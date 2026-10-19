import io
import json
import math
import time
from pathlib import Path

import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile, Request, Response

from schemas import (
    ChipInput, PredictionOutput, AngleSweepInput, AngleSweepOutput,
    AngleSweepPoint, GradCamOutput, ModelComparisonOutput,
    ModelPredictionResult, ModelConsensus, RadarTextureHighlights,
    RadarQualityTelemetry, BatchChipInput, BatchPredictionOutput,
    PredictionHistoryItem
)
from inference import SARClassifier, DEFAULT_SWEEP_ANGLES
from gradcam import GradCamService
from xgb_inference import XGBoostBaselineClassifier
from preprocessing.radar_telemetry import extract_radar_quality_telemetry
from history import log_prediction, get_history, is_history_enabled
from limiter import limiter
from logging_config import get_logger

logger = get_logger("router.predict")


def _extract_telemetry_obj(band_1: list, band_2: list) -> RadarQualityTelemetry | None:
    """Helper to safely build RadarQualityTelemetry without repeating error handling or threshold rules."""
    try:
        data = extract_radar_quality_telemetry(band_1, band_2)
        return RadarQualityTelemetry(**data)
    except Exception:
        return None

router = APIRouter()

MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024  # 2MB limit (typical chips are ~46KB .npz or ~200KB .json)


@router.post("/predict", response_model=PredictionOutput)
def predict(chip: ChipInput):
    """
    Classify a single SAR chip as ship or iceberg.
    Expects raw (unfiltered) band_1/band_2 arrays and the true incidence angle.
    """
    logger.info("Single chip prediction requested (inc_angle=%.2f°)", chip.inc_angle)
    try:
        prob, predicted_class, confidence = SARClassifier.predict(
            chip.band_1, chip.band_2, chip.inc_angle
        )
    except FileNotFoundError as e:
        logger.error("Prediction failed - model file missing: %s", e)
        raise HTTPException(status_code=503, detail="Model file not found; see README for setup")
    except Exception as e:
        logger.warning("Prediction calculation failed: %s", e)
        raise HTTPException(status_code=400, detail=f"Prediction failed: {e}")

    telemetry_obj = _extract_telemetry_obj(chip.band_1, chip.band_2)

    log_prediction(
        predicted_class=predicted_class,
        probability_iceberg=prob,
        confidence=confidence,
        inc_angle=chip.inc_angle,
        model_used="resnet50",
        source="predict",
    )

    logger.info("Single prediction completed: class=%s, prob=%.4f, conf=%.4f", predicted_class, prob, confidence)

    return PredictionOutput(
        probability_iceberg=prob,
        predicted_class=predicted_class,
        confidence=confidence,
        telemetry=telemetry_obj,
    )


@router.post("/predict/batch", response_model=BatchPredictionOutput)
@limiter.limit("5/minute")
def predict_batch(request: Request, response: Response, payload: BatchChipInput):
    """
    Classify a batch of SAR chips as ship or iceberg (capped at 50 chips).
    Loops over incoming chips, delegating to existing SARClassifier.predict().
    If any single chip fails, returns HTTP 400 identifying the failing index.
    """
    logger.info("Batch prediction requested for %d chips", len(payload.chips))
    results = []
    for idx, chip in enumerate(payload.chips):
        try:
            prob, predicted_class, confidence = SARClassifier.predict(
                chip.band_1, chip.band_2, chip.inc_angle
            )
        except FileNotFoundError as e:
            logger.error("Batch prediction failed at index %d - model missing: %s", idx, e)
            raise HTTPException(status_code=503, detail="Model file not found; see README for setup")
        except Exception as e:
            logger.warning("Batch prediction failed at index %d: %s", idx, e)
            raise HTTPException(status_code=400, detail=f"Prediction failed at index {idx}: {e}")

        telemetry_obj = _extract_telemetry_obj(chip.band_1, chip.band_2)

        log_prediction(
            predicted_class=predicted_class,
            probability_iceberg=prob,
            confidence=confidence,
            inc_angle=chip.inc_angle,
            model_used="resnet50",
            source="batch",
        )

        results.append(
            PredictionOutput(
                probability_iceberg=prob,
                predicted_class=predicted_class,
                confidence=confidence,
                telemetry=telemetry_obj,
            )
        )

    logger.info("Batch prediction completed successfully for %d chips", len(results))
    return BatchPredictionOutput(results=results)


