"""
Integration tests for the /predict and /predict/angle-sweep endpoints.

These use the REAL sar_classifier.onnx model and the 6 sample chips
exported from Kaggle (backend/data/sample_chips/*.npz), so they only
pass once both are in place — this is intentional. A green run here
means your model, preprocessing, and API are all wired correctly
end-to-end before you ever touch the frontend.

Run with:
    cd backend
    pytest tests/test_predict.py -v
"""

import sys
import time
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient


sys.path.insert(0, str(Path(__file__).parent.parent))
from main import app  # noqa: E402

client = TestClient(app)

SAMPLES_DIR = Path(__file__).parent.parent / "data" / "sample_chips"
MODELS_DIR = Path(__file__).parent.parent / "models"
ONNX_MODEL_PATH = MODELS_DIR / "sar_classifier.onnx"
XGB_MODEL_PATH = MODELS_DIR / "xgb_baseline.json"
KERAS_MODEL_PATH = MODELS_DIR / "best_resnet_fusion.keras"


def require_onnx_model():
    if not ONNX_MODEL_PATH.exists():
        pytest.skip(f"ONNX model not found at {ONNX_MODEL_PATH}; skipping test.")


def require_xgboost_model():
    if not XGB_MODEL_PATH.exists():
        pytest.skip(f"XGBoost baseline model not found at {XGB_MODEL_PATH}; skipping test.")


def require_keras_model():
    if not KERAS_MODEL_PATH.exists():
        pytest.skip(f"Grad-CAM Keras model not found at {KERAS_MODEL_PATH}; skipping test.")



def load_sample(filename: str) -> dict:
    path = SAMPLES_DIR / filename
    if not path.exists():
        pytest.skip(f"Sample chip not found: {path}. Copy your exported .npz files into backend/data/sample_chips/.")
    with np.load(path) as data:
        return {
            "band_1": data["band_1"],
            "band_2": data["band_2"],
            "inc_angle": float(data["inc_angle"]),
            "label": int(data["label"]) if "label" in data else 0,
        }


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_cors_allowed_origin():
    """Verify requests with an allowed Origin header receive access-control-allow-origin back."""
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_disallowed_origin():
    """Verify requests with a non-matching Origin header do not receive access-control-allow-origin."""
    response = client.get("/health", headers={"Origin": "http://untrusted-domain.com"})
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize("filename,expected_label", [
    ("ship_1.npz", 0),
    ("ship_2.npz", 0),
    ("ship_3.npz", 0),
    ("iceberg_1.npz", 1),
    ("iceberg_2.npz", 1),
    ("iceberg_3.npz", 1),
])
def test_predict_matches_known_label(filename, expected_label):
    require_onnx_model()
    sample = load_sample(filename)

    response = client.post("/api/predict", json={
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
        "inc_angle": sample["inc_angle"],
    })

    assert response.status_code == 200
    body = response.json()

    assert 0.0 <= body["probability_iceberg"] <= 1.0
    assert body["predicted_class"] in ("ship", "iceberg")
    assert "telemetry" in body
    assert body["telemetry"] is not None
    assert isinstance(body["telemetry"]["target_to_clutter_ratio_db"], (float, int))

    predicted_label = 1 if body["predicted_class"] == "iceberg" else 0
    assert predicted_label == expected_label, (
        f"{filename}: expected label {expected_label}, got {predicted_label} "
        f"(prob={body['probability_iceberg']:.4f}). This may be a genuine "
        f"model error on a hard example, not necessarily a pipeline bug — "
        f"check probability_iceberg's distance from 0.5 before assuming a bug."
    )


def test_angle_sweep_returns_default_range():
    require_onnx_model()
    sample = load_sample("iceberg_1.npz")

    response = client.post("/api/predict/angle-sweep", json={
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
    })

    assert response.status_code == 200
    points = response.json()["points"]
    assert len(points) == 9  # 30..46 step 2
    assert points[0]["angle"] == 30.0
    assert points[-1]["angle"] == 46.0
    for p in points:
        assert 0.0 <= p["probability_iceberg"] <= 1.0


def test_predict_rejects_wrong_length_band():
    response = client.post("/api/predict", json={
        "band_1": [0.0] * 100,  # wrong length, should be 5625
        "band_2": [0.0] * 5625,
        "inc_angle": 40.0,
    })
    assert response.status_code == 422  # Pydantic validation error


