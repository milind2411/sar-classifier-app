import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function PrivacyPage() {
  useDocumentTitle('Privacy Policy | SAR Classifier');

  const privacyFacts = [
    {
      id: 'no-cookies',
      tag: '01 · No Tracking',
      title: 'Zero Cookies & No Third-Party Trackers',
      description:
        'This application does not use cookies, tracking pixels, session storage identifiers, or external analytics scripts. No advertising SDKs or tracking beacons are loaded, and no cookie consent banner is needed.',
    },
    {
      id: 'self-hosted',
      tag: '02 · Origin Isolation',
      title: 'Zero Third-Party Requests & Self-Hosted Assets',
      description:
        'All application dependencies, including fonts (Space Grotesk and JetBrains Mono) and interface assets, are self-hosted and delivered directly from the application origin. Your browser initiates zero outbound connections to Google Fonts, public CDNs, or external telemetry services.',
    },
    {
      id: 'history-fields',
      tag: '03 · Telemetry Scope',
      title: 'Stored Prediction History Fields',
      description:
        'When history is enabled, only structured prediction metadata is recorded: timestamp, predicted class (ship/iceberg), confidence score, probability of iceberg, radar incidence angle (θ), pipeline model used, and input source category (preset, file_upload, or synthetic_stress_test). Raw radar pixel arrays (band_1, band_2) and uploaded filenames are never stored.',
    },
    {
      id: 'in-memory-uploads',
      tag: '04 · Transient Uploads',
      title: 'In-Memory File Processing',
      description:
        'Uploaded SAR chips (.json and .npz files) are parsed and evaluated strictly in volatile RAM. Uploaded files and raw radar payloads are never written to disk, scratch directories, or persistent cloud storage.',
    },
    {
      id: 'in-memory-rate-limits',
      tag: '05 · Volatile Limits',
      title: 'In-Memory Rate Limiting',
      description:
        'Rate limiting for compute-intensive endpoints (such as Grad-CAM heatmap generation) is maintained strictly in server process memory using a sliding token window. Counter states reset automatically upon application or worker restart and are never persisted to databases.',
    },
    {
      id: 'server-logs-and-history',
      tag: '06 · Logging & Deployment Scope',
      title: 'Privacy-Preserving Logs & Deployment Visibility',
      description:
        'Server operational logs record HTTP statuses, endpoints, and file format extensions without capturing client IP addresses, raw radar imagery, or original file names. When prediction history is enabled on a shared deployment, recorded inference history is visible across clients of that instance. Operators can fully disable history storage by setting HISTORY_ENABLED=false.',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-6 md:py-10 px-2 sm:px-4">
      {/* ── Page Header ── */}
      <div className="space-y-4 border-b border-white/10 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-mono font-medium">
          <span className="w-2 h-2 rounded-full bg-accent" />
          <span>Operational Privacy & Data Architecture</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Privacy Policy
        </h1>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl font-sans">
          This system is designed as a privacy-respecting, zero-tracking automated target recognition workstation.
          The operational policies below reflect the exact technical architecture of the platform.
        </p>
      </div>

      {/* ── 6 Verified Facts Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {privacyFacts.map((fact) => (
          <motion.div
            key={fact.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="glass-panel p-6 border border-white/10 space-y-3 flex flex-col justify-between hover:border-white/20 transition-colors"
          >
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-accent font-semibold">
                {fact.tag}
              </span>
              <h2 className="text-base font-bold text-white mt-1.5 mb-2">
                {fact.title}
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-sans">
                {fact.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Deployment Notice & Return Links ── */}
      <div className="glass-panel p-6 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Need Technical Architecture Details?</h3>
          <p className="text-xs text-muted mt-0.5">
            Explore radar calibration equations, model dual-branch design, and complete specifications.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/about"
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-colors"
          >
            System About Page
          </Link>
          <Link
            to="/app"
            className="btn-primary text-xs px-4 py-2 inline-flex items-center gap-2"
          >
            <span>Open Workspace</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