@router.post("/predict/upload", response_model=PredictionOutput)
async def predict_upload(file: UploadFile = File(...)):
    """
    Classify a SAR chip uploaded as a raw file (.json or .npz).
    Extracts band_1, band_2, and inc_angle, delegating prediction to SARClassifier.predict().
    Rejects unsupported extensions, payloads exceeding MAX_UPLOAD_SIZE_BYTES (HTTP 413),
    or malformed payloads with HTTP 400.
    """
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()
    logger.info("File upload prediction requested (format='%s')", ext)

    if ext not in [".json", ".npz"]:
        logger.warning("Upload rejected: unsupported file extension '%s'", ext)
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension '{ext}'. Supported formats: .json, .npz",
        )

    # Check file size before reading full payload into memory
    file_size = file.size
    if file_size is None:
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)

    if file_size > MAX_UPLOAD_SIZE_BYTES:
        logger.warning("Upload rejected: payload (%d bytes, format='%s') exceeds 2MB limit", file_size, ext)
        raise HTTPException(
            status_code=413,
            detail=(
                f"File size exceeds maximum limit of {MAX_UPLOAD_SIZE_BYTES} bytes (2MB). "
                f"Received: {file_size} bytes."
            ),
        )

    try:
        contents = await file.read()
    except Exception as e:
        logger.warning("Upload rejected: failed to read payload (format='%s'): %s", ext, e)
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {e}")

    if ext == ".json":
        try:
            data = json.loads(contents.decode("utf-8"))
        except Exception as e:
            logger.warning("Upload rejected: malformed JSON: %s", e)
            raise HTTPException(status_code=400, detail=f"Malformed JSON file: {e}")
    else:  # .npz
        try:
            with np.load(io.BytesIO(contents)) as npz:
                data = {k: npz[k] for k in npz.files}
        except Exception as e:
            logger.warning("Upload rejected: malformed .npz: %s", e)
            raise HTTPException(status_code=400, detail=f"Failed to parse .npz file: {e}")

    if not isinstance(data, dict):
        logger.warning("Upload rejected: payload is not a dictionary (format='%s')", ext)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file payload: expected a dictionary/object, got {type(data).__name__}",
        )

    missing_fields = [f for f in ["band_1", "band_2", "inc_angle"] if f not in data]
    if missing_fields:
        logger.warning("Upload rejected: missing fields %s (format='%s')", missing_fields, ext)
        raise HTTPException(
            status_code=400,
            detail=f"Missing required field(s): {', '.join(missing_fields)}",
        )

    band_1 = data["band_1"]
    band_2 = data["band_2"]
    inc_angle_val = data["inc_angle"]

    if hasattr(band_1, "tolist"):
        band_1 = band_1.tolist()
    if hasattr(band_2, "tolist"):
        band_2 = band_2.tolist()

    if not isinstance(band_1, (list, tuple)) or len(band_1) != 5625:
        length_str = str(len(band_1)) if hasattr(band_1, "__len__") else "non-sequence"
        logger.warning("Upload rejected: invalid band_1 length (%s, format='%s')", length_str, ext)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid length for band_1: expected 5625 floats, got {length_str}",
        )

    if not isinstance(band_2, (list, tuple)) or len(band_2) != 5625:
        length_str = str(len(band_2)) if hasattr(band_2, "__len__") else "non-sequence"
        logger.warning("Upload rejected: invalid band_2 length (%s, format='%s')", length_str, ext)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid length for band_2: expected 5625 floats, got {length_str}",
        )

    try:
        band_1 = [float(x) for x in band_1]
        band_2 = [float(x) for x in band_2]
    except (ValueError, TypeError) as e:
        logger.warning("Upload rejected: non-numerical band data (format='%s'): %s", ext, e)
        raise HTTPException(
            status_code=400,
            detail=f"Band arrays must contain numerical values: {e}",
        )

    if any(not math.isfinite(x) for x in band_1) or any(not math.isfinite(x) for x in band_2):
        logger.warning("Upload rejected: non-finite (NaN/Inf) band data (format='%s')", ext)
        raise HTTPException(
            status_code=400,
            detail="Band array values must be finite numbers (NaN and Infinity are not permitted)",
        )

    try:
        inc_angle = float(inc_angle_val)
    except (ValueError, TypeError) as e:
        logger.warning("Upload rejected: invalid angle (format='%s'): %s", ext, e)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid incidence angle: {e}",
        )

    if not math.isfinite(inc_angle) or not (0.0 <= inc_angle <= 90.0):
        logger.warning("Upload rejected: angle %s out of bounds (format='%s')", inc_angle_val, ext)
        raise HTTPException(
            status_code=400,
            detail=f"Incidence angle {inc_angle_val} out of valid range [0, 90] degrees",
        )

    try:
        prob, predicted_class, confidence = SARClassifier.predict(
            band_1, band_2, inc_angle
        )
    except FileNotFoundError as e:
        logger.error("Upload prediction failed - model missing: %s", e)
        raise HTTPException(status_code=503, detail="Model file not found; see README for setup")
    except Exception as e:
        logger.warning("Upload prediction calculation failed: %s", e)
        raise HTTPException(status_code=400, detail=f"Prediction failed: {e}")

    telemetry_obj = _extract_telemetry_obj(band_1, band_2)

    log_prediction(
        predicted_class=predicted_class,
        probability_iceberg=prob,
        confidence=confidence,
        inc_angle=inc_angle,
        model_used="resnet50",
        source="upload",
    )

    logger.info(
        "File upload prediction completed: filename='%s', class=%s, prob=%.4f, conf=%.4f",
        filename, predicted_class, prob, confidence
    )

    return PredictionOutput(
        probability_iceberg=prob,
        predicted_class=predicted_class,
        confidence=confidence,
        telemetry=telemetry_obj,
    )


