"""
Feature extraction pipeline for classical SAR classification (GLCM + Statistical moments).

Extracts 49 texture and radar scattering descriptors from raw Sentinel-1 SAR chips
to feed the XGBoost baseline classifier.

Feature breakdown:
- GLCM Haralick Textures (24 features):
  - contrast, homogeneity, energy, correlation
  - distances d in [1, 2], averaged across 4 orientations (0, 45, 90, 135 deg)
  - computed on filtered HH, filtered HV, and difference (HH - HV)
- First-Order Radar Statistics & Clutter (24 features):
  - mean, std, max, min, skewness, kurtosis, peak-to-mean clutter ratio, center-to-total energy fraction
  - computed on filtered HH, filtered HV, and difference (HH - HV)
- Satellite Incidence Angle (1 feature):
  - inc_angle

Single source of truth for classical ML feature representation.
"""

from typing import Dict, List, Tuple
import numpy as np

from preprocessing.sar_preprocessing import lee_filter

N_LEVELS = 16
GLCM_DISTANCES = [1, 2]
GLCM_DIRECTIONS = [(0, 1), (-1, 1), (-1, 0), (-1, -1)]  # 0, 45, 90, 135 deg


def _quantize_band(img: np.ndarray, n_levels: int = N_LEVELS) -> np.ndarray:
    """Quantize continuous SAR intensity map to discrete integer bins [0, n_levels-1]."""
    mn, mx = float(np.min(img)), float(np.max(img))
    if mx > mn:
        scaled = (img - mn) / (mx - mn + 1e-6) * (n_levels - 1)
        return np.clip(scaled.astype(np.int32), 0, n_levels - 1)
    return np.zeros_like(img, dtype=np.int32)


def _compute_glcm_channel(
    img: np.ndarray,
    prefix: str,
    n_levels: int = N_LEVELS,
    distances: List[int] = GLCM_DISTANCES
) -> Dict[str, float]:
    """
    Vectorized computation of Gray-Level Co-occurrence Matrix (GLCM) Haralick features.
    Computes contrast, homogeneity, energy, and correlation averaged over 4 orientations.
    """
    q = _quantize_band(img, n_levels)
    H, W = q.shape
    features = {}

    i_indices, j_indices = np.indices((n_levels, n_levels))
    diff_sq = (i_indices - j_indices) ** 2
    homo_denom = 1.0 + diff_sq

    for d in distances:
        contrasts, homos, energies, correlations = [], [], [], []
        for dr, dc in GLCM_DIRECTIONS:
            r_dr, c_dc = dr * d, dc * d
            r1_start = max(0, -r_dr)
            r1_end = H - max(0, r_dr)
            c1_start = max(0, -c_dc)
            c1_end = W - max(0, c_dc)

            p1 = q[r1_start:r1_end, c1_start:c1_end].ravel()
            p2 = q[r1_start + r_dr:r1_end + r_dr, c1_start + c_dc:c1_end + c_dc].ravel()

            pairs = p1 * n_levels + p2
            counts = np.bincount(pairs, minlength=n_levels * n_levels).astype(np.float64)
            mat = counts.reshape(n_levels, n_levels)
            mat = mat + mat.T  # Symmetrize GLCM
            total = mat.sum()
            p = mat / total if total > 0 else np.zeros_like(mat)

            contrasts.append(float(np.sum(diff_sq * p)))
            homos.append(float(np.sum(p / homo_denom)))
            energies.append(float(np.sum(p ** 2)))

            mu_i = float(np.sum(i_indices * p))
            mu_j = float(np.sum(j_indices * p))
            sigma_i = float(np.sqrt(np.sum((i_indices - mu_i) ** 2 * p)))
            sigma_j = float(np.sqrt(np.sum((j_indices - mu_j) ** 2 * p)))
            if sigma_i * sigma_j > 1e-9:
                corr = float(np.sum((i_indices - mu_i) * (j_indices - mu_j) * p) / (sigma_i * sigma_j))
            else:
                corr = 0.0
            correlations.append(corr)

        features[f"{prefix}_glcm_contrast_d{d}"] = float(np.mean(contrasts))
        features[f"{prefix}_glcm_homogeneity_d{d}"] = float(np.mean(homos))
        features[f"{prefix}_glcm_energy_d{d}"] = float(np.mean(energies))
        features[f"{prefix}_glcm_correlation_d{d}"] = float(np.mean(correlations))

    return features


