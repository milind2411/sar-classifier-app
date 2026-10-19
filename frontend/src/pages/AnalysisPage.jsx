import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Dropzone from '../components/Dropzone';
import ChipCanvas from '../components/ChipCanvas';
import ResultsPanel from '../components/ResultsPanel';
import GradCamPanel from '../components/GradCamPanel';
import ModelComparisonPanel from '../components/ModelComparisonPanel';
import AngleSensitivityChart from '../components/AngleSensitivityChart';
import ExecutiveReportModal from '../components/ExecutiveReportModal';
import { useChip, SAMPLES } from '../context/ChipContext';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function AnalysisPage() {
  useDocumentTitle('Analysis | SAR Classifier');
  const [reportOpen, setReportOpen] = useState(false);
  const [searchParams] = useSearchParams();

  const {
    chip,
    loadChip,
    loadSample,
    result,
    loading,
    modelMode,
    setModelMode,
    compareResult,
    setCompareResult,
    sweepData,
    setSweepData,
    gradcamData,
    setGradcamData,
    handleClassify,
    handleGradcam,
    handleAngleSweep,
    handleRunComparison,
    handleExportReport,
    gradcamLoading,
    sweepLoading,
    containerVariants,
    itemVariants,
    shouldReduceMotion,
    backendOnline,
  } = useChip();

  useEffect(() => {
    const sample = searchParams.get('sample');
    if (sample && (!chip || chip.name !== `${sample}.json`)) {
      loadSample(sample);
    }
  }, [searchParams, loadSample, chip]);

  useEffect(() => {
    if (searchParams.get('classify') === '1' && chip && !result && !loading) {
      handleClassify();
    }
  }, [searchParams, chip, result, loading, handleClassify]);

  const triggerGradcam = async () => {
    await handleGradcam();
    document.getElementById('section-gradcam')?.scrollIntoView({ behavior: 'smooth' });
  };

  const triggerAngleSweep = async () => {
    await handleAngleSweep();
    document.getElementById('section-angle')?.scrollIntoView({ behavior: 'smooth' });
  };

  const triggerComparison = async () => {
    await handleRunComparison();
    document.getElementById('section-compare')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header & System Telemetry ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Single-Target ATR Workstation
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/10 border border-accent/30 text-accent font-semibold">
              Analysis Workspace
            </span>
          </h1>
          <p className="text-muted text-xs mt-0.5">
            Full-spectrum Sentinel-1 SAR analysis: dual-polarization synthesis, dual-engine classification, orbital sensitivity & Grad-CAM attribution.
          </p>
        </div>

        {/* Small, unobtrusive Engine Status indicator */}
        {backendOnline !== null && (
          <div
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/10 text-[11px] font-mono text-white/50"
            title={backendOnline ? 'Inference engine connected' : 'Inference service offline'}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                backendOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
              }`}
            />
            <span>{backendOnline ? 'Engine Online' : 'Engine Offline'}</span>
          </div>
        )}
      </div>

      {!chip ? (
        /* ── Empty Workspace State: Presets + Dropzone + Designed Standby Card ── */
        <div className="space-y-6">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest font-mono">
                Ground-Truth Target Presets
              </h2>
              <span className="text-[10px] text-white/40 font-mono">
                Click to load verified Kaggle chips
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => loadSample(s.id)}
                  className="px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all duration-200 border cursor-pointer bg-navy-light/40 border-white/10 text-white/70 hover:bg-navy-light/70 hover:border-white/20"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid lg:grid-cols-12 gap-6 items-stretch"
          >
            <div className="lg:col-span-5 flex flex-col justify-center">
              <Dropzone onChipLoaded={loadChip} disabled={loading} />
            </div>

            <div className="lg:col-span-7 glass-panel p-6 sm:p-8 flex flex-col justify-center items-center text-center space-y-4 border border-dashed border-white/15 shadow-inner">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center shadow-glow">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-accent animate-pulse-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
                  <circle cx="12" cy="12" r="3" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3" />
                </svg>
              </div>

              <div className="space-y-1.5 max-w-md">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Awaiting Radar Target
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  Select a verified ground-truth preset above or drop a Sentinel-1 SAR chip (.json / .npz) to inspect dual-polarization channels, evaluate ResNet50 & XGBoost classifiers, and view explainability telemetry.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {SAMPLES[0] && (
                  <button
                    type="button"
                    onClick={() => loadSample(SAMPLES[0].id)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 transition-all cursor-pointer shadow-glow-sm"
                  >
                    Quick Load: {SAMPLES[0].label} →
                  </button>
                )}
                {SAMPLES[3] && (
                  <button
                    type="button"
                    onClick={() => loadSample(SAMPLES[3].id)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium bg-white/[0.04] border border-white/10 text-white/70 hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer"
                  >
                    Quick Load: {SAMPLES[3].label} →
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 w-full pt-3 border-t border-white/5 text-[11px] font-mono text-white/40">
                <div>Dual-Pol (HH / HV)</div>
                <div>ResNet50 + XGBoost</div>
                <div>Grad-CAM Heatmaps</div>
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
        /* ── Consolidated Single-Chip Continuous Workflow ── */
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* Row 1: Compact Chip Input Bar (Presets + Compact Dropzone) */}
          <motion.div variants={itemVariants} className="glass-panel p-3.5 rounded-2xl border border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider font-semibold shrink-0">
                Target Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLES.map((s) => {
                  const isActive = chip?.name === `${s.id}.json`;
                  return (
                    <button
                      key={s.id}
                      onClick={() => loadSample(s.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all duration-150 border cursor-pointer ${
                        isActive
                          ? 'bg-accent/20 border-accent/50 text-accent shadow-glow font-bold'
                          : 'bg-white/[0.03] border-white/5 text-white/70 hover:bg-white/[0.08] hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="shrink-0 w-full md:w-auto">
              <Dropzone onChipLoaded={loadChip} disabled={loading} compact={true} />
            </div>
          </motion.div>

          {/* Row 2: Chip Canvas & Classifier Controls + Classification Result (Side by Side) */}
          <motion.div variants={itemVariants} className="grid lg:grid-cols-2 gap-6 items-start">
            {/* Left Column: Canvas, Sensor Info & Classifier Controls */}
            <div className="glass-panel p-6 rounded-2xl space-y-4 border border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest font-mono">
                  Target Imagery & Sensor Geometry
                </h2>
                <span className="text-xs font-mono text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded">
                  {chip.name || 'Custom Chip'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ChipCanvas band1={chip.band_1} band2={chip.band_2} />
                <div className="flex sm:flex-col gap-3 w-full sm:w-auto">
                  <div className="flex-1 bg-navy-light/50 border border-white/10 rounded-xl p-3 shadow-inner">
                    <div className="text-xs text-muted uppercase tracking-wider font-mono">Incidence Angle</div>
                    <div className="text-xl font-mono font-bold text-white/90">
                      {chip.inc_angle != null ? `${chip.inc_angle.toFixed(1)}°` : 'N/A'}
                    </div>
                  </div>
                  {chip.label != null && (
                    <div className="flex-1 bg-navy-light/50 border border-white/10 rounded-xl p-3 shadow-inner">
                      <div className="text-xs text-muted uppercase tracking-wider font-mono">True Label</div>
                      <div className={`text-sm font-semibold mt-0.5 ${chip.label === 1 ? 'text-danger' : 'text-accent'}`}>
                        {chip.label === 1 ? 'Iceberg' : 'Ship'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Model Execution Mode Selector */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs text-white/50 uppercase tracking-wider font-semibold">
                  <span>Classifier Mode</span>
                  <span className="text-[10px] text-white/30 font-normal lowercase font-mono">select engine</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-navy-light/50 border border-white/10 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setModelMode('resnet')}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                      modelMode === 'resnet'
                        ? 'bg-accent/20 text-accent border border-accent/40 shadow-glow-sm font-bold'
                        : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    ResNet50
                  </button>
                  <button
                    type="button"
                    onClick={() => setModelMode('xgboost')}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                      modelMode === 'xgboost'
                        ? 'bg-amber/20 text-amber border border-amber/40 shadow-glow-sm font-bold'
                        : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    XGBoost
                  </button>
                  <button
                    type="button"
                    onClick={() => setModelMode('compare')}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                      modelMode === 'compare'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-glow-sm font-bold'
                        : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    Compare Both
                  </button>
                </div>
              </div>

              <button
                className="btn-primary w-full shadow-glow active:scale-[0.98] cursor-pointer"
                onClick={handleClassify}
                disabled={loading}
              >
                {loading
                  ? 'Evaluating Target…'
                  : modelMode === 'compare'
                  ? 'Run Dual-Model Comparison'
                  : modelMode === 'xgboost'
                  ? 'Classify with XGBoost Baseline'
                  : 'Classify Chip (ResNet50)'}
              </button>
            </div>

            {/* Right Column: Classification Results Panel */}
            <ResultsPanel
              result={result}
              loading={loading}
              chipName={chip?.name}
              onGradcam={triggerGradcam}
              onAngleSweep={triggerAngleSweep}
              onExportReport={handleExportReport}
              onExecutiveReport={() => setReportOpen(true)}
              gradcamLoading={gradcamLoading}
              sweepLoading={sweepLoading}
            />
          </motion.div>

          {/* Row 3: Section 2 — Model Comparison & Consensus Benchmark */}
          <motion.section
            id="section-compare"
            variants={itemVariants}
            className="glass-panel p-6 rounded-2xl space-y-4 border border-white/10"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Model Comparison & Consensus Benchmark
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                    ResNet50 vs GLCM XGBoost
                  </span>
                </div>
                <p className="text-muted text-xs mt-0.5">
                  Side-by-side consensus evaluation, decision agreement, and physical texture feature telemetry.
                </p>
              </div>

              <button
                type="button"
                onClick={triggerComparison}
                disabled={loading}
                className="btn-primary text-xs cursor-pointer shadow-glow-sm flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <span className="animate-spin text-sm">↻</span>
                    <span>Evaluating Models…</span>
                  </>
                ) : compareResult ? (
                  'Re-run Comparison'
                ) : (
                  'Run Dual-Model Comparison'
                )}
              </button>
            </div>

            {compareResult ? (
              <ModelComparisonPanel
                data={compareResult}
                onClose={() => setCompareResult(null)}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center space-y-3 bg-white/[0.01]">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto text-emerald-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 12h12l3-12H3zm9-3v18" />
                  </svg>
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-sm font-semibold text-white/90">Dual-Model Consensus Ready</h3>
                  <p className="text-xs text-white/50 leading-relaxed font-sans">
                    Benchmark the 50-layer deep convolutional neural network against 49 classical Haralick GLCM texture metrics and clutter moments.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={triggerComparison}
                  disabled={loading}
                  className="btn-secondary text-xs inline-flex items-center gap-2 cursor-pointer text-emerald-300 border-emerald-500/30 hover:border-emerald-500/60"
                >
                  {loading ? 'Evaluating…' : 'Run Dual-Model Comparison →'}
                </button>
              </div>
            )}
          </motion.section>

          {/* Row 4: Section 3 — Incidence Angle Sensitivity Sweep */}
          <motion.section
            id="section-angle"
            variants={itemVariants}
            className="glass-panel p-6 rounded-2xl space-y-4 border border-white/10"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Incidence Angle Sensitivity Sweep
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/10 border border-accent/30 text-accent font-semibold">
                    30.0° – 46.0° Sweep
                  </span>
                </div>
                <p className="text-muted text-xs mt-0.5">
                  Counterfactual orbital simulation evaluating target classification stability across varying radar look angles.
                </p>
              </div>

              <button
                type="button"
                onClick={triggerAngleSweep}
                disabled={sweepLoading}
                className="btn-primary text-xs cursor-pointer shadow-glow-sm flex items-center gap-1.5"
              >
                {sweepLoading ? (
                  <>
                    <span className="animate-spin text-sm">↻</span>
                    <span>Simulating Orbital Sweep…</span>
                  </>
                ) : sweepData && sweepData.length > 0 ? (
                  'Re-run Sweep'
                ) : (
                  'Run Angle Sweep'
                )}
              </button>
            </div>

            {sweepData && sweepData.length > 0 ? (
              <AngleSensitivityChart
                data={sweepData}
                currentAngle={chip?.inc_angle}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center space-y-3 bg-white/[0.01]">
                <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center mx-auto text-accent">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-sm font-semibold text-white/90">Orbital Look-Angle Simulation Ready</h3>
                  <p className="text-xs text-white/50 leading-relaxed font-sans">
                    Simulate 31 synthetic pass geometries from 30.0° grazing to 46.0° steep angles to determine boundary crossover risk.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={triggerAngleSweep}
                  disabled={sweepLoading}
                  className="btn-secondary text-xs inline-flex items-center gap-2 cursor-pointer text-accent border-accent/30 hover:border-accent/60"
                >
                  {sweepLoading ? 'Simulating…' : 'Run Angle Sweep →'}
                </button>
              </div>
            )}
          </motion.section>

          {/* Row 5: Section 4 — Spatial Explainability (Grad-CAM) */}
          <motion.section
            id="section-gradcam"
            variants={itemVariants}
            className="glass-panel p-6 rounded-2xl space-y-4 border border-white/10"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Spatial Explainability (Grad-CAM)
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-semibold">
                    Target Layer: conv3_block4_3_conv
                  </span>
                </div>
                <p className="text-muted text-xs mt-0.5">
                  Deep learning activation mapping on convolutional layers to verify spatial saliency on the radar target vs clutter.
                </p>
              </div>

              <button
                type="button"
                onClick={triggerGradcam}
                disabled={gradcamLoading}
                className="btn-primary text-xs cursor-pointer shadow-glow-sm flex items-center gap-1.5"
              >
                {gradcamLoading ? (
                  <>
                    <span className="animate-spin text-sm">↻</span>
                    <span>Generating Heatmap…</span>
                  </>
                ) : gradcamData ? (
                  'Re-generate Grad-CAM'
                ) : (
                  'Generate Grad-CAM Heatmap'
                )}
              </button>
            </div>

            {gradcamData ? (
              <GradCamPanel
                heatmap={gradcamData.heatmap}
                band1={chip?.band_1}
                band2={chip?.band_2}
                layerName={gradcamData.layer_used}
                predictedClass={result?.predicted_class || (chip?.label === 1 ? 'iceberg' : 'ship')}
                confidence={result?.confidence}
                onClose={() => setGradcamData(null)}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center space-y-3 bg-white/[0.01]">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center mx-auto text-cyan-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-sm font-semibold text-white/90">Grad-CAM Attribution Standby</h3>
                  <p className="text-xs text-white/50 leading-relaxed font-sans">
                    Compute gradient-weighted class activation mapping (Grad-CAM) to inspect whether the CNN focused on target scatterers or ocean clutter.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={triggerGradcam}
                  disabled={gradcamLoading}
                  className="btn-secondary text-xs inline-flex items-center gap-2 cursor-pointer text-cyan-300 border-cyan-500/30 hover:border-cyan-500/60"
                >
                  {gradcamLoading ? 'Generating Heatmap…' : 'Generate Grad-CAM Heatmap →'}
                </button>
              </div>
            )}
          </motion.section>
        </motion.div>
      )}

      {/* Target Classification Assessment Report Modal */}
      <ExecutiveReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        chip={chip}
        result={result}
        compareResult={compareResult}
        gradcamData={gradcamData}
        onDownloadTextReport={handleExportReport}
      />
    </div>
  );
}
