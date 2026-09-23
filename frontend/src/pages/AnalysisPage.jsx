import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Dropzone from '../components/Dropzone';
import ChipCanvas from '../components/ChipCanvas';
import ResultsPanel from '../components/ResultsPanel';
import GradCamPanel from '../components/GradCamPanel';
import ExecutiveReportModal from '../components/ExecutiveReportModal';
import { useChip, SAMPLES } from '../context/ChipContext';

export default function AnalysisPage() {
  const [reportOpen, setReportOpen] = useState(false);
  const {
    chip,
    loadChip,
    loadSample,
    result,
    loading,
    modelMode,
    setModelMode,
    compareResult,
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
    const params = new URLSearchParams(window.location.search);
    const sample = params.get('sample');
    if (sample && (!chip || chip.name !== `${sample}.json`)) {
      loadSample(sample);
    }
  }, [loadSample, chip]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('classify') === '1' && chip && !result && !loading) {
      handleClassify();
    }
  }, [chip, result, loading, handleClassify]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Target Chip Presets */}
      <section>
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3 font-mono">
          Target Chip Presets
        </h2>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSample(s.id)}
              className={`
                px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border
                ${chip?.name === `${s.id}.json`
                  ? 'bg-accent/20 border-accent/50 text-accent shadow-glow font-semibold'
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
        className="grid lg:grid-cols-2 gap-8"
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
                      <div className="text-xs text-muted uppercase tracking-wider font-mono">Angle</div>
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
                    <span>Model Architecture</span>
                    <span className="text-[10px] text-white/30 font-normal lowercase font-mono">active evaluator</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-navy-light/50 border border-white/10 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setModelMode('resnet')}
                      className={`py-2 px-2 rounded-lg text-xs font-medium transition-all text-center ${
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
                      className={`py-2 px-2 rounded-lg text-xs font-medium transition-all text-center ${
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
                      className={`py-2 px-2 rounded-lg text-xs font-medium transition-all text-center ${
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
                  className="btn-primary w-full shadow-glow active:scale-[0.98]"
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

        {/* Right column: results & in-flow Grad-CAM */}
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
        </motion.div>
      </motion.div>

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
