import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

/**
 * Drag-and-drop zone for uploading .npy sample chips or raw JSON payloads.
 * Parses the uploaded file and calls onChipLoaded({ band_1, band_2, inc_angle, label?, name }).
 *
 * Accepts:
 *  - .npy files (binary numpy format from backend/data/sample_chips/)
 *  - .json files with { band_1, band_2, inc_angle } structure
 */
export default function Dropzone({ onChipLoaded, disabled, compact = false }) {
  const onDrop = useCallback(
    async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      const name = file.name;

      try {
        if (name.endsWith('.json')) {
          const text = await file.text();
          const data = JSON.parse(text);
          if (!data.band_1 || !data.band_2 || data.inc_angle == null) {
            throw new Error('JSON must contain band_1, band_2, and inc_angle');
          }
          onChipLoaded({ ...data, name });
        } else if (name.endsWith('.npy')) {
          const buf = await file.arrayBuffer();
          const chip = parseNpy(buf);
          onChipLoaded({ ...chip, name });
        } else {
          throw new Error('Unsupported file type. Use .npy or .json');
        }
      } catch (err) {
        alert(`Failed to load ${name}: ${err.message}`);
      }
    },
    [onChipLoaded],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    accept: { 'application/octet-stream': ['.npy'], 'application/json': ['.json'] },
    maxFiles: 1,
  });

  if (compact) {
    return (
      <div
        {...getRootProps()}
        className={`
          px-4 py-2 rounded-xl border border-dashed text-center cursor-pointer transition-all duration-200 flex items-center justify-center gap-2.5
          ${isDragActive ? 'border-accent bg-accent/10 shadow-glow-sm' : 'border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.05]'}
          ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <span className="text-xs text-white/70 font-mono">
          {isDragActive ? 'Drop SAR chip here…' : 'Upload custom .json / .npy'}
        </span>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`
        glass-panel p-8 text-center cursor-pointer transition-all duration-300
        ${isDragActive ? 'border-accent/50 shadow-glow-lg scale-[1.01]' : 'hover:border-white/15'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <div>
          <p className="text-white/80 font-medium">
            {isDragActive ? 'Drop the SAR chip here…' : 'Drop a .npy or .json chip file'}
          </p>
          <p className="text-muted text-sm mt-1">or click to browse</p>
        </div>
      </div>
    </div>
  );
}

// ── Minimal .npy parser ──────────────────────────────────────────────
// Handles the specific format used by our sample_chips: numpy dict saved
// with np.save(path, chip_dict) where chip_dict is a 0-d object array
// wrapping a Python dict.
function parseNpy(buffer) {
  const bytes = new Uint8Array(buffer);
  // Validate magic: \x93NUMPY
  if (bytes[0] !== 0x93 || String.fromCharCode(...bytes.slice(1, 6)) !== 'NUMPY') {
    throw new Error('Not a valid .npy file');
  }

  const major = bytes[6];
  let headerLen, headerStart;
  if (major === 1) {
    headerLen = bytes[8] | (bytes[9] << 8);
    headerStart = 10;
  } else {
    headerLen = bytes[8] | (bytes[9] << 8) | (bytes[10] << 16) | (bytes[11] << 24);
    headerStart = 12;
  }

  const headerStr = new TextDecoder().decode(bytes.slice(headerStart, headerStart + headerLen));

  // If it's an object array (pickled dict), we can't parse it directly in JS.
  // Fall back: read via JSON export. For now, try to detect float64 arrays.
  if (headerStr.includes("'O'") || headerStr.includes('object')) {
    throw new Error(
      'This .npy file contains a pickled Python object. ' +
      'Use the export tool (frontend/tools/export_samples_to_json.py) to convert it to JSON first.',
    );
  }

  // Simple float64 array parsing (for future direct-band uploads)
  const dataStart = headerStart + headerLen;
  const descr = headerStr.match(/'descr'\s*:\s*'([^']+)'/)?.[1] || '<f8';
  const isFloat32 = descr.includes('f4');
  const bytesPerElement = isFloat32 ? 4 : 8;
  const dataBytes = bytes.slice(dataStart);
  const arr = isFloat32
    ? new Float32Array(dataBytes.buffer, dataBytes.byteOffset, dataBytes.byteLength / bytesPerElement)
    : new Float64Array(dataBytes.buffer, dataBytes.byteOffset, dataBytes.byteLength / bytesPerElement);

  // If it's a flat 5625-element array, treat as single band (not very useful alone)
  // More likely it's the full chip dict — but those are pickled. Guide user to JSON export.
  if (arr.length === 5625) {
    throw new Error('Single-band .npy detected. Please provide a full chip (band_1 + band_2 + inc_angle) as JSON.');
  }

  throw new Error(
    'Cannot parse this .npy format directly. Use frontend/tools/export_samples_to_json.py to convert sample chips to JSON.',
  );
}
