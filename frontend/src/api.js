/**
 * API client for the SAR Classifier backend.
 *
 * All preprocessing (Lee filtering, normalization) happens server-side.
 * The frontend sends raw bands + angle exactly as stored in the .npy files.
 */

const BASE = '/api';

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
    throw new Error(detail.detail || `API error ${res.status}`);
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
 * Health check.
 * @returns {{ status: string }}
 */
export async function healthCheck() {
  const res = await fetch('/health');
  if (!res.ok) throw new Error('Backend unreachable');
  return res.json();
}