def test_feature_extraction_dimension_and_validity():
    """Verify GLCM + Statistical moments produce exactly 49 valid numerical features."""
    from preprocessing.feature_extraction import extract_features_vector, get_feature_names

    sample = load_sample("ship_1.npz")
    vec = extract_features_vector(
        sample["band_1"].tolist(),
        sample["band_2"].tolist(),
        sample["inc_angle"]
    )
    names = get_feature_names()

    assert len(names) == 49
    assert vec.shape == (49,)
    assert not np.isnan(vec).any(), "Extracted features contain NaN"
    assert not np.isinf(vec).any(), "Extracted features contain Inf"


def test_xgboost_baseline_inference():
    """Verify singleton XGBoost inference runs and yields valid probabilities and low latency."""
    require_xgboost_model()
    from xgb_inference import XGBoostBaselineClassifier

    sample = load_sample("ship_1.npz")
    prob, pred_class, conf, latency_ms, feats = XGBoostBaselineClassifier.predict(
        sample["band_1"].tolist(),
        sample["band_2"].tolist(),
        sample["inc_angle"]
    )

    assert 0.0 <= prob <= 1.0
    assert pred_class in ("ship", "iceberg")
    assert 0.5 <= conf <= 1.0
    assert latency_ms < 500.0  # CPU execution < 500ms
    assert len(feats) == 49


@pytest.mark.parametrize("filename,expected_label", [
    ("ship_1.npz", 0),
    ("ship_2.npz", 0),
    ("ship_3.npz", 0),
    ("iceberg_1.npz", 1),
    ("iceberg_2.npz", 1),
    ("iceberg_3.npz", 1),
])
def test_predict_compare_matches_ground_truth(filename, expected_label):
    """Verify /api/predict/compare executes both models and generates consensus."""
    require_onnx_model()
    require_xgboost_model()
    sample = load_sample(filename)

    response = client.post("/api/predict/compare", json={
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
        "inc_angle": sample["inc_angle"],
    })

    assert response.status_code == 200
    data = response.json()

    # Validate schema fields
    assert "resnet" in data
    assert "xgboost" in data
    assert "consensus" in data
    assert "texture_highlights" in data
    assert "top_classical_features" in data

    # Verify both models
    resnet = data["resnet"]
    xgboost = data["xgboost"]
    consensus = data["consensus"]

    assert 0.0 <= resnet["probability_iceberg"] <= 1.0
    assert 0.0 <= xgboost["probability_iceberg"] <= 1.0
    assert resnet["latency_ms"] >= 0.0
    assert xgboost["latency_ms"] >= 0.0

    # Verify consensus and classification
    expected_class = "iceberg" if expected_label == 1 else "ship"
    assert resnet["predicted_class"] == expected_class
    assert consensus["agreement"] is True
    assert consensus["consensus_class"] == expected_class
    assert "telemetry" in data
    assert data["telemetry"] is not None
    assert isinstance(data["telemetry"]["target_to_clutter_ratio_db"], (float, int))


def test_radar_quality_telemetry_snr():
    """Verify radar telemetry calculation (SNR/TCR in dB, ENL, speckle reduction)."""
    require_onnx_model()
    sample = load_sample("ship_1.npz")
    response = client.post("/api/predict", json={
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
        "inc_angle": sample["inc_angle"],
    })
    assert response.status_code == 200
    telemetry = response.json()["telemetry"]
    assert telemetry is not None
    assert isinstance(telemetry["target_to_clutter_ratio_db"], float)
    assert telemetry["target_contrast_assessment"] in ("High Contrast Target", "Low Contrast / High Clutter")
    assert telemetry["speckle_reduction_pct"] > 0.0
    assert 5.0 <= telemetry["enl_filtered"] <= 30.0
    assert isinstance(telemetry["cross_pol_delta_db"], float)
    assert isinstance(telemetry["dynamic_range_db"], float)


