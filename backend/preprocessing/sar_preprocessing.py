"""
SAR chip preprocessing — extracted from the Kaggle training notebook so the
exact same transformation runs at inference time inside the FastAPI backend.
This is the single source of truth for preprocessing; do not reimplement
Lee filtering or normalization anywhere else in this codebase.

Pipeline: raw HH/HV bands -> Lee speckle filter -> [HH, HV, HH-HV] stack
-> per-sample min-max normalize to [0, 1] -> (1, 75, 75, 3) tensor.
"""

import numpy as np
from scipy.ndimage import uniform_filter

CHIP_SIZE = 75


def lee_filter(img: np.ndarray, size: int = 5) -> np.ndarray:
    """
    Adaptive Lee filter for SAR speckle suppression.
    Formula: W = var / (var + noise_var), filtered = mean + W * (img - mean)
    where noise_var is the GLOBAL variance of the raw input image
    (np.var(img)) — matches the training notebook exactly.
    """
    mean = uniform_filter(img, size)
    sq_mean = uniform_filter(img ** 2, size)
    var = sq_mean - mean ** 2
    overall_var = np.var(img)
    weight = var / (var + overall_var + 1e-6)
    return mean + weight * (img - mean)


def build_composite_tensor(raw_band_1, raw_band_2) -> np.ndarray:
    """
    Turn two raw flattened SAR bands (length 5625 each) into the
    normalized (75, 75, 3) composite tensor the model expects:
    channel 0 = HH (Lee-filtered), channel 1 = HV (Lee-filtered),
    channel 2 = HH - HV.
    """
    b1 = lee_filter(np.array(raw_band_1, dtype=np.float32).reshape(CHIP_SIZE, CHIP_SIZE))
    b2 = lee_filter(np.array(raw_band_2, dtype=np.float32).reshape(CHIP_SIZE, CHIP_SIZE))
    ratio = b1 - b2

    chip = np.stack([b1, b2, ratio], axis=-1)  # (75, 75, 3)

    c_min = chip.min(axis=(0, 1), keepdims=True)
    c_max = chip.max(axis=(0, 1), keepdims=True)
    chip_norm = (chip - c_min) / (c_max - c_min + 1e-6)

    return chip_norm.astype(np.float32)


def prepare_angle(incidence_angle: float) -> np.ndarray:
    """Format a scalar incidence angle into the (1, 1) shape the model expects."""
    return np.array([[float(incidence_angle)]], dtype=np.float32)


def process_chip_for_inference(raw_band_1, raw_band_2, incidence_angle: float) -> dict:
    """
    Full pipeline: raw bands + angle -> dict ready to feed straight into
    the ONNX session's run() call, keyed by the exact input names the
    model expects.
    """
    chip_norm = build_composite_tensor(raw_band_1, raw_band_2)
    image_batch = np.expand_dims(chip_norm, axis=0)  # (1, 75, 75, 3)
    angle_batch = prepare_angle(incidence_angle)      # (1, 1)

    return {
        "sar_image_input": image_batch,
        "inc_angle_input": angle_batch,
    }
