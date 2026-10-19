import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { getHistory } from '../api';

function formatReadableTime(isoStr) {
  if (!isoStr) return 'Unknown';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

export default function HistoryDrawer({ isOpen, onClose }) {
  const shouldReduceMotion = useReducedMotion();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsDisabled(false);
    try {
      const data = await getHistory(50);
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.status === 404 || (err.message && err.message.toLowerCase().includes('disabled'))) {
        setIsDisabled(true);
      } else {
        setError(err.message || 'Failed to fetch history');
      }
    } finally {
      setLoading(false);
    }
  }, []);


  // Fetch whenever the drawer is opened
  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, fetchHistory]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
          />

          {/* Slide-out Drawer */}
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Prediction History"
            initial={shouldReduceMotion ? { opacity: 0 } : { x: '100%' }}
            animate={shouldReduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-y-0 right-0 max-w-full flex pl-10"
          >
            <div className="w-screen max-w-md sm:max-w-lg bg-slate-950/95 border-l border-white/10 shadow-2xl backdrop-blur-xl flex flex-col">
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      Prediction History
                      {history.length > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white/70 font-normal">
                          {history.length} {history.length === 1 ? 'record' : 'records'}
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-muted">Telemetry Audit Store · Newest First</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={fetchHistory}
                    disabled={loading}
                    title="Refresh history"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors disabled:opacity-40"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`w-4 h-4 ${loading ? 'animate-spin text-accent' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    title="Close history drawer"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading && history.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                    <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                    <span className="text-xs text-muted font-mono">Fetching prediction history…</span>
                  </div>
                )}

                {error && !isDisabled && (
                  <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs space-y-2">
                    <p className="font-semibold">Failed to load history</p>
                    <p>{error}</p>
                    <button
                      onClick={fetchHistory}
                      className="px-3 py-1 bg-danger/20 hover:bg-danger/30 rounded text-[11px] font-mono text-danger font-medium transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {isDisabled && (
                  <div className="flex flex-col items-center justify-center py-20 text-center px-6 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-muted">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Prediction History</h3>
                      <p className="text-xs text-muted mt-1 max-w-xs leading-relaxed">
                        History is disabled on this deployment.
                      </p>
                    </div>
                  </div>
                )}

                {!loading && !error && !isDisabled && history.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center px-6 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-muted">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">No predictions yet</h3>
                      <p className="text-xs text-muted mt-1 max-w-xs leading-relaxed">
                        No predictions yet — analyze a chip to see history here.
                      </p>
                    </div>
                    <Link
                      to="/app"
                      onClick={onClose}
                      className="btn-primary text-xs inline-flex items-center gap-2 mt-2"
                    >
                      <span>Go to Analysis Workspace</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
                  </div>
                )}

                {!error && !isDisabled && history.length > 0 && (
                  <div className="space-y-2.5">
                    {history.map((item) => {
                      const isIceberg = item.predicted_class === 'iceberg';
                      const isExpanded = expandedId === item.id;
                      const confidencePct = (item.confidence * 100).toFixed(1);
                      const probIcebergPct = (item.probability_iceberg * 100).toFixed(1);
                      const probShipPct = ((1 - item.probability_iceberg) * 100).toFixed(1);

                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border transition-all duration-150 overflow-hidden ${
                            isExpanded
                              ? 'bg-slate-900/90 border-accent/40 shadow-glow-sm'
                              : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.05] hover:border-white/20'
                          }`}
                        >
                          {/* Summary Row (Clickable) */}
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            className="w-full text-left p-3.5 flex items-center justify-between gap-3 cursor-pointer"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <span className={isIceberg ? 'badge-iceberg' : 'badge-ship'}>
                                  {isIceberg ? 'Iceberg' : 'Ship'}
                                </span>
                                <span className="font-mono text-xs font-semibold text-white/90">
                                  {confidencePct}% conf
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/60">
                                  {item.inc_angle != null ? `${item.inc_angle.toFixed(1)}°` : 'N/A'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-muted flex-wrap">
                                <span>{formatReadableTime(item.timestamp)}</span>
                                <span className="text-white/20">·</span>
                                <span className="font-mono text-[10px] text-accent/80">
                                  {item.model_used || 'resnet50'}
                                </span>
                                <span className="text-white/20">·</span>
                                <span className="font-mono text-[10px] text-white/40">
                                  {item.source || 'predict'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-white/40 shrink-0">
                              <span className="text-[10px] font-mono text-white/30">#{item.id}</span>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-accent' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                              </svg>
                            </div>
                          </button>

                          {/* Expanded Telemetry Detail View */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                                className="border-t border-white/10 bg-slate-950/60 p-4 space-y-3.5 text-xs font-mono"
                              >
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                                    <div className="text-[10px] text-muted uppercase">Confidence</div>
                                    <div className={`text-base font-bold ${isIceberg ? 'text-danger' : 'text-accent'}`}>
                                      {confidencePct}%
                                    </div>
                                  </div>
                                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                                    <div className="text-[10px] text-muted uppercase">Incidence Angle</div>
                                    <div className="text-base font-bold text-white">
                                      {item.inc_angle != null ? `${item.inc_angle.toFixed(2)}°` : 'N/A'}
                                    </div>
                                  </div>
                                </div>

                                {/* Probability Distribution */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-muted">P(Iceberg) / P(Ship)</span>
                                    <span className="text-white">
                                      {probIcebergPct}% / {probShipPct}%
                                    </span>
                                  </div>
                                  <div className="w-full h-2 bg-navy-light/60 rounded-full overflow-hidden flex border border-white/10">
                                    <div
                                      style={{ width: `${item.probability_iceberg * 100}%` }}
                                      className="h-full bg-danger transition-all duration-300"
                                      title={`Iceberg: ${probIcebergPct}%`}
                                    />
                                    <div
                                      style={{ width: `${(1 - item.probability_iceberg) * 100}%` }}
                                      className="h-full bg-accent transition-all duration-300"
                                      title={`Ship: ${probShipPct}%`}
                                    />
                                  </div>
                                </div>

                                {/* Metadata Breakdown */}
                                <div className="space-y-1 pt-1 text-[11px] text-white/70 border-t border-white/5">
                                  <div className="flex justify-between py-0.5">
                                    <span className="text-muted">Record ID</span>
                                    <span className="text-white">#{item.id}</span>
                                  </div>
                                  <div className="flex justify-between py-0.5">
                                    <span className="text-muted">Timestamp</span>
                                    <span className="text-white/80">{item.timestamp}</span>
                                  </div>
                                  <div className="flex justify-between py-0.5">
                                    <span className="text-muted">Model Pipeline</span>
                                    <span className="text-accent">{item.model_used}</span>
                                  </div>
                                  <div className="flex justify-between py-0.5">
                                    <span className="text-muted">Source Endpoint</span>
                                    <span className="text-emerald-400">POST /api/{item.source}</span>
                                  </div>
                                </div>

                                <p className="text-[10px] text-muted italic leading-relaxed pt-1">
                                  Source radar chip raw pixel arrays are not persisted in audit logs to optimize storage footprint. Target classification telemetry is preserved above.
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer info */}
              <div className="p-3 border-t border-white/10 text-center text-[10px] font-mono text-muted bg-slate-900/40">
                Automated Audit Log · Persistent Record
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
