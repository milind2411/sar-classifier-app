import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { heatmapToImageData } from '../colormap';
import SplitCurtainViewer from './SplitCurtainViewer';

/**
 * Dedicated Grad-CAM Explainability Panel.
 * Renders the 75×75 spatial attention activation map on its own standalone 300×300 canvas
 * with selectable colormaps (Turbo, Inferno, Jet), crisp vs smooth rendering,
 * colorbar scale, pixel-level activation inspection, and interactive split-curtain wipe.
 */
export default function GradCamPanel({
  heatmap,
  band1,
  band2,
  layerName = 'conv3_block4_3_conv',
  predictedClass = 'ship',
  confidence = 0.99,
  onClose,
}) {
  const canvasRef = useRef(null);
  const [colormap, setColormap] = useState('turbo'); // 'turbo' | 'inferno' | 'jet'
  const [smooth, setSmooth] = useState(false);
  const [mode, setMode] = useState('standalone'); // 'standalone' | 'curtain'
  const [hoverInfo, setHoverInfo] = useState(null);

  // Compute peak and average attention stats
  const stats = useMemo(() => {
    if (!heatmap) return { min: 0, max: 0, mean: 0 };
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;
    for (let y = 0; y < heatmap.length; y++) {
      for (let x = 0; x < heatmap[y].length; x++) {
        const v = heatmap[y][x];
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
        count++;
      }
    }
    return {
      min,
      max,
      mean: count > 0 ? sum / count : 0,
    };
  }, [heatmap]);

  // Render heatmap to canvas
  useEffect(() => {
    if (!heatmap) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const imgData = heatmapToImageData(heatmap, colormap);

    const offscreen = new OffscreenCanvas(75, 75);
    const offCtx = offscreen.getContext('2d');
    offCtx.putImageData(imgData, 0, 0);

    ctx.imageSmoothingEnabled = smooth;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
  }, [heatmap, colormap, smooth]);

  const handleMouseMove = useCallback(
    (e) => {
      const canvas = canvasRef.current;
      if (!canvas || !heatmap) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const scaleX = 75 / rect.width;
      const scaleY = 75 / rect.height;
      const x = Math.max(0, Math.min(74, Math.floor(clientX * scaleX)));
      const y = Math.max(0, Math.min(74, Math.floor(clientY * scaleY)));

      const val = heatmap[y]?.[x] ?? 0;
      setHoverInfo({ x, y, val });
    },
    [heatmap],
  );

  const handleMouseLeave = useCallback(() => {
    setHoverInfo(null);
  }, []);

  if (!heatmap) return null;

  const isIceberg = predictedClass === 'iceberg';
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={shouldReduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel p-6 space-y-4 border border-accent/30"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white/90">Grad-CAM Spatial Attention</h2>
            <span className="badge bg-accent/15 text-accent border border-accent/30 text-[11px] font-mono">
              {layerName}
            </span>
          </div>
          <p className="text-muted text-xs mt-0.5">
            Explaining predicted <span className={isIceberg ? 'text-danger font-semibold' : 'text-accent font-semibold'}>
              {isIceberg ? 'Iceberg' : 'Ship'}
            </span> ({((confidence || 0) * 100).toFixed(1)}% confidence)
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5 text-sm"
            title="Dismiss Grad-CAM"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Control Bar: View Mode, Colormap & Smoothing */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Mode Switcher */}
        {band1 && band2 && (
          <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setMode('standalone')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                mode === 'standalone'
                  ? 'bg-accent/20 text-accent font-semibold shadow-glow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Standalone CAM
            </button>
            <button
              type="button"
              onClick={() => setMode('curtain')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                mode === 'curtain'
                  ? 'bg-amber-500/20 text-amber-300 font-semibold shadow-glow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Split-Curtain Wipe
            </button>
          </div>
        )}

        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/10">
          {[
            { id: 'turbo', label: 'Turbo' },
            { id: 'inferno', label: 'Inferno' },
            { id: 'jet', label: 'Jet' },
          ].map((cm) => (
            <button
              key={cm.id}
              type="button"
              onClick={() => setColormap(cm.id)}
              className={`px-2 py-1 rounded-lg font-medium transition-all ${
                colormap === cm.id
                  ? 'bg-accent/20 text-accent font-semibold shadow-glow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {cm.label}
            </button>
          ))}
        </div>

        {mode === 'standalone' && (
          <button
            type="button"
            onClick={() => setSmooth((prev) => !prev)}
            className={`px-2.5 py-1 rounded-xl border transition-all ${
              smooth
                ? 'bg-white/10 text-white border-white/30'
                : 'bg-white/[0.03] text-white/60 border-white/10 hover:text-white'
            }`}
          >
            {smooth ? 'Contour' : '75×75 Grid'}
          </button>
        )}
      </div>

      {/* Render selected mode */}
      <div className="flex flex-col items-center gap-2">
        {mode === 'curtain' && band1 && band2 ? (
          <SplitCurtainViewer
            band1={band1}
            band2={band2}
            gradcamHeatmap={heatmap}
            colormap={colormap}
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="chip-canvas-container shadow-glow relative group">
              <canvas
                ref={canvasRef}
                width={300}
                height={300}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="w-full h-full cursor-crosshair"
              />
              <div className="absolute top-2 right-2 badge bg-black/80 text-white/80 text-[10px] border border-white/10 backdrop-blur-sm">
                Standalone CAM
              </div>
            </div>

            {/* Pixel Activation Inspector */}
            <div className="w-full max-w-[300px] text-center text-xs font-mono py-1 px-2 rounded-lg bg-white/[0.02] border border-white/5 min-h-[26px]">
              {hoverInfo ? (
                <span className="text-white/90">
                  [X:{hoverInfo.x} Y:{hoverInfo.y}] Attention:{' '}
                  <span className="text-accent font-bold">{(hoverInfo.val * 100).toFixed(1)}%</span>
                </span>
              ) : (
                <span className="text-muted text-[11px]">Hover over heatmap to inspect pixel attention %</span>
              )}
            </div>
          </div>
        )}

        {/* Colorbar Scale */}
        <div className="w-full max-w-[300px] space-y-1">
          <div className="h-2 rounded-full overflow-hidden shadow-inner" style={{
            background: colormap === 'inferno'
              ? 'linear-gradient(90deg, #000004, #6a1068, #bb3754, #f98e09, #fcffa4)'
              : colormap === 'jet'
              ? 'linear-gradient(90deg, #000083, #00ffff, #ffff00, #ff0000, #800000)'
              : 'linear-gradient(90deg, #30123b, #4670eb, #1ae4b6, #a2fc3c, #fb8022, #7a0403)',
          }} />
          <div className="flex justify-between text-[10px] font-mono text-muted">
            <span>0% (Background)</span>
            <span>50%</span>
            <span>100% (Peak Attention)</span>
          </div>
        </div>
      </div>

      {/* Stats and Interpretation */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <div className="text-xs text-muted">Peak Activation</div>
          <div className="text-lg font-mono font-bold text-accent">
            {(stats.max * 100).toFixed(1)}%
          </div>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <div className="text-xs text-muted">Mean Activation</div>
          <div className="text-lg font-mono font-bold text-white/80">
            {(stats.mean * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-accent/5 border border-accent/10 text-xs text-white/70 leading-relaxed">
        {isIceberg ? (
          <span>
            <strong className="text-white">Iceberg Attribution:</strong> Gradient highlights broad, diffuse volumetric backscatter and rough surface boundaries characteristic of glacial ice.
          </span>
        ) : (
          <span>
            <strong className="text-white">Ship Attribution:</strong> Gradient highlights concentrated, high-contrast corner reflections from the metallic vessel superstructure against open ocean.
          </span>
        )}
      </div>
    </motion.div>
  );
}
