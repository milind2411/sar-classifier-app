import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { getHistory } from '../api';
import { useChip } from '../context/ChipContext';

const PIE_COLORS = {
  ship: '#38bdf8', // cyan
  iceberg: '#fbbf24', // amber
};

export default function AnalyticsPage() {
  const { containerVariants, itemVariants } = useChip();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterClass, setFilterClass] = useState('all');

  useEffect(() => {
    let mounted = true;
    getHistory(200)
      .then((data) => {
        if (mounted) {
          setHistory(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Compute Analytics Metrics
  const stats = useMemo(() => {
    const total = history.length;
    if (total === 0) {
      return {
        total: 0,
        ships: 0,
        icebergs: 0,
        shipPct: 0,
        icebergPct: 0,
        meanConf: 0,
        highConfCount: 0,
        borderlineCount: 0,
      };
    }

    const ships = history.filter((h) => h.predicted_class === 'ship').length;
    const icebergs = history.filter((h) => h.predicted_class === 'iceberg').length;
    const meanConf = (history.reduce((acc, h) => acc + h.confidence, 0) / total) * 100;
    const highConfCount = history.filter((h) => h.confidence >= 0.9).length;
    const borderlineCount = history.filter((h) => h.confidence >= 0.5 && h.confidence < 0.7).length;

    return {
      total,
      ships,
      icebergs,
      shipPct: ((ships / total) * 100).toFixed(1),
      icebergPct: ((icebergs / total) * 100).toFixed(1),
      meanConf: meanConf.toFixed(1),
      highConfCount,
      borderlineCount,
    };
  }, [history]);

  // Chart Data: Class Distribution Donut
  const classDonutData = useMemo(() => {
    return [
      { name: 'Ships', value: stats.ships, color: PIE_COLORS.ship },
      { name: 'Icebergs', value: stats.icebergs, color: PIE_COLORS.iceberg },
    ];
  }, [stats]);

  // Chart Data: Confidence Distribution Histogram
  const confidenceHistogram = useMemo(() => {
    const bins = [
      { range: '50-60%', count: 0 },
      { range: '60-70%', count: 0 },
      { range: '70-80%', count: 0 },
      { range: '80-90%', count: 0 },
      { range: '90-100%', count: 0 },
    ];

    history.forEach((item) => {
      const c = item.confidence * 100;
      if (c < 60) bins[0].count++;
      else if (c < 70) bins[1].count++;
      else if (c < 80) bins[2].count++;
      else if (c < 90) bins[3].count++;
      else bins[4].count++;
    });

    return bins;
  }, [history]);

  // Chart Data: Incidence Angle Spread
  const angleSpread = useMemo(() => {
    const bins = [
      { range: '30-34°', count: 0 },
      { range: '34-38°', count: 0 },
      { range: '38-42°', count: 0 },
      { range: '42-46°', count: 0 },
    ];

    history.forEach((item) => {
      const ang = item.inc_angle;
      if (ang != null) {
        if (ang < 34) bins[0].count++;
        else if (ang < 38) bins[1].count++;
        else if (ang < 42) bins[2].count++;
        else bins[3].count++;
      }
    });

    return bins;
  }, [history]);

  // Filtered Table Records
  const filteredHistory = useMemo(() => {
    if (filterClass === 'all') return history;
    return history.filter((h) => h.predicted_class === filterClass);
  }, [history, filterClass]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ── Header ── */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase tracking-widest text-accent font-semibold">
              Operational Telemetry
            </span>
            <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent font-mono text-[10px]">
              Telemetry Audit Store ({stats.total} Records)
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Prediction Audit & Telemetry Analytics
          </h2>
          <p className="text-muted text-sm mt-1 max-w-2xl">
            Real-time evaluation statistics, model confidence distributions, and target classification trends across all processed SAR radar passes.
          </p>
        </div>
      </motion.div>

      {/* ── KPI Cards ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass-panel p-4">
          <p className="text-[11px] font-mono text-muted uppercase">Inferences Logged</p>
          <p className="text-xl font-mono font-bold text-white mt-1">{stats.total}</p>
          <p className="text-[10px] font-mono text-white/40 mt-0.5">Audit Database</p>
        </div>

        <div className="glass-panel p-4">
          <p className="text-[11px] font-mono text-cyan-400 uppercase">Ships Detected</p>
          <p className="text-xl font-mono font-bold text-cyan-300 mt-1">{stats.ships}</p>
          <p className="text-[10px] font-mono text-white/40 mt-0.5">{stats.shipPct}% of total</p>
        </div>

        <div className="glass-panel p-4">
          <p className="text-[11px] font-mono text-amber-400 uppercase">Icebergs Detected</p>
          <p className="text-xl font-mono font-bold text-amber-300 mt-1">{stats.icebergs}</p>
          <p className="text-[10px] font-mono text-white/40 mt-0.5">{stats.icebergPct}% of total</p>
        </div>

        <div className="glass-panel p-4">
          <p className="text-[11px] font-mono text-muted uppercase">Mean Confidence</p>
          <p className="text-xl font-mono font-bold text-white mt-1">{stats.meanConf}%</p>
          <p className="text-[10px] font-mono text-white/40 mt-0.5">Avg Model Certainty</p>
        </div>

        <div className="glass-panel p-4">
          <p className="text-[11px] font-mono text-emerald-400 uppercase">High Confidence</p>
          <p className="text-xl font-mono font-bold text-emerald-300 mt-1">{stats.highConfCount}</p>
          <p className="text-[10px] font-mono text-white/40 mt-0.5">&ge;90% Certainty</p>
        </div>

        <div className="glass-panel p-4">
          <p className="text-[11px] font-mono text-rose-400 uppercase">Borderline Contacts</p>
          <p className="text-xl font-mono font-bold text-rose-300 mt-1">{stats.borderlineCount}</p>
          <p className="text-[10px] font-mono text-white/40 mt-0.5">50–70% Certainty</p>
        </div>
      </motion.div>

      {/* ── Charts Grid ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut: Class Breakdown */}
        <div className="glass-panel p-5 space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-white/60">
            Target Class Distribution
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={classDonutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  stroke="#020408"
                  strokeWidth={2}
                >
                  {classDonutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#05080e',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span className="text-white/80">Ships: {stats.ships} ({stats.shipPct}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-white/80">Icebergs: {stats.icebergs} ({stats.icebergPct}%)</span>
            </div>
          </div>
        </div>

        {/* Histogram: Confidence Spread */}
        <div className="glass-panel p-5 space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-white/60">
            Model Confidence Histogram
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confidenceHistogram} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="range" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#05080e',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] font-mono text-muted text-center">
            Distribution of model certainty across all inference passes
          </p>
        </div>

        {/* Histogram: Incidence Angle Distribution */}
        <div className="glass-panel p-5 space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-white/60">
            Satellite Incidence Angle Spread
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={angleSpread} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="range" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#05080e',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] font-mono text-muted text-center">
            Radar viewing geometry distribution (Sentinel-1 pass angles)
          </p>
        </div>
      </motion.div>

      {/* ── Recent Inferences Table ── */}
      <motion.div variants={itemVariants} className="glass-panel overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-mono uppercase tracking-wider text-white font-semibold">
            Inference Audit Records
          </h3>
          <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/10 text-xs font-mono">
            {['all', 'ship', 'iceberg'].map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => setFilterClass(cls)}
                className={`px-3 py-1 rounded-lg transition-all capitalize ${
                  filterClass === cls
                    ? 'bg-accent/20 text-accent font-bold shadow-glow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="py-12 text-center text-muted text-xs font-mono">
            No audit records match the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono divide-y divide-white/5">
              <thead className="bg-white/[0.02] text-white/50 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Class</th>
                  <th className="py-2.5 px-4">Confidence</th>
                  <th className="py-2.5 px-4">P(Iceberg)</th>
                  <th className="py-2.5 px-4">Angle (θ)</th>
                  <th className="py-2.5 px-4">Pipeline</th>
                  <th className="py-2.5 px-4">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredHistory.slice(0, 50).map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3 text-white/40">#{row.id}</td>
                    <td className="py-2.5 px-4 text-white/70">
                      {new Date(row.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.predicted_class === 'ship' ? 'badge-ship' : 'badge-iceberg'
                      }`}>
                        {row.predicted_class.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-white">
                      {(row.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-4 text-white/80">
                      {(row.probability_iceberg * 100).toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-4 text-white/60">
                      {row.inc_angle != null ? `${row.inc_angle.toFixed(1)}°` : 'N/A'}
                    </td>
                    <td className="py-2.5 px-4 text-accent/80">{row.model_used}</td>
                    <td className="py-2.5 px-4 text-white/40">{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