def test_batch_predict_matches_individual_predict():
    """
    Verify /api/predict/batch loads all 6 sample chips, runs as a single batch,
    and returns outputs that match individual /api/predict calls exactly.
    """
    require_onnx_model()
    filenames = [
        "ship_1.npz",
        "ship_2.npz",
        "ship_3.npz",
        "iceberg_1.npz",
        "iceberg_2.npz",
        "iceberg_3.npz",
    ]

    chips_payload = []
    individual_responses = []

    for fn in filenames:
        sample = load_sample(fn)
        chip_dict = {
            "band_1": sample["band_1"].tolist(),
            "band_2": sample["band_2"].tolist(),
            "inc_angle": float(sample["inc_angle"]),
        }
        chips_payload.append(chip_dict)

        indiv_resp = client.post("/api/predict", json=chip_dict)
        assert indiv_resp.status_code == 200, f"Individual /api/predict failed for {fn}: {indiv_resp.text}"
        individual_responses.append(indiv_resp.json())

    batch_resp = client.post("/api/predict/batch", json={"chips": chips_payload})
    assert batch_resp.status_code == 200, f"Batch /api/predict/batch failed: {batch_resp.text}"
    batch_data = batch_resp.json()

    assert "results" in batch_data
    results = batch_data["results"]
    assert len(results) == len(filenames)

    for idx, (indiv, batch_item) in enumerate(zip(individual_responses, results)):
        assert batch_item["predicted_class"] == indiv["predicted_class"], (
            f"Class mismatch at index {idx} ({filenames[idx]}): "
            f"batch={batch_item['predicted_class']} vs indiv={indiv['predicted_class']}"
        )
        assert batch_item["probability_iceberg"] == pytest.approx(indiv["probability_iceberg"], abs=1e-6), (
            f"Probability mismatch at index {idx} ({filenames[idx]}): "
            f"batch={batch_item['probability_iceberg']} vs indiv={indiv['probability_iceberg']}"
        )
        assert batch_item["confidence"] == pytest.approx(indiv["confidence"], abs=1e-6), (
            f"Confidence mismatch at index {idx} ({filenames[idx]}): "
            f"batch={batch_item['confidence']} vs indiv={indiv['confidence']}"
        )


def test_batch_predict_caps_at_50_chips():
    """Verify batch endpoint rejects requests with >50 chips via Pydantic max_length."""
    sample = load_sample("ship_1.npz")
    chip_dict = {
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
        "inc_angle": float(sample["inc_angle"]),
    }
    oversized_payload = {"chips": [chip_dict] * 51}
    response = client.post("/api/predict/batch", json=oversized_payload)
    assert response.status_code == 422


def test_batch_predict_error_reports_failing_index(monkeypatch):
    """Verify that an inference failure at index i returns 400 identifying index i."""
    require_onnx_model()
    from inference import SARClassifier

    sample = load_sample("ship_1.npz")
    chip_dict = {
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
        "inc_angle": float(sample["inc_angle"]),
    }
    payload = {"chips": [chip_dict, chip_dict]}

    original_predict = SARClassifier.predict
    call_count = 0

    def mock_predict(b1, b2, angle):
        nonlocal call_count
        if call_count == 1:
            raise ValueError("Simulated tensor computation error")
        call_count += 1
        return original_predict(b1, b2, angle)

    monkeypatch.setattr(SARClassifier, "predict", mock_predict)
    response = client.post("/api/predict/batch", json=payload)
    assert response.status_code == 400
    assert "index 1" in response.json()["detail"]


def test_gradcam_prewarming_on_startup():
    """
    Verify GradCamService pre-warms the model in the background on app startup
    without calling the /api/predict/gradcam endpoint.
    """
    require_keras_model()
    from gradcam import GradCamService

    with TestClient(app):
        # Poll for background pre-warming to complete without calling /api/predict/gradcam
        start_time = time.time()
        while time.time() - start_time < 60.0:
            if GradCamService._model is not None:
                break
            time.sleep(0.5)

        assert GradCamService._model is not None, (
            "GradCamService._model should be non-None via background pre-warming on server startup"
        )


@pytest.mark.parametrize("filename", [
    "ship_1.npz",
    "ship_2.npz",
    "ship_3.npz",
    "iceberg_1.npz",
    "iceberg_2.npz",
    "iceberg_3.npz",
])
def test_predict_upload_matches_predict_for_all_sample_chips(filename):
    """
    Verify uploading .npz files via /api/predict/upload produces identical
    results to passing the raw parsed bands to /api/predict directly.
    """
    require_onnx_model()
    sample_path = SAMPLES_DIR / filename
    if not sample_path.exists():
        pytest.skip(f"Sample file not found: {sample_path}")

    sample = load_sample(filename)
    direct_resp = client.post("/api/predict", json={
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
        "inc_angle": float(sample["inc_angle"]),
    })
    assert direct_resp.status_code == 200
    direct_data = direct_resp.json()

    with open(sample_path, "rb") as f:
        upload_resp = client.post(
            "/api/predict/upload",
            files={"file": (filename, f, "application/octet-stream")}
        )

    assert upload_resp.status_code == 200, f"Upload failed for {filename}: {upload_resp.text}"
    upload_data = upload_resp.json()

    assert upload_data["predicted_class"] == direct_data["predicted_class"]
    assert upload_data["probability_iceberg"] == pytest.approx(direct_data["probability_iceberg"], abs=1e-6)
    assert upload_data["confidence"] == pytest.approx(direct_data["confidence"], abs=1e-6)


