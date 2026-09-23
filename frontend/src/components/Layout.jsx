import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useChip } from '../context/ChipContext';
import HistoryDrawer from './HistoryDrawer';
import CommandPalette from './CommandPalette';
import LiquidBackground from './LiquidBackground';

export default function Layout() {
  const { backendOnline, error } = useChip();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(() => {
    return new URLSearchParams(window.location.search).get('history') === '1';
  });

  // Global ⌘K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const navLinks = [
    { to: '/', label: 'Overview' },
    { to: '/app', label: 'Analysis Workspace' },
    { to: '/about', label: 'About' },
  ];

  return (
    <div className="min-h-screen flex flex-col relative bg-[#020408] text-white selection:bg-accent/30 selection:text-white print:bg-white print:text-black">
      {/* ── Fluid Liquid-Merging Black Background (SVG Goo Filter) ── */}
      <LiquidBackground />

      {/* ── Header ── */}
      <header className="relative z-10 border-b border-white/5 bg-slate-950/50 backdrop-blur-md print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          {/* Logo / Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center shadow-glow-sm transition-all duration-200 group-hover:border-accent/60">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
                <circle cx="12" cy="12" r="3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3M3 12h3m12 0h3" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                SAR Classifier
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/10 border border-accent/30 text-accent font-semibold">
                  S1-ATR v2
                </span>
              </h1>
              <p className="text-muted text-xs -mt-0.5">Ship vs Iceberg · Sentinel-1 C-Band ATR</p>
            </div>
          </Link>

          {/* Navigation Links: Clean and Uncluttered */}
          <nav className="flex items-center gap-1 bg-white/[0.03] border border-white/5 p-1 rounded-xl">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `
                  px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                  ${isActive
                    ? 'bg-accent/15 border border-accent/30 text-accent font-semibold shadow-glow-sm'
                    : 'text-white/65 hover:text-white hover:bg-white/5 border border-transparent'
                  }
                `}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Utilities: Command Palette Trigger, History Button, System Status */}
          <div className="flex items-center gap-2.5">
            {/* Command Palette Trigger */}
            <button
              type="button"
              onClick={() => setIsPaletteOpen(true)}
              title="Open Command Palette (⌘K / Ctrl+K)"
              aria-label="Command palette shortcut"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-white/[0.04] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08] hover:border-white/20 transition-all duration-150 cursor-pointer group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-white/40 group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <span className="text-[11px] text-white/50 group-hover:text-white/80 hidden sm:inline">Search</span>
              <kbd className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-white/10 text-white/70 border border-white/10 shadow-sm">
                ⌘K
              </kbd>
            </button>

            {/* Prediction History Drawer Trigger */}
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              title="View Prediction History"
              aria-label="View Prediction History"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-white/[0.04] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08] hover:border-white/20 transition-all duration-150 cursor-pointer group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-white/40 group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[11px] text-white/50 group-hover:text-white/80 hidden sm:inline">History</span>
            </button>

            {backendOnline !== null && (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                  backendOnline
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}
                title={backendOnline ? 'Inference engine connected' : 'Inference service offline'}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                  }`}
                />
                <span className="font-mono">{backendOnline ? 'System Online' : 'System Offline'}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main content outlet ── */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        {error && (
          <div className="mb-6 px-4 py-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm animate-fade-in shadow-inner">
            {error}
          </div>
        )}
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 py-6 bg-slate-950/40 backdrop-blur-sm print:hidden">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-3 text-center">
          {/* Architecture description */}
          <p className="text-muted text-xs tracking-wide">
            Sentinel-1 C-Band Automated Target Recognition · Dual-Branch Neural Network & Classical Baseline
          </p>

          {/* Section 3: GitHub repo link & credit line */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted">
            {/* PLACEHOLDER: Replace YOUR_USERNAME with actual GitHub repository owner/organization */}
            <a
              href="https://github.com/YOUR_USERNAME/sar-classifier-app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-white/60 hover:text-accent transition-colors font-mono text-[11px]"
              title="GitHub Repository (placeholder: replace YOUR_USERNAME)"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>github.com/YOUR_USERNAME/sar-classifier-app</span>
            </a>
            <span className="text-white/20 hidden sm:inline">·</span>
            <span className="text-white/40">
              Sentinel-1 C-Band Automated Target Recognition Workstation
            </span>
          </div>
        </div>
      </footer>

      {/* ── Slide-out Prediction History Drawer ── */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* ── S1-ATR Command Palette (⌘K / Ctrl+K) ── */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />
    </div>
  );
}
