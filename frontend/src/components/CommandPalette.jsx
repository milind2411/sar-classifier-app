import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useChip, SAMPLES } from '../context/ChipContext';

export default function CommandPalette({ isOpen, onClose, onOpenHistory }) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    chip,
    loadSample,
    handleClassify,
    handleRunComparison,
    handleGradcam,
    handleAngleSweep,
    handleExportReport,
    result,
  } = useChip();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Define commands list
  const commands = useMemo(() => {
    const items = [
      // ── Navigation ──
      {
        id: 'nav-analysis',
        category: 'NAVIGATION',
        title: 'Analysis Workstation',
        description: 'Primary single-target radar canvas, band inspector, and telemetry',
        shortcut: 'G A',
        keywords: 'app analysis console canvas radar image',
        action: () => {
          navigate('/app');
          onClose();
        },
      },
      {
        id: 'nav-map',
        category: 'NAVIGATION',
        title: 'Geospatial Acquisition Map',
        description: 'Arctic / North Atlantic AOI with Sentinel-1 orbital swaths and radar contacts',
        shortcut: 'G M',
        keywords: 'map coverage geospatial acquisition arctic ocean sentinel orbit track swath contacts coordinates',
        action: () => {
          navigate('/map');
          onClose();
        },
      },
      {
        id: 'nav-analytics',
        category: 'NAVIGATION',
        title: 'Telemetry & Prediction Analytics',
        description: 'Historical audit KPIs, confidence distribution, and radar SNR telemetry',
        shortcut: 'G Y',
        keywords: 'analytics charts stats pie bar telemetry snr kpi trends audit distribution',
        action: () => {
          navigate('/analytics');
          onClose();
        },
      },
      {
        id: 'nav-compare',
        category: 'NAVIGATION',
        title: 'Model Comparison',
        description: 'ResNet50 Deep Learning vs. GLCM+XGBoost Baseline benchmark',
        shortcut: 'G C',
        keywords: 'compare model xgboost benchmark glcm texture',
        action: () => {
          navigate('/compare');
          onClose();
        },
      },
      {
        id: 'nav-angle',
        category: 'NAVIGATION',
        title: 'Incidence Angle Sweep',
        description: 'Counterfactual sensitivity curve across orbital angles (30°–46°)',
        shortcut: 'G S',
        keywords: 'angle sweep sensitivity orbital curve geometry',
        action: () => {
          navigate('/angle');
          onClose();
        },
      },
      {
        id: 'nav-batch',
        category: 'NAVIGATION',
        title: 'Batch Processing Workstation',
        description: 'High-throughput multi-target ATR analysis (up to 50 chips)',
        shortcut: 'G B',
        keywords: 'batch upload multi chips high throughput bulk',
        action: () => {
          navigate('/batch');
          onClose();
        },
      },
      {
        id: 'nav-history',
        category: 'NAVIGATION',
        title: 'Prediction Audit History',
        description: 'View audit log of past inferences and SNR telemetry',
        shortcut: 'G H',
        keywords: 'history audit sqlite log predictions',
        action: () => {
          onClose();
          onOpenHistory?.();
        },
      },
      {
        id: 'nav-overview',
        category: 'NAVIGATION',
        title: 'Project Overview',
        description: 'Landing hero and core architecture blocks at a glance',
        shortcut: 'G O',
        keywords: 'overview landing home summary hero',
        action: () => {
          navigate('/');
          onClose();
        },
      },
      {
        id: 'nav-about',
        category: 'NAVIGATION',
        title: 'About & Technical Specifications',
        description: 'Physical radar challenge, 4-stage pipeline, dataset provenance, and disclosures',
        shortcut: 'G A',
        keywords: 'about info specs architecture sentinel dataset physics disclosures',
        action: () => {
          navigate('/about');
          onClose();
        },
      },

      // ── Ground-Truth Sample Targets ──
      ...SAMPLES.map((sample) => {
        const isShip = sample.class === 'ship';
        return {
          id: `sample-${sample.id}`,
          category: 'SAMPLE TARGETS',
          title: `Load ${sample.label}`,
          description: isShip
            ? `Verified Kaggle ground-truth surface vessel (${sample.id})`
            : `Verified Kaggle ground-truth glacial iceberg (${sample.id})`,
          shortcut: isShip ? 'SHIP' : 'ICE',
          keywords: `sample target load ${sample.id} ${sample.label} ${sample.class}`,
          action: () => {
            loadSample(sample.id);
            if (location.pathname !== '/app') {
              navigate('/app');
            }
            onClose();
          },
        };
      }),

      // ── Actions ──
      {
        id: 'action-classify',
        category: 'ACTIONS',
        title: 'Run Target Classification',
        description: chip
          ? `Classify target "${chip.name || 'loaded chip'}" with primary model`
          : 'Requires a chip to be loaded first',
        disabled: !chip,
        shortcut: '↵',
        keywords: 'classify predict run inference model evaluate',
        action: () => {
          if (chip) {
            handleClassify();
            if (location.pathname !== '/app') navigate('/app');
            onClose();
          }
        },
      },
      {
        id: 'action-compare',
        category: 'ACTIONS',
        title: 'Benchmark Both Models (Compare)',
        description: chip
          ? 'Run ResNet50 and XGBoost simultaneously with consensus telemetry'
          : 'Requires a chip to be loaded first',
        disabled: !chip,
        shortcut: 'CMP',
        keywords: 'compare benchmark duel consensus resnet xgboost',
        action: () => {
          if (chip) {
            handleRunComparison();
            if (location.pathname !== '/compare') navigate('/compare');
            onClose();
          }
        },
      },
      {
        id: 'action-gradcam',
        category: 'ACTIONS',
        title: 'Generate Grad-CAM Attention Map',
        description: chip
          ? 'Compute spatial attribution heatmap on conv3_block4_3_conv'
          : 'Requires a chip to be loaded first',
        disabled: !chip,
        shortcut: 'XAI',
        keywords: 'gradcam explainability heatmap attention xai explain',
        action: () => {
          if (chip) {
            handleGradcam();
            if (location.pathname !== '/app') navigate('/app');
            onClose();
          }
        },
      },
      {
        id: 'action-sweep',
        category: 'ACTIONS',
        title: 'Run Incidence Angle Sweep',
        description: chip
          ? 'Simulate classification response across 30° to 46°'
          : 'Requires a chip to be loaded first',
        disabled: !chip,
        shortcut: 'SWP',
        keywords: 'angle sweep sensitivity simulation curve',
        action: () => {
          if (chip) {
            handleAngleSweep();
            if (location.pathname !== '/angle') navigate('/angle');
            onClose();
          }
        },
      },
      {
        id: 'action-export',
        category: 'ACTIONS',
        title: 'Export ATR Classification Report',
        description: result
          ? 'Download standardized Maritime Assessment Brief (.txt)'
          : 'Requires completed classification result',
        disabled: !result,
        shortcut: 'EXP',
        keywords: 'export brief report download text summary',
        action: () => {
          if (result) {
            handleExportReport();
            onClose();
          }
        },
      },
    ];

    return items;
  }, [
    chip,
    result,
    location.pathname,
    navigate,
    loadSample,
    handleClassify,
    handleRunComparison,
    handleGradcam,
    handleAngleSweep,
    handleExportReport,
    onClose,
    onOpenHistory,
  ]);

  // Filter commands by search query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase().trim();
    return commands.filter((cmd) => {
      const titleMatch = cmd.title.toLowerCase().includes(q);
      const descMatch = cmd.description.toLowerCase().includes(q);
      const catMatch = cmd.category.toLowerCase().includes(q);
      const keyMatch = cmd.keywords?.toLowerCase().includes(q);
      return titleMatch || descMatch || catMatch || keyMatch;
    });
  }, [commands, query]);

  // Ensure selectedIndex is in bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredCommands[selectedIndex];
      if (selected && !selected.disabled) {
        selected.action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 sm:px-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Modal Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-2xl bg-slate-950/90 border border-white/15 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden backdrop-blur-xl"
            onKeyDown={handleKeyDown}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-white/[0.02]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-accent shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command, route, or target name..."
                className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none font-mono"
              />

              {chip && (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-[10px] font-mono text-accent shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  {chip.name || 'Chip Loaded'}
                </span>
              )}

              <kbd
                onClick={onClose}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white/50 border border-white/10 hover:text-white hover:bg-white/20 cursor-pointer transition-colors shrink-0"
              >
                ESC
              </kbd>
            </div>

            {/* Command List */}
            <div
              ref={listRef}
              className="max-h-[380px] overflow-y-auto p-2 divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10"
            >
              {filteredCommands.length === 0 ? (
                <div className="py-12 text-center text-muted text-xs font-mono">
                  No commands match &ldquo;{query}&rdquo;
                </div>
              ) : (
                filteredCommands.map((cmd, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      data-selected={isSelected}
                      disabled={cmd.disabled}
                      onClick={() => !cmd.disabled && cmd.action()}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`
                        w-full text-left px-3 py-2.5 rounded-xl transition-all duration-100 flex items-center justify-between gap-3 group
                        ${cmd.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                        ${isSelected
                          ? 'bg-accent/15 border border-accent/30 text-white shadow-glow-sm'
                          : 'hover:bg-white/[0.04] border border-transparent text-white/80'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 shrink-0">
                          {cmd.category}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white group-hover:text-accent transition-colors truncate">
                            {cmd.title}
                          </p>
                          <p className="text-[11px] text-muted truncate mt-0.5">
                            {cmd.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {cmd.shortcut && (
                          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/10">
                            {cmd.shortcut}
                          </kbd>
                        )}
                        {isSelected && !cmd.disabled && (
                          <span className="text-accent text-xs">↵</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer hints */}
            <div className="px-4 py-2 bg-slate-900/60 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-white/40">
              <div className="flex items-center gap-3">
                <span>↑↓ Navigate</span>
                <span>↵ Execute</span>
                <span>ESC Close</span>
              </div>
              <span className="text-[10px] text-accent/70">
                S1-ATR Analysis Console
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
