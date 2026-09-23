"""
Alias re-export for XGBoost classical ML baseline service.
References XGBoostBaselineClassifier in xgb_inference.py.
"""

from xgb_inference import XGBoostBaselineClassifier, XGBoostService

__all__ = ["XGBoostBaselineClassifier", "XGBoostService"]
