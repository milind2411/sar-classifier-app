# SAR Vessel/Iceberg Classifier — Backend

FastAPI backend serving a dual-branch ResNet50 SAR classifier (image branch +
incidence-angle branch) via ONNX Runtime.

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Before running: place your artifacts

- `models/sar_classifier.onnx` — your exported ONNX model
- `data/sample_chips/*.npy` — your 6 exported sample chips (ship_1.npy, ..., iceberg_3.npy)

These are NOT included in this scaffold — copy them in from your Kaggle exports.

## Run the API

```bash
uvicorn main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` for interactive Swagger docs, where you can
test `/api/predict` directly in the browser before wiring up the frontend.

## Run tests

```bash
pytest tests/test_predict.py -v
```

Tests will `skip` (not fail) if sample chips aren't in place yet — that's a
signal to copy them in, not a real failure.

## API Endpoints

### `POST /api/predict`
Classify a single chip.

Request body:
```json
{
  "band_1": [/* 5625 floats, raw HH band */],
  "band_2": [/* 5625 floats, raw HV band */],
  "inc_angle": 40.2
}
```

Response:
```json
{
  "probability_iceberg": 0.87,
  "predicted_class": "iceberg",
  "confidence": 0.87
}
```

### `POST /api/predict/angle-sweep`
Re-run inference across a range of incidence angles on the same chip (image
content fixed), powering the angle-sensitivity chart. `angles` is optional
and defaults to 30-46 degrees in steps of 2.

Request body:
```json
{
  "band_1": [/* 5625 floats */],
  "band_2": [/* 5625 floats */],
  "angles": [30, 34, 38, 42, 46]
}
```

### `POST /api/predict/gradcam`
Explainability heatmap showing which spatial regions most influenced the prediction. Class-aware gradient backpropagation targets the `conv3_block4_3_conv` layer ($10\times10$ spatial grid), producing vibrant heatmaps for both ships and icebergs.

Background pre-warming runs asynchronously during server startup (`main.py` lifespan via `loop.run_in_executor()`), eliminating first-call latency penalties while keeping server startup fast and non-blocking. Rate-limited to 10 requests/minute per client IP.

Request body: same shape as `/api/predict`.

Response:
```json
{
  "heatmap": [[0.02, 0.05, ...], ...],  // 75x75 grid, values in [0, 1]
  "layer_used": "conv3_block4_3_conv"
}
```

### `POST /api/predict/compare`
Multi-model evaluation benchmarking the ResNet50 deep learning model against the classical ML baseline (49 Haralick GLCM textures & clutter moments + calibrated XGBoost classifier). Rate-limited to 10 requests/minute.

Response:
```json
{
  "resnet": { "probability_iceberg": 0.012, "predicted_class": "ship", "confidence": 0.988, "latency_ms": 38.2 },
  "xgboost": { "probability_iceberg": 0.045, "predicted_class": "ship", "confidence": 0.955, "latency_ms": 14.1 },
  "consensus": { "agreement": true, "lead_model": "resnet50", "confidence_delta": 0.033, "status_text": "High Confidence Agreement" },
  "radar_telemetry": { "target_to_clutter_ratio_db": 12.4, "enl_filtered": 8.7, "speckle_reduction_pct": 36.2 },
  "texture_highlights": { "glcm_contrast": 0.42, "glcm_homogeneity": 0.88, "skewness": 2.1, "kurtosis": 7.4 }
}
```

### `POST /api/predict/upload`
Direct binary `.npz` or JSON chip file ingestion (enforces a strict 2MB ceiling, returns HTTP 413 on oversized payloads, and rejects object deserialization to eliminate RCE risks).

### `POST /api/predict/batch`
Batch inference processing up to 50 chips per call with atomic index-level error reporting. Rate-limited to 5 requests/minute.

### `GET /api/history`
Retrieves recent prediction audit records persisted in SQLite (`predictions.db`), ordered newest-first and capped at 200 records.

## Architecture Notes

- `preprocessing/sar_preprocessing.py` is the **single source of truth** for transforming raw radar bands into normalized input tensors. Do not duplicate this logic anywhere else (including frontend) — any drift will invalidate predictions.
- `inference.py` loads the ONNX session once (singleton pattern).
- `xgb_inference.py` provides singleton inference for the 49-feature classical ML baseline model (`backend/models/xgb_baseline.json`).
- `gradcam.py` loads TensorFlow & `best_resnet_fusion.keras` in background on startup for instant class-aware attention maps.
- `preprocessing/radar_telemetry.py` calculates Target-to-Clutter Ratio (TCR in dB) and clutter-annulus Equivalent Number of Looks (ENL) to quantify physical radar quality.
- Rate limiting via `slowapi` protects gradient and feature extraction endpoints against denial-of-service.
