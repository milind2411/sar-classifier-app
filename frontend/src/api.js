/**
 * API client for the SAR Classifier backend.
 *
 * All preprocessing (Lee filtering, normalization) happens server-side.
 * The frontend sends raw bands + angle exactly as stored in the .npy files.
 */

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').trim();
const BASE = RAW_BASE.replace(/\/+$/, '');

/**
 * Derive health endpoint URL from base URL.
 * In dev: returns '/health' (proxied by Vite to http://127.0.0.1:8000).
 * With absolute VITE_API_BASE_URL: extracts origin and points to `${origin}/health`.
 */
function getHealthUrl() {
  if (BASE.startsWith('http://') || BASE.startsWith('https://')) {
    try {
      return `${new URL(BASE).origin}/health`;
    } catch {
      return '/health';
    }
  }
  return '/health';
}

async function request(endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `API error ${res.status}`);
  }
  return res.json();
}

/**
 * Classify a single SAR chip.
 * @param {number[]} band_1  Flattened 75×75 HH band (5625 floats)
 * @param {number[]} band_2  Flattened 75×75 HV band (5625 floats)
 * @param {number}   inc_angle  Incidence angle in degrees
 * @returns {{ probability_iceberg: number, predicted_class: string, confidence: number }}
 */
export function predict(band_1, band_2, inc_angle) {
  return request('/predict', { band_1, band_2, inc_angle });
}

/**
 * Sweep incidence angle while holding image content fixed.
 * @param {number[]} band_1
 * @param {number[]} band_2
 * @param {number[]} [angles]  Optional custom angle list
 * @returns {{ points: { angle: number, probability_iceberg: number }[] }}
 */
export function angleSweep(band_1, band_2, angles = null) {
  const body = { band_1, band_2 };
  if (angles) body.angles = angles;
  return request('/predict/angle-sweep', body);
}

/**
 * Compute Grad-CAM heatmap for explainability.
 * NOTE: First call lazy-loads TensorFlow on the backend — expect ~10s delay.
 * @param {number[]} band_1
 * @param {number[]} band_2
 * @param {number}   inc_angle
 * @returns {{ heatmap: number[][], layer_used: string }}
 */
export function gradcam(band_1, band_2, inc_angle) {
  return request('/predict/gradcam', { band_1, band_2, inc_angle });
}

/**
 * Run multi-model comparison: ResNet50 Deep Learning vs. GLCM + XGBoost Baseline.
 * @param {number[]} band_1
 * @param {number[]} band_2
 * @param {number}   inc_angle
 * @returns {ModelComparisonOutput}
 */
export function compare(band_1, band_2, inc_angle) {
  return request('/predict/compare', { band_1, band_2, inc_angle });
}

/**
 * Retrieve recent prediction history from SQLite audit store.
 * @param {number} [limit=50]  Number of records to fetch (capped at 200)
 * @returns {Promise<Array<{
 *   id: number,
 *   timestamp: string,
 *   predicted_class: 'ship' | 'iceberg',
 *   probability_iceberg: number,
 *   confidence: number,
 *   inc_angle: number,
 *   model_used: string,
 *   source: string
 * }>>}
 */
export async function getHistory(limit = 50) {
  const capped = Math.min(Math.max(1, limit), 200);
  const res = await fetch(`${BASE}/history?limit=${capped}`);
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    const err = new Error(detail.detail || `API error ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

/**
 * Run batch prediction on up to 50 SAR chips simultaneously.
 * @param {Array<{ band_1: number[], band_2: number[], inc_angle: number }>} chips
 * @returns {Promise<{ results: Array<{ probability_iceberg: number, predicted_class: 'ship' | 'iceberg', confidence: number, telemetry: object | null }> }>}
 */
export function predictBatch(chips) {
  return request('/predict/batch', { chips });
}

/**
 * Health check querying the backend root /health endpoint.
 * Works both via local Vite proxy ('/health') and against absolute VITE_API_BASE_URL.
 * @returns {Promise<{ status: string }>}
 */
export async function checkHealth() {
  const healthUrl = getHealthUrl();
  const res = await fetch(healthUrl);
  if (!res.ok) throw new Error(`Backend unreachable (status ${res.status})`);
  return res.json();
}

// Backward-compatible alias
export const healthCheck = checkHealth;

/**
 * Load a verified Kaggle ground-truth sample chip by id (e.g. 'ship_1', 'iceberg_2').
 * @param {string} id  Sample chip identifier
 * @returns {Promise<{ band_1: number[], band_2: number[], inc_angle: number, name?: string, id?: string }>}
 */
export async function loadSampleChip(id) {
  const cleanId = String(id).replace(/\.json$/, '');
  const res = await fetch(`/sample_chips/${cleanId}.json`);
  if (!res.ok) {
    throw new Error(`Failed to load sample chip '${cleanId}': ${res.status}`);
  }
  return res.json();
}


