"""
Pydantic request/response models for the SAR classifier API.

Both bands must be flattened 75x75 arrays (5625 floats), matching the
raw format used in training (df_train['band_1'] / ['band_2']).
"""

import math
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

CHIP_LENGTH = 75 * 75  # 5625


class ChipInput(BaseModel):
    band_1: List[float] = Field(
        ..., min_length=CHIP_LENGTH, max_length=CHIP_LENGTH,
        description="Flattened 75x75 HH band, raw (unfiltered) values."
    )
    band_2: List[float] = Field(
        ..., min_length=CHIP_LENGTH, max_length=CHIP_LENGTH,
        description="Flattened 75x75 HV band, raw (unfiltered) values."
    )
    inc_angle: float = Field(..., ge=0, le=90, description="Satellite incidence angle in degrees.")

    @field_validator("band_1", "band_2")
    @classmethod
    def validate_finite_bands(cls, v: List[float]) -> List[float]:
        if any(not math.isfinite(x) for x in v):
            raise ValueError("Band array values must be finite numbers (NaN and Infinity are not permitted)")
        return v


class RadarQualityTelemetry(BaseModel):
    target_to_clutter_ratio_db: float = Field(..., description="Target-to-Clutter Ratio (SNR) in dB for the HH band.")
    target_contrast_assessment: str = Field(..., description="'High Contrast Target' or 'Low Contrast / High Clutter'")
    speckle_reduction_pct: float = Field(..., description="Speckle reduction percentage achieved by adaptive Lee filtering.")
    enl_filtered: float = Field(..., description="Equivalent Number of Looks (ENL) after Lee filtering.")
    cross_pol_delta_db: float = Field(..., description="Cross-polarization delta (HH - HV in dB).")
    dynamic_range_db: float = Field(..., description="Dynamic range (max - min in dB).")


class PredictionOutput(BaseModel):
    probability_iceberg: float = Field(..., description="Model probability that the chip is an iceberg, in [0,1].")
    predicted_class: str = Field(..., description="'ship' or 'iceberg' based on a 0.5 threshold.")
    confidence: float = Field(..., description="Probability of the predicted class (always >= 0.5).")
    telemetry: Optional[RadarQualityTelemetry] = Field(default=None, description="Radar signal-to-clutter ratio (SNR) and image quality metrics.")


class BatchChipInput(BaseModel):
    chips: List[ChipInput] = Field(
        ...,
        max_length=50,
        description="List of SAR chips to classify (maximum 50 chips per batch)."
    )



class BatchPredictionOutput(BaseModel):
    results: List[PredictionOutput] = Field(
        ...,
        description="List of prediction outputs corresponding 1:1 to the input chips."
    )


class AngleSweepInput(BaseModel):
    band_1: List[float] = Field(..., min_length=CHIP_LENGTH, max_length=CHIP_LENGTH)
    band_2: List[float] = Field(..., min_length=CHIP_LENGTH, max_length=CHIP_LENGTH)
    angles: Optional[List[float]] = Field(
        default=None,
        description="Angles to sweep in degrees. Defaults to 30-46 in steps of 2 if omitted."
    )

    @field_validator("band_1", "band_2")
    @classmethod
    def validate_finite_bands(cls, v: List[float]) -> List[float]:
        if any(not math.isfinite(x) for x in v):
            raise ValueError("Band array values must be finite numbers (NaN and Infinity are not permitted)")
        return v

    @field_validator("angles")
    @classmethod
    def validate_finite_angles(cls, v: Optional[List[float]]) -> Optional[List[float]]:
        if v is not None and any(not math.isfinite(x) or not (0.0 <= x <= 90.0) for x in v):
            raise ValueError("Angles must be finite numbers between 0 and 90 degrees")
        return v


class AngleSweepPoint(BaseModel):
    angle: float
    probability_iceberg: float


class AngleSweepOutput(BaseModel):
    points: List[AngleSweepPoint]


class GradCamOutput(BaseModel):
    heatmap: List[List[float]] = Field(..., description="75x75 grid, values in [0,1]. Frontend applies its own colormap/overlay.")
    layer_used: str = Field(..., description="Which conv layer the heatmap was computed from.")


class ModelPredictionResult(BaseModel):
    model_name: str = Field(..., description="Name of the model (e.g. 'ResNet50 Deep Learning' or 'GLCM + XGBoost Baseline').")
    model_type: str = Field(..., description="'deep_learning' or 'classical_ml'")
    probability_iceberg: float = Field(..., description="Probability of iceberg in [0, 1].")
    predicted_class: str = Field(..., description="'iceberg' or 'ship'")
    confidence: float = Field(..., description="Confidence score in [0.5, 1.0].")
    latency_ms: float = Field(..., description="Inference latency in milliseconds.")


class ModelConsensus(BaseModel):
    agreement: bool = Field(..., description="True if both models agree on the predicted class.")
    consensus_class: str = Field(..., description="'iceberg', 'ship', or 'divergent'")
    confidence_delta: float = Field(..., description="Absolute difference in iceberg probabilities.")
    lead_model: str = Field(..., description="Model with higher confidence.")


class RadarTextureHighlights(BaseModel):
    hh_contrast: float = Field(..., description="HH band GLCM contrast.")
    hh_homogeneity: float = Field(..., description="HH band GLCM homogeneity.")
    hh_skewness: float = Field(..., description="HH radar scattering asymmetry/skewness.")
    hv_contrast: float = Field(..., description="HV band GLCM contrast.")
    hv_homogeneity: float = Field(..., description="HV band GLCM homogeneity.")
    diff_skewness: float = Field(..., description="Polarimetric difference skewness.")


class ModelComparisonOutput(BaseModel):
    resnet: ModelPredictionResult
    xgboost: ModelPredictionResult
    consensus: ModelConsensus
    texture_highlights: RadarTextureHighlights
    top_classical_features: Dict[str, float] = Field(..., description="Top contributing features for this prediction.")
    telemetry: Optional[RadarQualityTelemetry] = Field(default=None, description="Radar signal-to-clutter ratio (SNR) and image quality metrics.")


class PredictionHistoryItem(BaseModel):
    id: int = Field(..., description="Unique database ID of prediction")
    timestamp: str = Field(..., description="ISO timestamp of prediction")
    predicted_class: str = Field(..., description="'ship' or 'iceberg'")
    probability_iceberg: float = Field(..., description="Probability score in [0, 1]")
    confidence: float = Field(..., description="Confidence score in [0.5, 1.0]")
    inc_angle: float = Field(..., description="Satellite incidence angle in degrees")
    model_used: str = Field(..., description="Model identifier (e.g. 'resnet50')")
    source: str = Field(..., description="Source route (e.g. 'predict', 'upload', 'batch')")


class HealthResponse(BaseModel):
    status: str = Field(..., description="System health status ('ok')")


