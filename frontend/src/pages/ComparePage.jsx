import { Link } from 'react-router-dom';
import ModelComparisonPanel from '../components/ModelComparisonPanel';
import { useChip } from '../context/ChipContext';

export default function ComparePage({ onSelectTarget }) {
  const { chip, compareResult, setCompareResult, handleRunComparison, loading } = useChip();

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Model Comparison Benchmark
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
              ResNet50 vs GLCM XGBoost
            </span>
          </h1>
          <p className="text-muted text-xs mt-0.5">
            Side-by-side consensus evaluation, decision agreement, and physical texture feature telemetry.
          </p>
        </div>

        {chip && !compareResult && (
          <button
            onClick={handleRunComparison}
            disabled={loading}
            className="btn-primary text-xs cursor-pointer"
          >
            {loading ? 'Evaluating Models…' : 'Run Dual-Model Comparison'}
          </button>
        )}
      </div>

      {!chip ? (
        <div className="glass-panel p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center mx-auto text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">No Target Chip Loaded</h2>
            <p className="text-muted text-xs max-w-md mx-auto mt-1">
              Please select a target preset or drop a SAR chip file in the Analysis Workspace to benchmark ResNet50 against the GLCM XGBoost baseline.
            </p>
          </div>
          {onSelectTarget ? (
            <button
              type="button"
              onClick={onSelectTarget}
              className="btn-primary text-xs inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Select Target in Analysis</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          ) : (
            <Link to="/app" className="btn-primary text-xs inline-flex items-center gap-2">
              <span>Select Target in Analysis</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          )}
        </div>
      ) : !compareResult ? (
        <div className="glass-panel p-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent font-mono text-xs">
            <span>Loaded: {chip.name || 'Custom Chip'}</span>
            <span>·</span>
            <span>Angle: {chip.inc_angle != null ? `${chip.inc_angle.toFixed(1)}°` : 'N/A'}</span>
          </div>
          <p className="text-muted text-xs max-w-md mx-auto">
            Ready to benchmark deep learning features against 49 classical GLCM Haralick texture and clutter moment features.
          </p>
          <button
            onClick={handleRunComparison}
            disabled={loading}
            className="btn-primary text-sm inline-flex items-center gap-2 shadow-glow"
          >
            {loading ? 'Evaluating Models…' : 'Run Dual-Model Comparison'}
          </button>
        </div>
      ) : (
        <ModelComparisonPanel
          data={compareResult}
          onClose={() => setCompareResult(null)}
        />
      )}
    </div>
  );
}
