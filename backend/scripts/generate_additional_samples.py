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

JSON_DIR.mkdir(parents=True, exist_ok=True)
NPZ_DIR.mkdir(parents=True, exist_ok=True)

# 9 Additional Datasets configured with numpy transforms (rotations, flips, rolls, and jitter)
NEW_TARGETS = [
    # 5 New Ships
    {
        "id": "ship_4",
        "label": 0,
        "base": "ship_1",
        "inc_angle": 38.4,
        "rot90_k": 1,
        "flip": "lr",
        "roll": (1, -1),
        "noise_scale": 0.2,
        "name": "Cargo Vessel (Flemish Pass)",
    },
    {
        "id": "ship_5",
        "label": 0,
        "base": "ship_2",
        "inc_angle": 36.2,
        "rot90_k": 2,
        "flip": "none",
        "roll": (-1, 2),
        "noise_scale": 0.25,
        "name": "Fishing Trawler (Grand Banks)",
    },
    {
        "id": "ship_6",
        "label": 0,
        "base": "ship_3",
        "inc_angle": 41.5,
        "rot90_k": 3,
        "flip": "ud",
        "roll": (2, -2),
        "noise_scale": 0.2,
        "name": "Container Carrier (Davis Strait)",
    },
    {
        "id": "ship_7",
        "label": 0,
        "base": "ship_1",
        "inc_angle": 42.8,
        "rot90_k": 2,
        "flip": "ud",
        "roll": (-2, 1),
        "noise_scale": 0.2,
        "name": "Tanker Vessel (Baffin Bay)",
    },
    {
        "id": "ship_8",
        "label": 0,
        "base": "ship_2",
        "inc_angle": 34.1,
        "rot90_k": 1,
        "flip": "lr",
        "roll": (1, 1),
        "noise_scale": 0.25,
        "name": "Offshore Patrol Craft (Kara Sea)",
    },
    # 4 New Icebergs
    {
        "id": "iceberg_4",
        "label": 1,
        "base": "iceberg_1",
        "inc_angle": 43.5,
        "rot90_k": 1,
        "flip": "lr",
        "roll": (1, 1),
        "noise_scale": 0.2,
        "name": "Pinnacle Iceberg (Baffin Bay)",
    },
    {
        "id": "iceberg_5",
        "label": 1,
        "base": "iceberg_2",
        "inc_angle": 39.8,
        "rot90_k": 2,
        "flip": "ud",
        "roll": (-1, -1),
        "noise_scale": 0.25,
        "name": "Tabular Iceberg (Davis Strait)",
    },
    {
        "id": "iceberg_6",
        "label": 1,
        "base": "iceberg_3",
        "inc_angle": 40.7,
        "rot90_k": 3,
        "flip": "none",
        "roll": (2, 0),
        "noise_scale": 0.2,
        "name": "Dome Iceberg (Flemish Pass)",
    },
    {
        "id": "iceberg_7",
        "label": 1,
        "base": "iceberg_1",
        "inc_angle": 37.4,
        "rot90_k": 2,
        "flip": "none",
        "roll": (-1, 2),
        "noise_scale": 0.25,
        "name": "Blocky Wedge Iceberg (Grand Banks)",
    },
]

def apply_transforms(arr2d, spec):
    out = arr2d.copy()
    if spec["rot90_k"] > 0:
        out = np.rot90(out, spec["rot90_k"])
    if spec["flip"] == "lr":
        out = np.fliplr(out)
    elif spec["flip"] == "ud":
        out = np.flipud(out)
    if spec["roll"] != (0, 0):
        out = np.roll(out, spec["roll"], axis=(0, 1))
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

def main():
    np.random.seed(42)
    print("Generating 9 additional radar datasets and validating via live API...")

    for spec in NEW_TARGETS:
        base_id = spec["base"]
        base_npz = NPZ_DIR / f"{base_id}.npz"
        with np.load(base_npz) as d:
            b1 = d["band_1"].reshape(75, 75).astype(np.float32)
            b2 = d["band_2"].reshape(75, 75).astype(np.float32)

        b1_t = apply_transforms(b1, spec)
        b2_t = apply_transforms(b2, spec)

        # Subtle noise to add natural speckle variance
        noise1 = np.random.normal(0, spec["noise_scale"], (75, 75)).astype(np.float32)
        noise2 = np.random.normal(0, spec["noise_scale"], (75, 75)).astype(np.float32)
        b1_final = (b1_t + noise1).flatten()
        b2_final = (b2_t + noise2).flatten()

        angle = float(spec["inc_angle"])
        label = int(spec["label"])
        target_id = spec["id"]

        b1_list = [round(float(v), 6) for v in b1_final]
        b2_list = [round(float(v), 6) for v in b2_final]

        # Query live running backend
        pred_resnet = query_api_predict(b1_list, b2_list, angle)
        pred_comp = query_api_compare(b1_list, b2_list, angle)

        res_class = pred_resnet["predicted_class"]
        res_conf = pred_resnet["confidence"]
        xgb_class = pred_comp["xgboost"]["predicted_class"]
        xgb_conf = pred_comp["xgboost"]["confidence"]

        expected_class = "iceberg" if label == 1 else "ship"

        print(f"[{target_id}] ({spec['name']}): Expected={expected_class} | ResNet={res_class} ({res_conf*100:.1f}%) | XGB={xgb_class} ({xgb_conf*100:.1f}%)")

        assert res_class == expected_class, f"ResNet mismatch for {target_id}: got {res_class}, expected {expected_class}"
        assert xgb_class == expected_class, f"XGBoost mismatch for {target_id}: got {xgb_class}, expected {expected_class}"

        # Save to NPZ
        npz_path = NPZ_DIR / f"{target_id}.npz"
        np.savez_compressed(
            npz_path,
            band_1=b1_final,
            band_2=b2_final,
            inc_angle=angle,
            label=label,
        )

        # Save to JSON
        json_path = JSON_DIR / f"{target_id}.json"
        with open(json_path, "w") as f:
            json.dump({
                "band_1": b1_list,
                "band_2": b2_list,
                "inc_angle": angle,
                "label": label,
            }, f)

        print(f"  -> Saved {npz_path.name} and {json_path.name}")

    print("\nAll 9 additional datasets successfully generated and verified via live API!")

if __name__ == "__main__":
    main()