def test_predict_upload_valid_json():
    """Verify uploading a valid .json file to /api/predict/upload works correctly."""
    require_onnx_model()
    import json
    sample = load_sample("ship_1.npz")
    payload = {
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
        "inc_angle": float(sample["inc_angle"]),
    }
    json_bytes = json.dumps(payload).encode("utf-8")
    upload_resp = client.post(
        "/api/predict/upload",
        files={"file": ("test_chip.json", json_bytes, "application/json")}
    )
    assert upload_resp.status_code == 200
    assert upload_resp.json()["predicted_class"] == "ship"


def test_predict_upload_rejects_unsupported_extension():
    """Verify that unsupported extensions (e.g. .txt) return 400 naming the received and allowed formats."""
    upload_resp = client.post(
        "/api/predict/upload",
        files={"file": ("test.txt", b"plain text content", "text/plain")}
    )
    assert upload_resp.status_code == 400
    detail = upload_resp.json().get("detail", "")
    assert ".txt" in detail
    assert ".json" in detail and ".npz" in detail


def test_predict_upload_rejects_wrong_length_band_with_400():
    """Verify that a .json file with a wrong-length band array is rejected with 400, not 500."""
    import json
    payload = {
        "band_1": [0.0] * 100,  # Invalid length (expected 5625)
        "band_2": [0.0] * 5625,
        "inc_angle": 39.5,
    }
    json_bytes = json.dumps(payload).encode("utf-8")
    upload_resp = client.post(
        "/api/predict/upload",
        files={"file": ("invalid_chip.json", json_bytes, "application/json")}
    )
    assert upload_resp.status_code == 400
    detail = upload_resp.json().get("detail", "")
    assert "Invalid length for band_1" in detail or "5625" in detail


def test_predict_upload_rejects_oversized_payload_with_413():
    """Verify uploading a file exceeding MAX_UPLOAD_SIZE_BYTES returns HTTP 413 (Payload Too Large)."""
    import io
    # 2MB + 1KB payload exceeding the 2MB (2,097,152 bytes) limit without large memory spike
    oversized_bytes = b"0" * (2 * 1024 * 1024 + 1024)
    upload_resp = client.post(
        "/api/predict/upload",
        files={"file": ("oversized.json", io.BytesIO(oversized_bytes), "application/json")}
    )
    assert upload_resp.status_code == 413
    detail = upload_resp.json().get("detail", "")
    assert "exceeds" in detail.lower()
    assert "2mb" in detail.lower() or "2097152" in detail


def test_predict_upload_normal_sized_chip_succeeds():
    """Regression check confirming a normal-sized valid chip succeeds within the size limit."""
    require_onnx_model()
    sample_path = SAMPLES_DIR / "ship_1.npz"
    with open(sample_path, "rb") as f:
        upload_resp = client.post(
            "/api/predict/upload",
            files={"file": ("ship_1.npz", f, "application/octet-stream")}
        )
    assert upload_resp.status_code == 200
    assert upload_resp.json()["predicted_class"] == "ship"


def test_predict_increments_history_count():
    """Verify calling /api/predict increases history count by exactly 1 in the isolated test database."""
    require_onnx_model()
    from history import get_history

    initial_history = get_history(limit=200)
    initial_count = len(initial_history)

    sample = load_sample("ship_1.npz")
    response = client.post("/api/predict", json={
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
        "inc_angle": float(sample["inc_angle"]),
    })
    assert response.status_code == 200

    updated_history = get_history(limit=200)
    assert len(updated_history) == initial_count + 1

    latest = updated_history[0]
    assert latest["predicted_class"] == "ship"
    assert latest["source"] == "predict"
    assert latest["model_used"] == "resnet50"
    assert latest["inc_angle"] == pytest.approx(float(sample["inc_angle"]), abs=1e-4)


