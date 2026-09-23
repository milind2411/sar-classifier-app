import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import { predict, angleSweep, gradcam, compare } from '../api';

// ── Built-in sample chips (ground-truth Kaggle samples) ──
export const SAMPLES = [
  { id: 'ship_1', label: 'Ship #1', class: 'ship' },
  { id: 'ship_2', label: 'Ship #2', class: 'ship' },
  { id: 'ship_3', label: 'Ship #3', class: 'ship' },
  { id: 'iceberg_1', label: 'Iceberg #1', class: 'iceberg' },
  { id: 'iceberg_2', label: 'Iceberg #2', class: 'iceberg' },
  { id: 'iceberg_3', label: 'Iceberg #3', class: 'iceberg' },
];

const ChipContext = createContext(null);

export function ChipProvider({ children }) {
  const shouldReduceMotion = useReducedMotion();

  // ── Animation Variants ──
  const containerVariants = {
    hidden: { opacity: shouldReduceMotion ? 1 : 0 },
    show: {
      opacity: 1,
      transition: shouldReduceMotion
        ? {}
        : {
            staggerChildren: 0.08,
            delayChildren: 0.05,
          },
    },
  };

  const itemVariants = {
    hidden: { opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.35,
        ease: 'easeOut',
      },
    },
  };

  // ── State ──
  const [chip, setChip] = useState(null); // { band_1, band_2, inc_angle, label?, name }
  const [result, setResult] = useState(null); // PredictionOutput
  const [modelMode, setModelMode] = useState('resnet'); // 'resnet' | 'xgboost' | 'compare'
  const [compareResult, setCompareResult] = useState(null); // ModelComparisonOutput
  const [sweepData, setSweepData] = useState([]); // AngleSweepPoint[]
  const [gradcamData, setGradcamData] = useState(null); // { heatmap, layer_used }

  const [loading, setLoading] = useState(false);
  const [gradcamLoading, setGradcamLoading] = useState(false);
  const [sweepLoading, setSweepLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backendOnline, setBackendOnline] = useState(null);

  // ── Health check on mount ──
  useEffect(() => {
    let isMounted = true;
    fetch('/health')
      .then((res) => {
        if (res.ok) {
          if (isMounted) setBackendOnline(true);
        } else {
          if (isMounted) setBackendOnline(false);
        }
      })
      .catch(() => {
        if (isMounted) setBackendOnline(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Load a chip (from dropzone or sample selector) ──
  const loadChip = useCallback((data) => {
    setChip(data);
    setResult(null);
    setCompareResult(null);
    setSweepData([]);
    setGradcamData(null);
    setError(null);
  }, []);

  // ── Load a built-in sample ──
  const loadSample = useCallback(
    async (sampleId) => {
      try {
        const res = await fetch(`/sample_chips/${sampleId}.json`);
        if (!res.ok) throw new Error(`Sample ${sampleId}.json not found in public/sample_chips/`);
        const data = await res.json();
        loadChip({ ...data, name: `${sampleId}.json` });
      } catch (err) {
        setError(`Failed to load sample: ${err.message}. Run the export tool first.`);
      }
    },
    [loadChip],
  );

  // ── Classify ──
  const handleClassify = useCallback(async () => {
    if (!chip) return;
    setLoading(true);
    setError(null);
    try {
      if (modelMode === 'compare') {
        const compRes = await compare(chip.band_1, chip.band_2, chip.inc_angle);
        setCompareResult(compRes);
        setResult({
          probability_iceberg: compRes.resnet.probability_iceberg,
          predicted_class: compRes.resnet.predicted_class,
          confidence: compRes.resnet.confidence,
          telemetry: compRes.telemetry,
        });
      } else if (modelMode === 'xgboost') {
        const compRes = await compare(chip.band_1, chip.band_2, chip.inc_angle);
        setCompareResult(null);
        setResult({
          probability_iceberg: compRes.xgboost.probability_iceberg,
          predicted_class: compRes.xgboost.predicted_class,
          confidence: compRes.xgboost.confidence,
          telemetry: compRes.telemetry,
        });
      } else {
        const res = await predict(chip.band_1, chip.band_2, chip.inc_angle);
        setResult(res);
        setCompareResult(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [chip, modelMode]);

  // ── Run Dual-Model Comparison directly ──
  const handleRunComparison = useCallback(async () => {
    if (!chip) return;
    setLoading(true);
    setError(null);
    try {
      const compRes = await compare(chip.band_1, chip.band_2, chip.inc_angle);
      setCompareResult(compRes);
      setResult({
        probability_iceberg: compRes.resnet.probability_iceberg,
        predicted_class: compRes.resnet.predicted_class,
        confidence: compRes.resnet.confidence,
        telemetry: compRes.telemetry,
      });
    } catch (err) {
      setError(`Comparison failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [chip]);

  // ── Grad-CAM ──
  const handleGradcam = useCallback(async () => {
    if (!chip) return;
    setGradcamLoading(true);
    setError(null);
    try {
      const res = await gradcam(chip.band_1, chip.band_2, chip.inc_angle);
      setGradcamData(res);
    } catch (err) {
      setError(`Grad-CAM: ${err.message}`);
    } finally {
      setGradcamLoading(false);
    }
  }, [chip]);

  // ── Angle sweep ──
  const handleAngleSweep = useCallback(async () => {
    if (!chip) return;
    setSweepLoading(true);
    setError(null);
    try {
      const res = await angleSweep(chip.band_1, chip.band_2);
      setSweepData(res.points);
    } catch (err) {
      setError(`Angle sweep: ${err.message}`);
    } finally {
      setSweepLoading(false);
    }
  }, [chip]);

  // ── Export Classification Report ──
  const handleExportReport = useCallback(() => {
    if (!result || !chip) return;

    const timestamp = new Date().toISOString();
    const isIceberg = result.predicted_class === 'iceberg';
    const confidencePct = (result.confidence * 100).toFixed(2);
    const probIcebergPct = (result.probability_iceberg * 100).toFixed(2);
    const trueLabelStr = chip.label == null ? 'Unknown' : chip.label === 1 ? 'Iceberg (Class 1)' : 'Ship (Class 0)';
    const matchStatus = chip.label == null ? 'N/A' : (chip.label === 1 && isIceberg) || (chip.label === 0 && !isIceberg) ? 'Match' : 'Discrepancy';

    // Angle sensitivity summary
    let angleStabilityStr = 'Not Evaluated (Run Angle Sweep first)';
    if (sweepData && sweepData.length > 1) {
      let crossover = null;
      let minP = 1.0, maxP = 0.0;
      for (let i = 0; i < sweepData.length; i++) {
        const p = sweepData[i].probability_iceberg;
        if (p < minP) minP = p;
        if (p > maxP) maxP = p;
        if (i < sweepData.length - 1) {
          const pNext = sweepData[i + 1].probability_iceberg;
          if ((p - 0.5) * (pNext - 0.5) <= 0 && p !== pNext) {
            const t = (0.5 - p) / (pNext - p);
            const a = sweepData[i].angle + t * (sweepData[i + 1].angle - sweepData[i].angle);
            crossover = a.toFixed(1);
          }
        }
      }
      if (crossover) {
        angleStabilityStr = `Boundary crossover at ${crossover}° across incidence angle sweep`;
      } else if (maxP < 0.5) {
        angleStabilityStr = `Consistent Ship classification across all pass angles (30.0°–46.0°)`;
      } else {
        angleStabilityStr = `Consistent Iceberg classification across all pass angles (30.0°–46.0°)`;
      }
    }

    // Grad-CAM summary
    let gradcamSummaryStr = 'Not Computed (Run Grad-CAM first)';
    if (gradcamData) {
      let maxVal = 0;
      for (let r of gradcamData.heatmap) {
        for (let v of r) if (v > maxVal) maxVal = v;
      }
      gradcamSummaryStr = `Target Layer: ${gradcamData.layer_used || 'conv3_block4_3_conv'} | Peak Spatial Attention: ${(maxVal * 100).toFixed(1)}%`;
    }

    const telemetry = result?.telemetry || compareResult?.telemetry;
    let telemetrySummaryStr = '';
    if (telemetry) {
      telemetrySummaryStr = `
--------------------------------------------------------------------------------
5. RADAR SENSOR QUALITY & TARGET-TO-CLUTTER RATIO (SNR)
--------------------------------------------------------------------------------
* Target-to-Clutter (SNR): ${telemetry.target_to_clutter_ratio_db >= 0 ? '+' : ''}${telemetry.target_to_clutter_ratio_db.toFixed(1)} dB (${telemetry.target_contrast_assessment})
* Speckle Suppression   : ${telemetry.speckle_reduction_pct.toFixed(1)}% (via Adaptive Lee filtering)
* Filtered ENL           : ${telemetry.enl_filtered.toFixed(2)} looks (Equivalent Number of Looks)
* Cross-Pol Delta (HH-HV): ${telemetry.cross_pol_delta_db >= 0 ? '+' : ''}${telemetry.cross_pol_delta_db.toFixed(1)} dB
* Dynamic Range          : ${telemetry.dynamic_range_db.toFixed(1)} dB
`;
    }

    let compareSummaryStr = '';
    if (compareResult) {
      compareSummaryStr = `
--------------------------------------------------------------------------------
6. MODEL COMPARISON BENCHMARK (RESNET50 vs GLCM+XGBOOST)
--------------------------------------------------------------------------------
* ResNet50 Verdict    : ${compareResult.resnet.predicted_class.toUpperCase()} (${(compareResult.resnet.confidence * 100).toFixed(1)}% conf, ${compareResult.resnet.latency_ms.toFixed(1)}ms)
* XGBoost Verdict     : ${compareResult.xgboost.predicted_class.toUpperCase()} (${(compareResult.xgboost.confidence * 100).toFixed(1)}% conf, ${compareResult.xgboost.latency_ms.toFixed(1)}ms)
* Model Agreement     : ${compareResult.consensus.agreement ? 'MODELS AGREE' : 'MODELS DISAGREE'} (${compareResult.consensus.consensus_class})
* Confidence Delta    : ${(compareResult.consensus.confidence_delta * 100).toFixed(1)}%
* Lead Predictor      : ${compareResult.consensus.lead_model}
* Key GLCM Textures   :
  - HH Contrast (d=1)    : ${compareResult.texture_highlights.hh_contrast}
  - HH Homogeneity (d=1) : ${compareResult.texture_highlights.hh_homogeneity}
  - HH Skewness          : ${compareResult.texture_highlights.hh_skewness}
  - HV Contrast (d=1)    : ${compareResult.texture_highlights.hv_contrast}
  - HV Homogeneity (d=1) : ${compareResult.texture_highlights.hv_homogeneity}
  - Polarimetric Ratio Skewness : ${compareResult.texture_highlights.diff_skewness}
`;
    }

    const reportContent = `================================================================================
SAR-VISION S1-ATR TARGET CLASSIFICATION REPORT
Sentinel-1 Synthetic Aperture Radar Automated Target Recognition
================================================================================
Report Generated : ${timestamp}
Target Asset ID  : ${chip.name || 'Custom Chip'}
Sensor Platform  : Sentinel-1 C-Band SAR (Dual Polarization: HH + HV)
Processing Model : Dual-Branch ResNet50 Fusion Model
Serving Pipeline : High-Speed Automated CPU Execution
--------------------------------------------------------------------------------
1. TARGET CLASSIFICATION SUMMARY
--------------------------------------------------------------------------------
* Predicted Class   : ${isIceberg ? 'Iceberg' : 'Ship'}
* Model Confidence  : ${confidencePct}%
* P(Iceberg) Scalar : ${probIcebergPct}%
* Ground Truth Label: ${trueLabelStr}
* Label Agreement   : ${matchStatus}
* Satellite Angle   : ${chip.inc_angle?.toFixed(1) ?? 'N/A'}° (incidence angle relative to surface normal)

--------------------------------------------------------------------------------
2. INCIDENCE ANGLE SENSITIVITY SWEEP
--------------------------------------------------------------------------------
* Angle Stability   : ${angleStabilityStr}
* Sweep Range       : 30.0° to 46.0°
* Decision Threshold: 50.0%

--------------------------------------------------------------------------------
3. GRAD-CAM SPATIAL ATTRIBUTION
--------------------------------------------------------------------------------
* Grad-CAM Status   : ${gradcamSummaryStr}
* Physical Context  : ${
      isIceberg
        ? 'Distributed volumetric scattering and irregular boundary attenuation characteristic of sea ice.'
        : 'Concentrated double-bounce corner reflection from metallic vessel superstructure and vertical bulkheads.'
    }

--------------------------------------------------------------------------------
4. ANALYSIS NOTES
--------------------------------------------------------------------------------
${
  isIceberg
    ? 'Classification indicates glacial ice target profile. Cross-referencing with optical imagery or nautical charts recommended.'
    : 'Classification indicates surface vessel target profile.'
}${telemetrySummaryStr}${compareSummaryStr}
================================================================================
END OF REPORT — SAR-VISION ATR ANALYSIS
================================================================================
`;

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SAR_Classification_Report_${(chip.name || 'target').replace(/\.[^/.]+$/, '')}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [chip, result, sweepData, gradcamData, compareResult]);

  const value = {
    chip,
    setChip,
    loadChip,
    loadSample,
    result,
    setResult,
    modelMode,
    setModelMode,
    compareResult,
    setCompareResult,
    sweepData,
    setSweepData,
    gradcamData,
    setGradcamData,
    loading,
    setLoading,
    gradcamLoading,
    sweepLoading,
    error,
    setError,
    backendOnline,
    handleClassify,
    handleRunComparison,
    handleGradcam,
    handleAngleSweep,
    handleExportReport,
    containerVariants,
    itemVariants,
    shouldReduceMotion,
  };

  return <ChipContext.Provider value={value}>{children}</ChipContext.Provider>;
}

export function useChip() {
  const context = useContext(ChipContext);
  if (!context) {
    throw new Error('useChip must be used within a ChipProvider');
  }
  return context;
}
