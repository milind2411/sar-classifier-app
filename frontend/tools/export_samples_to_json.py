#!/usr/bin/env python3
"""
# Export backend sample .npz chips to JSON files for the frontend.
#
# Usage (from project root):
#     python frontend/tools/export_samples_to_json.py
#
# Reads:  backend/data/sample_chips/{ship,iceberg}_{1,2,3}.npz
# Writes: frontend/public/sample_chips/{ship,iceberg}_{1,2,3}.json
#
# Each output JSON has the structure:
#     { "band_1": [...], "band_2": [...], "inc_angle": float, "label": int }
"""

import json
import sys
from pathlib import Path

import numpy as np

BACKEND_CHIPS = Path(__file__).resolve().parents[2] / "backend" / "data" / "sample_chips"
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "public" / "sample_chips"


def export_chip(npz_path: Path, out_path: Path) -> None:
    with np.load(npz_path) as data:
        chip_json = {
            "band_1": [float(x) for x in data["band_1"]],
            "band_2": [float(x) for x in data["band_2"]],
            "inc_angle": float(data["inc_angle"]),
            "label": int(data["label"]),
        }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(chip_json, f)
    size_mb = out_path.stat().st_size / 1024 / 1024
    print(f"  OK {npz_path.name} -> {out_path.name}  ({size_mb:.1f} MB)")


def main():
    if not BACKEND_CHIPS.exists():
        print(f"ERROR: Sample chips directory not found: {BACKEND_CHIPS}", file=sys.stderr)
        sys.exit(1)

    npz_files = sorted(BACKEND_CHIPS.glob("*.npz"))
    if not npz_files:
        print(f"ERROR: No .npz files found in {BACKEND_CHIPS}", file=sys.stderr)
        sys.exit(1)

    print(f"Exporting {len(npz_files)} sample chips to JSON...")
    for npz_path in npz_files:
        out_path = OUTPUT_DIR / f"{npz_path.stem}.json"
        export_chip(npz_path, out_path)

    print(f"\nDone! JSON files written to {OUTPUT_DIR}")
    print("Run 'npm run dev' to serve them at /sample_chips/*.json")


if __name__ == "__main__":
    main()
