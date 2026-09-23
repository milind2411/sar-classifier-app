"""
One-time migration script: Convert sample chips from legacy .npy format
to secure .npz format (NumPy Zip archive) with named arrays.

This completely eliminates the need for allow_pickle=True when loading sample chips.
"""

from pathlib import Path
import numpy as np

SAMPLE_DIR = Path(__file__).resolve().parents[1] / "data" / "sample_chips"


def migrate():
    npy_files = sorted(SAMPLE_DIR.glob("*.npy"))
    print(f"Found {len(npy_files)} .npy files in {SAMPLE_DIR}")

    if not npy_files:
        print("No .npy files found to migrate.")
        return

    converted_files = []

    for npy_file in npy_files:
        print(f"Migrating {npy_file.name}...")
        # Trusted local read of existing .npy dict
        raw_data = np.load(npy_file, allow_pickle=True).item()

        band_1 = np.array(raw_data["band_1"], dtype=np.float32)
        band_2 = np.array(raw_data["band_2"], dtype=np.float32)
        inc_angle = float(raw_data["inc_angle"])
        label = int(raw_data["label"])

        npz_file = npy_file.with_suffix(".npz")
        np.savez(
            npz_file,
            band_1=band_1,
            band_2=band_2,
            inc_angle=inc_angle,
            label=label,
        )

        # Verify that the new .npz file is readable WITHOUT allow_pickle
        with np.load(npz_file) as loaded:
            assert "band_1" in loaded, f"Missing band_1 in {npz_file.name}"
            assert "band_2" in loaded, f"Missing band_2 in {npz_file.name}"
            assert "inc_angle" in loaded, f"Missing inc_angle in {npz_file.name}"
            assert "label" in loaded, f"Missing label in {npz_file.name}"
            assert len(loaded["band_1"]) == 5625, f"Invalid band_1 length in {npz_file.name}"
            assert len(loaded["band_2"]) == 5625, f"Invalid band_2 length in {npz_file.name}"
            assert float(loaded["inc_angle"]) == inc_angle
            assert int(loaded["label"]) == label

        converted_files.append((npy_file, npz_file))
        print(f"  -> Successfully created {npz_file.name} ({npz_file.stat().st_size} bytes)")

    # Confirm all 6 .npz exist
    npz_count = len(list(SAMPLE_DIR.glob("*.npz")))
    print(f"\nVerification: {npz_count} .npz files exist in {SAMPLE_DIR}")
    assert npz_count == len(npy_files) == 6, f"Expected 6 .npz files, found {npz_count}"

    # Delete old .npy files
    print("\nRemoving old .npy files...")
    for npy_file, _ in converted_files:
        npy_file.unlink()
        print(f"  Deleted {npy_file.name}")

    remaining_npy = list(SAMPLE_DIR.glob("*.npy"))
    print(f"Remaining .npy files: {len(remaining_npy)}")
    assert len(remaining_npy) == 0, "Failed to remove all .npy files!"
    print("Migration from .npy to .npz complete!")


if __name__ == "__main__":
    migrate()
