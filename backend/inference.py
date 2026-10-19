"""
ONNX inference wrapper for the SAR ship/iceberg classifier.

The ONNX session is loaded once (singleton) at first use, not per-request —
loading a session on every API call would add unnecessary latency.
"""

import threading
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import onnxruntime as ort

from logging_config import get_logger
from preprocessing.sar_preprocessing import process_chip_for_inference

MODEL_PATH = Path(__file__).parent / "models" / "sar_classifier.onnx"

DEFAULT_SWEEP_ANGLES = [float(a) for a in range(30, 47, 2)]  # 30,32,...,46

# Clip probabilities away from exact 0/1 for numerical stability downstream
# (matches the clipping mentioned in the project's log-loss stabilization step).
EPSILON = 1e-7

logger = get_logger("inference")


DECISION_THRESHOLD = 0.5


def classify(prob: float) -> Tuple[str, float]:
    """
    Single source of truth for binary decision thresholding.
    prob: Calibrated probability that the target is an iceberg [0.0, 1.0].
    Returns: (predicted_class, confidence) where confidence is always >= 0.5.
    """
    predicted_class = "iceberg" if prob >= DECISION_THRESHOLD else "ship"
    confidence = prob if predicted_class == "iceberg" else 1.0 - prob
    return predicted_class, confidence


class SARClassifier:
    _session: Optional[ort.InferenceSession] = None
    _lock = threading.Lock()

    @classmethod
    def get_session(cls) -> ort.InferenceSession:
        # 1. Fast path: return existing session without locking
        if cls._session is None:
            # 2. Acquire lock to prevent concurrent initialization races
            with cls._lock:
                # 3. Double-check inside lock in case another thread loaded it
                if cls._session is None:
                    if not MODEL_PATH.exists():
                        raise FileNotFoundError(
                            f"ONNX model not found at {MODEL_PATH}. "
                            "Make sure sar_classifier.onnx is in backend/models/."
                        )
                    logger.info("Loading ONNX inference session from %s...", MODEL_PATH.name)
                    cls._session = ort.InferenceSession(
                        str(MODEL_PATH), providers=["CPUExecutionProvider"]
                    )
                    logger.info("ONNX inference session loaded successfully.")
        return cls._session

    @classmethod
    def _raw_probability(cls, band_1: List[float], band_2: List[float], inc_angle: float) -> float:
        session = cls.get_session()
        inputs = process_chip_for_inference(band_1, band_2, inc_angle)
        outputs = session.run(None, inputs)
        prob = float(np.array(outputs[0]).squeeze())
        return float(np.clip(prob, EPSILON, 1 - EPSILON))

    @classmethod
    def predict(cls, band_1: List[float], band_2: List[float], inc_angle: float):
        """Returns (probability_iceberg, predicted_class, confidence)."""
        prob = cls._raw_probability(band_1, band_2, inc_angle)
        predicted_class, confidence = classify(prob)
        return prob, predicted_class, confidence

    @classmethod
    def angle_sweep(cls, band_1: List[float], band_2: List[float], angles: Optional[List[float]] = None):
        """
        Re-run inference on the SAME chip across a range of incidence angles,
        holding the image content fixed. Powers the angle-sensitivity chart.
        Note: this only varies the angle branch input — it does NOT
        re-simulate how backscatter would physically change at a different
        angle, since that would require re-imaging the scene. It shows how
        the *trained model* responds to the angle feature in isolation.
        """
        sweep_angles = angles if angles else DEFAULT_SWEEP_ANGLES
        points = []
        for angle in sweep_angles:
            prob = cls._raw_probability(band_1, band_2, angle)
            points.append({"angle": angle, "probability_iceberg": prob})
        return points
