"""
Adversarial input test suite for the SAR Classifier API.

Covers malformed, malicious, and edge-case inputs across all client-facing endpoints:
- /api/predict
- /api/predict/upload (.json and .npz)
- /api/predict/batch
- /api/predict/angle-sweep
- /api/predict/compare

Guarantees:
1. Always returns a clean 4xx (400 or 422) with a sensible error message.
2. Never raises unhandled 500 Internal Server Errors or leaks tracebacks.
3. Does not corrupt SQLite audit history or break on zero-variance inputs.
"""

import io
import json
import math
import sys
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent))
from main import app
import history

client = TestClient(app)

CHIP_LENGTH = 5625
VALID_BAND_1 = [0.1] * CHIP_LENGTH
VALID_BAND_2 = [-0.1] * CHIP_LENGTH
VALID_ANGLE = 38.5


# =====================================================================
# 1. NaN and Infinity Injection Tests
# =====================================================================

def test_predict_nan_injection_rejected():
    """NaN values in band arrays must be rejected with 422 Unprocessable Entity."""
    nan_band = [float("nan")] * CHIP_LENGTH
    payload = {
        "band_1": nan_band,
        "band_2": VALID_BAND_2,
        "inc_angle": VALID_ANGLE,
    }
    raw_body = json.dumps(payload, allow_nan=True).encode("utf-8")
    response = client.post("/api/predict", content=raw_body, headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    data = response.json()
    assert "detail" in data
    assert any("finite" in str(err) for err in data["detail"])


def test_predict_infinity_injection_rejected():
    """Infinity values in band arrays must be rejected with 422 Unprocessable Entity."""
    inf_band = [float("inf")] * CHIP_LENGTH
    payload = {
        "band_1": inf_band,
        "band_2": VALID_BAND_2,
        "inc_angle": VALID_ANGLE,
    }
    raw_body = json.dumps(payload, allow_nan=True).encode("utf-8")
    response = client.post("/api/predict", content=raw_body, headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    data = response.json()
    assert "detail" in data
    assert any("finite" in str(err) for err in data["detail"])


def test_angle_sweep_nan_injection_rejected():
    """NaN values in angle-sweep band arrays must be rejected with 422."""
    nan_band = [float("nan")] * CHIP_LENGTH
    payload = {
        "band_1": nan_band,
        "band_2": VALID_BAND_2,
    }
    raw_body = json.dumps(payload, allow_nan=True).encode("utf-8")
    response = client.post("/api/predict/angle-sweep", content=raw_body, headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    data = response.json()
    assert "detail" in data
    assert any("finite" in str(err) for err in data["detail"])


def test_upload_json_nan_infinity_rejected():
    """Uploaded JSON containing NaN or Infinity must be rejected with HTTP 400."""
    # JSON with NaN / Infinity represented as Python floats
    nan_payload = {
        "band_1": [float("nan")] + [0.0] * (CHIP_LENGTH - 1),
        "band_2": VALID_BAND_2,
        "inc_angle": VALID_ANGLE,
    }
    # TestClient serialize or custom json dump
    raw_json = json.dumps(nan_payload).encode("utf-8")
    files = {"file": ("chip_nan.json", io.BytesIO(raw_json), "application/json")}
    response = client.post("/api/predict/upload", files=files)
    assert response.status_code == 400
    assert "finite numbers" in response.json()["detail"]

    inf_payload = {
        "band_1": VALID_BAND_1,
        "band_2": [float("inf")] + [0.0] * (CHIP_LENGTH - 1),
        "inc_angle": VALID_ANGLE,
    }
    raw_json_inf = json.dumps(inf_payload).encode("utf-8")
    files_inf = {"file": ("chip_inf.json", io.BytesIO(raw_json_inf), "application/json")}
    response = client.post("/api/predict/upload", files=files_inf)
    assert response.status_code == 400
    assert "finite numbers" in response.json()["detail"]


def test_upload_npz_nan_infinity_rejected():
    """Uploaded .npz containing NaN or Infinity must be rejected with HTTP 400."""
    buffer = io.BytesIO()
    nan_b1 = np.full(CHIP_LENGTH, np.nan, dtype=np.float32)
    b2 = np.array(VALID_BAND_2, dtype=np.float32)
    np.savez(buffer, band_1=nan_b1, band_2=b2, inc_angle=VALID_ANGLE)
    buffer.seek(0)

    files = {"file": ("chip_nan.npz", buffer, "application/octet-stream")}
    response = client.post("/api/predict/upload", files=files)
    assert response.status_code == 400
    assert "finite numbers" in response.json()["detail"]


# =====================================================================
# 2. Zero-Variance / Flat / Uniform Chip Integrity
# =====================================================================

def test_zero_variance_chip_predict_safe():
    """All-zero flat chips must not cause division-by-zero or crash SQLite."""
    onnx_path = Path(__file__).parent.parent / "models" / "sar_classifier.onnx"
    if not onnx_path.exists():
        pytest.skip(f"ONNX model file not found at {onnx_path}; skipping test.")

    flat_band = [0.0] * CHIP_LENGTH
    payload = {
        "band_1": flat_band,
        "band_2": flat_band,
        "inc_angle": VALID_ANGLE,
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_class"] in ["ship", "iceberg"]
    assert isinstance(data["probability_iceberg"], float)
    assert not math.isnan(data["probability_iceberg"])
    assert 0.0 <= data["probability_iceberg"] <= 1.0
    assert 0.5 <= data["confidence"] <= 1.0


def test_zero_variance_chip_compare_safe():
    """All-zero flat chips in dual-model comparison must compute without math errors."""
    onnx_path = Path(__file__).parent.parent / "models" / "sar_classifier.onnx"
    xgb_path = Path(__file__).parent.parent / "models" / "xgb_baseline.json"
    if not onnx_path.exists() or not xgb_path.exists():
        pytest.skip("ONNX or XGBoost model file not found; skipping compare test.")

    flat_band = [0.0] * CHIP_LENGTH
    payload = {
        "band_1": flat_band,
        "band_2": flat_band,
        "inc_angle": VALID_ANGLE,
    }
    response = client.post("/api/predict/compare", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "resnet" in data
    assert "xgboost" in data
    assert "consensus" in data
    assert not math.isnan(data["resnet"]["probability_iceberg"])
    assert not math.isnan(data["xgboost"]["probability_iceberg"])


# =====================================================================
# 3. Wrong-Length Arrays
# =====================================================================

def test_predict_wrong_length_array_422():
    """Band arrays of length != 5625 must fail schema validation with HTTP 422."""
    # One short: 5624
    short_payload = {
        "band_1": [0.1] * (CHIP_LENGTH - 1),
        "band_2": VALID_BAND_2,
        "inc_angle": VALID_ANGLE,
    }
    res_short = client.post("/api/predict", json=short_payload)
    assert res_short.status_code == 422

    # One long: 5626
    long_payload = {
        "band_1": VALID_BAND_1,
        "band_2": [-0.1] * (CHIP_LENGTH + 1),
        "inc_angle": VALID_ANGLE,
    }
    res_long = client.post("/api/predict", json=long_payload)
    assert res_long.status_code == 422

    # Empty array
    empty_payload = {
        "band_1": [],
        "band_2": VALID_BAND_2,
        "inc_angle": VALID_ANGLE,
    }
    res_empty = client.post("/api/predict", json=empty_payload)
    assert res_empty.status_code == 422


def test_upload_json_wrong_length_array_400():
    """Uploaded JSON with wrong array length must return HTTP 400."""
    payload = {
        "band_1": [0.1] * 10,
        "band_2": VALID_BAND_2,
        "inc_angle": VALID_ANGLE,
    }
    raw_json = json.dumps(payload).encode("utf-8")
    files = {"file": ("short.json", io.BytesIO(raw_json), "application/json")}
    response = client.post("/api/predict/upload", files=files)
    assert response.status_code == 400
    assert "Invalid length for band_1" in response.json()["detail"]


def test_upload_npz_wrong_length_array_400():
    """Uploaded .npz with wrong array length must return HTTP 400."""
    buffer = io.BytesIO()
    np.savez(buffer, band_1=np.zeros(500), band_2=np.array(VALID_BAND_2), inc_angle=VALID_ANGLE)
    buffer.seek(0)

    files = {"file": ("short.npz", buffer, "application/octet-stream")}
    response = client.post("/api/predict/upload", files=files)
    assert response.status_code == 400
    assert "Invalid length for band_1" in response.json()["detail"]


# =====================================================================
# 4. Non-Numeric Values in Band Data
# =====================================================================

def test_predict_non_numeric_band_values_422():
    """Band arrays containing non-numeric strings must return HTTP 422."""
    bad_band = ["not_a_number"] * CHIP_LENGTH
    payload = {
        "band_1": bad_band,
        "band_2": VALID_BAND_2,
        "inc_angle": VALID_ANGLE,
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 422


def test_upload_json_non_numeric_band_values_400():
    """Uploaded JSON with non-numeric band values must return HTTP 400."""
    payload = {
        "band_1": ["corrupt"] * CHIP_LENGTH,
        "band_2": VALID_BAND_2,
        "inc_angle": VALID_ANGLE,
    }
    raw_json = json.dumps(payload).encode("utf-8")
    files = {"file": ("bad_type.json", io.BytesIO(raw_json), "application/json")}
    response = client.post("/api/predict/upload", files=files)
    assert response.status_code == 400
    assert "numerical values" in response.json()["detail"].lower()


# =====================================================================
# 5. Corrupted, Truncated, and Malformed Files
# =====================================================================

def test_upload_corrupted_json_400():
    """Syntactically broken JSON must return HTTP 400 with sensible error."""
    broken_json = b"{'key_with_single_quotes': not_json, truncated"
    files = {"file": ("broken.json", io.BytesIO(broken_json), "application/json")}
    response = client.post("/api/predict/upload", files=files)
    assert response.status_code == 400
    assert "Malformed JSON" in response.json()["detail"]


def test_upload_non_dict_json_400():
    """JSON that parses to a list instead of a dict must return HTTP 400."""
    list_json = json.dumps([1, 2, 3, 4]).encode("utf-8")
    files = {"file": ("array.json", io.BytesIO(list_json), "application/json")}
    response = client.post("/api/predict/upload", files=files)
    assert response.status_code == 400
    assert "expected a dictionary/object" in response.json()["detail"]


def test_upload_missing_fields_json_400():
    """JSON missing required fields (e.g. band_2) must return HTTP 400."""
    incomplete = json.dumps({"band_1": VALID_BAND_1, "inc_angle": VALID_ANGLE}).encode("utf-8")
    files = {"file": ("missing_band2.json", io.BytesIO(incomplete), "application/json")}
    response = client.post("/api/predict/upload", files=files)
    assert response.status_code == 400
    assert "Missing required field" in response.json()["detail"]
    assert "band_2" in response.json()["detail"]


def test_upload_corrupted_truncated_npz_400():
    """Truncated or corrupted .npz bytes must return HTTP 400."""
    truncated_npz = b"PK\x03\x04random_corrupted_binary_stream_without_valid_zip_trailer"
    files = {"file": ("corrupt.npz", io.BytesIO(truncated_npz), "application/octet-stream")}
    response = client.post("/api/predict/upload", files=files)
    assert response.status_code == 400
    assert "Failed to parse .npz file" in response.json()["detail"]


def test_upload_unsupported_file_extension_400():
    """Uploading an unsupported file format like .csv or .png must return HTTP 400."""
    csv_bytes = b"band_1,band_2,inc_angle\n0.1,0.2,35\n"
    files = {"file": ("chip.csv", io.BytesIO(csv_bytes), "text/csv")}
    response = client.post("/api/predict/upload", files=files)
    assert response.status_code == 400
    assert "Unsupported file extension '.csv'" in response.json()["detail"]


def test_upload_file_size_exceeded_413():
    """Files exceeding 2MB limit must return HTTP 413 Payload Too Large."""
    oversized_bytes = b"0" * (2 * 1024 * 1024 + 1024)  # 2MB + 1KB
    files = {"file": ("huge.json", io.BytesIO(oversized_bytes), "application/json")}
    response = client.post("/api/predict/upload", files=files)
    assert response.status_code == 413
    assert "exceeds maximum limit" in response.json()["detail"]


# =====================================================================
# 6. Incidence Angle Boundary & Edge Cases
# =====================================================================

def test_angle_boundaries_valid():
    """Incidence angles exactly 0.0 and 90.0 must be accepted."""
    payload_0 = {"band_1": VALID_BAND_1, "band_2": VALID_BAND_2, "inc_angle": 0.0}
    res_0 = client.post("/api/predict", json=payload_0)
    assert res_0.status_code == 200

    payload_90 = {"band_1": VALID_BAND_1, "band_2": VALID_BAND_2, "inc_angle": 90.0}
    res_90 = client.post("/api/predict", json=payload_90)
    assert res_90.status_code == 200


def test_angle_out_of_bounds_rejected():
    """Angles outside [0.0, 90.0] must be rejected with 422 or 400."""
    # Negative angle
    res_neg = client.post("/api/predict", json={"band_1": VALID_BAND_1, "band_2": VALID_BAND_2, "inc_angle": -0.001})
    assert res_neg.status_code == 422

    # Over 90 degrees
    res_over = client.post("/api/predict", json={"band_1": VALID_BAND_1, "band_2": VALID_BAND_2, "inc_angle": 90.001})
    assert res_over.status_code == 422

    # Non-numeric angle
    res_str = client.post("/api/predict", json={"band_1": VALID_BAND_1, "band_2": VALID_BAND_2, "inc_angle": "invalid_deg"})
    assert res_str.status_code == 422


def test_upload_angle_out_of_bounds_400():
    """Uploaded chip with angle outside [0, 90] must return HTTP 400."""
    payload = {
        "band_1": VALID_BAND_1,
        "band_2": VALID_BAND_2,
        "inc_angle": 120.5,
    }
    raw_json = json.dumps(payload).encode("utf-8")
    files = {"file": ("chip.json", io.BytesIO(raw_json), "application/json")}
    response = client.post("/api/predict/upload", files=files)
    assert response.status_code == 400
    assert "out of valid range [0, 90]" in response.json()["detail"]


# =====================================================================
# 7. SQL Injection & Path Traversal Resilience
# =====================================================================

def test_sql_injection_attempt_history_safe():
    """Attempting SQL injection in prediction query params or metadata is harmless."""
    # Normal prediction to populate history
    payload = {"band_1": VALID_BAND_1, "band_2": VALID_BAND_2, "inc_angle": VALID_ANGLE}
    pred_res = client.post("/api/predict", json=payload)
    assert pred_res.status_code == 200

    # Malicious limit query attempting to terminate query or drop table
    malicious_limit = "1; DROP TABLE predictions; --"
    res = client.get(f"/api/history?limit={malicious_limit}")
    # FastAPI schema expects an int for limit, so this cleanly returns 422
    assert res.status_code == 422

    # Verify table was not touched and history is intact
    records = history.get_history(limit=5)
    assert len(records) >= 1
    assert all(isinstance(r["id"], int) for r in records)


def test_path_traversal_filename_upload_safe():
    """Filenames with directory traversal patterns must not write to disk or crash."""
    traversal_filenames = [
        "../../../../etc/passwd.json",
        "..\\..\\..\\windows\\win.ini.json",
        "/absolute/root/path/chip.json",
    ]
    payload = {
        "band_1": VALID_BAND_1,
        "band_2": VALID_BAND_2,
        "inc_angle": VALID_ANGLE,
    }
    raw_json = json.dumps(payload).encode("utf-8")

    for fname in traversal_filenames:
        files = {"file": (fname, io.BytesIO(raw_json), "application/json")}
        response = client.post("/api/predict/upload", files=files)
        # Should process in-memory successfully without touching arbitrary paths
        assert response.status_code == 200
        assert "probability_iceberg" in response.json()


# =====================================================================
# 8. Batch Endpoint Adversarial Isolation
# =====================================================================

def test_batch_adversarial_chip_rejected():
    """Batch containing a malformed chip (e.g. invalid length) must be rejected with 422."""
    valid_chip = {"band_1": VALID_BAND_1, "band_2": VALID_BAND_2, "inc_angle": VALID_ANGLE}
    bad_chip = {"band_1": [0.0] * 10, "band_2": VALID_BAND_2, "inc_angle": VALID_ANGLE}
    response = client.post("/api/predict/batch", json={"chips": [valid_chip, bad_chip]})
    assert response.status_code == 422


def test_batch_oversized_payload_rejected():
    """Batch exceeding max 50 chips must be rejected with 422."""
    valid_chip = {"band_1": VALID_BAND_1, "band_2": VALID_BAND_2, "inc_angle": VALID_ANGLE}
    oversized_chips = [valid_chip] * 51
    response = client.post("/api/predict/batch", json={"chips": oversized_chips})
    assert response.status_code == 422