def test_history_endpoint_returns_newest_first_order():
    """Verify /api/history returns entries in newest-first (descending ID) order."""
    from history import log_prediction

    log_prediction(predicted_class="ship", probability_iceberg=0.1, confidence=0.9, inc_angle=35.0, source="predict")
    log_prediction(predicted_class="iceberg", probability_iceberg=0.8, confidence=0.8, inc_angle=40.0, source="predict")
    log_prediction(predicted_class="ship", probability_iceberg=0.05, confidence=0.95, inc_angle=42.0, source="predict")

    response = client.get("/api/history")
    assert response.status_code == 200
    entries = response.json()
    assert len(entries) >= 3

    ids = [item["id"] for item in entries]
    assert ids == sorted(ids, reverse=True), "History items must be ordered newest-first"


def test_history_limit_cap_enforced_at_200():
    """Verify /api/history enforces default limit of 50 and caps ?limit= at 200."""
    from history import log_prediction

    # Seed 205 prediction entries
    for i in range(205):
        log_prediction(
            predicted_class="iceberg" if i % 2 == 0 else "ship",
            probability_iceberg=0.8 if i % 2 == 0 else 0.2,
            confidence=0.8,
            inc_angle=30.0 + (i % 15),
            source="batch",
        )

    # 1. Default limit = 50
    resp_default = client.get("/api/history")
    assert resp_default.status_code == 200
    assert len(resp_default.json()) == 50

    # 2. Custom limit = 20
    resp_20 = client.get("/api/history?limit=20")
    assert resp_20.status_code == 200
    assert len(resp_20.json()) == 20

    # 3. Limit at exactly 200
    resp_200 = client.get("/api/history?limit=200")
    assert resp_200.status_code == 200
    assert len(resp_200.json()) == 200

    # 4. Limit requesting 250 must be capped at 200
    resp_250 = client.get("/api/history?limit=250")
    assert resp_250.status_code == 200
    assert len(resp_250.json()) == 200


def test_gradcam_rate_limit_exceeded_returns_429():
    """
    Verify exceeding 10 req/min on /api/predict/gradcam returns HTTP 429 Too Many Requests
    with Retry-After header. Skips if best_resnet_fusion.keras is missing.
    """
    require_keras_model()
    from gradcam import GradCamService
    from limiter import limiter
    GradCamService._ensure_loaded()
    limiter.reset()

    sample = load_sample("ship_1.npz")
    payload = {
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
        "inc_angle": sample["inc_angle"],
    }

    resp = None
    for _ in range(15):
        resp = client.post("/api/predict/gradcam", json=payload)
        if resp.status_code == 429:
            break

    assert resp is not None and resp.status_code == 429
    data = resp.json()
    assert "Rate limit exceeded" in data.get("detail", "")
    assert "retry-after" in resp.headers or "Retry-After" in resp.headers


def test_sar_classifier_double_checked_locking_concurrent(monkeypatch):
    """
    Verify SARClassifier uses double-checked locking to load the ONNX session
    exactly once under concurrent multi-threaded inference calls.
    """
    require_onnx_model()
    import threading
    from concurrent.futures import ThreadPoolExecutor
    import time
    from inference import SARClassifier
    import onnxruntime as ort

    # Reset singleton state
    SARClassifier._session = None

    load_count = 0
    count_lock = threading.Lock()
    orig_session_factory = ort.InferenceSession

    def tracking_session_factory(*args, **kwargs):
        nonlocal load_count
        with count_lock:
            load_count += 1
        time.sleep(0.05)  # Artificially widen the race window
        return orig_session_factory(*args, **kwargs)

    monkeypatch.setattr("inference.ort.InferenceSession", tracking_session_factory)

    sample = load_sample("ship_1.npz")
    b1 = sample["band_1"].tolist()
    b2 = sample["band_2"].tolist()
    angle = sample["inc_angle"]

    # Spin up 10 concurrent threads invoking predict simultaneously
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [
            executor.submit(SARClassifier.predict, b1, b2, angle)
            for _ in range(10)
        ]
        results = [f.result() for f in futures]

    assert len(results) == 10
    for prob, pred_class, conf in results:
        assert pred_class == "ship"
        assert 0.0 <= prob <= 1.0

    assert load_count == 1, f"Expected exactly 1 ONNX session load, got {load_count}"


