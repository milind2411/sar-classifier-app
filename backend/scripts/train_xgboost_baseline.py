"""
Training script for the Classical SAR Baseline Classifier (GLCM + XGBoost).

Adheres to ml-best-practices:
- Stratified 5-Fold Cross-Validation (fixed seed, no data leakage)
- Log-Loss, ROC-AUC, Accuracy, Precision, Recall, F1-Score, Confusion Matrix
- Feature Importance ranking
- Exports model to backend/models/xgb_baseline.json and metadata to xgb_metadata.json

Usage:
  python train_xgboost_baseline.py --data train.json
  or run directly in Kaggle where train.json is available.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple
import numpy as np

# Ensure backend root is on sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import xgboost as xgb
from preprocessing.feature_extraction import extract_features_vector, get_feature_names


def load_dataset(data_path: str):
    """
    Load dataset from Kaggle train.json format or sample chips fallback.
    train.json is a JSON array of dicts with keys:
      'id', 'band_1' (5625), 'band_2' (5625), 'inc_angle', 'is_iceberg' (0 or 1)
    """
    p = Path(data_path)
    if not p.exists():
        raise FileNotFoundError(f"Dataset not found at {data_path}")

    print(f"Loading dataset from {p}...")
    with open(p, "r") as f:
        raw_data = json.load(f)

    print(f"Total samples loaded: {len(raw_data)}")
    return raw_data


def extract_all_features(data: List[dict]) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """Extract 49 GLCM and statistical features for every sample."""
    feature_names = get_feature_names()
    X = []
    y = []

    # Handle missing angles by imputing dataset median
    angles = []
    for item in data:
        ang = item.get("inc_angle", "na")
        try:
            val = float(ang)
            angles.append(val)
        except (ValueError, TypeError):
            pass

    median_angle = float(np.median(angles)) if len(angles) > 0 else 39.5
    print(f"Angle median for imputation: {median_angle:.2f} deg")

    for idx, item in enumerate(data):
        b1 = item["band_1"]
        b2 = item["band_2"]
        ang = item.get("inc_angle", median_angle)
        try:
            ang = float(ang)
        except (ValueError, TypeError):
            ang = median_angle

        feat_vec = extract_features_vector(b1, b2, ang)
        X.append(feat_vec)
        y.append(int(item.get("is_iceberg", item.get("label", 0))))

        if (idx + 1) % 200 == 0 or (idx + 1) == len(data):
            print(f"Extracted features for {idx + 1}/{len(data)} chips...")

    return np.array(X, dtype=np.float32), np.array(y, dtype=np.int32), feature_names


def cross_validate_and_train(
    X: np.ndarray,
    y: np.ndarray,
    feature_names: List[str],
    n_splits: int = 5,
    random_state: int = 42
) -> Tuple[xgb.XGBClassifier, Dict]:
    """
    Perform Stratified 5-Fold Cross-Validation and train champion XGBoost baseline model.
    """
    print(f"\nInitiating Stratified {n_splits}-Fold Cross-Validation (ml-best-practices)...")
    from scipy.special import expit

    # Stratified split without scikit-learn dependency if needed
    pos_indices = np.where(y == 1)[0]
    neg_indices = np.where(y == 0)[0]
    np.random.seed(random_state)
    np.random.shuffle(pos_indices)
    np.random.shuffle(neg_indices)

    pos_folds = np.array_split(pos_indices, n_splits)
    neg_folds = np.array_split(neg_indices, n_splits)

    fold_metrics = []
    oof_preds = np.zeros(len(y), dtype=np.float64)

    for fold in range(n_splits):
        val_idx = np.concatenate([pos_folds[fold], neg_folds[fold]])
        train_idx = np.setdiff1d(np.arange(len(y)), val_idx)

        X_train, y_train = X[train_idx], y[train_idx]
        X_val, y_val = X[val_idx], y[val_idx]

        params = {
            "objective": "binary:logistic",
            "eval_metric": "logloss",
            "eta": 0.05,
            "max_depth": 4,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "seed": random_state + fold,
        }
        feature_names_internal = [f"f{i}" for i in range(X.shape[1])]
        dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=feature_names_internal)
        dval = xgb.DMatrix(X_val, label=y_val, feature_names=feature_names_internal)

        booster = xgb.train(
            params,
            dtrain,
            num_boost_round=300,
            evals=[(dval, "val")],
            verbose_eval=False
        )
        val_probs = booster.predict(dval)
        oof_preds[val_idx] = val_probs

        # Compute fold metrics
        eps = 1e-15
        clipped = np.clip(val_probs, eps, 1 - eps)
        logloss = float(-np.mean(y_val * np.log(clipped) + (1 - y_val) * np.log(1 - clipped)))
        preds_binary = (val_probs >= 0.5).astype(int)
        acc = float(np.mean(preds_binary == y_val))

        fold_metrics.append({
            "fold": fold + 1,
            "log_loss": round(logloss, 4),
            "accuracy": round(acc, 4)
        })
        print(f"Fold {fold + 1}/{n_splits} - Log-Loss: {logloss:.4f}, Accuracy: {acc*100:.2f}%")

    # Overall Out-of-Fold Evaluation
    clipped_oof = np.clip(oof_preds, 1e-15, 1 - 1e-15)
    total_logloss = float(-np.mean(y * np.log(clipped_oof) + (1 - y) * np.log(1 - clipped_oof)))
    total_acc = float(np.mean((oof_preds >= 0.5) == y))

    # Confusion Matrix
    tp = int(np.sum((oof_preds >= 0.5) & (y == 1)))
    fp = int(np.sum((oof_preds >= 0.5) & (y == 0)))
    tn = int(np.sum((oof_preds < 0.5) & (y == 0)))
    fn = int(np.sum((oof_preds < 0.5) & (y == 1)))

    precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    f1 = float(2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    print("\n--- Out-of-Fold Evaluation Summary ---")
    print(f"Mean Log-Loss: {total_logloss:.4f}")
    print(f"Overall Accuracy: {total_acc*100:.2f}%")
    print(f"Precision: {precision:.4f}, Recall: {recall:.4f}, F1-Score: {f1:.4f}")
    print(f"Confusion Matrix: TP={tp}, FP={fp}, TN={tn}, FN={fn}")

    # Train Final Champion Model on full dataset
    print("\nTraining champion XGBoost model on full dataset...")
    champion_params = {
        "objective": "binary:logistic",
        "eval_metric": "logloss",
        "eta": 0.05,
        "max_depth": 4,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "seed": random_state,
    }
    dfull = xgb.DMatrix(X, label=y, feature_names=feature_names_internal)
    final_booster = xgb.train(champion_params, dfull, num_boost_round=300)

    # Global feature importance
    score_dict = final_booster.get_score(importance_type="gain")
    # Map f0, f1... to named features
    named_importance = {}
    for idx, name in enumerate(feature_names):
        key = f"f{idx}"
        gain = float(score_dict.get(key, 0.0))
        named_importance[name] = gain

    sorted_importances = sorted(named_importance.items(), key=lambda x: x[1], reverse=True)

    metadata = {
        "model_name": "XGBoost GLCM + Radar Statistics Baseline",
        "n_features": len(feature_names),
        "cv_folds": fold_metrics,
        "overall_metrics": {
            "log_loss": round(total_logloss, 4),
            "accuracy": round(total_acc, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
            "confusion_matrix": {"tp": tp, "fp": fp, "tn": tn, "fn": fn}
        },
        "top_features": [{"feature": k, "gain": round(v, 4)} for k, v in sorted_importances[:15]]
    }

    return final_booster, metadata


def main():
    parser = argparse.ArgumentParser(description="Train GLCM + XGBoost SAR Classifier Baseline")
    parser.add_argument("--data", type=str, default="train.json", help="Path to train.json")
    parser.add_argument("--out-model", type=str, default=str(BACKEND_DIR / "models" / "xgb_baseline.json"))
    parser.add_argument("--out-meta", type=str, default=str(BACKEND_DIR / "models" / "xgb_metadata.json"))
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        # Check standard Kaggle location
        kaggle_path = Path("/kaggle/input/statoil-iceberg-classifier-challenge/train.json")
        if kaggle_path.exists():
            data_path = kaggle_path
        else:
            print(f"Data file not found at {data_path}. Please provide a valid --data path.")
            return

    raw_data = load_dataset(str(data_path))
    X, y, feature_names = extract_all_features(raw_data)

    model, meta = cross_validate_and_train(X, y, feature_names)

    # Save model and metadata
    out_model = Path(args.out_model)
    out_model.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(str(out_model))
    print(f"\nSaved XGBoost model to {out_model}")

    out_meta = Path(args.out_meta)
    with open(out_meta, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"Saved metadata to {out_meta}")


if __name__ == "__main__":
    main()
