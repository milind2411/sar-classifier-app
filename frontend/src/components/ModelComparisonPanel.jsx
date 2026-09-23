import { motion, useReducedMotion } from 'framer-motion';

/**
 * ModelComparisonPanel — renders the multi-model comparison output from
 * POST /api/predict/compare.
 *
 * Props:
 *   data  — ModelComparisonOutput (resnet, xgboost, consensus, texture_highlights, top_classical_features)
 *   onClose — () => void
 */

const FEATURE_META = {
  hh_glcm_energy_d2:    { label: 'HH GLCM Energy d=2', tip: 'Textural uniformity in HH at 2-pixel distance. Higher = smoother (ice). Lower = chaotic (vessel deck).' },
  hh_glcm_energy_d1:    { label: 'HH GLCM Energy d=1', tip: 'Textural uniformity at 1-pixel distance. Ships show lower energy due to complex metal structures.' },
  hh_skewness:          { label: 'HH Skewness',         tip: 'Asymmetry of HH backscatter distribution. Positive skew = bright corner reflectors (metallic ships).' },
  hv_kurtosis:          { label: 'HV Kurtosis',         tip: 'Peakedness of HV distribution. High kurtosis = rare bright spikes from vessel superstructures.' },
  hv_glcm_contrast_d2:  { label: 'HV GLCM Contrast d=2', tip: 'Local HV intensity variation at 2px. High contrast = complex texture (ships). Low = uniform (ice).' },
  hh_peak_to_mean:      { label: 'HH Peak-to-Mean',     tip: 'Max / mean HH backscatter ratio. Large ratio = intense specular reflection from metallic hull.' },
  inc_angle:            { label: 'Incidence Angle',     tip: 'Satellite look angle (°). Near range (30°) increases clutter; far range (46°) reduces specular reflection.' },
};

