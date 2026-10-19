import { useRef, useEffect, useState, useCallback } from 'react';
import { bandsToFalseColor, heatmapToImageData } from '../colormap';

/**
 * SplitCurtainViewer provides an interactive A/B wipe slider
 * comparing raw SAR radar backscatter against the Grad-CAM spatial attribution map.
 */
export default function SplitCurtainViewer({ band1, band2, gradcamHeatmap, colormap = 'turbo' }) {
  const containerRef = useRef(null);
  const leftCanvasRef = useRef(null);
  const rightCanvasRef = useRef(null);

  const [sliderPos, setSliderPos] = useState(50); // percentage 0 to 100
  const [isDragging, setIsDragging] = useState(false);

  // Render left (Raw SAR Composite)
  useEffect(() => {
    if (!band1 || !band2 || !leftCanvasRef.current) return;
    const canvas = leftCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const imgData = bandsToFalseColor(band1, band2);

    const offscreen = document.createElement('canvas');
    offscreen.width = 75;
    offscreen.height = 75;
    offscreen.getContext('2d').putImageData(imgData, 0, 0);

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
  }, [band1, band2]);

  // Render right (Grad-CAM Attention Heatmap)
  useEffect(() => {
    if (!gradcamHeatmap || !rightCanvasRef.current) return;
    const canvas = rightCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const imgData = heatmapToImageData(gradcamHeatmap, colormap);

    const offscreen = document.createElement('canvas');
    offscreen.width = 75;
    offscreen.height = 75;
    offscreen.getContext('2d').putImageData(imgData, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
  }, [gradcamHeatmap, colormap]);

  // Slider Dragging handlers
  const handleMove = useCallback(
    (clientX) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPos(pct);
    },
    [],
  );

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e) => {
    if (isDragging) handleMove(e.clientX);
  };

  const handleTouchMove = (e) => {
    if (isDragging && e.touches[0]) handleMove(e.touches[0].clientX);
  };

  if (!band1 || !band2 || !gradcamHeatmap) {
    return (
      <div className="p-8 text-center text-muted text-xs font-mono bg-slate-900/40 rounded-xl border border-white/10">
        Run Grad-CAM on an active chip to enable split-curtain spatial attention wipe inspection.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex items-center justify-between w-full text-xs font-mono text-white/70 px-1">
        <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          Raw Radar Composite
        </span>
        <span className="text-white/40">{sliderPos.toFixed(0)}% Split</span>
        <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
          Grad-CAM Spatial Focus
          <span className="w-2 h-2 rounded-full bg-amber-400" />
        </span>
      </div>

      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        className="relative w-[300px] h-[300px] rounded-xl overflow-hidden border border-white/15 shadow-glow select-none cursor-ew-resize group"
      >
        {/* Underlayer (Right side: Grad-CAM Heatmap) */}
        <canvas
          ref={rightCanvasRef}
          role="img"
          aria-label="Split-curtain underlayer: Grad-CAM spatial attention activation map"
          width={300}
          height={300}
          className="absolute inset-0 w-full h-full"
        />

        {/* Overlayer with clip-path (Left side: Raw SAR Composite) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          <canvas
            ref={leftCanvasRef}
            role="img"
            aria-label="Split-curtain overlayer: SAR radar false-color composite image"
            width={300}
            height={300}
            className="w-full h-full"
          />
        </div>


        {/* Vertical Divider Line with handle */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-accent shadow-[0_0_8px_rgba(56,189,248,0.8)] z-10"
          style={{ left: `${sliderPos}%` }}
        >
          <div
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-slate-950 border-2 border-accent text-accent shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm-6 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      <p className="text-[11px] font-mono text-muted text-center">
        Drag slider to wipe between raw radar scatterers and deep neural activation hotspots
      </p>
    </div>
  );
}
