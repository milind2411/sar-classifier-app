import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Dropzone from '../components/Dropzone';
import ChipCanvas from '../components/ChipCanvas';
import ResultsPanel from '../components/ResultsPanel';
import GradCamPanel from '../components/GradCamPanel';
import ModelComparisonPanel from '../components/ModelComparisonPanel';
import AngleSensitivityChart from '../components/AngleSensitivityChart';
import ExecutiveReportModal from '../components/ExecutiveReportModal';
import ComparePage from './ComparePage';
import AnglePage from './AnglePage';
import MapPage from './MapPage';
import BatchPage from './BatchPage';
import AnalyticsPage from './AnalyticsPage';
import { useChip, SAMPLES } from '../context/ChipContext';

const WORKSPACE_TABS = [
  {
    id: 'target',
    label: 'Target Analysis',
    badge: 'Console',
    desc: 'Single-target radar canvas, measurement ruler & classifier',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
        <circle cx="12" cy="12" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3" />
      </svg>
    ),
  },
  {
    id: 'compare',
    label: 'Model Comparison',
    badge: 'ResNet vs XGB',
    desc: 'Side-by-side consensus and GLCM texture features',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 12h12l3-12H3zm9-3v18" />
      </svg>
    ),
  },
  {
    id: 'sweep',
    label: 'Angle Sweep',
    badge: '30°–46°',
    desc: 'Counterfactual look-angle sensitivity & crossover stability',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    id: 'map',
    label: 'Coverage Map',
    badge: 'Arctic AOI',
    desc: 'Interactive geospatial map with Sentinel-1 orbital tracks',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934a1.12 1.12 0 01-.894 0L10.5 3.815a1.12 1.12 0 00-.894 0L4.73 5.752A1.125 1.125 0 004 6.758v12.428c0 .836.88 1.38 1.628 1.006l3.869-1.934a1.12 1.12 0 01.894 0l4.112 2.056c.28.14.614.14.894 0z" />
      </svg>
    ),
  },
  {
    id: 'batch',
    label: 'Batch ATR',
    badge: '≤ 50 Chips',
    desc: 'High-throughput automated multi-target evaluation',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    badge: 'Audit KPIs',
    desc: 'Historical prediction trends, SNR telemetry & model agreement',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
      </svg>
    ),
  },
];

export default function AnalysisPage() {
  const [reportOpen, setReportOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Active module tab: 'target' | 'compare' | 'sweep' | 'map' | 'batch' | 'analytics'
  const activeTab = searchParams.get('tab') || 'target';

  const setActiveTab = (tabId) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tabId === 'target') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', tabId);
    }
    setSearchParams(nextParams);
  };

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
    handleExportReport,
    gradcamLoading,
    sweepLoading,
    containerVariants,
    itemVariants,
    shouldReduceMotion,
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Tactical Analysis Module Switcher (Embedded in Analysis Part) ── */}
      <section className="glass-panel p-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {WORKSPACE_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap border shrink-0
                  ${isActive
                    ? 'bg-accent/15 border-accent/40 text-accent font-semibold shadow-glow-sm'
                    : 'bg-white/[0.02] border-white/5 text-white/60 hover:text-white hover:bg-white/[0.06] hover:border-white/10'
                  }
                `}
                title={tab.desc}
              >
                <span className={isActive ? 'text-accent' : 'text-white/40'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                  isActive
                    ? 'bg-accent/20 border-accent/30 text-accent'
                    : 'bg-white/5 border-white/10 text-white/40'
                }`}>
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Active Module Viewport ── */}
      <AnimatePresence mode="wait">
        {activeTab === 'compare' && (
          <motion.div
            key="tab-compare"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <ComparePage onSelectTarget={() => setActiveTab('target')} />
          </motion.div>
        )}

        {activeTab === 'sweep' && (
          <motion.div
            key="tab-sweep"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <AnglePage onSelectTarget={() => setActiveTab('target')} />
          </motion.div>
        )}

        {activeTab === 'map' && (
          <motion.div
            key="tab-map"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <MapPage onInspectTarget={() => setActiveTab('target')} />
          </motion.div>
        )}

        {activeTab === 'batch' && (
          <motion.div
            key="tab-batch"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <BatchPage onInspectChip={() => setActiveTab('target')} />
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div
            key="tab-analytics"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <AnalyticsPage />
          </motion.div>
        )}

        {activeTab === 'target' && (
          <motion.div
            key="tab-target"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Target Chip Presets */}
            <section>
              <div className="flex items-center justify-between mb-3">
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
                    className={`
                      px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all duration-200 border cursor-pointer
                      ${chip?.name === `${s.id}.json`
                        ? 'bg-accent/20 border-accent/50 text-accent shadow-glow font-bold'
                        : 'bg-navy-light/40 border-white/10 text-white/70 hover:bg-navy-light/70 hover:border-white/20'
                      }
                    `}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Two-column analysis workspace layout */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid lg:grid-cols-2 gap-8 items-start"
            >
              {/* Left column: input & controls */}
              <motion.div variants={itemVariants} className="space-y-6">
                <Dropzone onChipLoaded={loadChip} disabled={loading} />

                <AnimatePresence mode="wait">
                  {chip && (
                    <motion.div
                      key={chip.name || 'custom-chip'}
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="glass-panel p-5 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <ChipCanvas
                          band1={chip.band_1}
                          band2={chip.band_2}
                        />
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Right column: results, in-flow Grad-CAM, in-flow Compare, and in-flow Angle Sweep */}
              <motion.div variants={itemVariants} className="space-y-6">
                <ResultsPanel
                  result={result}
                  loading={loading}
                  chipName={chip?.name}
                  onGradcam={handleGradcam}
                  onAngleSweep={handleAngleSweep}
                  onExportReport={handleExportReport}
                  onExecutiveReport={() => setReportOpen(true)}
                  gradcamLoading={gradcamLoading}
                  sweepLoading={sweepLoading}
                />

                {/* In-Flow Grad-CAM Heatmap Attention Map */}
                {gradcamData && (
                  <GradCamPanel
                    heatmap={gradcamData.heatmap}
                    band1={chip?.band_1}
                    band2={chip?.band_2}
                    layerName={gradcamData.layer_used}
                    predictedClass={result?.predicted_class || (chip?.label === 1 ? 'iceberg' : 'ship')}
                    confidence={result?.confidence}
                    onClose={() => setGradcamData(null)}
                  />
                )}

                {/* In-Flow Multi-Model Comparison Panel */}
                {compareResult && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                        Dual-Model Consensus Breakdown
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('compare')}
                        className="text-[11px] font-mono text-accent hover:underline cursor-pointer"
                      >
                        Open Full Comparison View →
                      </button>
                    </div>
                    <ModelComparisonPanel
                      data={compareResult}
                      onClose={() => setCompareResult(null)}
                    />
                  </div>
                )}

                {/* In-Flow Angle Sensitivity Sweep Curve */}
                {sweepData && sweepData.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-mono text-accent font-semibold uppercase tracking-wider">
                        Orbital Angle Sensitivity Simulation
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('sweep')}
                        className="text-[11px] font-mono text-accent hover:underline cursor-pointer"
                      >
                        Open Full Sweep View →
                      </button>
                    </div>
                    <AngleSensitivityChart
                      data={sweepData}
                      currentAngle={chip?.inc_angle}
                    />
                  </div>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