def test_xgboost_service_double_checked_locking_concurrent(monkeypatch):
    """
    Verify XGBoostBaselineClassifier uses double-checked locking to load the booster
    exactly once under concurrent multi-threaded inference calls.
    """
    require_xgboost_model()
    import threading
    from concurrent.futures import ThreadPoolExecutor
    import time
    import xgboost as xgb
    from xgb_inference import XGBoostBaselineClassifier

    # Reset singleton state
    XGBoostBaselineClassifier._booster = None
    XGBoostBaselineClassifier._feature_names = None

    load_count = 0
    count_lock = threading.Lock()
    orig_load_model = xgb.Booster.load_model

    def tracking_load_model(self, *args, **kwargs):
        nonlocal load_count
        with count_lock:
            load_count += 1
        time.sleep(0.05)  # Artificially widen the race window
        return orig_load_model(self, *args, **kwargs)

    monkeypatch.setattr(xgb.Booster, "load_model", tracking_load_model)

    sample = load_sample("ship_1.npz")
    b1 = sample["band_1"].tolist()
    b2 = sample["band_2"].tolist()
    angle = sample["inc_angle"]

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [
            executor.submit(XGBoostBaselineClassifier.predict, b1, b2, angle)
            for _ in range(10)
        ]
        results = [f.result() for f in futures]

    assert len(results) == 10
    for prob, pred_class, conf, latency, feats in results:
        assert pred_class == "ship"
        assert len(feats) == 49

    assert load_count == 1, f"Expected exactly 1 XGBoost load, got {load_count}"


def test_gradcam_service_double_checked_locking_concurrent(monkeypatch):
    """
    Verify GradCamService uses double-checked locking to load TensorFlow / Keras model
    exactly once under concurrent multi-threaded compute_heatmap calls.
    """
    require_keras_model()

    import threading
    from concurrent.futures import ThreadPoolExecutor
    import time
    from gradcam import GradCamService
    import tensorflow as tf

    # Reset singleton state
    GradCamService._model = None

    load_count = 0
    count_lock = threading.Lock()
    orig_load_model = tf.keras.models.load_model

    def tracking_load_model(*args, **kwargs):
        nonlocal load_count
        with count_lock:
            load_count += 1
        time.sleep(0.05)  # Artificially widen the race window
        return orig_load_model(*args, **kwargs)

    monkeypatch.setattr(tf.keras.models, "load_model", tracking_load_model)

    sample = load_sample("ship_1.npz")
    b1 = sample["band_1"].tolist()
    b2 = sample["band_2"].tolist()
    angle = sample["inc_angle"]

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [
            executor.submit(GradCamService.compute_heatmap, b1, b2, angle)
            for _ in range(10)
        ]
        results = [f.result() for f in futures]

    assert len(results) == 10
    for heatmap, layer in results:
        assert len(heatmap) == 75
        assert len(heatmap[0]) == 75

    assert load_count == 1, f"Expected exactly 1 Keras load, got {load_count}"


def test_logging_configuration_stdout_and_level(monkeypatch):
    """
    Verify setup_logging respects LOG_LEVEL env var and writes exclusively to sys.stdout.
    """
    import logging
    import sys
    from logging_config import setup_logging

    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    app_logger = setup_logging()

    assert app_logger.level == logging.DEBUG
    root_logger = logging.getLogger()
    assert root_logger.level == logging.DEBUG

    stdout_handlers = [h for h in root_logger.handlers if getattr(h, "stream", None) == sys.stdout]
    assert len(stdout_handlers) >= 1
    assert any(isinstance(h, logging.StreamHandler) and h.stream == sys.stdout for h in root_logger.handlers)

    # Reset back to INFO
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    setup_logging("INFO")


def test_incoming_prediction_logs_summary_without_raw_arrays(caplog):
    """
    Verify that incoming prediction requests and results are logged at INFO,
    and that raw 5625-float band arrays are never leaked into log messages.
    """
    require_onnx_model()
    import logging

    sample = load_sample("ship_1.npz")
    payload = {
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
        "inc_angle": sample["inc_angle"],
    }

    with caplog.at_level(logging.INFO, logger="sar_classifier"):
        resp = client.post("/api/predict", json=payload)
        assert resp.status_code == 200

    # Check for request and result summary logs
    messages = [rec.message for rec in caplog.records if rec.name.startswith("sar_classifier")]
    req_logs = [m for m in messages if "Single chip prediction requested" in m]
    res_logs = [m for m in messages if "Single prediction completed" in m]

    assert len(req_logs) >= 1
    assert len(res_logs) >= 1

    # Verify that full 5625 float arrays are never logged
    for m in messages:
        assert len(m) < 500  # Summary messages must stay compact
        assert "[" not in m or "]" not in m or len(m.split(",")) < 10


