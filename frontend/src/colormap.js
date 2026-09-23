/**
 * Colormap utilities for rendering SAR chips and Grad-CAM overlays.
 *
 * Uses Viridis (perceptually uniform) for SAR false-color rendering
 * and a hot colormap (transparent → red → yellow → white) for Grad-CAM.
 */

// ── Viridis LUT (16-stop approximation) ──────────────────────────────
const VIRIDIS = [
  [68, 1, 84],    [72, 26, 108],  [71, 47, 126],  [65, 68, 135],
  [57, 86, 140],  [49, 104, 142], [42, 120, 142],  [35, 137, 140],
  [31, 152, 132], [34, 168, 120], [53, 183, 105],  [83, 197, 83],
  [122, 209, 58], [165, 219, 38], [210, 226, 27],  [253, 231, 37],
];

function interpolateViridis(t) {
  t = Math.max(0, Math.min(1, t));
  const idx = t * (VIRIDIS.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, VIRIDIS.length - 1);
  const frac = idx - lo;
  return [
    Math.round(VIRIDIS[lo][0] + frac * (VIRIDIS[hi][0] - VIRIDIS[lo][0])),
    Math.round(VIRIDIS[lo][1] + frac * (VIRIDIS[hi][1] - VIRIDIS[lo][1])),
    Math.round(VIRIDIS[lo][2] + frac * (VIRIDIS[hi][2] - VIRIDIS[lo][2])),
  ];
}

/**
 * Render a 75×75 single-channel array to a 75×75 RGBA ImageData using Viridis.
 * @param {number[]} flatChannel  5625 floats, already min-max normalized to [0,1]
 * @returns {ImageData}
 */
export function channelToImageData(flatChannel) {
  const size = 75;
  const imageData = new ImageData(size, size);
  const data = imageData.data;
  for (let i = 0; i < size * size; i++) {
    const [r, g, b] = interpolateViridis(flatChannel[i]);
    const offset = i * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = 255;
  }
  return imageData;
}

/**
 * Render raw SAR bands as a false-color composite: R = HH, G = HV, B = HH−HV.
 * Each band is independently min-max normalized before rendering.
 * @param {number[]} band1  5625 floats (raw HH)
 * @param {number[]} band2  5625 floats (raw HV)
 * @returns {ImageData}
 */
export function bandsToFalseColor(band1, band2) {
  const size = 75;
  const norm = (arr) => {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const range = max - min || 1;
    return arr.map((v) => (v - min) / range);
  };
  const n1 = norm(band1);
  const n2 = norm(band2);
  const ratio = band1.map((v, i) => v - band2[i]);
  const nR = norm(ratio);

  const imageData = new ImageData(size, size);
  const data = imageData.data;
  for (let i = 0; i < size * size; i++) {
    const offset = i * 4;
    data[offset] = Math.round(n1[i] * 255);
    data[offset + 1] = Math.round(n2[i] * 255);
    data[offset + 2] = Math.round(nR[i] * 255);
    data[offset + 3] = 255;
  }
  return imageData;
}

// ── Standalone Heatmap Colormaps (Turbo, Inferno, Jet) ──────────────
export const TURBO = [
  [48, 18, 59],
  [70, 74, 157],
  [71, 119, 212],
  [51, 161, 237],
  [27, 198, 203],
  [39, 224, 151],
  [95, 239, 93],
  [159, 241, 53],
  [210, 226, 44],
  [247, 197, 44],
  [254, 155, 45],
  [243, 110, 44],
  [217, 68, 41],
  [177, 33, 31],
  [122, 4, 3],
];

export const INFERNO = [
  [0, 0, 4],
  [22, 11, 57],
  [66, 10, 104],
  [106, 23, 110],
  [147, 38, 103],
  [188, 55, 84],
  [221, 81, 58],
  [243, 120, 25],
  [252, 165, 10],
  [246, 215, 70],
  [252, 255, 164],
];

export const JET = [
  [0, 0, 131],
  [0, 0, 212],
  [0, 60, 255],
  [0, 142, 255],
  [0, 224, 255],
  [60, 255, 195],
  [142, 255, 113],
  [224, 255, 31],
  [255, 208, 0],
  [255, 126, 0],
  [255, 45, 0],
  [180, 0, 0],
  [128, 0, 0],
];

function interpolateLut(lut, t) {
  t = Math.max(0, Math.min(1, t));
  const idx = t * (lut.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, lut.length - 1);
  const frac = idx - lo;
  return [
    Math.round(lut[lo][0] + frac * (lut[hi][0] - lut[lo][0])),
    Math.round(lut[lo][1] + frac * (lut[hi][1] - lut[lo][1])),
    Math.round(lut[lo][2] + frac * (lut[hi][2] - lut[lo][2])),
  ];
}

/**
 * Render a 75×75 Grad-CAM heatmap as an opaque standalone RGBA ImageData.
 * @param {number[][]} heatmap   75×75 grid, values in [0,1]
 * @param {'turbo'|'inferno'|'jet'} colormap  Colormap name
 * @returns {ImageData}
 */
export function heatmapToImageData(heatmap, colormap = 'turbo') {
  const lut = colormap === 'inferno' ? INFERNO : colormap === 'jet' ? JET : TURBO;
  const size = 75;
  const imageData = new ImageData(size, size);
  const data = imageData.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const val = heatmap[y][x];
      const [r, g, b] = interpolateLut(lut, val);
      const offset = (y * size + x) * 4;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = 255; // 100% opaque
    }
  }
  return imageData;
}

