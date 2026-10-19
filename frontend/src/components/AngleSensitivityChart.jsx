import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, Area,
} from 'recharts';

/**
 * Interactive chart showing how the model's P(iceberg) changes as the
 * incidence angle input is swept, holding the chip image fixed.
 * Features dual-zone shading (Iceberg vs Ship), crossover detection, and stability analysis.
 */
export default function AngleSensitivityChart({ data, currentAngle }) {
  const shouldReduceMotion = useReducedMotion();
  const analysis = useMemo(() => {
    if (!data || data.length < 2) return null;
    let minP = 1.0;
    let maxP = 0.0;
    let crossoverPoint = null;

    for (let i = 0; i < data.length; i++) {
      const p = data[i].probability_iceberg;
      if (p < minP) minP = p;
      if (p > maxP) maxP = p;

      if (i < data.length - 1) {
        const pNext = data[i + 1].probability_iceberg;
        if ((p - 0.5) * (pNext - 0.5) <= 0 && p !== pNext) {
          const t = (0.5 - p) / (pNext - p);
          const angle = data[i].angle + t * (data[i + 1].angle - data[i].angle);
          const direction = pNext > p ? 'Ship → Iceberg' : 'Iceberg → Ship';
          crossoverPoint = { angle: parseFloat(angle.toFixed(1)), direction };
        }
      }
    }

    const isCrossing = crossoverPoint !== null;
    const allShip = maxP < 0.5;
    const allIceberg = minP >= 0.5;

    return {
      minP,
      maxP,
      crossoverPoint,
      isCrossing,
      allShip,
      allIceberg,
    };
  }, [data]);

  if (!data || data.length === 0) return null;

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="glass-panel p-6 space-y-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white/90 mb-0.5">
            Incidence Angle Sensitivity
          </h3>
          <p className="text-muted text-xs">
            P(iceberg) vs viewing geometry — image content held constant
          </p>
        </div>
        {analysis?.isCrossing ? (
          <span className="badge bg-amber/15 text-amber border border-amber/30 text-[11px] font-mono">
            Angle Sensitive
          </span>
        ) : (
          <span className="badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono">
            Angle Robust
          </span>
        )}
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
            <defs>
              <linearGradient id="probGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Dual-Zone Shading */}
            <ReferenceArea
              y1={0.5}
              y2={1.0}
              fill="#f87171"
              fillOpacity={0.06}
            />
            <ReferenceArea
              y1={0.0}
              y2={0.5}
              fill="#38bdf8"
              fillOpacity={0.06}
            />

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="angle"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              label={{
                value: 'Incidence Angle (°)',
                position: 'insideBottom',
                offset: -2,
                style: { fill: '#94a3b8', fontSize: 11 },
              }}
            />
            <YAxis
              domain={[0, 1]}
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              label={{
                value: 'P(Iceberg)',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                style: { fill: '#94a3b8', fontSize: 11 },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                fontSize: 12,
              }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(value) => [`${(value * 100).toFixed(2)}%`, 'P(Iceberg)']}
              labelFormatter={(label) => `Angle: ${label}°`}
            />
            
            {/* 50% Threshold Reference Line */}
            <ReferenceLine
              y={0.5}
              stroke="#f87171"
              strokeDasharray="6 4"
              strokeOpacity={0.7}
              label={{
                value: '50% Threshold',
                position: 'right',
                style: { fill: '#f87171', fontSize: 10, opacity: 0.8 },
              }}
            />

            {/* Crossover Line if crossing occurs */}
            {analysis?.crossoverPoint && (
              <ReferenceLine
                x={analysis.crossoverPoint.angle}
                stroke="#fbbf24"
                strokeDasharray="3 3"
                label={{
                  value: `Flip: ${analysis.crossoverPoint.angle}°`,
                  position: 'insideTopLeft',
                  style: { fill: '#fbbf24', fontSize: 10, fontWeight: 'bold' },
                }}
              />
            )}

            {/* Actual Observation Angle */}
            {currentAngle != null && (
              <ReferenceLine
                x={currentAngle}
                stroke="#34d399"
                strokeDasharray="4 3"
                strokeOpacity={0.8}
                label={{
                  value: `Observed (${currentAngle.toFixed(1)}°)`,
                  position: 'top',
                  style: { fill: '#34d399', fontSize: 10 },
                }}
              />
            )}

            <Area
              type="monotone"
              dataKey="probability_iceberg"
              stroke="none"
              fill="url(#probGradient)"
            />
            <Line
              type="monotone"
              dataKey="probability_iceberg"
              stroke="#38bdf8"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#0b1120', stroke: '#38bdf8', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#38bdf8', stroke: '#fff', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend & Zone Identifiers */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs border-t border-white/5">
        <div className="flex items-center gap-4 text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/30 border border-rose-500/50 inline-block" />
            <span>Iceberg Zone (&gt;50%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-500/30 border border-sky-500/50 inline-block" />
            <span>Ship Zone (&lt;50%)</span>
          </span>
        </div>
        {currentAngle != null && (
          <span className="font-mono text-emerald-400 text-[11px]">
            ● Observed Pass: {currentAngle.toFixed(1)}°
          </span>
        )}
      </div>

      {/* Stability Diagnostic Insight */}
      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-white/70 leading-relaxed">
        {analysis?.isCrossing ? (
          <span className="flex items-start gap-2 text-amber-light">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>
              <strong className="text-white">Decision Boundary Crossing at {analysis.crossoverPoint.angle}°:</strong> At steeper look angles the model predicts one class, but transitions to the other at shallower grazing angles. Secondary verification recommended.
            </span>
          </span>
        ) : analysis?.allShip ? (
          <span className="flex items-start gap-2 text-emerald-300/90">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>
              <strong className="text-white">Consistent Ship Classification:</strong> Estimated iceberg probability remains below the 50% threshold across all evaluated incidence angles ({analysis.minP ? (analysis.minP * 100).toFixed(1) : 0}% – {(analysis.maxP * 100).toFixed(1)}%). Classification remains stable across orbital geometries.
            </span>
          </span>
        ) : (
          <span className="flex items-start gap-2 text-rose-300/90">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>
              <strong className="text-white">Consistent Iceberg Classification:</strong> Estimated iceberg probability exceeds 50% across all evaluated incidence angles ({(analysis?.minP * 100).toFixed(1)}% – {(analysis?.maxP * 100).toFixed(1)}%). Target signature remains stable across orbital geometries.
            </span>
          </span>
        )}
      </div>
    </motion.div>
  );
}