@router.get("/history", response_model=list[PredictionHistoryItem])
def history(limit: int = 50):
    """
    Retrieve recent prediction history (default limit 50, capped at 200).
    Returns 404 if history collection/retrieval is disabled via HISTORY_ENABLED=false.
    """
    if not is_history_enabled():
        raise HTTPException(status_code=404, detail="Prediction history is disabled on this deployment")

    capped_limit = min(max(1, limit), 200)
    logger.info("Prediction history requested (limit=%d)", capped_limit)
    return get_history(limit=capped_limit)



@router.post("/predict/angle-sweep", response_model=AngleSweepOutput)
def angle_sweep(payload: AngleSweepInput):
    """
    Sweep the incidence angle input across a range (default 30-46 degrees,
    step 2) while holding the chip's image content fixed. Powers the
    interactive angle-sensitivity chart in the frontend.
    """
    num_angles = len(payload.angles) if payload.angles else len(DEFAULT_SWEEP_ANGLES)
    logger.info("Angle sweep requested for %d angles", num_angles)
    try:
        points = SARClassifier.angle_sweep(payload.band_1, payload.band_2, payload.angles)
    except FileNotFoundError as e:
        logger.error("Angle sweep failed - model missing: %s", e)
        raise HTTPException(status_code=503, detail="Model file not found; see README for setup")
    except Exception as e:
        logger.warning("Angle sweep failed: %s", e)
        raise HTTPException(status_code=400, detail=f"Angle sweep failed: {e}")

    logger.info("Angle sweep completed successfully (%d points evaluated)", len(points))
    return AngleSweepOutput(
        points=[AngleSweepPoint(**p) for p in points]
    )


@router.post("/predict/gradcam", response_model=GradCamOutput)
@limiter.limit("10/minute")
def gradcam(request: Request, response: Response, chip: ChipInput):
    """
    Compute a Grad-CAM explainability heatmap for a chip, showing which
    regions of the image most influenced the model's prediction.
    """
    logger.info("Grad-CAM requested (inc_angle=%.2f°)", chip.inc_angle)
    try:
        heatmap, layer_used = GradCamService.compute_heatmap(
            chip.band_1, chip.band_2, chip.inc_angle
        )
    except FileNotFoundError as e:
        logger.error("Grad-CAM failed - Keras model missing: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Grad-CAM model file not found; see README for setup (Grad-CAM is optional)",
        )
    except Exception as e:
        logger.warning("Grad-CAM computation failed: %s", e)
        raise HTTPException(status_code=400, detail=f"Grad-CAM failed: {e}")

    logger.info("Grad-CAM heatmap computed successfully using layer '%s'", layer_used)
    return GradCamOutput(
        heatmap=heatmap.tolist(),
        layer_used=layer_used,
    )