def test_logging_4xx_client_error_warns(caplog):
    """
    Verify 4xx client errors produce WARNING logs.
    """
    import logging

    with caplog.at_level(logging.WARNING):
        resp = client.post("/api/predict", json={"band_1": [1.0, 2.0], "band_2": [3.0], "inc_angle": 35.0})
        assert resp.status_code in (400, 422)

    warning_records = [rec for rec in caplog.records if rec.levelno == logging.WARNING]
    assert len(warning_records) >= 1


def test_rate_limit_rejection_logs_warning_without_raw_ip(caplog):
    """
    Verify rate-limit rejections log at WARNING level noting the endpoint without raw client IP.
    """
    require_keras_model()
    import logging

    sample = load_sample("ship_1.npz")
    payload = {
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
        "inc_angle": sample["inc_angle"],
    }

    with caplog.at_level(logging.WARNING, logger="sar_classifier"):
        for _ in range(15):
            resp = client.post("/api/predict/gradcam", json=payload)
            if resp.status_code == 429:
                break
        assert resp.status_code == 429

    app_warning_msgs = [
        rec.message for rec in caplog.records
        if rec.levelno == logging.WARNING and rec.name.startswith("sar_classifier")
    ]
    assert any("Rate limit exceeded on endpoint: /api/predict/gradcam" in m for m in app_warning_msgs)
    # Ensure raw client IP / host was NOT logged in application logs
    assert all("127.0.0.1" not in m and "testclient" not in m for m in app_warning_msgs)


# =====================================================================
# Missing Model 503 Error Path Tests (Graceful degradation)
# =====================================================================

def test_predict_missing_model_returns_503(monkeypatch):
    """Verify /api/predict returns 503 when the ONNX model file is missing without leaking filesystem paths."""
    from inference import SARClassifier
    import inference

    monkeypatch.setattr(inference, "MODEL_PATH", Path("nonexistent_sar_classifier.onnx"))
    monkeypatch.setattr(SARClassifier, "_session", None)

    sample = load_sample("ship_1.npz")
    resp = client.post("/api/predict", json={
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
        "inc_angle": sample["inc_angle"],
    })
    # Reset singleton so subsequent tests reload cleanly
    monkeypatch.setattr(SARClassifier, "_session", None)

    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert detail == "Model file not found; see README for setup"
    assert "nonexistent" not in detail
    assert "/" not in detail and "\\" not in detail


def test_predict_batch_missing_model_returns_503(monkeypatch):
    """Verify /api/predict/batch returns 503 when the ONNX model file is missing."""
    from inference import SARClassifier
    import inference

    monkeypatch.setattr(inference, "MODEL_PATH", Path("nonexistent_sar_classifier.onnx"))
    monkeypatch.setattr(SARClassifier, "_session", None)

    sample = load_sample("ship_1.npz")
    resp = client.post("/api/predict/batch", json={
        "chips": [{
            "band_1": sample["band_1"].tolist(),
            "band_2": sample["band_2"].tolist(),
            "inc_angle": sample["inc_angle"],
        }]
    })
    monkeypatch.setattr(SARClassifier, "_session", None)

    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert detail == "Model file not found; see README for setup"
    assert "/" not in detail and "\\" not in detail


def test_predict_upload_missing_model_returns_503(monkeypatch):
    """Verify /api/predict/upload returns 503 when the ONNX model file is missing."""
    import json
    from inference import SARClassifier
    import inference

    monkeypatch.setattr(inference, "MODEL_PATH", Path("nonexistent_sar_classifier.onnx"))
    monkeypatch.setattr(SARClassifier, "_session", None)

    sample = load_sample("ship_1.npz")
    payload = {
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
        "inc_angle": float(sample["inc_angle"]),
    }
    json_bytes = json.dumps(payload).encode("utf-8")
    resp = client.post(
        "/api/predict/upload",
        files={"file": ("test_chip.json", json_bytes, "application/json")}
    )
    monkeypatch.setattr(SARClassifier, "_session", None)

    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert detail == "Model file not found; see README for setup"
    assert "/" not in detail and "\\" not in detail


