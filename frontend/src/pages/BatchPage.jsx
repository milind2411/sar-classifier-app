import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useChip, SAMPLES } from '../context/ChipContext';
import { predictBatch } from '../api';
import { bandsToFalseColor } from '../colormap';

function ChipThumbnail({ band1, band2 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !band1 || !band2) return;
    try {
      const imgData = bandsToFalseColor(band1, band2);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Draw onto offscreen canvas at 75x75 then scale down to canvas size
      const offscreen = document.createElement('canvas');
      offscreen.width = 75;
      offscreen.height = 75;
      const offCtx = offscreen.getContext('2d');
      offCtx.putImageData(imgData, 0, 0);

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    } catch {
      // Fallback
    }
  }, [band1, band2]);

  return (
    <canvas
      ref={canvasRef}
      width={40}
      height={40}
      className="w-10 h-10 rounded border border-white/15 bg-black shrink-0"
      title="Radar false-color composite preview"
    />
  );
}

export default function BatchPage({ onInspectChip }) {
  const navigate = useNavigate();
  const { loadChip, containerVariants, itemVariants } = useChip();

  const [chips, setChips] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // ── Load built-in 6 sample chips as a batch ──
  const handleLoadSampleBatch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedChips = [];
      for (const s of SAMPLES) {
        const res = await fetch(`/sample_chips/${s.id}.json`);
        if (!res.ok) throw new Error(`Could not fetch /sample_chips/${s.id}.json`);
        const data = await res.json();
        loadedChips.push({
          ...data,
          name: `${s.id}.json`,
          trueLabel: s.class,
        });
      }

      setChips(loadedChips);

      // Call batch inference API
      const payload = loadedChips.map((c) => ({
        band_1: c.band_1,
        band_2: c.band_2,
        inc_angle: c.inc_angle,
      }));

      const batchRes = await predictBatch(payload);
      setResults(batchRes.results);
    } catch (err) {
      setError(`Batch loading failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Handle multiple file upload via file picker ──
  const handleFilesSelected = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length > 50) {
      setError('Batch limit is 50 chips per execution. Please select 50 or fewer files.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const parsedChips = [];
      for (const file of files) {
        if (!file.name.endsWith('.json')) {
          throw new Error(`File ${file.name} is not a .json chip. Currently JSON batch upload is supported.`);
        }
        const text = await file.text();
        const json = JSON.parse(text);
        if (!json.band_1 || !json.band_2 || json.inc_angle == null) {
          throw new Error(`File ${file.name} is missing required fields (band_1, band_2, inc_angle).`);
        }
        parsedChips.push({
          ...json,
          name: file.name,
        });
      }

      setChips(parsedChips);

      const payload = parsedChips.map((c) => ({
        band_1: c.band_1,
        band_2: c.band_2,
        inc_angle: c.inc_angle,
      }));

      const batchRes = await predictBatch(payload);
      setResults(batchRes.results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  // ── Transfer chip to Analysis Console ──
  const handleInspectInConsole = useCallback(
    (index) => {
      const selectedChip = chips[index];
      if (selectedChip) {
        loadChip(selectedChip);
        if (onInspectChip) {
          onInspectChip(selectedChip);
        } else {
          navigate('/app');
        }
      }
    },
    [chips, loadChip, navigate, onInspectChip],
  );

  // ── Export Batch as CSV ──
  const handleExportCsv = useCallback(() => {
    if (results.length === 0) return;

    const headers = [
      'Index',
      'Filename',
      'Predicted_Class',
      'Probability_Iceberg',
      'Confidence',
      'Incidence_Angle_Deg',
      'SNR_TCR_dB',
      'Contrast_Assessment',
      'Speckle_Reduction_Pct',
      'ENL_Filtered',
      'Cross_Pol_Delta_dB',
    ];

    const rows = results.map((r, i) => {
      const c = chips[i] || {};
      const t = r.telemetry || {};
      return [
        i + 1,
        `"${c.name || `chip_${i + 1}`}"`,
        r.predicted_class,
        r.probability_iceberg.toFixed(4),
        (r.confidence * 100).toFixed(2),
        c.inc_angle != null ? c.inc_angle.toFixed(2) : '',
        t.target_to_clutter_ratio_db != null ? t.target_to_clutter_ratio_db.toFixed(2) : '',
        `"${t.target_contrast_assessment || 'N/A'}"`,
        t.speckle_reduction_pct != null ? t.speckle_reduction_pct.toFixed(1) : '',
        t.enl_filtered != null ? t.enl_filtered.toFixed(2) : '',
        t.cross_pol_delta_db != null ? t.cross_pol_delta_db.toFixed(2) : '',
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SAR_Batch_ATR_Report_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [chips, results]);

  // ── Batch Aggregates ──
  const stats = {
    total: results.length,
    ships: results.filter((r) => r.predicted_class === 'ship').length,
    icebergs: results.filter((r) => r.predicted_class === 'iceberg').length,
    avgConfidence:
      results.length > 0
        ? (results.reduce((acc, r) => acc + r.confidence, 0) / results.length) * 100
        : 0,
    meanSnr:
      results.length > 0
        ? results.reduce((acc, r) => acc + (r.telemetry?.target_to_clutter_ratio_db || 0), 0) /
          results.length
        : 0,
    clutterAlerts: results.filter(
      (r) => (r.telemetry?.target_to_clutter_ratio_db ?? 10) < 6.0,
    ).length,
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* ── Page Header ── */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase tracking-widest text-accent font-semibold">
              High-Throughput Batch Processing
            </span>
            <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent font-mono text-[10px]">
              POST /api/predict/batch
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Batch Processing Workstation
          </h2>
          <p className="text-muted text-sm mt-1 max-w-2xl">
            Evaluate up to 50 Sentinel-1 SAR chips simultaneously via high-speed automated neural inference with automated radar clutter and SNR telemetry.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".json"
            onChange={handleFilesSelected}
            className="hidden"
          />

          <button
            type="button"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl text-xs font-mono bg-white/[0.04] border border-white/15 text-white hover:bg-white/[0.08] hover:border-white/30 transition-all duration-150 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Upload JSON Chips
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleLoadSampleBatch}
            className="px-3.5 py-2 rounded-xl text-xs font-mono bg-accent/15 border border-accent/35 text-accent hover:bg-accent/25 hover:border-accent/60 transition-all duration-150 flex items-center gap-2 cursor-pointer shadow-glow-sm disabled:opacity-50"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            )}
            Load 6 Ground-Truth Chips
          </button>

          {results.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 rounded-xl text-xs font-mono bg-white/[0.04] border border-white/15 text-white/80 hover:text-white hover:bg-white/[0.08] transition-all duration-150 flex items-center gap-2 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export CSV
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Error Banner ── */}
      {error && (
        <motion.div variants={itemVariants} className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-400 text-xs font-mono">
          {error}
        </motion.div>
      )}

      {/* ── Aggregate Metrics Ribbon (Visible when results present) ── */}
      {results.length > 0 && (
        <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="glass-panel p-4">
            <p className="text-[11px] font-mono text-muted uppercase">Total Evaluated</p>
            <p className="text-xl font-mono font-bold text-white mt-1">{stats.total}</p>
            <p className="text-[10px] font-mono text-white/40 mt-0.5">Capped at 50</p>
          </div>

          <div className="glass-panel p-4">
            <p className="text-[11px] font-mono text-cyan-400 uppercase">Ships Detected</p>
            <p className="text-xl font-mono font-bold text-cyan-300 mt-1">{stats.ships}</p>
            <p className="text-[10px] font-mono text-white/40 mt-0.5">
              {((stats.ships / stats.total) * 100).toFixed(0)}% of batch
            </p>
          </div>

          <div className="glass-panel p-4">
            <p className="text-[11px] font-mono text-sky-400 uppercase">Icebergs Detected</p>
            <p className="text-xl font-mono font-bold text-sky-300 mt-1">{stats.icebergs}</p>
            <p className="text-[10px] font-mono text-white/40 mt-0.5">
              {((stats.icebergs / stats.total) * 100).toFixed(0)}% of batch
            </p>
          </div>

          <div className="glass-panel p-4">
            <p className="text-[11px] font-mono text-muted uppercase">Mean Confidence</p>
            <p className="text-xl font-mono font-bold text-white mt-1">
              {stats.avgConfidence.toFixed(1)}%
            </p>
            <p className="text-[10px] font-mono text-white/40 mt-0.5">Sigmoid confidence</p>
          </div>

          <div className="glass-panel p-4">
            <p className="text-[11px] font-mono text-muted uppercase">Mean SNR (TCR)</p>
            <p className="text-xl font-mono font-bold text-white mt-1">
              {stats.meanSnr >= 0 ? '+' : ''}
              {stats.meanSnr.toFixed(1)} dB
            </p>
            <p className="text-[10px] font-mono text-white/40 mt-0.5">Target/Clutter Ratio</p>
          </div>

          <div className="glass-panel p-4">
            <p className="text-[11px] font-mono text-amber-400 uppercase">Clutter Warnings</p>
            <p className="text-xl font-mono font-bold text-amber-300 mt-1">{stats.clutterAlerts}</p>
            <p className="text-[10px] font-mono text-white/40 mt-0.5">&lt;6 dB target contrast</p>
          </div>
        </motion.div>
      )}

      {/* ── Main Batch Table or Empty State ── */}
      <motion.div variants={itemVariants} className="glass-panel overflow-hidden">
        {results.length === 0 ? (
          <div className="p-12 text-center max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/25 text-accent mx-auto flex items-center justify-center shadow-glow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white">No Batch Loaded</h3>
            <p className="text-muted text-xs leading-relaxed">
              Upload multiple JSON chip files or load the Kaggle ground-truth test batch (6 chips) to run high-throughput automated target recognition.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleLoadSampleBatch}
                className="btn-primary inline-flex items-center gap-2"
              >
                Load Ground-Truth Test Batch (6 Chips)
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono divide-y divide-white/5">
              <thead className="bg-white/[0.02] text-white/50 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-3">Radar Preview</th>
                  <th className="py-3 px-4">Target File</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">P(Iceberg)</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Angle (θ)</th>
                  <th className="py-3 px-4">SNR (dB)</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {results.map((res, idx) => {
                  const chipData = chips[idx] || {};
                  const isShip = res.predicted_class === 'ship';
                  const pIceberg = res.probability_iceberg;
                  const snr = res.telemetry?.target_to_clutter_ratio_db;
                  const isLowContrast = snr != null && snr < 6.0;

                  return (
                    <tr
                      key={chipData.name || idx}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Index */}
                      <td className="py-3 px-4 text-white/40">{idx + 1}</td>

                      {/* 40x40 Thumbnail Preview */}
                      <td className="py-2.5 px-3">
                        <ChipThumbnail
                          band1={chipData.band_1}
                          band2={chipData.band_2}
                        />
                      </td>

                      {/* Target Name */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white truncate max-w-[160px]" title={chipData.name}>
                          {chipData.name || `chip_${idx + 1}`}
                        </div>
                        {chipData.trueLabel && (
                          <span className="text-[10px] text-white/40">
                            Ground truth: {chipData.trueLabel}
                          </span>
                        )}
                      </td>

                      {/* Class Badge */}
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${isShip ? 'badge-ship' : 'badge-iceberg'}`}>
                          {isShip ? 'SHIP' : 'ICEBERG'}
                        </span>
                      </td>

                      {/* P(Iceberg) Meter */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={`h-full ${isShip ? 'bg-cyan-400' : 'bg-sky-400'}`}
                              style={{ width: `${Math.max(3, pIceberg * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-white/80">
                            {(pIceberg * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Confidence */}
                      <td className="py-3 px-4 text-white font-medium">
                        {(res.confidence * 100).toFixed(1)}%
                      </td>

                      {/* Incidence Angle */}
                      <td className="py-3 px-4 text-white/70">
                        {chipData.inc_angle != null ? `${chipData.inc_angle.toFixed(1)}°` : 'N/A'}
                      </td>

                      {/* SNR (dB) */}
                      <td className="py-3 px-4">
                        {snr != null ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                isLowContrast
                                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                                  : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                              }`}
                            >
                              {snr >= 0 ? '+' : ''}
                              {snr.toFixed(1)} dB
                            </span>
                          </div>
                        ) : (
                          <span className="text-white/30">N/A</span>
                        )}
                      </td>

                      {/* Action: Inspect in Console */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleInspectInConsole(idx)}
                          title="Load this chip into the primary Analysis Console for deep inspection"
                          className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-white/[0.04] border border-white/10 text-white/70 hover:text-white hover:bg-accent/15 hover:border-accent/30 transition-all duration-150 cursor-pointer"
                        >
                          Inspect →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
