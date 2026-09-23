export default function LiquidBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#020408]">
      {/* Hidden SVG Filter Definition for Liquid "Goo" Merging */}
      <svg
        className="fixed pointer-events-none w-0 h-0 opacity-0 -z-50"
        aria-hidden="true"
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      >
        <defs>
          <filter id="liquid-goo" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 24 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Fluid Liquid Blobs with Goo Filter */}
      <div className="liquid-goo-container">
        <div className="liquid-blob liquid-blob-1" />
        <div className="liquid-blob liquid-blob-2" />
        <div className="liquid-blob liquid-blob-3" />
        <div className="liquid-blob liquid-blob-4" />
        <div className="liquid-blob liquid-blob-5" />
      </div>

      {/* Radar Overlay Textures (Layered above liquid blobs, softened to preserve legibility) */}
      <div className="absolute inset-0 radar-grid-texture opacity-40" />
      <div className="absolute inset-0 radar-range-rings opacity-25" />
    </div>
  );
}
