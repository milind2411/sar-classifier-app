import { useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

function AnimatedNumber({ value, decimals = 1, suffix = '%' }) {
  const shouldReduceMotion = useReducedMotion();
  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, { damping: 24, stiffness: 120 });
  const [display, setDisplay] = useState(() => (shouldReduceMotion ? value.toFixed(decimals) : '0.0'));

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplay(value.toFixed(decimals));
      return;
    }
    motionVal.set(value);
  }, [value, motionVal, shouldReduceMotion, decimals]);

  useEffect(() => {
    if (shouldReduceMotion) return;
    const unsubscribe = springVal.on('change', (latest) => {
      setDisplay(latest.toFixed(decimals));
    });
    return () => unsubscribe();
  }, [springVal, decimals, shouldReduceMotion]);

  return <span>{display}{suffix}</span>;
}

/**
 * Results panel showing classification output, confidence, and action buttons.
 */
export default function ResultsPanel({
  result,
  loading,
  onGradcam,
  onAngleSweep,
  onExportReport,
  onExecutiveReport,
  gradcamLoading,
  sweepLoading,
  chipName,
}) {
  const shouldReduceMotion = useReducedMotion();

  if (!result && !loading) {
    return (
      <div className="glass-panel p-6 animate-fade-in space-y-3 border-l-2 border-l-accent/60">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-tight">Classification Standby</h2>
          {chipName && (
            <span className="text-xs font-mono text-accent bg-accent/10 border border-accent/25 px-2 py-0.5 rounded">
              {chipName}
            </span>
          )}
        </div>
        <p className="text-slate-300 text-xs leading-relaxed font-sans">
          Target loaded into workspace. Select your preferred classifier engine (ResNet50, XGBoost, or Compare Both) on the left and click <span className="text-accent font-medium font-mono">Classify</span> to generate model probabilities, SNR telemetry, and Grad-CAM attention maps.
        </p>
        <div className="pt-2 border-t border-white/5 flex items-center gap-2 text-[11px] font-mono text-white/40">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span>Ready for evaluation</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-panel p-6">
        <div className="flex items-center gap-3">
          <Spinner />
          <span className="text-white/70">Classifying…</span>
        </div>
      </div>
    );
  }

  const isIceberg = result.predicted_class === 'iceberg';
  const confidenceValue = result.confidence * 100;
  const probValue = result.probability_iceberg * 100;
  const telemetry = result.telemetry;
  const snr = telemetry?.target_to_clutter_ratio_db;

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="glass-panel p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white/90 mb-1">Classification Result</h2>
          {chipName && <p className="text-muted text-xs font-mono">{chipName}</p>}
        </div>
        <span className={isIceberg ? 'badge-iceberg' : 'badge-ship'}>
          {isIceberg ? 'Iceberg' : 'Ship'}
        </span>
      </div>

      {/* Stats row with animated count-up */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <div className={`stat-value ${isIceberg ? 'text-danger' : 'text-accent'}`}>
            <AnimatedNumber value={confidenceValue} decimals={1} />
          </div>
          <div className="stat-label">Confidence</div>
        </div>
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
          <div className="stat-value text-white/80">
            <AnimatedNumber value={probValue} decimals={2} />
          </div>
          <div className="stat-label">P(Iceberg)</div>
        </div>
      </div>

      {/* Radar Quality & Target-to-Clutter Ratio (SNR) Telemetry */}
      {telemetry && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
              </svg>
              <div>
                <span className="text-xs font-semibold text-white/85">Radar SNR (Target-to-Clutter)</span>
                <p className="text-[10px] text-white/60">Backscatter contrast over ocean clutter floor</p>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-base font-bold font-mono ${snr >= 6.0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {snr >= 0 ? `+${snr.toFixed(1)}` : snr.toFixed(1)} dB
              </span>
              <span className={`block text-[10px] uppercase tracking-wider font-semibold ${snr >= 6.0 ? 'text-emerald-400/80' : 'text-amber-400/80'}`}>
                {telemetry.target_contrast_assessment}
              </span>
            </div>
          </div>

          {snr < 4.0 && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span>Low target contrast: Ocean wave clutter may degrade classification certainty.</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-[11px]">
            <div>
              <span className="text-slate-300 block text-[10px]">Speckle Suppr.</span>
              <span className="font-mono text-white/80 font-medium">+{telemetry.speckle_reduction_pct.toFixed(0)}%</span>
            </div>
            <div>
              <span className="text-slate-300 block text-[10px]">Filtered ENL</span>
              <span className="font-mono text-white/80 font-medium">{telemetry.enl_filtered.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-slate-300 block text-[10px]">Pol. Delta (HH-HV)</span>
              <span className="font-mono text-white/80 font-medium">{telemetry.cross_pol_delta_db >= 0 ? `+${telemetry.cross_pol_delta_db.toFixed(1)}` : telemetry.cross_pol_delta_db.toFixed(1)} dB</span>
            </div>
          </div>
        </div>
      )}

      {/* Confidence bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted">
          <span>Ship</span>
          <span>Iceberg</span>
        </div>
        <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${result.probability_iceberg * 100}%` }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.65,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{
              background: `linear-gradient(90deg, #38bdf8, #f87171)`,
            }}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          className="btn-secondary flex items-center gap-2 text-sm"
          onClick={onGradcam}
          disabled={gradcamLoading}
          title="Explain spatial radar attention"
        >
          {gradcamLoading ? <Spinner small /> : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
          Grad-CAM
        </button>
        <button
          className="btn-secondary flex items-center gap-2 text-sm"
          onClick={onAngleSweep}
          disabled={sweepLoading}
          title="Simulate satellite look-angle sensitivity"
        >
          {sweepLoading ? <Spinner small /> : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          )}
          Angle Sweep
        </button>
        {onExecutiveReport && (
          <button
            className="btn-secondary flex items-center gap-2 text-sm text-cyan-300 hover:text-white hover:border-cyan-400/50"
            onClick={onExecutiveReport}
            title="Open Printable Summary & PDF Report"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            Printable Report
          </button>
        )}
        {onExportReport && (
          <button
            className="btn-secondary flex items-center gap-2 text-sm"
            onClick={onExportReport}
            title="Download classification report log (.txt)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Text Log
          </button>
        )}
      </div>
    </motion.div>
  );
}

function Spinner({ small }) {
  return (
    <svg
      className={`animate-spin ${small ? 'w-4 h-4' : 'w-5 h-5'} text-accent`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