function ProbBar({ prob, isIceberg }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-white/40">
        <span>Ship</span>
        <span>Iceberg</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${prob * 100}%`,
            background: 'linear-gradient(90deg, #38bdf8, #f87171)',
          }}
        />
      </div>
    </div>
  );
}

function FeatureBar({ value, max }) {
  const pct = Math.min(Math.abs(value) / (max || 1), 1) * 100;
  const isNeg = value < 0;
  return (
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${isNeg ? 'bg-amber-400/60' : 'bg-sky-400/60'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ModelCard({ model, accentClass, borderClass }) {
  const isIceberg = model.predicted_class === 'iceberg';
  const pct = (model.confidence * 100).toFixed(1);
  const prob = (model.probability_iceberg * 100).toFixed(1);

  return (
    <div className={`glass-panel p-5 border-l-4 ${borderClass} space-y-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-widest ${accentClass} mb-0.5`}>
            {model.model_type === 'deep_learning' ? 'Deep Learning' : 'Classical ML'}
          </p>
          <h3 className="text-sm font-bold text-white/90 leading-tight">{model.model_name}</h3>
        </div>
        <span className={isIceberg ? 'badge-iceberg' : 'badge-ship'}>
          {isIceberg ? 'Iceberg' : 'Ship'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/[0.03] rounded-xl p-3">
          <div className={`text-xl font-bold font-mono ${isIceberg ? 'text-danger' : 'text-accent'}`}>
            {pct}%
          </div>
          <div className="text-xs text-white/40 uppercase tracking-wider mt-0.5">Confidence</div>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3">
          <div className="text-xl font-bold font-mono text-white/80">{prob}%</div>
          <div className="text-xs text-white/40 uppercase tracking-wider mt-0.5">P(Iceberg)</div>
        </div>
      </div>

      {/* Prob bar */}
      <ProbBar prob={model.probability_iceberg} isIceberg={isIceberg} />

      {/* Latency badge */}
      <div className="flex justify-end">
        <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/5 border border-white/10 text-white/40 font-mono">
          {model.latency_ms.toFixed(1)} ms
        </span>
      </div>
    </div>
  );
}

function ConsensusBanner({ consensus }) {
  const { agreement, consensus_class, confidence_delta, lead_model } = consensus;
  const isAgreed = agreement;

  return (
    <div
      className={`rounded-2xl border px-5 py-4 ${
        isAgreed
          ? 'bg-emerald-500/8 border-emerald-500/25'
          : 'bg-amber-500/8 border-amber-500/25'
      }`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${
              isAgreed ? 'bg-emerald-500/15' : 'bg-amber-500/15'
            }`}
          >
            {isAgreed ? (
              <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
          </div>
          <div>
            <p
              className={`text-sm font-bold ${
                isAgreed ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {isAgreed
                ? `Models Agree — ${consensus_class === 'iceberg' ? 'Iceberg' : 'Ship'}`
                : 'Models Disagree'}
            </p>
            <p className="text-xs text-white/40 mt-0.5">
              Lead model: <span className="text-white/60">{lead_model}</span>
            </p>
          </div>
        </div>

        {/* Delta */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-white/40 uppercase tracking-wider">Δ Confidence</span>
          <span
            className={`text-sm font-bold font-mono ${
              confidence_delta < 0.1 ? 'text-emerald-400' : confidence_delta < 0.25 ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {(confidence_delta * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Delta bar */}
      <div className="mt-3">
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              confidence_delta < 0.1 ? 'bg-emerald-400/60' : confidence_delta < 0.25 ? 'bg-amber-400/60' : 'bg-rose-400/60'
            }`}
            style={{ width: `${Math.min(confidence_delta * 100 * 2, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-white/25 mt-0.5">
          <span>0% (agreement)</span>
          <span>50%+ (large difference)</span>
        </div>
      </div>
    </div>
  );
}

function TextureInspector({ features }) {
  const entries = Object.entries(features);
  const absVals = entries.map(([, v]) => Math.abs(v));
  const maxVal = Math.max(...absVals, 1);

  return (
    <div className="glass-panel p-5">
      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
        Radar Texture Features (GLCM + Clutter)
      </h3>
      <div className="space-y-3">
        {entries.map(([key, value]) => {
          const meta = FEATURE_META[key] || { label: key, tip: '' };
          return (
            <div key={key} title={meta.tip} className="space-y-1 cursor-help">
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/60 font-medium">{meta.label}</span>
                <span className="text-xs font-mono text-white/80 ml-2 shrink-0">
                  {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(4) : value}
                </span>
              </div>
              <FeatureBar value={value} max={maxVal} />
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-white/25 mt-3">Hover a feature for physical interpretation</p>
    </div>
  );
}

function RadarTelemetryCard({ telemetry }) {
  if (!telemetry) return null;
  const snr = telemetry.target_to_clutter_ratio_db;
  const isHighContrast = snr >= 6.0;

  return (
    <div className="glass-panel p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${isHighContrast ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
            <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
            <circle cx="12" cy="12" r="2" />
            <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
            <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white/90">Radar SNR (TCR):</span>
            <span className={`text-xs font-bold font-mono ${isHighContrast ? 'text-emerald-400' : 'text-amber-400'}`}>
              {snr >= 0 ? `+${snr.toFixed(1)}` : snr.toFixed(1)} dB
            </span>
          </div>
          <p className="text-[11px] text-white/40">{telemetry.target_contrast_assessment} · Filtered ENL: {telemetry.enl_filtered.toFixed(1)} looks</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className="text-[10px] text-white/40 block">Speckle Suppr.</span>
        <span className="text-xs font-mono font-semibold text-emerald-400">+{telemetry.speckle_reduction_pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export default function ModelComparisonPanel({ data, onClose }) {
  const shouldReduceMotion = useReducedMotion();
  if (!data) return null;

  const { resnet, xgboost, consensus, top_classical_features, telemetry } = data;

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={shouldReduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest">
          Model Comparison
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/70 transition-colors text-xs px-2 py-1 rounded-lg hover:bg-white/5"
          >
            Clear
          </button>
        )}
      </div>

      {/* Side-by-side model cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <ModelCard
          model={resnet}
          accentClass="text-sky-400"
          borderClass="border-sky-500/50"
        />
        <ModelCard
          model={xgboost}
          accentClass="text-violet-400"
          borderClass="border-violet-500/50"
        />
      </div>

      {/* Model agreement banner */}
      <ConsensusBanner consensus={consensus} />

      {/* Radar Quality & SNR Telemetry */}
      {telemetry && <RadarTelemetryCard telemetry={telemetry} />}

      {/* Texture feature inspector */}
      <TextureInspector features={top_classical_features} />
    </motion.div>
  );
}
