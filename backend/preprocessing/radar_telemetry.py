"""
Radar Physics & Maritime Risk Scoring Engine for SAR Imagery.

Computes quantifiable SAR image quality metrics:
- Equivalent Number of Looks (ENL) before & after Lee filtering: ENL = (mean^2) / (variance)
- Speckle Index (S = std / mean) & Speckle Suppression Percentage
- Target-to-Clutter Ratio (TCR in dB): Contrast between central target and surrounding sea clutter
- Maritime Navigational Assessment & Advisories: Translates probabilities into navigational advisory protocols
"""

from typing import Dict, List, Tuple
import numpy as np

from preprocessing.sar_preprocessing import lee_filter

CONTRAST_THRESHOLD_DB = 6.0
HIGH_CONTRAST_LABEL = "High Contrast Target"
LOW_CONTRAST_LABEL = "Low Contrast / High Clutter"


def assess_target_contrast(tcr_db: float) -> str:
    """
    Single source of truth for radar target contrast assessment.
    A Target-to-Clutter Ratio (TCR) >= 6.0 dB indicates high target contrast relative to background sea clutter.
    """
    return HIGH_CONTRAST_LABEL if tcr_db >= CONTRAST_THRESHOLD_DB else LOW_CONTRAST_LABEL


def compute_radar_quality_metrics(
    raw_band_1: List[float],
    raw_band_2: List[float]
) -> Dict[str, any]:
    """
    Compute domain-specific radar physics telemetry for the raw and filtered SAR chip.
    Operates in the linear intensity domain (Power = 10^(dB / 10)).
    """
    b1_db = np.array(raw_band_1, dtype=np.float32).reshape(75, 75)
    b2_db = np.array(raw_band_2, dtype=np.float32).reshape(75, 75)

    # 1. Linear Intensity conversion for physical radar statistics
    # SAR intensity: I = 10^(dB / 10)
    p_raw = 10.0 ** (b1_db / 10.0)

    # Filtered HH band
    f_b1_db = lee_filter(b1_db)
    p_filtered = 10.0 ** (f_b1_db / 10.0)

    # 2. Target core and sea clutter annulus masks (shared across TCR & ENL)
    # Core target (central 15x15) vs sea clutter annulus (outer border masking central 25x25)
    H, W = b1_db.shape
    cr_r = slice(H // 2 - 7, H // 2 + 8)
    cr_c = slice(W // 2 - 7, W // 2 + 8)
    target_core = p_raw[cr_r, cr_c]

    # Clutter ring: mask out central 25x25 (homogeneous sea clutter region)
    clutter_mask = np.ones((H, W), dtype=bool)
    clutter_mask[H // 2 - 12 : H // 2 + 13, W // 2 - 12 : W // 2 + 13] = False

    clutter_raw = p_raw[clutter_mask]
    clutter_filtered = p_filtered[clutter_mask]

    # 3. Equivalent Number of Looks (ENL = mean^2 / var) over homogeneous clutter annulus
    mean_raw = float(np.mean(clutter_raw))
    var_raw = float(np.var(clutter_raw))
    enl_raw = float((mean_raw ** 2) / (var_raw + 1e-9))

    mean_filt = float(np.mean(clutter_filtered))
    var_filt = float(np.var(clutter_filtered))
    enl_filtered = float((mean_filt ** 2) / (var_filt + 1e-9))

    # 4. Speckle Index (S = std / mean) & Speckle Suppression Percentage over clutter
    s_raw = float(np.sqrt(var_raw) / (mean_raw + 1e-9))
    s_filt = float(np.sqrt(var_filt) / (mean_filt + 1e-9))
    speckle_reduction_pct = float(max(0.0, (s_raw - s_filt) / (s_raw + 1e-9) * 100.0))

    # 5. Target-to-Clutter Ratio (TCR) in dB
    mean_target_power = float(np.mean(target_core))
    mean_clutter_power = float(np.mean(clutter_raw)) + 1e-9
    tcr_db = float(10.0 * np.log10(max(1e-6, mean_target_power / mean_clutter_power)))

    # 6. Polarization Contrast (HH vs HV decibel difference)
    f_b2_db = lee_filter(b2_db)
    cross_pol_ratio = float(np.mean(f_b1_db) - np.mean(f_b2_db))

    tcr_db_rounded = round(tcr_db, 2)

    return {
        "enl_raw": round(enl_raw, 2),
        "enl_unfiltered": round(enl_raw, 2),
        "enl_filtered": round(enl_filtered, 2),
        "speckle_reduction_pct": round(speckle_reduction_pct, 1),
        "target_to_clutter_ratio_db": tcr_db_rounded,
        "target_contrast_assessment": assess_target_contrast(tcr_db_rounded),
        "cross_pol_delta_db": round(cross_pol_ratio, 2),
        "dynamic_range_db": round(float(np.max(b1_db) - np.min(b1_db)), 2),
    }


def extract_radar_quality_telemetry(
    raw_band_1: List[float],
    raw_band_2: List[float]
) -> Dict[str, any]:
    """
    Extract all radar quality telemetry metrics including target contrast assessment.
    Returns a dict matching schemas.RadarQualityTelemetry.
    """
    metrics = compute_radar_quality_metrics(raw_band_1, raw_band_2)
    return {
        "target_to_clutter_ratio_db": metrics["target_to_clutter_ratio_db"],
        "target_contrast_assessment": metrics["target_contrast_assessment"],
        "speckle_reduction_pct": metrics["speckle_reduction_pct"],
        "enl_filtered": metrics["enl_filtered"],
        "cross_pol_delta_db": metrics["cross_pol_delta_db"],
        "dynamic_range_db": metrics["dynamic_range_db"],
    }


def generate_maritime_risk_directive(
    predicted_class: str,
    probability_iceberg: float,
    confidence: float,
    inc_angle: float,
    tcr_db: float
) -> Dict:
    """
    Generate actionable maritime navigational advisories, risk levels, and standoff distances.
    """
    if predicted_class == "iceberg":
        if confidence >= 0.85:
            risk_level = "CRITICAL_HAZARD"
            risk_color = "red"
            standoff_nm = 5.0
            directive = (
                "EMERGENCY NAVIGATIONAL WARNING: Confirmed high-confidence non-cooperative "
                "iceberg contact. Enforce minimum 5.0 nautical mile exclusion standoff radius. "
                "Broadcast urgent hazard notice to regional Arctic transit corridor."
            )
        else:
            risk_level = "ELEVATED_RISK"
            risk_color = "amber"
            standoff_nm = 2.5
            directive = (
                "OPERATIONAL ADVISORY: Potential iceberg contact with borderline confidence. "
                f"Viewing geometry ({inc_angle:.1f}°) or sea clutter may induce backscatter ambiguity. "
                "Recommend 2.5 nm standoff and visual or radar verification."
            )
    else:
        risk_level = "NEGLIGIBLE_HAZARD"
        risk_color = "emerald"
        standoff_nm = 1.0
        directive = (
            "CORRIDOR NOMINAL: Radar backscatter profile aligns with metallic surface vessel. "
            "Query maritime AIS (Automatic Identification System) for transponder signature verification."
        )

    return {
        "risk_level": risk_level,
        "risk_color": risk_color,
        "recommended_standoff_nm": standoff_nm,
        "directive": directive,
        "target_contrast_assessment": assess_target_contrast(tcr_db),
    }
