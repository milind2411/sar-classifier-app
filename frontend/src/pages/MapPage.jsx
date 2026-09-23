import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useChip, SAMPLES } from '../context/ChipContext';

// Verified Ground-Truth Target Geolocation Coordinates (North Atlantic & Arctic)
const TARGET_CONTACTS = [
  {
    id: 'ship_1',
    name: 'Ship #1 (Tanker)',
    class: 'ship',
    lat: 48.2,
    lon: -46.5,
    region: 'Flemish Pass Basin',
    speed: '14.2 kts',
    heading: '068° ENE',
    inc_angle: 38.6,
    polarization: 'HH + HV',
    description: 'High-confidence commercial tanker contact displaying prominent double-bounce metallic hull reflection.',
  },
  {
    id: 'ship_2',
    name: 'Ship #2 (Cargo Vessel)',
    class: 'ship',
    lat: 46.8,
    lon: -51.2,
    region: 'Grand Banks Corridor',
    speed: '11.8 kts',
    heading: '112° ESE',
    inc_angle: 42.1,
    polarization: 'HH + HV',
    description: 'Container cargo vessel navigating transatlantic maritime shipping lane.',
  },
  {
    id: 'ship_3',
    name: 'Ship #3 (Vessel)',
    class: 'ship',
    lat: 53.4,
    lon: -54.1,
    region: 'Labrador Coastal Shelf',
    speed: '18.0 kts',
    heading: '345° NNW',
    inc_angle: 35.8,
    polarization: 'HH + HV',
    description: 'Compact vessel contact embedded within moderate sea state ocean clutter.',
  },
  {
    id: 'iceberg_1',
    name: 'Iceberg #1 (Tabular Iceberg)',
    class: 'iceberg',
    lat: 71.4,
    lon: -62.8,
    region: 'Baffin Bay Iceberg Alley',
    drift: '0.8 kts',
    heading: '190° S',
    inc_angle: 39.5,
    polarization: 'HH + HV',
    description: 'Massive tabular glacial ice fragment drifting southward along the Baffin Current.',
  },
  {
    id: 'iceberg_2',
    name: 'Iceberg #2 (Fragmented Pinnacle)',
    class: 'iceberg',
    lat: 60.1,
    lon: -44.2,
    region: 'Cape Farewell (South Greenland)',
    drift: '1.4 kts',
    heading: '215° SW',
    inc_angle: 44.0,
    polarization: 'HH + HV',
    description: 'Highly irregular pinnacle iceberg exhibiting multi-faceted volumetric radar backscatter.',
  },
  {
    id: 'iceberg_3',
    name: 'Iceberg #3 (Rough Ice Floe)',
    class: 'iceberg',
    lat: 65.5,
    lon: -57.6,
    region: 'Davis Strait Gateway',
    drift: '0.6 kts',
    heading: '175° S',
    inc_angle: 34.2,
    polarization: 'HH + HV',
    description: 'Degraded, aerated glacial ice floe with high cross-polarization backscatter attenuation.',
  },
];

