export default function LiquidBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#020408]">
      {/* ── High-Performance Ambient Glow Fields (Zero-CPU Static Gradients) ── */}
      <div
        className="absolute -top-[20%] -left-[10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full opacity-40"
        style={{
          background: 'radial-gradient(circle, rgba(14, 165, 233, 0.12) 0%, rgba(14, 165, 233, 0.03) 45%, transparent 70%)',
          transform: 'translateZ(0)',
        }}
      />
      <div
        className="absolute top-[20%] -right-[15%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full opacity-35"
        style={{
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.10) 0%, rgba(245, 158, 11, 0.02) 50%, transparent 70%)',
          transform: 'translateZ(0)',
        }}
      />
      <div
        className="absolute -bottom-[20%] left-[20%] w-[65vw] h-[65vw] max-w-[850px] max-h-[850px] rounded-full opacity-30"
        style={{
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.10) 0%, rgba(56, 189, 248, 0.02) 50%, transparent 70%)',
          transform: 'translateZ(0)',
        }}
      />

      {/* ── Radar Overlay Textures (Hardware-accelerated CSS patterns) ── */}
      <div className="absolute inset-0 radar-grid-texture opacity-35" />
      <div className="absolute inset-0 radar-range-rings opacity-20" />
    </div>
  );
}