def _compute_stats_channel(img: np.ndarray, prefix: str) -> Dict[str, float]:
    """
    Compute first-order statistical and clutter metrics for a SAR channel.
    Ships exhibit high positive skewness (specular point targets) and high center concentration.
    """
    flat = img.ravel().astype(np.float64)
    mean_val = float(np.mean(flat))
    std_val = float(np.std(flat))
    max_val = float(np.max(flat))
    min_val = float(np.min(flat))

    # Higher order moments
    if std_val > 1e-6:
        normalized = (flat - mean_val) / std_val
        skewness = float(np.mean(normalized ** 3))
        kurtosis = float(np.mean(normalized ** 4) - 3.0)
    else:
        skewness = 0.0
        kurtosis = 0.0

    # Peak-to-mean clutter ratio (CFAR signal-to-clutter ratio)
    peak_to_mean = float(max_val / (abs(mean_val) + 1e-6))

    # Center-to-total energy fraction (15x15 central crop)
    H, W = img.shape
    cr_r = slice(H // 2 - 7, H // 2 + 8)
    cr_c = slice(W // 2 - 7, W // 2 + 8)
    center_crop = img[cr_r, cr_c].ravel().astype(np.float64)
    center_energy = float(np.sum(center_crop ** 2))
    total_energy = float(np.sum(flat ** 2)) + 1e-6
    center_ratio = float(center_energy / total_energy)

    return {
        f"{prefix}_mean": mean_val,
        f"{prefix}_std": std_val,
        f"{prefix}_max": max_val,
        f"{prefix}_min": min_val,
        f"{prefix}_skewness": skewness,
        f"{prefix}_kurtosis": kurtosis,
        f"{prefix}_peak_to_mean": peak_to_mean,
        f"{prefix}_center_energy_ratio": center_ratio,
    }


def extract_features_dict(
    band_1: List[float],
    band_2: List[float],
    inc_angle: float
) -> Dict[str, float]:
    """
    Extract all 49 classical features as a named dictionary.
    Reuses the canonical apply_lee_filter from sar_preprocessing.py.
    """
    b1_raw = np.array(band_1, dtype=np.float32).reshape(75, 75)
    b2_raw = np.array(band_2, dtype=np.float32).reshape(75, 75)

    f_b1 = lee_filter(b1_raw)
    f_b2 = lee_filter(b2_raw)
    f_diff = f_b1 - f_b2

    features: Dict[str, float] = {}

    # 1. HH features
    features.update(_compute_glcm_channel(f_b1, "hh"))
    features.update(_compute_stats_channel(f_b1, "hh"))

    # 2. HV features
    features.update(_compute_glcm_channel(f_b2, "hv"))
    features.update(_compute_stats_channel(f_b2, "hv"))

    # 3. Difference (HH - HV) features
    features.update(_compute_glcm_channel(f_diff, "diff"))
    features.update(_compute_stats_channel(f_diff, "diff"))

    # 4. Incidence angle
    features["inc_angle"] = float(inc_angle)

    return features


def get_feature_names() -> List[str]:
    """Return ordered list of the 49 feature names."""
    dummy = [0.0] * 5625
    sample_dict = extract_features_dict(dummy, dummy, 40.0)
    return list(sample_dict.keys())


def extract_features_vector(
    band_1: List[float],
    band_2: List[float],
    inc_angle: float
) -> np.ndarray:
    """
    Extract all 49 features as a flattened 1D NumPy array of shape (49,) dtype float32.
    """
    feats = extract_features_dict(band_1, band_2, inc_angle)
    return np.array(list(feats.values()), dtype=np.float32)
