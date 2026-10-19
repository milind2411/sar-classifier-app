import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import useDocumentTitle from '../hooks/useDocumentTitle';

/**
 * RevealSection helper for scroll-triggered entry animations
 */
function RevealSection({ children, className = '', delay = 0, id }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px 0px' });

  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`scroll-mt-24 ${className}`}
    >
      {children}
    </motion.section>
  );
}

export default function LandingPage() {
  useDocumentTitle('SAR Classifier — Ship vs Iceberg');

  return (

    <div className="space-y-16 py-4 md:py-10 max-w-6xl mx-auto px-2 sm:px-4">
      {/* ──────────────── 1. HERO SECTION (UNTOUCHED) ──────────────── */}
      <RevealSection className="flex flex-col md:flex-row items-center justify-between gap-10 md:gap-14 pt-4 pb-6">
        <div className="flex-1 space-y-6 text-left">
          {/* Subtitle / System Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-mono font-medium">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span>SAR Classifier · Sentinel-1 C-Band ATR</span>
          </div>

          {/* Headline focused on real problem */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-[1.15]">
            Distinguishing Ships from Icebergs in All-Weather Satellite Radar
          </h1>

          {/* Honest subheadline */}
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl font-sans">
            Optical sensors cannot penetrate heavy cloud decks or polar darkness. 
            This automated target recognition system classifies dual-polarization Sentinel-1 Synthetic Aperture Radar (SAR) 
            chips into vessels or ice hazards using a deep learning fusion network paired with an empirical texture baseline.
          </p>

          {/* Single Primary CTA to dedicated Analysis Workspace */}
          <div className="pt-2 flex flex-wrap items-center gap-4">
            <Link
              to="/app"
              className="btn-primary inline-flex items-center gap-2.5 text-sm sm:text-base font-semibold shadow-glow px-6 py-3 cursor-pointer"
            >
              <span>Launch Analysis Workspace</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <span className="text-xs font-mono text-slate-400">
              Zero login required · 6 ground-truth samples ready
            </span>
          </div>
        </div>

        {/* Subtle Radar Sweep Graphic Accent */}
        <div className="relative shrink-0 flex items-center justify-center">
          <div className="relative w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-full border border-cyan-500/25 bg-slate-950/70 shadow-2xl flex items-center justify-center overflow-hidden">
            {/* Range rings */}
            <div className="absolute inset-4 rounded-full border border-cyan-500/15" />
            <div className="absolute inset-12 rounded-full border border-cyan-500/15" />
            <div className="absolute inset-20 rounded-full border border-cyan-500/20" />
            {/* Center target indicator */}
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-glow z-10" />

            {/* Radar crosshairs */}
            <div className="absolute w-full h-[1px] bg-cyan-500/15" />
            <div className="absolute h-full w-[1px] bg-cyan-500/15" />

            {/* Simulated contact blips */}
            <div className="absolute top-[28%] left-[64%] w-2 h-2 rounded-full bg-amber-400 animate-ping opacity-60" />
            <div className="absolute top-[28%] left-[64%] w-1.5 h-1.5 rounded-full bg-amber-400" />
            <div className="absolute bottom-[32%] left-[26%] w-1.5 h-1.5 rounded-full bg-cyan-400 opacity-80" />

            {/* Rotating radar sweep beam */}
            <div
              className="absolute inset-0 origin-center animate-[spin_5s_linear_infinite]"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(56, 189, 248, 0.22) 360deg)',
              }}
            />

            {/* Calibration readout */}
            <div className="absolute bottom-2 font-mono text-[9px] text-cyan-400/70 tracking-widest uppercase">
              C-BAND · 5.405 GHz
            </div>
          </div>
        </div>
      </RevealSection>

      {/* ──────────────── 2. SYSTEM OVERVIEW IN BLOCKS ──────────────── */}
      <RevealSection delay={0.1} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/5 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-4 rounded-full bg-cyan-400" />
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-300">
                Core Architecture
              </h2>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              System Overview at a Glance
            </h3>
          </div>
          <Link
            to="/about"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors group"
          >
            <span>Explore Full Project Details</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>

        {/* 4 Compact Overview Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Block 1 */}
          <div className="glass-panel p-5 space-y-3 border-t-2 border-t-cyan-500/70 hover:border-white/20 transition-all flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-400 font-bold">01 · SENSOR DATA</span>
                <span className="text-white/40">75×75 Grid</span>
              </div>
              <h4 className="text-base font-bold text-white tracking-tight">
                Dual-Pol C-Band SAR
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                Spaceborne synthetic aperture radar penetrating cloud decks and polar darkness. Ingests dual-polarization (HH & HV) decibel matrices alongside satellite incidence angle.
              </p>
            </div>
            <div className="text-[11px] font-mono text-cyan-400/80 pt-2 border-t border-white/5">
              Sentinel-1 IW GRDH
            </div>
          </div>

          {/* Block 2 */}
          <div className="glass-panel p-5 space-y-3 border-t-2 border-t-cyan-500/70 hover:border-white/20 transition-all flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-400 font-bold">02 · PREPROCESSING</span>
                <span className="text-white/40">5×5 Window</span>
              </div>
              <h4 className="text-base font-bold text-white tracking-tight">
                Adaptive Lee Filter
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                Variance-weighted speckle reduction suppresses granular ocean clutter while preserving sharp metallic double-bounce reflection boundaries of vessels.
              </p>
            </div>
            <div className="text-[11px] font-mono text-cyan-400/80 pt-2 border-t border-white/5">
              Speckle noise suppression
            </div>
          </div>

          {/* Block 3 */}
          <div className="glass-panel p-5 space-y-3 border-t-2 border-t-cyan-500/70 hover:border-white/20 transition-all flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-400 font-bold">03 · DUAL INFERENCE</span>
                <span className="text-white/40">Hybrid</span>
              </div>
              <h4 className="text-base font-bold text-white tracking-tight">
                Neural & Texture Baseline
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                Dual-branch ResNet50 fusion deep learning network evaluated alongside a calibrated 49-feature GLCM Haralick physical texture and clutter baseline.
              </p>
            </div>
            <div className="text-[11px] font-mono text-cyan-400/80 pt-2 border-t border-white/5">
              &lt; 50ms execution latency
            </div>
          </div>

          {/* Block 4 */}
          <div className="glass-panel p-5 space-y-3 border-t-2 border-t-cyan-500/70 hover:border-white/20 transition-all flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-cyan-400 font-bold">04 · EXPLAINABILITY</span>
                <span className="text-white/40">Diagnostics</span>
              </div>
              <h4 className="text-base font-bold text-white tracking-tight">
                Grad-CAM & Radar SNR
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                10×10 localized gradient attention maps, real-time Target-to-Clutter Ratio (dB) telemetry, and incidence angle counterfactual sensitivity diagnostics.
              </p>
            </div>
            <div className="text-[11px] font-mono text-cyan-400/80 pt-2 border-t border-white/5">
              Explainable AI & Telemetry
            </div>
          </div>
        </div>

        {/* Quick Action Navigation Bar */}
        <div className="glass-panel p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 border border-white/10">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-base font-bold text-white">Looking for detailed project specifications?</h4>
            <p className="text-xs text-slate-400 font-sans">
              Read the complete documentation on the physical radar challenge, processing pipeline, benchmarks, and disclosures.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap justify-center">
            <Link
              to="/about"
              className="px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.06] border border-white/10 text-white hover:bg-white/[0.1] hover:border-white/20 transition-all font-mono"
            >
              Read About Section →
            </Link>
            <Link
              to="/app"
              className="btn-primary px-4 py-2.5 rounded-xl text-xs font-semibold shadow-glow cursor-pointer"
            >
              Open Analysis Workspace
            </Link>
          </div>
        </div>
      </RevealSection>
    </div>
  );
}
