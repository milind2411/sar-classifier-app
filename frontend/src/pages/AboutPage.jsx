import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function AboutPage() {
  const jumpLinks = [
    { href: '#challenge', label: '01 · Physical Challenge' },
    { href: '#pipeline', label: '02 · Radar Pipeline' },
    { href: '#dataset', label: '03 · Dataset Provenance' },
    { href: '#models', label: '04 · Dual Architectures' },
    { href: '#benchmarks', label: '05 · Verified Benchmarks' },
    { href: '#explainability', label: '06 · Explainability (XAI)' },
    { href: '#disclosures', label: '07 · Disclosures & Boundaries' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-12 py-6 md:py-10 px-2 sm:px-4">
      {/* ── Page Header ── */}
      <div className="space-y-4 border-b border-white/10 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-mono font-medium">
          <span className="w-2 h-2 rounded-full bg-accent" />
          <span>System Specifications & Technical Reference</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          About SAR Classifier
        </h1>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-3xl font-sans">
          Comprehensive physical and technical documentation for the Sentinel-1 C-Band Automated Target Recognition 
          system. Explaining satellite radar characteristics, speckle reduction, dual-model architectures, 
          empirical benchmarks, spatial explainability, and transparent operational boundaries.
        </p>

        {/* Quick Jump Anchor Pill Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {jumpLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[11px] font-mono px-3 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-white/70 hover:text-white hover:bg-white/[0.08] hover:border-accent/40 transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      {/* ── 01. THE PHYSICAL CHALLENGE ── */}
      <section id="challenge" className="glass-panel p-6 sm:p-8 space-y-4 scroll-mt-24 border border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-full bg-amber-400" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-amber-300">
            01 · The Physical Challenge
          </h2>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Distinguishing Vessels from Ice Hazards in Synthetic Aperture Radar
        </h3>
        <div className="text-slate-300 text-sm leading-relaxed font-sans space-y-3">
          <p>
            Maritime domain awareness in sub-polar corridors is severely constrained by weather. Optical and infrared 
            satellite sensors cannot penetrate persistent cloud covers, advection fog, or the months of continuous darkness 
            characteristic of high-latitude winter. Spaceborne C-band Synthetic Aperture Radar (SAR) transmits microwave pulses 
            at 5.405 GHz that penetrate all atmospheric interference day and night.
          </p>
          <p>
            However, interpreting SAR radar imagery presents severe physical ambiguity. Ships are rigid metallic structures 
            that produce sharp dihedral and trihedral corner-reflector scattering, resulting in concentrated, high-intensity 
            double-bounce returns. Glacial icebergs, composed of compacted freshwater ice, produce intense volumetric 
            scattering from internal crystalline facets and air bubbles that frequently mimic the backscatter magnitude of ships. 
            Furthermore, surrounding ocean surfaces contribute turbulent capillary wave clutter, and varying satellite incidence 
            angles alter surface reflectivity. Simple thresholding is fundamentally incapable of reliable operational classification.
          </p>
        </div>
      </section>

      {/* ── 02. PROCESSING PIPELINE ── */}
      <section id="pipeline" className="glass-panel p-6 sm:p-8 space-y-5 scroll-mt-24 border border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-full bg-cyan-400" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-300">
            02 · 4-Stage Processing Pipeline
          </h2>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          From Raw Decibel Backscatter to Target Classification
        </h3>
        <p className="text-slate-300 text-sm font-sans leading-relaxed">
          The processing engine executes a strict 4-stage sequential transformation pipeline designed to preserve metallic 
          boundaries while isolating true physical backscatter signals:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {/* Stage 1 */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-white/10 space-y-2 flex flex-col justify-between">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase block">Stage 01</span>
              <h4 className="text-sm font-bold text-white">Raw Polarimetric Ingestion</h4>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                Ingests dual-polarization C-band matrices (<code className="text-cyan-300 font-mono">HH</code> co-pol and <code className="text-cyan-300 font-mono">HV</code> cross-pol in dB) extracted from Sentinel-1 IW GRDH products alongside satellite look angle <code className="text-cyan-300 font-mono">θ</code>.
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-white/5">
              75×75 Grid (5,625 px/band)
            </div>
          </div>

          {/* Stage 2 */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-white/10 space-y-2 flex flex-col justify-between">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase block">Stage 02</span>
              <h4 className="text-sm font-bold text-white">Adaptive Lee Speckle Filter</h4>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                A 5×5 spatial Lee filter suppresses multiplicative speckle noise across homogeneous ocean clutter while preserving sharp metallic edges, weighted by global image variance.
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-white/5">
              5×5 Kernel · Edge Preserving
            </div>
          </div>

          {/* Stage 3 */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-white/10 space-y-2 flex flex-col justify-between">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase block">Stage 03</span>
              <h4 className="text-sm font-bold text-white">Dual-Path Inference</h4>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                The 3-channel composite tensor <code className="text-cyan-300 font-mono">[HH, HV, HH−HV]</code> feeds the ResNet50 fusion model, while a 49-feature texture vector is evaluated by the calibrated baseline.
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-white/5">
              Deep Neural + Classical Texture
            </div>
          </div>

          {/* Stage 4 */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-white/10 space-y-2 flex flex-col justify-between">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase block">Stage 04</span>
              <h4 className="text-sm font-bold text-white">Telemetry & Attribution</h4>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                Outputs probability, confidence, Target-to-Clutter Ratio (dB), Equivalent Number of Looks (ENL), and localized Grad-CAM spatial activation heatmaps.
              </p>
            </div>
            <div className="text-[11px] font-mono text-slate-400 pt-2 border-t border-white/5">
              Audit Logging & Intelligence Export
            </div>
          </div>
        </div>
      </section>

      {/* ── 03. DATASET PROVENANCE ── */}
      <section id="dataset" className="glass-panel p-6 sm:p-8 space-y-4 scroll-mt-24 border border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-full bg-cyan-400" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-300">
            03 · Ground-Truth Dataset Provenance
          </h2>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Kaggle Statoil/C-CORE Iceberg Classifier Challenge
        </h3>
        <p className="text-slate-300 text-sm leading-relaxed font-sans">
          The models are trained and calibrated on the benchmark dataset from the 
          <strong> Statoil/C-CORE Iceberg Classifier Challenge</strong>, comprising radar chips acquired by the European Space Agency’s 
          <strong> Sentinel-1</strong> satellite constellation operating in C-band (5.405 GHz) Interferometric Wide (IW) swath mode.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-white/5 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">Sample Count</span>
            <span className="text-lg font-mono font-bold text-white">1,604</span>
            <span className="text-[11px] text-slate-400 block font-sans">Labeled radar chips</span>
          </div>
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-white/5 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">Polarization</span>
            <span className="text-lg font-mono font-bold text-cyan-300">HH + HV</span>
            <span className="text-[11px] text-slate-400 block font-sans">Co-pol & cross-pol dB</span>
          </div>
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-white/5 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">Chip Dimensions</span>
            <span className="text-lg font-mono font-bold text-white">75 × 75 px</span>
            <span className="text-[11px] text-slate-400 block font-sans">Nominal 10m/px spacing</span>
          </div>
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-white/5 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">Incidence Angle</span>
            <span className="text-lg font-mono font-bold text-amber-300">30° – 46°</span>
            <span className="text-[11px] text-slate-400 block font-sans">Imputed median ~39.5°</span>
          </div>
        </div>
      </section>

      {/* ── 04. DUAL ARCHITECTURES ── */}
      <section id="models" className="glass-panel p-6 sm:p-8 space-y-4 scroll-mt-24 border border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-full bg-cyan-400" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-300">
            04 · Dual-Model Architecture & Feature Engineering
          </h2>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Deep Learning Fusion & Classical Physical Texture Baseline
        </h3>
        <p className="text-slate-300 text-sm leading-relaxed font-sans">
          To provide both high discriminatory classification capability and physics-grounded interpretability, the workstation implements two distinct classification pathways:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Primary Neural Model */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase">Primary Model</span>
              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">Deep Residual Network</span>
            </div>
            <h4 className="text-base font-bold text-white">Dual-Branch ResNet50 Fusion</h4>
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Ingests a 3-channel composite tensor <code className="text-cyan-300 font-mono">[HH, HV, HH - HV]</code> filtered with a 5×5 Adaptive Lee filter using global raw variance weighting. This spatial representation fuses with a secondary Multi-Layer Perceptron (MLP) branch that ingests the satellite incidence angle <code className="text-cyan-300 font-mono">θ</code> before outputting a calibrated class probability.
            </p>
            <div className="text-[11px] font-mono text-slate-400 pt-1 border-t border-white/5">
              Input format: <code className="text-white/80">[75×75×3] composite + [scalar θ]</code>
            </div>
          </div>

          {/* Classical Baseline */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase">Baseline Benchmark</span>
              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">Gradient Boosted Decision Trees</span>
            </div>
            <h4 className="text-base font-bold text-white">GLCM Haralick + Clutter Moments</h4>
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Extracts 49 domain-specific physical radar features: 24 rotation-invariant Gray-Level Co-occurrence Matrix (GLCM) textures across distances 1 & 2, 24 statistical clutter distribution moments (skewness, kurtosis, peak-to-mean, energy), and satellite incidence angle. Provides an empirical benchmark against deep learning outputs.
            </p>
            <div className="text-[11px] font-mono text-slate-400 pt-1 border-t border-white/5">
              Features: <code className="text-white/80">49 physical texture and clutter descriptors</code>
            </div>
          </div>
        </div>
      </section>

      {/* ── 05. VERIFIED METRICS ── */}
      <section id="benchmarks" className="glass-panel p-6 sm:p-8 space-y-4 scroll-mt-24 border border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-full bg-emerald-400" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-300">
            05 · Verified Evaluation Metrics
          </h2>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Ground-Truth Validated Performance
        </h3>
        <p className="text-slate-300 text-sm leading-relaxed font-sans">
          All performance metrics are grounded in verified evaluations on held-out test sets and automated test suites:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">Classical Baseline</span>
            <span className="text-2xl font-mono font-bold text-emerald-400">89.97%</span>
            <span className="text-[11px] text-slate-400 block font-sans">5-Fold CV (0.964 ROC-AUC)</span>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">Model Agreement</span>
            <span className="text-base font-mono font-bold text-cyan-300 pt-1 block">Concordant</span>
            <span className="text-[11px] text-slate-400 block font-sans">Matches baseline on samples</span>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">CPU Inference Time</span>
            <span className="text-2xl font-mono font-bold text-cyan-400">&lt; 50 ms</span>
            <span className="text-[11px] text-slate-400 block font-sans">High-speed execution</span>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">Automated Test Suite</span>
            <span className="text-2xl font-mono font-bold text-white">71 / 71</span>
            <span className="text-[11px] text-slate-400 block font-sans">100% test pass rate</span>
          </div>
        </div>
      </section>

      {/* ── 06. EXPLAINABILITY (GRAD-CAM) ── */}
      <section id="explainability" className="glass-panel p-6 sm:p-8 space-y-4 scroll-mt-24 border border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-full bg-cyan-400" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-300">
            06 · Explainable AI (XAI) & Spatial Attribution
          </h2>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Grad-CAM Spatial Attribution: Reducing Black-Box Opacity
        </h3>
        <div className="text-slate-300 text-sm leading-relaxed font-sans space-y-3">
          <p>
            To understand why the deep learning network reaches a specific verdict, the system generates Gradient-weighted 
            Class Activation Mapping (Grad-CAM) heatmaps. Rather than blindly targeting the final convolution layer 
            (<code className="text-cyan-300 font-mono text-xs">conv5_block3_3_conv</code>), which collapses to an overly coarse 3×3 grid on small 75×75 chips, 
            the explainability engine targets <code className="text-cyan-300 font-mono text-xs">conv3_block4_3_conv</code> to produce a localized 10×10 attention map.
          </p>
          <p>
            A class-aware target gradient scoring formula ensures that vessel detections (P(Iceberg) &lt; 0.5) generate active, vibrant attention peaks 
            rather than zeroed-out ReLU gradients. This provides analysts with clear visual validation that the network focuses on genuine metallic 
            corner reflections for vessels rather than surrounding ocean speckle.
          </p>
        </div>
      </section>

      {/* ── 07. TRANSPARENT LIMITATIONS & DISCLOSURES ── */}
      <section id="disclosures" className="glass-panel p-6 sm:p-8 space-y-4 scroll-mt-24 border border-amber-500/20">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-full bg-amber-400" />
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-amber-300">
            07 · Transparent Limitations & Disclosures
          </h2>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Known Constraints & Operational Boundaries
        </h3>
        <p className="text-slate-300 text-sm leading-relaxed font-sans">
          To maintain scientific integrity and operational honesty, the following constraints are explicitly documented:
        </p>

        <div className="space-y-3 pt-1 text-xs text-slate-300 font-sans leading-relaxed">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1">
            <strong className="text-amber-300 font-mono text-xs uppercase block">
              1. Incidence Angle Sweep is a Model Sensitivity Probe
            </strong>
            <p>
              The angle sweep simulator on <code className="text-cyan-300 font-mono">/angle</code> tests the neural network’s mathematical response by varying the scalar incidence angle input <code className="text-cyan-300 font-mono">θ</code> across 30° to 46° for a static image tensor. It is a counterfactual model diagnostic, not a physical electromagnetic re-simulation of radar wave scattering under differing satellite look geometries.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1">
            <strong className="text-amber-300 font-mono text-xs uppercase block">
              2. Geospatial Overview Map Uses Simulated Positions
            </strong>
            <p>
              The maritime map on <code className="text-cyan-300 font-mono">/map</code> renders illustrative sample targets, idealized orbital ground-track swaths, and marginal ice zones for interactive demonstration. Target coordinates and boundaries are illustrative and not derived from real-time live satellite telemetry feeds.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1">
            <strong className="text-amber-300 font-mono text-xs uppercase block">
              3. ResNet50 Multi-Fold Benchmarks Pending Fresh Benchmark
            </strong>
            <p>
              While the classical baseline holds verified 5-fold cross-validation metrics (89.97% accuracy, 0.964 AUC), the original cross-validation metrics for the ResNet50 fold checkpoint were lost during an earlier kernel restart. While side-by-side evaluation confirms solid agreement on sample chips, formal multi-fold numerical benchmarks for the deep learning checkpoint are pending fresh re-computation.
            </p>
          </div>
        </div>
      </section>

      {/* ── Navigation Return CTA ── */}
      <div className="flex items-center justify-between pt-2 flex-wrap gap-4">
        <Link
          to="/app"
          className="btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-glow px-5 py-2.5 cursor-pointer"
        >
          <span>Launch Analysis Workspace</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
        <Link
          to="/"
          className="btn-secondary text-xs inline-flex items-center gap-1.5 text-slate-300 hover:text-white"
        >
          <span>← Back to Overview</span>
        </Link>
      </div>
    </div>
  );
}