def test_predict_angle_sweep_missing_model_returns_503(monkeypatch):
    """Verify /api/predict/angle-sweep returns 503 when the ONNX model file is missing."""
    from inference import SARClassifier
    import inference

    monkeypatch.setattr(inference, "MODEL_PATH", Path("nonexistent_sar_classifier.onnx"))
    monkeypatch.setattr(SARClassifier, "_session", None)

    sample = load_sample("ship_1.npz")
    resp = client.post("/api/predict/angle-sweep", json={
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
    })
    monkeypatch.setattr(SARClassifier, "_session", None)

    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert detail == "Model file not found; see README for setup"
    assert "/" not in detail and "\\" not in detail


def test_predict_compare_missing_resnet_returns_503(monkeypatch):
    """Verify /api/predict/compare returns 503 when the ResNet ONNX model is missing."""
    from inference import SARClassifier
    import inference

    monkeypatch.setattr(inference, "MODEL_PATH", Path("nonexistent_sar_classifier.onnx"))
    monkeypatch.setattr(SARClassifier, "_session", None)

    sample = load_sample("ship_1.npz")
    resp = client.post("/api/predict/compare", json={
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
        "inc_angle": sample["inc_angle"],
    })
    monkeypatch.setattr(SARClassifier, "_session", None)

    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert detail == "Model file not found; see README for setup"
    assert "/" not in detail and "\\" not in detail


def test_predict_compare_missing_xgboost_returns_503(monkeypatch):
    """Verify /api/predict/compare returns 503 when the XGBoost model is missing."""
    require_onnx_model()
    from xgb_inference import XGBoostBaselineClassifier
    import xgb_inference

    monkeypatch.setattr(xgb_inference, "MODEL_PATH", Path("nonexistent_xgb_baseline.json"))
    monkeypatch.setattr(XGBoostBaselineClassifier, "_booster", None)

    sample = load_sample("ship_1.npz")
    resp = client.post("/api/predict/compare", json={
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
        "inc_angle": sample["inc_angle"],
    })
    monkeypatch.setattr(XGBoostBaselineClassifier, "_booster", None)

    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert detail == "Model file not found; see README for setup"
    assert "/" not in detail and "\\" not in detail


def test_predict_gradcam_missing_model_returns_503(monkeypatch):
    """Verify /api/predict/gradcam returns 503 with note that Grad-CAM is optional when Keras model is missing."""
    from gradcam import GradCamService
    import gradcam

    monkeypatch.setattr(gradcam, "KERAS_MODEL_PATH", Path("nonexistent_best_resnet_fusion.keras"))
    monkeypatch.setattr(GradCamService, "_model", None)

    sample = load_sample("ship_1.npz")
    resp = client.post("/api/predict/gradcam", json={
        "band_1": sample["band_1"].tolist(),
        "band_2": sample["band_2"].tolist(),
        "inc_angle": sample["inc_angle"],
    })
    monkeypatch.setattr(GradCamService, "_model", None)

    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert detail == "Grad-CAM model file not found; see README for setup (Grad-CAM is optional)"
    assert "Grad-CAM is optional" in detail
    assert "/" not in detail and "\\" not in detail


def test_startup_prewarm_missing_keras_emits_info_log(caplog, monkeypatch):
    """Verify startup pre-warm emits exactly one INFO log line and no error logs when Keras model is missing."""
    import logging
    from gradcam import GradCamService
    import gradcam
    from main import _prewarm_gradcam

    monkeypatch.setattr(gradcam, "KERAS_MODEL_PATH", Path("nonexistent_best_resnet_fusion.keras"))
    monkeypatch.setattr(GradCamService, "_model", None)

    with caplog.at_level(logging.INFO):
        _prewarm_gradcam()

    info_msgs = [rec.message for rec in caplog.records if rec.levelno == logging.INFO]
    error_msgs = [rec.message for rec in caplog.records if rec.levelno >= logging.ERROR]

    assert any("Grad-CAM disabled: model file not found" in m for m in info_msgs)
    assert not any("Grad-CAM" in m for m in error_msgs)


def test_history_disabled_returns_404(monkeypatch):
    """Verify that when HISTORY_ENABLED=false, GET /api/history returns 404 and logging is skipped."""
    monkeypatch.setenv("HISTORY_ENABLED", "false")
    resp = client.get("/api/history")
    assert resp.status_code == 404
    assert "disabled on this deployment" in resp.json()["detail"]


def test_history_enabled_returns_200(monkeypatch):
    """Verify that when HISTORY_ENABLED=true, GET /api/history returns 200."""
    monkeypatch.setenv("HISTORY_ENABLED", "true")
    resp = client.get("/api/history")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)







