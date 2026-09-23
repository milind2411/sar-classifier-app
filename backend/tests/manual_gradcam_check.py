"""
Manual Grad-CAM check — hits the LIVE backend at localhost:8000.

Sends a real sample chip to /api/predict/gradcam, verifies the response,
and saves the resulting heatmap as manual_gradcam_result.png alongside
this script.

Usage (with backend running on :8000):
    cd backend
    python tests/manual_gradcam_check.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import requests

BACKEND_URL = "http://localhost:8000"
SAMPLES_DIR = Path(__file__).resolve().parent.parent / "data" / "sample_chips"
OUTPUT_PATH = Path(__file__).resolve().parent / "manual_gradcam_result.png"


def main():
    # ── 1. Load a sample chip ──
    sample_file = SAMPLES_DIR / "iceberg_1.npz"
    if not sample_file.exists():
        print(f"ERROR: Sample not found: {sample_file}", file=sys.stderr)
        sys.exit(1)

    with np.load(sample_file) as npz_data:
        data = {
            "band_1": npz_data["band_1"],
            "band_2": npz_data["band_2"],
            "inc_angle": float(npz_data["inc_angle"]),
            "label": int(npz_data["label"]),
        }
    print(f"Loaded {sample_file.name}: label={data['label']}, angle={data['inc_angle']:.1f}")

    # ── 2. Call /api/predict first to get the classification ──
    print("\n--- /api/predict ---")
    predict_resp = requests.post(f"{BACKEND_URL}/api/predict", json={
        "band_1": data["band_1"].tolist(),
        "band_2": data["band_2"].tolist(),
        "inc_angle": float(data["inc_angle"]),
    }, timeout=30)
    predict_resp.raise_for_status()
    pred = predict_resp.json()
    print(f"  Class: {pred['predicted_class']}")
    print(f"  Confidence: {pred['confidence']:.4f}")
    print(f"  P(iceberg): {pred['probability_iceberg']:.4f}")

    # ── 3. Call /api/predict/gradcam ──
    print("\n--- /api/predict/gradcam ---")
    print("  (first call may be slow — TensorFlow lazy-loads...)")
    gradcam_resp = requests.post(f"{BACKEND_URL}/api/predict/gradcam", json={
        "band_1": data["band_1"].tolist(),
        "band_2": data["band_2"].tolist(),
        "inc_angle": float(data["inc_angle"]),
    }, timeout=120)  # generous timeout for TF cold-start
    gradcam_resp.raise_for_status()
    result = gradcam_resp.json()

    layer_used = result["layer_used"]
    heatmap = np.array(result["heatmap"], dtype=np.float32)

    print(f"  Layer used: {layer_used}")
    print(f"  Heatmap shape: {heatmap.shape}")
    print(f"  Heatmap range: [{heatmap.min():.4f}, {heatmap.max():.4f}]")
    print(f"  Heatmap mean:  {heatmap.mean():.4f}")

    # ── 4. Validate ──
    assert heatmap.shape == (75, 75), f"Expected (75, 75), got {heatmap.shape}"
    assert 0.0 <= heatmap.min() and heatmap.max() <= 1.0 + 1e-6, "Heatmap values out of [0,1]"

    # ── 5. Save as PNG (using matplotlib if available, fallback to raw) ──
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import matplotlib.colors as mcolors

        fig, axes = plt.subplots(1, 3, figsize=(14, 4.5))

        # Panel 1: False-color composite of the raw chip
        b1 = np.array(data["band_1"]).reshape(75, 75)
        b2 = np.array(data["band_2"]).reshape(75, 75)
        norm = lambda a: (a - a.min()) / (a.max() - a.min() + 1e-8)
        rgb = np.stack([norm(b1), norm(b2), norm(b1 - b2)], axis=-1)
        axes[0].imshow(rgb, interpolation="nearest")
        axes[0].set_title("False-Color (R=HH, G=HV, B=Ratio)", fontsize=10)
        axes[0].axis("off")

        # Panel 2: Grad-CAM heatmap alone
        axes[1].imshow(heatmap, cmap="hot", interpolation="bilinear", vmin=0, vmax=1)
        axes[1].set_title(f"Grad-CAM ({layer_used})", fontsize=10)
        axes[1].axis("off")

        # Panel 3: Overlay
        axes[2].imshow(rgb, interpolation="nearest")
        axes[2].imshow(heatmap, cmap="hot", alpha=0.5, interpolation="bilinear", vmin=0, vmax=1)
        axes[2].set_title("Overlay", fontsize=10)
        axes[2].axis("off")

        fig.suptitle(
            f"Grad-CAM: {pred['predicted_class']} (P(iceberg)={pred['probability_iceberg']:.3f}, "
            f"angle={data['inc_angle']:.1f})",
            fontsize=12, fontweight="bold",
        )
        plt.tight_layout()
        plt.savefig(OUTPUT_PATH, dpi=150, bbox_inches="tight")
        plt.close()
        print(f"\n  Saved: {OUTPUT_PATH}")

    except ImportError:
        # Fallback: save raw heatmap values as grayscale PNG using only numpy
        print("  matplotlib not available — saving raw heatmap as grayscale PNG")
        _save_raw_png(heatmap, OUTPUT_PATH)
        print(f"  Saved: {OUTPUT_PATH}")

    print("\nSUCCESS: Grad-CAM check passed.")


def _save_raw_png(heatmap, path):
    """Minimal PNG writer for a 75x75 grayscale image, no dependencies."""
    import struct
    import zlib

    h, w = heatmap.shape
    pixels = (heatmap * 255).astype(np.uint8)

    def chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    raw = b""
    for row in pixels:
        raw += b"\x00" + row.tobytes()

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(sig)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", zlib.compress(raw)))
        f.write(chunk(b"IEND", b""))


if __name__ == "__main__":
    main()