export default function MapPage() {
  const navigate = useNavigate();
  const { loadSample, containerVariants, itemVariants } = useChip();

  const [selectedContact, setSelectedContact] = useState(TARGET_CONTACTS[0]);
  const [filterClass, setFilterClass] = useState('all'); // 'all' | 'ship' | 'iceberg'
  const [showSwath, setShowSwath] = useState(true);
  const [showIceEdge, setShowIceEdge] = useState(true);

  // Map projection bounding box: Lat 42°N to 76°N, Lon -75°W to -25°W
  const minLat = 42.0, maxLat = 76.0;
  const minLon = -75.0, maxLon = -25.0;

  // Convert (lat, lon) to SVG viewBox coordinates [0..800, 0..520]
  const project = useCallback((lat, lon) => {
    const x = ((lon - minLon) / (maxLon - minLon)) * 800;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 520;
    return { x, y };
  }, [minLat, maxLat, minLon, maxLon]);

  const filteredContacts = useMemo(() => {
    if (filterClass === 'all') return TARGET_CONTACTS;
    return TARGET_CONTACTS.filter((c) => c.class === filterClass);
  }, [filterClass]);

  const handleSelectAndLoad = (contact) => {
    loadSample(contact.id);
    navigate('/app');
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ── Page Header ── */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase tracking-widest text-accent font-semibold">
              Geospatial Overview
            </span>
            <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent font-mono text-[10px]">
              North Atlantic / Arctic AOI
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Geospatial Acquisition Map
          </h2>
          <p className="text-muted text-sm mt-1 max-w-2xl">
            Illustrative geospatial mapping of Sentinel-1 radar chips, simulated satellite swath coverage corridors, and maritime ice hazard zones.
          </p>
        </div>

        {/* Map Layers & Filter Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Class Filter */}
          <div className="flex items-center bg-white/[0.04] p-1 rounded-xl border border-white/10 text-xs font-mono">
            {[
              { id: 'all', label: 'All Contacts' },
              { id: 'ship', label: 'Ships' },
              { id: 'iceberg', label: 'Icebergs' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterClass(f.id)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filterClass === f.id
                    ? 'bg-accent/20 text-accent font-bold shadow-glow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Toggle Layers */}
          <button
            type="button"
            onClick={() => setShowSwath((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition-all ${
              showSwath
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-white/[0.03] border-white/10 text-white/50'
            }`}
          >
            Orbital Swath
          </button>
          <button
            type="button"
            onClick={() => setShowIceEdge((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition-all ${
              showIceEdge
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-white/[0.03] border-white/10 text-white/50'
            }`}
          >
            Ice Edge
          </button>
        </div>
      </motion.div>

      {/* ── Main Map Canvas & HUD Sidebar ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Viewport (2 Columns) */}
        <div className="lg:col-span-2 glass-panel p-4 overflow-hidden relative group">
          {/* Simulation & Illustrative Disclosure Banner */}
          <div className="mb-3 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <span>
              <strong className="font-semibold text-amber-300">Illustrative overview</strong> — positions and boundaries are simulated for demonstration, not derived from real satellite telemetry.
            </span>
          </div>

          <div className="relative w-full aspect-[800/520] bg-[#020712] rounded-xl overflow-hidden border border-white/10 shadow-inner">
            {/* SVG Acquisition Map */}
            <svg
              viewBox="0 0 800 520"
              className="w-full h-full select-none"
            >
              <defs>
                {/* Radar Grid Pattern */}
                <pattern id="radar-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(56, 189, 248, 0.05)" strokeWidth="1" />
                </pattern>

                {/* Polar Ice Edge Hatching */}
                <pattern id="ice-pattern" width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="16" stroke="rgba(251, 191, 36, 0.2)" strokeWidth="1.5" />
                </pattern>

                {/* Glow Filters */}
                <filter id="blip-glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Ocean Background & Grid */}
              <rect width="800" height="520" fill="#030814" />
              <rect width="800" height="520" fill="url(#radar-grid)" />

              {/* Geographic Parallels & Meridians */}
              {[45, 55, 65, 75].map((lat) => {
                const pt = project(lat, -75);
                return (
                  <g key={`lat-${lat}`}>
                    <line x1="0" y1={pt.y} x2="800" y2={pt.y} stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 4" />
                    <text x="8" y={pt.y - 4} fill="rgba(255, 255, 255, 0.3)" fontSize="10" fontFamily="monospace">
                      {lat}°N
                    </text>
                  </g>
                );
              })}

              {[-70, -60, -50, -40, -30].map((lon) => {
                const pt = project(42, lon);
                return (
                  <g key={`lon-${lon}`}>
                    <line x1={pt.x} y1="0" x2={pt.x} y2="520" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 4" />
                    <text x={pt.x + 4} y="512" fill="rgba(255, 255, 255, 0.3)" fontSize="10" fontFamily="monospace">
                      {Math.abs(lon)}°W
                    </text>
                  </g>
                );
              })}

              {/* Simplified Coastline Landmasses (Greenland, Baffin Island, Newfoundland) */}
              {/* Greenland outline */}
              <path
                d="M 440 20 L 530 40 L 590 120 L 560 210 L 490 280 L 440 260 L 420 180 L 390 100 Z"
                fill="rgba(15, 23, 42, 0.7)"
                stroke="rgba(56, 189, 248, 0.3)"
                strokeWidth="1.5"
              />
              <text x="470" y="140" fill="rgba(255, 255, 255, 0.25)" fontSize="12" fontFamily="monospace" letterSpacing="3">
                GREENLAND
              </text>

              {/* Baffin Island & Labrador Coast */}
              <path
                d="M 50 40 L 180 80 L 220 160 L 160 250 L 120 320 L 180 390 L 120 480 L 30 500 Z"
                fill="rgba(15, 23, 42, 0.7)"
                stroke="rgba(56, 189, 248, 0.3)"
                strokeWidth="1.5"
              />
              <text x="70" y="220" fill="rgba(255, 255, 255, 0.25)" fontSize="11" fontFamily="monospace" letterSpacing="2">
                CANADA / LABRADOR
              </text>

              {/* Newfoundland & Grand Banks Shelf */}
              <path
                d="M 290 410 L 360 415 L 370 470 L 310 485 Z"
                fill="rgba(15, 23, 42, 0.7)"
                stroke="rgba(56, 189, 248, 0.35)"
                strokeWidth="1.5"
              />
              <text x="280" y="445" fill="rgba(255, 255, 255, 0.35)" fontSize="10" fontFamily="monospace">
                NEWFOUNDLAND
              </text>

              {/* Polar Ice Edge Contour (NIC Ice Extent Zone) */}
              {showIceEdge && (
                <g>
                  <path
                    d="M 0 60 Q 240 100 400 90 T 800 50 L 800 0 L 0 0 Z"
                    fill="url(#ice-pattern)"
                    stroke="rgba(251, 191, 36, 0.4)"
                    strokeWidth="1"
                    strokeDasharray="4 3"
                  />
                  <text x="20" y="30" fill="rgba(251, 191, 36, 0.6)" fontSize="10" fontFamily="monospace">
                    MARGINAL ICE ZONE (MIZ)
                  </text>
                </g>
              )}

              {/* Sentinel-1 Orbital Swath Corridor */}
              {showSwath && (
                <g opacity="0.65">
                  <polygon
                    points="320,0 420,0 560,520 460,520"
                    fill="rgba(56, 189, 248, 0.08)"
                    stroke="rgba(56, 189, 248, 0.25)"
                    strokeWidth="1"
                    strokeDasharray="6 4"
                  />
                  <line x1="370" y1="0" x2="510" y2="520" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1" strokeDasharray="3 5" />
                  <text x="490" y="490" fill="rgba(56, 189, 248, 0.7)" fontSize="9" fontFamily="monospace">
                    S1B Ground Track · IW Mode (250km Swath)
                  </text>
                </g>
              )}

              {/* Target Contacts Blips */}
              {filteredContacts.map((c) => {
                const pt = project(c.lat, c.lon);
                const isSelected = selectedContact?.id === c.id;
                const isShip = c.class === 'ship';

                return (
                  <g
                    key={c.id}
                    onClick={() => setSelectedContact(c)}
                    className="cursor-pointer group"
                  >
                    {/* Pulsing Radar Ring */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 18 : 12}
                      fill="none"
                      stroke={isShip ? 'rgba(56, 189, 248, 0.4)' : 'rgba(251, 191, 36, 0.4)'}
                      strokeWidth="1"
                      className="animate-ping"
                    />

                    {/* Outer Selection Reticle */}
                    {isSelected && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="14"
                        fill="none"
                        stroke={isShip ? '#38bdf8' : '#fbbf24'}
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                      />
                    )}

                    {/* Central Target Blip */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 5 : 4}
                      fill={isShip ? '#38bdf8' : '#fbbf24'}
                      filter="url(#blip-glow)"
                    />

                    {/* Target Identifier Label */}
                    <text
                      x={pt.x + 10}
                      y={pt.y + 4}
                      fill={isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.75)'}
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight={isSelected ? 'bold' : 'normal'}
                    >
                      {c.name.split(' ')[0]} {c.name.split(' ')[1]}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Scale Indicator */}
            <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-mono text-white/60 flex items-center gap-3">
              <span>Projection: Mercator AOI</span>
              <span>10m / px (IW Resolution)</span>
              <span className="flex items-center gap-1 text-amber-400/90">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Simulated Swaths
              </span>
            </div>
          </div>
        </div>

        {/* Contact Card (1 Column) */}
        <div className="space-y-4">
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1.5 ${
                  selectedContact.class === 'ship' ? 'badge-ship' : 'badge-iceberg'
                }`}>
                  {selectedContact.class.toUpperCase()} TARGET
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {selectedContact.name}
                </h3>
                <p className="text-muted text-xs font-mono mt-0.5">
                  Sector: {selectedContact.region}
                </p>
              </div>

              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-accent">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
            </div>

            {/* Sensor Telemetry Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                <span className="text-white/40 block text-[10px]">COORDINATES</span>
                <span className="text-white font-semibold">{selectedContact.lat}°N, {Math.abs(selectedContact.lon)}°W</span>
              </div>
              <div className="bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                <span className="text-white/40 block text-[10px]">INCIDENCE ANGLE</span>
                <span className="text-accent font-semibold">{selectedContact.inc_angle}°</span>
              </div>
              <div className="bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                <span className="text-white/40 block text-[10px]">EST. MOTION</span>
                <span className="text-white font-semibold">{selectedContact.speed || selectedContact.drift}</span>
              </div>
              <div className="bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                <span className="text-white/40 block text-[10px]">POLARIZATION</span>
                <span className="text-white font-semibold">{selectedContact.polarization}</span>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-white/70 leading-relaxed bg-slate-900/40 p-3 rounded-lg border border-white/5">
              {selectedContact.description}
            </p>

            {/* Action: Load Target into Workstation */}
            <button
              type="button"
              onClick={() => handleSelectAndLoad(selectedContact)}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 shadow-glow cursor-pointer"
            >
              <span>Inspect in Workstation</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>

          {/* Quick Target List */}
          <div className="glass-panel p-4 space-y-2">
            <h4 className="text-xs font-mono uppercase tracking-wider text-white/50 px-1">
              Area Contacts ({filteredContacts.length})
            </h4>
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredContacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedContact(c)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-all flex items-center justify-between ${
                    selectedContact?.id === c.id
                      ? 'bg-accent/15 border border-accent/30 text-white'
                      : 'hover:bg-white/[0.04] text-white/60 border border-transparent'
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className={`text-[10px] font-bold uppercase ${c.class === 'ship' ? 'text-cyan-400' : 'text-amber-400'}`}>
                    {c.class}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
