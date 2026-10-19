"""
XGBoost inference service for classical SAR baseline classification.

Loads backend/models/xgb_baseline.json once as a singleton.
Accepts raw band_1, band_2, inc_angle, extracts 49 GLCM + statistical features,
and runs low-latency inference (<2ms on CPU).
"""

import threading
from pathlib import Path
import time
from typing import Dict, List, Optional, Tuple
import numpy as np
import xgboost as xgb

from inference import classify
from logging_config import get_logger
from preprocessing.feature_extraction import (
    extract_features_dict,
    extract_features_vector,
    get_feature_names
)

MODEL_PATH = Path(__file__).parent / "models" / "xgb_baseline.json"
EPSILON = 1e-7

logger = get_logger("xgb_inference")


class XGBoostBaselineClassifier:
    _booster: Optional[xgb.Booster] = None
    _feature_names: Optional[List[str]] = None
    _lock = threading.Lock()

    @classmethod
    def get_booster(cls) -> xgb.Booster:
        # 1. Fast path: return existing booster without acquiring lock
        if cls._booster is None:
            # 2. Acquire lock to serialize initialization
            with cls._lock:
                # 3. Double-check inside lock
                if cls._booster is None:
                    if not MODEL_PATH.exists():
                        raise FileNotFoundError(
                            f"XGBoost baseline model not found at {MODEL_PATH}. "
                            "Make sure xgb_baseline.json exists in backend/models/."
                        )
                    logger.info("Loading XGBoost baseline model from %s...", MODEL_PATH.name)
                    booster = xgb.Booster()
                    booster.load_model(str(MODEL_PATH))
                    cls._feature_names = get_feature_names()
                    cls._booster = booster
                    logger.info("XGBoost baseline model loaded successfully with %d features.", len(cls._feature_names))
        return cls._booster

    @classmethod
    def predict(
        cls,
        band_1: List[float],
        band_2: List[float],
        inc_angle: float
    ) -> Tuple[float, str, float, float, Dict[str, float]]:
        """
        Classify a SAR chip with the GLCM + XGBoost baseline model.

        Returns:
            prob_iceberg: float in [0, 1]
            predicted_class: 'iceberg' or 'ship'
            confidence: float in [0.5, 1.0]
            latency_ms: float execution time in milliseconds
            features: dict of all 49 extracted classical features
        """
        booster = cls.get_booster()
        t0 = time.perf_counter()

        feats_dict = extract_features_dict(band_1, band_2, inc_angle)
        feat_vector = np.array(list(feats_dict.values()), dtype=np.float32).reshape(1, -1)

        dmatrix = xgb.DMatrix(feat_vector, feature_names=[f"f{i}" for i in range(len(feats_dict))])
        raw_prob = float(booster.predict(dmatrix)[0])
        prob = float(np.clip(raw_prob, EPSILON, 1.0 - EPSILON))

        latency_ms = (time.perf_counter() - t0) * 1000.0

        predicted_class, confidence = classify(prob)

        return prob, predicted_class, confidence, latency_ms, feats_dict


# Alias for consistent architectural naming
XGBoostService = XGBoostBaselineClassifier

