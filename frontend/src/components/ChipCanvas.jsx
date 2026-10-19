import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { bandsToFalseColor, channelToImageData } from '../colormap';

/**
 * Enhanced SAR Chip Canvas with:
 * - 4x crisp nearest-neighbor radar rendering
 * - Continuous zoom (1x to 10x) and pan navigation
 * - Target measurement ruler (10m/pixel Sentinel-1 physical scaling)
 * - Channel toggling (Composite, HH, HV, HH−HV)
 * - Real-time pixel dB telemetry inspector
 */
export default function ChipCanvas({ band1, band2 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [viewMode, setViewMode] = useState('composite'); // 'composite' | 'hh' | 'hv' | 'ratio'
  const [hoverInfo, setHoverInfo] = useState(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Measurement Ruler state (10m per pixel)
  const [rulerActive, setRulerActive] = useState(false);
  const [rulerPoints, setRulerPoints] = useState(null); // { start: {x,y}, end: {x,y} }
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [showRulerTooltip, setShowRulerTooltip] = useState(false);

  // Normalized channels for Viridis single-band views
  const normalizedBands = useMemo(() => {
    if (!band1 || !band2) return null;

    const norm = (arr) => {
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] < min) min = arr[i];
        if (arr[i] > max) max = arr[i];
      }
      const range = max - min || 1;
      const res = new Float32Array(arr.length);
      for (let i = 0; i < arr.length; i++) {
        res[i] = (arr[i] - min) / range;
      }
      return res;
    };

    const ratio = new Float32Array(band1.length);
    for (let i = 0; i < band1.length; i++) {
      ratio[i] = band1[i] - band2[i];
    }

    return {
      hhNorm: norm(band1),
      hvNorm: norm(band2),
      ratioNorm: norm(ratio),
      ratioRaw: ratio,
    };
  }, [band1, band2]);

  // Render the SAR canvas with zoom, pan, and ruler overlays
  useEffect(() => {
    if (!band1 || !band2 || !normalizedBands) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // 1. Generate base 75x75 image
    let baseImage;
    if (viewMode === 'composite') {
      baseImage = bandsToFalseColor(band1, band2);
    } else if (viewMode === 'hh') {
      baseImage = channelToImageData(normalizedBands.hhNorm);
    } else if (viewMode === 'hv') {
      baseImage = channelToImageData(normalizedBands.hvNorm);
    } else if (viewMode === 'ratio') {
      baseImage = channelToImageData(normalizedBands.ratioNorm);
    }

    const offscreen = document.createElement('canvas');
    offscreen.width = 75;
    offscreen.height = 75;
    const offCtx = offscreen.getContext('2d');
    offCtx.putImageData(baseImage, 0, 0);

    // 2. Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Apply pan & zoom relative to center
    ctx.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);

    // Subtle pixel grid when zoomed in (>= 4x)
    if (zoom >= 4) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 0.5 / zoom;
      const step = canvas.width / 75;
      for (let i = 0; i <= 75; i++) {
        ctx.beginPath();
        ctx.moveTo(i * step, 0);
        ctx.lineTo(i * step, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * step);
        ctx.lineTo(canvas.width, i * step);
        ctx.stroke();
      }
    }

    // 3. Draw Measurement Vector Overlay if ruler is active
    if (rulerPoints && rulerPoints.start && rulerPoints.end) {
      const { start, end } = rulerPoints;
      const step = canvas.width / 75;
      const sx = (start.x + 0.5) * step;
      const sy = (start.y + 0.5) * step;
      const ex = (end.x + 0.5) * step;
      const ey = (end.y + 0.5) * step;

      // Glow vector line
      ctx.strokeStyle = '#38bdf8'; // cyan accent
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Start & End Crosshair Points
      const crossSize = 4 / zoom;
      [
        { x: sx, y: sy },
        { x: ex, y: ey },
      ].forEach((pt) => {
        ctx.strokeStyle = '#f59e0b'; // amber accent
        ctx.lineWidth = 1.5 / zoom;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, crossSize, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    ctx.restore();
  }, [band1, band2, normalizedBands, viewMode, zoom, pan, rulerPoints]);

  // Convert client mouse event to radar pixel coordinates [0, 74]
  const clientToPixelCoords = useCallback(
    (clientX, clientY) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const rawX = clientX - rect.left;
      const rawY = clientY - rect.top;

      // Invert translate and scale
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const transformedX = (rawX - cx - pan.x) / zoom + cx;
      const transformedY = (rawY - cy - pan.y) / zoom + cy;

      const px = Math.floor((transformedX / canvas.width) * 75);
      const py = Math.floor((transformedY / canvas.height) * 75);

      if (px >= 0 && px < 75 && py >= 0 && py < 75) {
        return { px, py };
      }
      return null;
    },
    [zoom, pan],
  );

  // Mouse handlers
  const handleMouseDown = (e) => {
    if (rulerActive) {
      const coords = clientToPixelCoords(e.clientX, e.clientY);
      if (coords) {
        setIsMeasuring(true);
        setRulerPoints({
          start: { x: coords.px, y: coords.py },
          end: { x: coords.px, y: coords.py },
        });
      }
    } else {
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    const coords = clientToPixelCoords(e.clientX, e.clientY);
    if (coords && band1 && band2) {
      const idx = coords.py * 75 + coords.px;
      setHoverInfo({
        x: coords.px,
        y: coords.py,
        hh: band1[idx],
        hv: band2[idx],
      });
    } else {
      setHoverInfo(null);
    }

    if (rulerActive && isMeasuring && rulerPoints?.start && coords) {
      setRulerPoints((prev) => ({
        ...prev,
        end: { x: coords.px, y: coords.py },
      }));
    } else if (isPanning && !rulerActive) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setIsMeasuring(false);
  };

  // Wheel Zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setZoom((prev) => Math.min(10.0, Math.max(1.0, parseFloat((prev + delta).toFixed(2)))));
  };

  const resetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setRulerPoints(null);
  };

  // Compute physical measurements (10m/pixel Sentinel-1 IW mode ground resolution)
  const measurement = useMemo(() => {
    if (!rulerPoints || !rulerPoints.start || !rulerPoints.end) return null;
    const dx = rulerPoints.end.x - rulerPoints.start.x;
    const dy = rulerPoints.end.y - rulerPoints.start.y;
    const pixelDistance = Math.hypot(dx, dy);
    const lengthMeters = pixelDistance * 10.0;
    let heading = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (heading < 0) heading += 360;

    return {
      pixels: pixelDistance.toFixed(1),
      meters: lengthMeters.toFixed(1),
      heading: heading.toFixed(0),
      dxMeters: (Math.abs(dx) * 10).toFixed(0),
      dyMeters: (Math.abs(dy) * 10).toFixed(0),
    };
  }, [rulerPoints]);

  if (!band1 || !band2) {
    return (
      <div className="chip-canvas-container flex items-center justify-center bg-deepslate/50">
        <p className="text-muted text-sm">No chip loaded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Channel selection & Tool Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 w-full max-w-[340px]">
        {/* Band View Buttons */}
        <div className="flex bg-navy-light/60 backdrop-blur-md p-1 rounded-xl border border-white/10 gap-1 text-xs">
          {[
            { id: 'composite', label: 'Composite' },
            { id: 'hh', label: 'HH (dB)' },
            { id: 'hv', label: 'HV (dB)' },
            { id: 'ratio', label: 'HH − HV' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setViewMode(tab.id)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                viewMode === tab.id
                  ? 'bg-accent/20 text-accent font-semibold shadow-glow-sm border border-accent/30'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.05] border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Ruler Mode Toggle */}
        <button
          type="button"
          onClick={() => {
            const next = !rulerActive;
            setRulerActive(next);
            if (next) {
              setRulerPoints({ start: { x: 26, y: 26 }, end: { x: 49, y: 47 } });
            } else {
              setRulerPoints(null);
              setShowRulerTooltip(false);
            }
          }}
          title="Toggle Target Measurement Ruler (10m/pixel scale)"
          className={`px-2.5 py-1 rounded-xl text-xs font-mono border transition-all flex items-center gap-1.5 cursor-pointer ${
            rulerActive
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-glow-sm'
              : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white hover:border-white/20'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <span>{rulerActive ? 'Ruler Active' : 'Ruler'}</span>
        </button>
      </div>

      {/* Canvas container with zoom/pan controls */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className="chip-canvas-container shadow-glow relative group border border-white/15 ring-1 ring-white/5 overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`SAR radar chip display, ${viewMode} visualization, 75x75 pixels at nominal 10m per pixel resolution`}
          width={300}
          height={300}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            handleMouseUp();
            setHoverInfo(null);
          }}
          className={`w-full h-full ${rulerActive ? 'cursor-crosshair' : zoom > 1 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'}`}
        />


        {/* Viewport Controls Overlay */}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-slate-950/80 backdrop-blur-md border border-white/15 rounded-lg p-0.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1.0, parseFloat((z - 0.5).toFixed(1))))}
            className="w-5 h-5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Zoom Out"
          >
            -
          </button>
          <span className="text-[10px] text-accent px-1 font-semibold">{zoom.toFixed(1)}×</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(10.0, parseFloat((z + 0.5).toFixed(1))))}
            className="w-5 h-5 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Zoom In"
          >
            +
          </button>
          {(zoom > 1 || pan.x !== 0 || pan.y !== 0) && (
            <button
              type="button"
              onClick={resetView}
              className="w-5 h-5 flex items-center justify-center text-amber-400 hover:text-amber-300 hover:bg-white/10 rounded transition-colors"
              title="Reset View"
            >
              ⟲
            </button>
          )}
        </div>

        {/* Active Ruler Measurement Card Overlay */}
        {rulerActive && measurement && (
          <div className="absolute bottom-2 left-2 right-2 bg-slate-950/95 backdrop-blur-md border border-amber-500/30 rounded-lg p-2.5 text-xs font-mono shadow-xl animate-fade-in z-20">
            <div className="flex items-center justify-between text-amber-300 font-semibold mb-1">
              <div className="flex items-center gap-1.5">
                <span>Target Physical Extent</span>
                {/* Info Tooltip Icon */}
                <div className="relative group/ruler-tip inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowRulerTooltip((v) => !v)}
                    onMouseEnter={() => setShowRulerTooltip(true)}
                    onMouseLeave={() => setShowRulerTooltip(false)}
                    aria-label="Measurement accuracy disclosure"
                    className="w-3.5 h-3.5 rounded-full bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 flex items-center justify-center text-[10px] font-bold transition-colors cursor-help"
                  >
                    i
                  </button>
                  <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 ${showRulerTooltip ? 'block' : 'hidden'} group-hover/ruler-tip:block w-60 max-w-[260px] p-2.5 rounded-lg bg-slate-900/98 border border-amber-500/40 text-[11px] text-slate-200 shadow-2xl z-30 font-sans normal-case leading-snug pointer-events-none`}>
                    <p className="font-semibold text-amber-300 mb-1 font-mono text-[10px] uppercase">Ruler Precision Note</p>
                    Approximate: based on nominal pixel spacing (10m), not adjusted for spatial resolution (~20×22m) or true orbital heading.
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-white/40">Nominal 10m/px</span>
            </div>
            <div className="flex items-center justify-between text-white/80 text-[11px]">
              <span>Length: <strong className="text-white">{measurement.meters} m</strong> ({measurement.pixels} px)</span>
              <span>Heading: <strong className="text-white">{measurement.heading}°</strong></span>
              <span>Footprint: <strong className="text-white">{measurement.dxMeters}×{measurement.dyMeters}m</strong></span>
            </div>
            <div className="text-[10px] text-amber-300/80 mt-1.5 pt-1 border-t border-white/10 flex items-start gap-1 leading-tight font-sans">
              <span className="text-amber-400 font-bold shrink-0">*</span>
              <span>Approximate: based on nominal pixel spacing, not adjusted for spatial resolution or true orbital heading.</span>
            </div>
          </div>
        )}
      </div>

      {/* Pixel Inspector HUD */}
      <div className="w-full text-center text-xs font-mono py-1.5 px-3 rounded-xl bg-navy-light/40 border border-white/10 min-h-[30px] backdrop-blur-sm shadow-inner flex items-center justify-between gap-2 max-w-[340px]">
        {hoverInfo ? (
          <>
            <span className="text-accent font-semibold">[X:{hoverInfo.x} Y:{hoverInfo.y}]</span>
            <span className="text-white/80">HH:{hoverInfo.hh.toFixed(2)} dB</span>
            <span className="text-white/30">|</span>
            <span className="text-white/80">HV:{hoverInfo.hv.toFixed(2)} dB</span>
          </>
        ) : (
          <span className="text-muted text-[11px] tracking-wide w-full text-center">
            {rulerActive ? 'Click and drag across target to measure length in meters' : 'Hover canvas to inspect pixel backscatter'}
          </span>
        )}
      </div>

      {/* Legend */}
      {viewMode === 'composite' ? (
        <div className="flex gap-3 items-center text-xs text-muted">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            <span>HH</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
            <span>HV</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span>Ratio</span>
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted flex items-center gap-1.5">
          <span>Viridis Scale: Low</span>
          <span className="w-16 h-2 rounded bg-gradient-to-r from-[#440154] via-[#21918c] to-[#fde725] inline-block" />
          <span>High</span>
        </div>
      )}
    </div>
  );
}
