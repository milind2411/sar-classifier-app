# SAR Classifier — Frontend

React + Vite + Tailwind frontend for the SAR Vessel/Iceberg Classifier.

## Quick start

```bash
# 1. Export sample chips to JSON (one-time, from project root)
python frontend/tools/export_samples_to_json.py

# 2. Install dependencies
cd frontend
npm install

# 3. Start dev server (proxies /api → backend at :8000)
npm run dev
```

Make sure the backend is running on `http://localhost:8000` first:
```bash
cd backend
uvicorn main:app --reload --port 8000
```

## Features

- **False-Color & Raw Band SAR Visualization (`ChipCanvas.jsx`)** — 75×75 Sentinel-1 chips rendered at 4× zoom ($300\times300$) with nearest-neighbor crisp pixels on an `OffscreenCanvas`. Toggle between Composite ($R=\text{HH}, G=\text{HV}, B=\text{HH}-\text{HV}$), raw HH, raw HV, and HH−HV difference bands with a real-time mouse hover pixel dB inspector.
- **Drag-and-Drop & Direct Ingestion (`Dropzone.jsx`)** — Drag-and-drop support for `.json` and `.npz` chip files, complete with format validation and error alerts.
- **Built-in Sample Chip Selectors** — 1-click quick-select buttons for 6 verified ground-truth Kaggle chips (3 vessels, 3 icebergs).
- **Multi-Model Evaluation & Comparison (`ModelComparisonPanel.jsx`)** — 3-way toggle switcher (`ResNet50 Only` / `XGBoost Only` / `Compare Both`). Side-by-side probability cards with per-model inference latencies, a consensus status banner (agreement vs. divergence alert), confidence delta visualization, and an interactive GLCM Haralick texture & clutter moments inspector with physical radar tooltips.
- **Radar Signal Quality & SNR Telemetry (`ResultsPanel.jsx` & `ModelComparisonPanel.jsx`)** — Real-time Target-to-Clutter Ratio ($10 \log_{10}(P_{\text{target}} / P_{\text{clutter}})$ in dB), clutter-annulus Equivalent Number of Looks (ENL), speckle reduction percentage via Adaptive Lee filtering, cross-polarization delta, and color-coded contrast badges (Green $\ge 6\text{ dB}$, Amber $< 6\text{ dB}$) with low-contrast clutter alerts.
- **Standalone Grad-CAM Explainability (`GradCamPanel.jsx`)** — Decoupled $300\times300$ attention canvas keeping the raw radar canvas 100% clean and unobscured. Class-aware gradient heatmaps with selectable scientific colormaps (**Turbo**, **Inferno**, **Jet**), crisp vs. smooth contour interpolation toggles, peak/mean attention statistics, and a pixel-level attention inspector.
- **Angle Sensitivity Curve & Dual-Zone Shading (`AngleSensitivityChart.jsx`)** — Interactive Recharts plot sweeping $30^\circ - 46^\circ$ incidence angles. Features dual-zone background shading (🧊 Iceberg Zone $>50\%$ vs 🚢 Ship Zone $<50\%$), automated mathematical boundary crossover calculation ($\theta_{\text{critical}}$), observed pass marker, and an operational stability diagnostic badge (`Angle Sensitive` vs `Angle Robust`).
- **Standardized Maritime Assessment Brief Export** — 1-click downloadable operational assessment report synthesizing target classification, confidence, physical radar quality & SNR telemetry, model consensus metrics, and environmental observations.

## Architecture

All preprocessing (Adaptive Lee filtering, polarimetric ratio, min-max normalization) and feature extractions happen server-side.
The frontend sends raw `band_1`, `band_2`, and `inc_angle` to the backend, matching the invariant in `brain.md` §3:
_"do not reimplement this logic anywhere else, including the frontend."_

## Build & Validation

```bash
npm run build    # production build via Vite -> dist/
npm run preview  # serve the production bundle locally
```
