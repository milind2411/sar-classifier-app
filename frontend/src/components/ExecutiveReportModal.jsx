import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Normalizes an array of numbers to [0, 255] using 2nd and 98th percentiles.
 */
function normalizeToUint8(data) {
  const flat = data.flat();
  const sorted = [...flat].sort((a, b) => a - b);
  const p2 = sorted[Math.floor(sorted.length * 0.02)] ?? sorted[0];
  const p98 = sorted[Math.floor(sorted.length * 0.98)] ?? sorted[sorted.length - 1];
  const range = p98 - p2 || 1;

  return flat.map((val) => {
    const clamped = Math.max(p2, Math.min(p98, val));
    return Math.round(((clamped - p2) / range) * 255);
  });
}

/**
 * ExecutiveReportModal renders a standardized maritime target classification
 * assessment report with false-color SAR imagery, sensor telemetry, and print styling.
 */
export default function ExecutiveReportModal({
  isOpen,
  onClose,
  chip,
  result,
  compareResult,
  gradcamData,
  onDownloadTextReport,
}) {
  const canvasRef = useRef(null);
  const camCanvasRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Render false-color SAR composite on canvas
  useEffect(() => {
    if (!isOpen || !chip || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = 75;
    const height = 75;
    canvas.width = width;
    canvas.height = height;

    const rNorm = normalizeToUint8(chip.band_1);
    const gNorm = normalizeToUint8(chip.band_2);
    const bNorm = chip.band_1.flat().map((v1, idx) => {
      const v2 = chip.band_2.flat()[idx];
      return Math.round(((rNorm[idx] + gNorm[idx]) / 2));
    });

    const imgData = ctx.createImageData(width, height);
    for (let i = 0; i < 75 * 75; i++) {
      const pIdx = i * 4;
      imgData.data[pIdx] = rNorm[i];
      imgData.data[pIdx + 1] = gNorm[i];
      imgData.data[pIdx + 2] = bNorm[i];
      imgData.data[pIdx + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }, [isOpen, chip]);

  // Render Grad-CAM heatmap on canvas if available
  useEffect(() => {
    if (!isOpen || !gradcamData?.heatmap || !camCanvasRef.current) return;
    const canvas = camCanvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = 75;
    canvas.height = 75;

    const heatmap = gradcamData.heatmap;
    const imgData = ctx.createImageData(75, 75);
    for (let y = 0; y < 75; y++) {
      for (let x = 0; x < 75; x++) {
        const val = heatmap[y]?.[x] ?? 0;
        const pIdx = (y * 75 + x) * 4;
        // Jet colormap approximation
        let r = 0, g = 0, b = 0;
        if (val < 0.25) {
          b = Math.round(val * 4 * 255);
        } else if (val < 0.5) {
          b = 255;
          g = Math.round((val - 0.25) * 4 * 255);
        } else if (val < 0.75) {
          g = 255;
          b = Math.round((1 - (val - 0.5) * 4) * 255);
          r = Math.round((val - 0.5) * 4 * 255);
        } else {
          r = 255;
          g = Math.round((1 - (val - 0.75) * 4) * 255);
        }
        imgData.data[pIdx] = r;
        imgData.data[pIdx + 1] = g;
        imgData.data[pIdx + 2] = b;
        imgData.data[pIdx + 3] = Math.round(val * 230 + 25);
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [isOpen, gradcamData]);

  if (!isOpen) return null;

  const isIceberg = result?.predicted_class === 'iceberg';
  const confidencePct = ((result?.confidence ?? 0) * 100).toFixed(1);
  const probIcebergPct = ((result?.probability_iceberg ?? 0) * 100).toFixed(2);
  const telemetry = result?.telemetry || compareResult?.telemetry;
  const timestamp = new Date().toISOString();
  const reportId = `ATR-${chip?.name ? chip.name.replace('.json', '').toUpperCase() : 'TARGET-S1'}-${Math.floor(Math.random() * 8999 + 1000)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
        {/* Backdrop dismiss */}
        <div className="fixed inset-0 print:hidden" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-white/15 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 text-slate-200 print:bg-white print:text-black print:border-none print:shadow-none print:max-h-none print:p-2 print:space-y-4 print:text-xs"
        >
          {/* Print/Action Bar Header (hidden in print) */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4 print:hidden">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 font-semibold tracking-wider uppercase">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Target Classification Report
            </div>
            <div className="flex items-center gap-2">
              {onDownloadTextReport && (
                <button
                  type="button"
                  onClick={onDownloadTextReport}
                  className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/80 transition-colors"
                >
                  Raw Log (.txt)
                </button>
              )}
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg shadow-glow flex items-center gap-1.5 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print / Save PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                title="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Report Document Banner */}
          <div className="border-b-2 border-cyan-500/50 pb-4 print:border-black">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono tracking-widest uppercase text-cyan-400 font-bold bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 rounded print:border-black print:text-black print:bg-transparent">
                  STANDARDIZED ATR ASSESSMENT REPORT
                </span>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white mt-1.5 print:text-black">
                  TARGET CLASSIFICATION REPORT
                </h1>
                <p className="text-xs text-slate-400 print:text-slate-600">
                  Automated Dual-Polarimetric (HH+HV) C-Band Radar Verification & Assessment
                </p>
              </div>
              <div className="text-right font-mono text-xs text-slate-400 print:text-black">
                <div className="font-bold text-slate-200 print:text-black">{reportId}</div>
                <div>{timestamp}</div>
                <div className="text-[10px] text-slate-500 print:text-slate-600">Sensor: Sentinel-1 IW (C-Band)</div>
              </div>
            </div>
          </div>

          {/* Imagery & Verification Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3 print:gap-3">
            {/* Image Col 1: False-Color Composite */}
            <div className="bg-slate-950/70 border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center print:border-black print:bg-slate-50">
              <span className="text-[11px] font-mono font-semibold uppercase text-slate-400 mb-2 print:text-black">
                SAR False-Color Composite (HH/HV/Ratio)
              </span>
              <div className="w-[180px] h-[180px] border border-white/20 rounded-lg overflow-hidden relative shadow-inner print:border-black">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full"
                  style={{ imageRendering: 'pixelated' }}
                />
                <span className="absolute bottom-1 right-1 bg-black/70 font-mono text-[9px] px-1 py-0.5 rounded text-white/70">
                  75x75 px (750x750m)
                </span>
              </div>
              <div className="mt-2 text-center text-[10px] text-slate-400 font-mono print:text-slate-600">
                10m/pixel spatial resolution
              </div>
            </div>

            {/* Image Col 2: Grad-CAM Explainability (or true chip) */}
            <div className="bg-slate-950/70 border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center print:border-black print:bg-slate-50">
              <span className="text-[11px] font-mono font-semibold uppercase text-slate-400 mb-2 print:text-black">
                Spatial Attention (Grad-CAM)
              </span>
              <div className="w-[180px] h-[180px] border border-white/20 rounded-lg overflow-hidden relative shadow-inner bg-slate-900 print:border-black flex items-center justify-center">
                {gradcamData?.heatmap ? (
                  <canvas
                    ref={camCanvasRef}
                    className="w-full h-full"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <div className="p-3 text-center text-xs text-slate-500 font-mono print:text-slate-700">
                    Grad-CAM activation not generated for this session
                  </div>
                )}
                {gradcamData?.layer_used && (
                  <span className="absolute bottom-1 right-1 bg-black/70 font-mono text-[9px] px-1 py-0.5 rounded text-cyan-300">
                    {gradcamData.layer_used}
                  </span>
                )}
              </div>
              <div className="mt-2 text-center text-[10px] text-slate-400 font-mono print:text-slate-600">
                Feature layer salience footprint
              </div>
            </div>

            {/* Col 3: Verdict & Metrics Summary */}
            <div className="bg-slate-950/70 border border-white/10 rounded-xl p-4 flex flex-col justify-between space-y-4 print:border-black print:bg-slate-50">
              <div>
                <span className="text-[11px] font-mono font-semibold uppercase text-slate-400 print:text-black">
                  Target Classification
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`inline-block px-3 py-1 rounded-lg text-base font-extrabold uppercase tracking-wide ${
                      isIceberg
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 print:text-rose-700 print:border-rose-700'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 print:text-cyan-800 print:border-cyan-800'
                    }`}
                  >
                    {result?.predicted_class || 'UNKNOWN'}
                  </span>
                  <span className="font-mono text-xs text-slate-300 print:text-slate-700">
                    ({confidencePct}% conf)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-white/[0.03] p-2 rounded border border-white/5 print:border-slate-300">
                  <span className="text-slate-400 text-[10px] block">P(Iceberg)</span>
                  <span className="font-bold text-white print:text-black">{probIcebergPct}%</span>
                </div>
                <div className="bg-white/[0.03] p-2 rounded border border-white/5 print:border-slate-300">
                  <span className="text-slate-400 text-[10px] block">Incidence Angle</span>
                  <span className="font-bold text-white print:text-black">
                    {chip?.inc_angle != null ? `${chip.inc_angle.toFixed(1)}°` : 'N/A'}
                  </span>
                </div>
                <div className="bg-white/[0.03] p-2 rounded border border-white/5 print:border-slate-300">
                  <span className="text-slate-400 text-[10px] block">Target SNR</span>
                  <span className="font-bold text-cyan-300 print:text-black">
                    {telemetry?.target_to_clutter_ratio_db != null
                      ? `${telemetry.target_to_clutter_ratio_db >= 0 ? '+' : ''}${telemetry.target_to_clutter_ratio_db.toFixed(1)} dB`
                      : 'N/A'}
                  </span>
                </div>
                <div className="bg-white/[0.03] p-2 rounded border border-white/5 print:border-slate-300">
                  <span className="text-slate-400 text-[10px] block">True Ground Truth</span>
                  <span className="font-bold text-white print:text-black">
                    {chip?.label === 1 ? 'Iceberg (1)' : chip?.label === 0 ? 'Ship (0)' : 'Unlabeled'}
                  </span>
                </div>
              </div>

              {compareResult && (
                <div className="text-[11px] font-mono border-t border-white/10 pt-2 print:border-slate-300">
                  <span className="text-slate-400 text-[10px] block">Dual-Model Consensus:</span>
                  <div className="flex justify-between text-slate-300 print:text-black mt-0.5">
                    <span>ResNet50: {compareResult.resnet.predicted_class}</span>
                    <span>XGBoost: {compareResult.xgboost.predicted_class}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Radiometric Sensor Telemetry Matrix */}
          <div className="bg-slate-950/70 border border-white/10 rounded-xl p-4 print:border-black print:bg-slate-50">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2 print:text-black">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-cyan-400 print:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              Radiometric Signal Analysis & Quality Audit
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-2 rounded bg-white/[0.02] border border-white/5 print:border-slate-300">
                <span className="text-slate-400 text-[10px] block">Speckle Suppr.</span>
                <span className="font-semibold text-slate-200 print:text-black">
                  {telemetry?.speckle_reduction_pct != null
                    ? `+${telemetry.speckle_reduction_pct.toFixed(1)}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="p-2 rounded bg-white/[0.02] border border-white/5 print:border-slate-300">
                <span className="text-slate-400 text-[10px] block">Filtered ENL</span>
                <span className="font-semibold text-slate-200 print:text-black">
                  {telemetry?.enl_filtered != null ? `${telemetry.enl_filtered.toFixed(2)} looks` : 'N/A'}
                </span>
              </div>
              <div className="p-2 rounded bg-white/[0.02] border border-white/5 print:border-slate-300">
                <span className="text-slate-400 text-[10px] block">Cross-Pol Delta (HH-HV)</span>
                <span className="font-semibold text-slate-200 print:text-black">
                  {telemetry?.cross_pol_delta_db != null
                    ? `${telemetry.cross_pol_delta_db >= 0 ? '+' : ''}${telemetry.cross_pol_delta_db.toFixed(1)} dB`
                    : 'N/A'}
                </span>
              </div>
              <div className="p-2 rounded bg-white/[0.02] border border-white/5 print:border-slate-300">
                <span className="text-slate-400 text-[10px] block">Contrast Rating</span>
                <span className="font-semibold text-cyan-300 print:text-black">
                  {telemetry?.target_contrast_assessment || 'Normal'}
                </span>
              </div>
            </div>
          </div>

          {/* Operational Notes & Assessment */}
          <div className="bg-slate-950/70 border border-white/10 rounded-xl p-4 print:border-black print:bg-slate-50 space-y-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 print:text-black">
              Operational Notes & Assessment
            </h3>
            {isIceberg ? (
              <div className="text-xs space-y-1.5 text-slate-300 print:text-black">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-rose-400 print:text-rose-700 font-mono shrink-0">[HAZARD WARNING]</span>
                  <span>
                    High radar backscatter and volumetric scattering signature indicate active sea ice/glacial iceberg mass.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-cyan-400 print:text-slate-800 font-mono shrink-0">[RECOMMENDED ASSESSMENT]</span>
                  <span>
                    Transmit radar target coordinates to International Ice Patrol (IIP) and Canadian Ice Service for inclusion in regional drift forecast models.
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs space-y-1.5 text-slate-300 print:text-black">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-cyan-400 print:text-cyan-800 font-mono shrink-0">[VESSEL DETECTED]</span>
                  <span>
                    Anisotropic dihedral/trihedral corner reflections and linear hull geometry indicate artificial maritime surface vessel.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-cyan-400 print:text-slate-800 font-mono shrink-0">[RECOMMENDED ASSESSMENT]</span>
                  <span>
                    Correlate target coordinates with AIS (Automatic Identification System) terrestrial and satellite feeds. If no AIS transponder response is identified in sector, flag contact as non-correlated vessel for standard maritime verification.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Report Footer / Sign-off */}
          <div className="border-t border-white/10 pt-3 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-slate-500 print:border-black print:text-slate-700">
            <div>Sentinel-1 SAR Maritime Analysis Platform • S1-ATR v2</div>
            <div>VERIFIED BY: AUTOMATED ATR INFERENCE ENGINE</div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
