"""
Grad-CAM explainability for the SAR fusion model.

Deliberately separate from inference.py: this module lazy-loads the
Keras (.h5/.keras) model and TensorFlow itself, ONLY on first use. The
main /predict path never touches this file or pays TensorFlow's ~500MB
import cost — that's the whole point of having gone to ONNX in the
first place. Grad-CAM is opt-in, slower, and heavier by nature (it
needs real gradients, which ONNX Runtime doesn't provide).

Layer choice: conv3_block4_3_conv, NOT the true final conv layer.
On a 75x75 input, ResNet50's last conv layer collapses to a 3x3 grid —
confirmed empirically to be too coarse to localize anything; the
"heatmap" was just a smooth diagonal gradient. conv3_block4_3_conv
gives a 10x10 grid, which visibly localizes real hotspots. If you
retrain with a different input size or backbone, re-verify this layer
choice rather than assuming it still holds.
"""

import threading
from pathlib import Path
from typing import Optional

import numpy as np

from logging_config import get_logger
from preprocessing.sar_preprocessing import build_composite_tensor, prepare_angle

KERAS_MODEL_PATH = (Path(__file__).parent / "models" / "best_resnet_fusion.keras").resolve()
DEFAULT_LAYER_NAME = "conv3_block4_3_conv"

logger = get_logger("gradcam")


class GradCamService:
    """Lazy singleton: TensorFlow and the Keras model load only on first call."""

    _model = None
    _tf = None
    _lock = threading.Lock()
    _compute_lock = threading.Lock()

    @classmethod
    def _ensure_loaded(cls):
        # 1. Fast path: return immediately if model is already loaded
        if cls._model is None:
            # 2. Acquire lock to prevent duplicate concurrent imports & model initialization
            with cls._lock:
                # 3. Double-check inside lock
                if cls._model is None:
                    logger.info("Loading TensorFlow and Keras model for Grad-CAM (%s)...", KERAS_MODEL_PATH.name)
                    import tensorflow as tf  # deferred import - heavy, only paid once
                    cls._tf = tf

                    if not KERAS_MODEL_PATH.exists():
                        raise FileNotFoundError(
                            f"Keras model not found at {KERAS_MODEL_PATH}. "
                            "Grad-CAM needs the original Keras model (gradients aren't "
                            "available from the ONNX graph) - copy best_resnet_fusion.keras "
                            "into backend/models/."
                        )
                    cls._model = tf.keras.models.load_model(str(KERAS_MODEL_PATH))
                    logger.info("Grad-CAM Keras model loaded successfully.")

    @classmethod
    def compute_heatmap(cls, band_1, band_2, inc_angle: float, layer_name: Optional[str] = None):
        """
        Returns (heatmap_75x75, layer_used) where heatmap values are
        normalized to [0, 1] and already resized to match the chip's
        75x75 spatial dimensions, ready for the frontend to overlay
        with its own colormap/opacity choice.
        """
        cls._ensure_loaded()
        tf = cls._tf
        layer_name = layer_name or DEFAULT_LAYER_NAME

        with cls._compute_lock:
            chip = build_composite_tensor(band_1, band_2)
            image_batch = np.expand_dims(chip, axis=0)
            angle_batch = prepare_angle(inc_angle)

            grad_model = tf.keras.models.Model(
                inputs=cls._model.inputs,
                outputs=[cls._model.get_layer(layer_name).output, cls._model.output],
            )

            with tf.GradientTape() as tape:
                conv_output, predictions = grad_model([image_batch, angle_batch])
                p_iceberg = predictions[:, 0]
                # Binary classification (0 = ship, 1 = iceberg):
                # If predicting ship (p < 0.5), explain the ship class (1 - p).
                # If predicting iceberg (p >= 0.5), explain the iceberg class (p).
                class_score = tf.where(p_iceberg < 0.5, 1.0 - p_iceberg, p_iceberg)

            grads = tape.gradient(class_score, conv_output)
            pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

            conv_output = conv_output[0]
            heatmap = conv_output @ pooled_grads[..., tf.newaxis]
            heatmap = tf.squeeze(heatmap)
            heatmap = tf.maximum(heatmap, 0)
            max_val = tf.math.reduce_max(heatmap)
            if max_val > 0:
                heatmap = heatmap / (max_val + 1e-8)

            heatmap_resized = tf.image.resize(
                heatmap[..., tf.newaxis], (75, 75), method="bilinear"
            ).numpy().squeeze()

            return heatmap_resized.astype(np.float32), layer_name
