import { Link } from 'react-router-dom';
import AngleSensitivityChart from '../components/AngleSensitivityChart';
import { useChip } from '../context/ChipContext';

export default function AnglePage() {
  const { chip, sweepData, handleAngleSweep, sweepLoading } = useChip();

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Incidence Angle Sensitivity Sweep
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-accent/10 border border-accent/25 text-accent">
              30.0° – 46.0° Sweep
            </span>
          </h1>
          <p className="text-muted text-xs mt-0.5">
            Counterfactual orbital simulation evaluating target classification stability across varying radar look angles.
          </p>
        </div>

        {chip && (!sweepData || sweepData.length === 0) && (
          <button
            onClick={handleAngleSweep}
            disabled={sweepLoading}
            className="btn-primary text-xs"
          >
            {sweepLoading ? 'Simulating Orbital Sweep…' : 'Run Angle Sweep'}
          </button>
        )}
      </div>

      {!chip ? (
        <div className="glass-panel p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center mx-auto text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">No Target Chip Loaded</h2>
            <p className="text-muted text-xs max-w-md mx-auto mt-1">
              Please select a target preset or drop a SAR chip file in the Analysis Workspace to simulate look-angle sensitivity.
            </p>
          </div>
          <Link to="/app" className="btn-primary text-xs inline-flex items-center gap-2">
            <span>Select Target in Analysis</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      ) : !sweepData || sweepData.length === 0 ? (
        <div className="glass-panel p-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent font-mono text-xs">
            <span>Loaded: {chip.name || 'Custom Chip'}</span>
            <span>·</span>
            <span>Observed Pass: {chip.inc_angle != null ? `${chip.inc_angle.toFixed(1)}°` : 'N/A'}</span>
          </div>
          <p className="text-muted text-xs max-w-md mx-auto">
            Simulate 31 synthetic pass geometries from 30.0° grazing to 46.0° steep angles to determine boundary crossover risk.
          </p>
          <button
            onClick={handleAngleSweep}
            disabled={sweepLoading}
            className="btn-primary text-sm inline-flex items-center gap-2 shadow-glow"
          >
            {sweepLoading ? 'Simulating Orbital Sweep…' : 'Run Angle Sweep'}
          </button>
        </div>
      ) : (
        <AngleSensitivityChart
          data={sweepData}
          currentAngle={chip?.inc_angle}
        />
      )}
    </div>
  );
}