@router.post("/predict/compare", response_model=ModelComparisonOutput)
@limiter.limit("10/minute")
def compare_models(request: Request, response: Response, chip: ChipInput):
    """
    Run multi-model comparison: ResNet50 Deep Learning vs. GLCM + XGBoost Baseline.
    Evaluates agreement, probability delta, inference latencies, and radar texture highlights.
    """
    logger.info("Multi-model comparison requested (inc_angle=%.2f°)", chip.inc_angle)
    # 1. ResNet50 Inference
    try:
        t0_resnet = time.perf_counter()
        resnet_prob, resnet_class, resnet_conf = SARClassifier.predict(
            chip.band_1, chip.band_2, chip.inc_angle
        )
        resnet_latency_ms = (time.perf_counter() - t0_resnet) * 1000.0
    except FileNotFoundError as e:
        logger.error("Model comparison failed - ResNet model missing: %s", e)
        raise HTTPException(status_code=503, detail="Model file not found; see README for setup")
    except Exception as e:
        logger.warning("Model comparison failed - ResNet inference error: %s", e)
        raise HTTPException(status_code=400, detail=f"ResNet prediction failed: {e}")

    # 2. XGBoost Baseline Inference
    try:
        xgb_prob, xgb_class, xgb_conf, xgb_latency_ms, feats = XGBoostBaselineClassifier.predict(
            chip.band_1, chip.band_2, chip.inc_angle
        )
    except FileNotFoundError as e:
        logger.error("Model comparison failed - XGBoost baseline missing: %s", e)
        raise HTTPException(status_code=503, detail="Model file not found; see README for setup")
    except Exception as e:
        logger.warning("Model comparison failed - XGBoost inference error: %s", e)
        raise HTTPException(status_code=400, detail=f"XGBoost prediction failed: {e}")

    # 3. Model Consensus Calculation
    agreement = (resnet_class == xgb_class)
    consensus_class = resnet_class if agreement else "divergent"
    conf_delta = abs(resnet_prob - xgb_prob)
    lead_model = "ResNet50 Deep Learning" if resnet_conf >= xgb_conf else "GLCM + XGBoost Baseline"

    # 4. Extract Key Physical Texture Highlights
    texture_highlights = RadarTextureHighlights(
        hh_contrast=round(feats.get("hh_glcm_contrast_d1", 0.0), 4),
        hh_homogeneity=round(feats.get("hh_glcm_homogeneity_d1", 0.0), 4),
        hh_skewness=round(feats.get("hh_skewness", 0.0), 4),
        hv_contrast=round(feats.get("hv_glcm_contrast_d1", 0.0), 4),
        hv_homogeneity=round(feats.get("hv_glcm_homogeneity_d1", 0.0), 4),
        diff_skewness=round(feats.get("diff_skewness", 0.0), 4),
    )

    top_classical = {
        "hh_glcm_energy_d2": round(feats.get("hh_glcm_energy_d2", 0.0), 4),
        "hh_glcm_energy_d1": round(feats.get("hh_glcm_energy_d1", 0.0), 4),
        "hh_skewness": round(feats.get("hh_skewness", 0.0), 4),
        "hv_kurtosis": round(feats.get("hv_kurtosis", 0.0), 4),
        "hv_glcm_contrast_d2": round(feats.get("hv_glcm_contrast_d2", 0.0), 4),
        "hh_peak_to_mean": round(feats.get("hh_peak_to_mean", 0.0), 4),
        "inc_angle": round(chip.inc_angle, 2),
    }

    telemetry_obj = _extract_telemetry_obj(chip.band_1, chip.band_2)

    logger.info(
        "Model comparison completed: resnet=%s (prob=%.4f), xgboost=%s (prob=%.4f), agreement=%s",
        resnet_class, resnet_prob, xgb_class, xgb_prob, agreement
    )

    return ModelComparisonOutput(
        resnet=ModelPredictionResult(
            model_name="ResNet50 Deep Learning",
            model_type="deep_learning",
            probability_iceberg=round(resnet_prob, 4),
            predicted_class=resnet_class,
            confidence=round(resnet_conf, 4),
            latency_ms=round(resnet_latency_ms, 2),
        ),
        xgboost=ModelPredictionResult(
            model_name="GLCM + XGBoost Baseline",
            model_type="classical_ml",
            probability_iceberg=round(xgb_prob, 4),
            predicted_class=xgb_class,
            confidence=round(xgb_conf, 4),
            latency_ms=round(xgb_latency_ms, 2),
        ),
        consensus=ModelConsensus(
            agreement=agreement,
            consensus_class=consensus_class,
            confidence_delta=round(conf_delta, 4),
            lead_model=lead_model,
        ),
        texture_highlights=texture_highlights,
        top_classical_features=top_classical,
        telemetry=telemetry_obj,
    )
