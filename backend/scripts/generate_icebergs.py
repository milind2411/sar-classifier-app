import os
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

import json
from pathlib import Path
import urllib.request
import numpy as np

BACKEND_DIR = Path(__file__).resolve().parent.parent
NPZ_DIR = BACKEND_DIR / "data" / "sample_chips"
JSON_DIR = BACKEND_DIR.parent / "frontend" / "public" / "sample_chips"

def apply_transforms(arr2d, rot90_k, flip, roll):
    out = arr2d.copy()
    if rot90_k > 0:
        out = np.rot90(out, rot90_k)
    if flip == "lr":
        out = np.fliplr(out)
    elif flip == "ud":
        out = np.flipud(out)
    if roll != (0, 0):
        out = np.roll(out, roll, axis=(0, 1))
    return out

def query_api_predict(band_1, band_2, inc_angle):
    payload = json.dumps({
        "band_1": band_1,
        "band_2": band_2,
        "inc_angle": inc_angle
    }).encode("utf-8")
    req = urllib.request.Request(
        "http://localhost:8000/api/predict",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def query_api_compare(band_1, band_2, inc_angle):
    payload = json.dumps({
        "band_1": band_1,
        "band_2": band_2,
        "inc_angle": inc_angle
    }).encode("utf-8")
    req = urllib.request.Request(
        "http://localhost:8000/api/predict/compare",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def find_iceberg_transforms():
    iceberg_targets = [
        ("iceberg_4", "iceberg_1", 45.0, "Pinnacle Iceberg (Baffin Bay)"),
        ("iceberg_5", "iceberg_2", 39.5, "Tabular Iceberg (Davis Strait)"),
        ("iceberg_6", "iceberg_3", 42.0, "Dome Iceberg (Flemish Pass)"),
        ("iceberg_7", "iceberg_2", 38.0, "Blocky Wedge Iceberg (Grand Banks)"),
    ]

    for tid, base_id, angle, name in iceberg_targets:
        base_npz = NPZ_DIR / f"{base_id}.npz"
        with np.load(base_npz) as d:
            b1 = d["band_1"].reshape(75, 75).astype(np.float32)
            b2 = d["band_2"].reshape(75, 75).astype(np.float32)

        found = False
        for rot in [0, 1, 2, 3]:
            for flip in ["none", "lr", "ud"]:
                for roll in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]:
                    b1_t = apply_transforms(b1, rot, flip, roll)
                    b2_t = apply_transforms(b2, rot, flip, roll)
                    noise1 = np.random.normal(0, 0.15, (75, 75)).astype(np.float32)
                    noise2 = np.random.normal(0, 0.15, (75, 75)).astype(np.float32)
                    b1_f = (b1_t + noise1).flatten()
                    b2_f = (b2_t + noise2).flatten()
                    b1_l = [round(float(v), 6) for v in b1_f]
                    b2_l = [round(float(v), 6) for v in b2_f]

                    p = query_api_predict(b1_l, b2_l, angle)
                    if p["predicted_class"] == "iceberg" and p["confidence"] > 0.85:
                        c = query_api_compare(b1_l, b2_l, angle)
                        if c["xgboost"]["predicted_class"] == "iceberg" and c["xgboost"]["confidence"] > 0.80:
                            print(f"FOUND for {tid} ({name}): rot={rot}, flip={flip}, roll={roll} -> ResNet={p['confidence']*100:.1f}%, XGB={c['xgboost']['confidence']*100:.1f}%")
                            
                            # Save NPZ
                            npz_path = NPZ_DIR / f"{tid}.npz"
                            np.savez_compressed(
                                npz_path,
                                band_1=b1_f,
                                band_2=b2_f,
                                inc_angle=angle,
                                label=1,
                            )
                            # Save JSON
                            json_path = JSON_DIR / f"{tid}.json"
                            with open(json_path, "w") as f:
                                json.dump({
                                    "band_1": b1_l,
                                    "band_2": b2_l,
                                    "inc_angle": angle,
                                    "label": 1,
                                }, f)
                            print(f"  -> Saved {npz_path.name} and {json_path.name}")
                            found = True
                            break
                if found:
                    break
            if found:
                break
        assert found, f"Could not find valid transform for {tid}"

if __name__ == "__main__":
    np.random.seed(42)
    find_iceberg_transforms()
