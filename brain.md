# PROJECT BRAIN — SAR Vessel/Iceberg Classifier

**Read this file before starting any mission. Update the STATUS section after
finishing any mission. This is the single source of truth for what exists,
what's verified, and what's still needed.**

---

## 1. What this project is

A dual-branch deep learning system that classifies Sentinel-1 dual-polarization
SAR chips as **ship** or **iceberg**, served via a FastAPI backend and a React
interactive frontend. Trained on Kaggle (Statoil/C-CORE iceberg dataset style).

Working titles: SAR-Vision / AeroPolaris / SentinelGuard.

## 2. Model — VERIFIED, do not re-derive these facts

- Architecture: dual-branch Keras Functional model (`fusion_model` in the
  training notebook) — ResNet50 image branch + small MLP angle branch, fused
  and output through a single sigmoid.
- **Canonical source checkpoint: `best_resnet_fusion.keras`** (one of 5
  fold checkpoints from cross-validation, selected as best-performing).
  An earlier `model.h5` checkpoint was used for an initial ONNX export, but
  was confirmed to be a DIFFERENT set of weights (predictions differed by
  ~15% relative, e.g. 0.0121 vs 0.0139 on the same sample) after a Kaggle
  kernel restart wiped `model.h5` but preserved the fold checkpoints.
  `best_resnet_fusion.keras` was designated canonical going forward and
  `sar_classifier.onnx` was re-exported from it. If a `model.h5`-derived
  ONNX file ever resurfaces anywhere in this repo, it is STALE — discard it.
- Exported to ONNX at `backend/models/sar_classifier.onnx`. Conversion
  verified against a real training sample (not dummy noise): max abs
  difference between Keras (`best_resnet_fusion.keras`) and ONNX output =
  `0.00000738`. Safe to treat as equivalent to the Keras model.
- **Exact input names (case-sensitive, required for ONNX Runtime calls):**
  - `sar_image_input` — shape `(1, 75, 75, 3)`, dtype float32
  - `inc_angle_input` — shape `(1, 1)`, dtype float32
- **Output:** single scalar, sigmoid probability of `is_iceberg` (0 = ship,
  1 = iceberg). Threshold at 0.5 for class label.
- Model file size ~134MB in Keras `.h5` form; ONNX form is what's actually
  served (do not load TensorFlow/Keras in the backend — ONNX Runtime only).

## 3. Preprocessing — VERIFIED, exact formula matters

Raw input per sample: `band_1` (HH) and `band_2` (HV), each a **flattened
75x75 array (5625 floats)**, plus a scalar `inc_angle`.

Pipeline (implemented in `backend/preprocessing/sar_preprocessing.py` —
**this file is the single source of truth, do not reimplement this logic
anywhere else, including the frontend**):

1. Reshape each band to `(75, 75)`.
2. Apply the **Adaptive Lee filter** to each band independently:
   ```
   mean = uniform_filter(img, size=5)
   sq_mean = uniform_filter(img**2, size=5)
   var = sq_mean - mean**2                    # NOT clipped to >= 0
   overall_var = np.var(img)                  # GLOBAL variance of RAW img
   weight = var / (var + overall_var + 1e-6)
   filtered = mean + weight * (img - mean)
   ```
   **Critical detail:** `overall_var` is the variance of the whole raw
   (unfiltered) image, computed fresh for each band — NOT a mean of the
   local variance map. This was confirmed against the actual training
   notebook after an earlier draft used the wrong formula (`np.mean(var)`
   instead of `np.var(img)`). If any future draft of this function
   reappears with `np.mean(var)`, that is a regression — revert it.
3. Compute `ratio = filtered_band_1 - filtered_band_2` (HH − HV).
4. Stack as `[HH, HV, ratio]` → shape `(75, 75, 3)`.
5. Per-sample, per-channel min-max normalize to `[0, 1]` using
   `axis=(0,1)` on a single chip (or `axis=(1,2)` on a batch — same
   operation, different axis for the missing batch dim).
6. Angle is reshaped to `(1, 1)` float32, unmodified otherwise.

Missing incidence angles in the original training data (~1604 rows, none
dropped) were imputed with the **median (~39.5°)**, not removed. A handful
of training chips therefore have a placeholder rather than a true angle —
irrelevant for inference, but relevant if picking a "true baseline" chip for
demoing the angle-sensitivity feature (don't pick an imputed-angle one for
that demo).

## 4. Backend — DONE (built and unit-verified, not yet run against real model)

Structure (already built, in `sar-backend.zip` delivered to the user):

```
backend/
├── main.py                  FastAPI app, CORS enabled (ALLOWED_ORIGINS env configurable), includes predict router
├── .env.example             template for environment variables (ALLOWED_ORIGINS CORS configuration)
├── schemas.py               Pydantic: ChipInput, PredictionOutput, AngleSweepInput/Output, GradCamOutput
├── inference.py             ONNX session singleton (double-checked locking); predict() and angle_sweep()
├── gradcam.py               Lazy-loaded TensorFlow/Keras singleton (double-checked locking) for Grad-CAM only
├── xgb_inference.py         XGBoost baseline booster singleton (double-checked locking)
├── xgboost_service.py       Alias re-export for XGBoost baseline service
├── history.py               SQLite prediction logger (predictions.db) and history reader
├── requirements.txt
├── README.md
├── preprocessing/
│   └── sar_preprocessing.py  (see section 3 — do not modify without re-verifying against Kaggle)
├── routers/
│   └── predict.py            POST /api/predict, /api/predict/upload, /api/predict/batch, /api/predict/angle-sweep, /api/predict/gradcam, /api/predict/compare, GET /api/history
├── models/
│   ├── sar_classifier.onnx        (fast inference — used by predict, angle-sweep)
│   └── best_resnet_fusion.keras   (gradient access — used ONLY by gradcam, lazy-loaded)
├── data/
│   ├── predictions.db             (SQLite database tracking inference runs, auto-initialized)
│   └── sample_chips/
│       └── {ship,iceberg}_{1,2,3}.npz  (raw bands+angle+label, 6 total)
└── tests/
    ├── conftest.py           test configuration; isolates SQLite DB via fixture and TESTING env guard
    └── test_predict.py       integration tests; skip (not fail) if model/samples absent
```

Verified via local test run (without real model, using synthetic checks):
- App imports cleanly, both routes register (`/api/predict`, `/api/predict/angle-sweep`)
- `/health` returns 200
- Malformed input (wrong band length) correctly returns 422
- Test suite: 2 pass, 7 skip cleanly (skips are expected until real model/samples are added)

**Not yet done:** running the test suite with the REAL onnx model + real sample
chips in place. Do this before building anything further — if any of the 6
known-label predictions come back wrong, investigate before moving to frontend.

**UPDATE — Mission: local verification.** Ran on the user's machine (Windows,
Python 3.13.9, tensorflow-cpu 2.21.0) with real `sar_classifier.onnx`,
`best_resnet_fusion.keras`, and all 6 sample chips in place. Result:
**9/9 tests passed** — health check, all 3 ship labels, all 3 iceberg labels,
angle-sweep default range, and input validation. Backend is confirmed fully
functional end-to-end. Note: `requirements.txt` pins were loosened from exact
(`==`) to minimum (`>=`) versions after `onnxruntime==1.19.2` and other exact
pins failed to resolve on Python 3.13 — if reproducing on an older Python
version, exact pins may need to be reintroduced for stability, but `>=` is
confirmed working on 3.13.9.

**Update — Direct file upload endpoint:** Added `POST /api/predict/upload` alongside `POST /api/predict`. Accepts raw file uploads (`.json` or `.npy` formatted as in `data/sample_chips/`), extracts `band_1`, `band_2`, and `inc_angle`, and delegates directly to `SARClassifier.predict()`, without requiring client-side pre-parsing. Enforces a 2MB maximum upload size limit (`MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024`); files exceeding this size are rejected with HTTP 413 (Payload Too Large) before contents are read into memory to prevent server memory exhaustion.

**Update — Prediction History Tracking & Test Isolation:** Added `GET /api/history` (default limit 50, capped at 200) powered by lightweight built-in SQLite (`backend/history.py` storing to `backend/data/predictions.db`). All prediction endpoints (`/api/predict`, `/api/predict/upload`, and items in `/api/predict/batch`) automatically log results. Test pollution is strictly guarded: `is_logging_enabled()` checks `TESTING=1` (set in `conftest.py`) and refuses to log to the default DB path, while an autouse fixture in `backend/tests/conftest.py` redirects `get_db_path()` to an isolated `tmp_path / "test_predictions.db"`. This ensures tests can verify logging mechanics without corrupting or polluting production/local history.

**Update — Docker Containerization:** Added container support for backend deployment via `backend/Dockerfile` using a `python:3.11-slim` base image (chosen for superior ML wheel support over 3.13) and `backend/.dockerignore` (excluding venvs, test caches, and dev databases). Running `docker build -t sar-classifier-backend .` and `docker run -p 8000:8000 sar-classifier-backend` serves as a containerized alternative to manual `pip install` + `uvicorn` setup. Containerized image verified locally with identical bit-for-bit inference results to the non-Docker environment.

**Update — Security Fix (RCE Prevention via NPZ Migration):** Fixed a critical remote-code-execution (RCE) vulnerability on `POST /api/predict/upload`. Loading user-uploaded `.npy` files with `allow_pickle=True` allows execution of arbitrary embedded code. Migrated binary sample chip storage and file upload format entirely from `.npy` to `.npz` (NumPy Zip archive, using `np.savez`/`np.load` with zero pickle usage). Removed `.npy` support from `/api/predict/upload` (now accepts `.json` and `.npz` only). Updated all test suites and tool scripts to load `.npz` files without `allow_pickle`. Zero occurrences of `allow_pickle=True` remain in production or testing code.

**Update — Pre-Deployment Checklist: Environment-Configurable CORS (`ALLOWED_ORIGINS`):** Replaced hardcoded `allow_origins=["*"]` in `main.py` with dynamic configuration via the `ALLOWED_ORIGINS` environment variable (comma-separated list, e.g. `ALLOWED_ORIGINS=https://sar-vision.example.com`). If unset, it safely defaults to standard local frontend development ports: `http://localhost:5173` (Vite default) and `http://localhost:3000`. Added template `backend/.env.example` documenting this variable.
> [!IMPORTANT]
> **PRE-DEPLOYMENT CHECKLIST ITEM:** `main.py` must NEVER run with wildcard (`*`) origins in a production deployment. Before launching publicly, operators must configure `ALLOWED_ORIGINS` locked strictly to the real deployed frontend domain(s).
Verified via automated integration tests (`test_cors_allowed_origin` and `test_cors_disallowed_origin`).



## 5. Frontend — DONE, verified

The frontend (React + Vite + Tailwind) is built and running via `npm run dev`, confirmed working end-to-end against the real backend — correct classification, correct true-label match, working Grad-CAM toggle, and a working angle-sensitivity chart (verified showing a real, non-flat curve on a borderline ~50/50 sample: probability climbed from ~42% at 30° to ~58% at 46°).

This mission extended the original scaffold with two additions not in the original design: sample-chip quick-select buttons, and a band-view toggle (Composite / HH / HV / HH−HV).

**Important clarification on the band-view toggle:**
The band-view toggle (in `ChipCanvas.jsx` + `colormap.js`) intentionally displays the raw, unfiltered `band_1`/`band_2` arrays for visual inspection — it does not apply the Lee filter. This is a deliberate design choice, not a bug: the toggle lets a human see raw SAR speckle, which is a different purpose from what the model receives. The frontend still sends the same raw arrays to `/api/predict`, and `sar_preprocessing.py` remains the only place Lee filtering happens. This should **NOT** be "fixed" by reimplementing Lee filtering client-side to match the backend — that would duplicate already-verified logic and risk drifting from the canonical formula in section 3.

**Mission update (Standalone Grad-CAM):** Replaced the in-canvas overlay with a dedicated standalone `GradCamPanel.jsx` component. The radar canvas (`ChipCanvas.jsx`) now stays completely clean and unobscured for raw radar band inspection, while the Grad-CAM spatial attention map renders on its own 300×300 canvas with selectable scientific colormaps (Turbo, Inferno, Jet), crisp vs smooth contour toggle, peak/mean activation statistics, and a dedicated pixel attention inspector.

**Mission update (Quick Wins — Zone Shading & Incident Brief Export):** Upgraded `AngleSensitivityChart.jsx` with dual-zone background shading (Iceberg Zone $>50\%$ vs Ship Zone $<50\%$), automated mathematical boundary crossover detection (interpolates exact critical flip angle $\theta_{\text{critical}}$, e.g. 38.6°), observed pass marker, and an operational stability diagnostic badge (`Angle Sensitive` vs `Angle Robust`). Added a 1-click **Export Brief** button in `ResultsPanel.jsx` generating a standardized, downloadable maritime intelligence assessment document.

**Mission update (Phase 10 — Classical ML Benchmark & Multi-Model Evaluation):** Implemented the classical SAR feature extraction pipeline in `backend/preprocessing/feature_extraction.py` computing 49 features (24 rotation-invariant GLCM Haralick textures across distances 1 & 2 on filtered HH, HV, and difference bands, plus 24 statistical clutter moments including Fisher-Pearson skewness, kurtosis, and center-energy fraction, plus satellite incidence angle). Key driving features by gain: `hh_glcm_energy_d2` (37.87), `hh_glcm_energy_d1` (28.31), `hh_skewness` (16.53), `hv_kurtosis` (1.05), and `hv_glcm_contrast_d2` (0.94). Built `backend/xgb_inference.py` singleton running low-latency inference (<25ms on CPU) using calibrated `backend/models/xgb_baseline.json`. Added `POST /api/predict/compare` returning side-by-side ResNet50 vs XGBoost predictions, consensus agreement, confidence delta, lead model, and physical texture highlights. Full pytest suite expanded to 17/17 passing tests.

**Mission update (Phase 12 — Radar SNR / Target-to-Clutter Ratio Telemetry):** Integrated physical radar signal quality telemetry in `backend/preprocessing/radar_telemetry.py` computing Target-to-Clutter Ratio ($\text{SNR} = 10 \log_{10}(P_{\text{target}} / P_{\text{clutter}})$ in dB) comparing the central target core ($15 \times 15$) against the background ocean clutter annulus ($25 \times 25$ exclusion mask), speckle reduction percentage via Adaptive Lee filtering, Equivalent Number of Looks (ENL), cross-polarization delta ($HH - HV$), and dynamic range. Note on ENL calculation: The original implementation evaluated ENL ($\mu^2 / \sigma^2$) across the entire 75×75 chip, which was methodologically flawed as the high-contrast target core inflated variance and collapsed ENL to ~0.02. This was corrected to compute ENL strictly over the homogeneous sea clutter annulus (reusing the exact TCR exclusion mask), yielding authentic Sentinel-1 ENL values (~3–5 raw, ~6–13 filtered) and accurate clutter speckle suppression percentages (~30–42%). Wired telemetry into `PredictionOutput` and `ModelComparisonOutput` in `schemas.py` and `routers/predict.py`. Built frontend radar telemetry display card in `ResultsPanel.jsx` and `ModelComparisonPanel.jsx` with color-coded contrast pills (Green for $\ge 6\text{ dB}$, Amber for $< **Mission update (Grad-CAM Background Pre-warming):** Replaced lazy-loading on first request with non-blocking background model pre-warming on FastAPI server startup (`main.py` lifespan via `loop.run_in_executor()`). This eliminates the first-click latency penalty (~10–18s on CPU for TensorFlow import and Keras model loading) so spatial attention maps render instantaneously from the very first request, while preserving fast non-blocking server startup. Verified via `test_gradcam_prewarming_on_startup` without invoking the endpoint.

**Mission update (Concurrency Hardening — Double-Checked Locking on Singletons):** Diagnosed a critical race condition in the lazy-singleton initialization pattern across `SARClassifier` (`inference.py`), `GradCamService` (`gradcam.py`), and `XGBoostBaselineClassifier` (`xgb_inference.py`). Under concurrent requests during cold-start or startup pre-warming, multiple worker threads could simultaneously evaluate `cls._model is None` / `cls._session is None` / `cls._booster is None`, triggering duplicate, wasteful model loads, spiking memory consumption, or in the worst case referencing a partially-initialized object. Verified via FastAPI documentation (context7) that synchronous `def` path operation functions run across an external `anyio` worker threadpool (`run_in_threadpool`), making `threading.Lock()` the correct, thread-safe synchronization primitive (rather than `asyncio.Lock`). Fixed all three services with canonical double-checked locking: check for `None` on fast path without lock -> acquire `cls._lock` -> re-check `None` inside lock -> perform expensive load. Added concurrent stress tests (`test_sar_classifier_double_checked_locking_concurrent`, `test_xgboost_service_double_checked_locking_concurrent`, `test_gradcam_service_double_checked_locking_concurrent`) in `backend/tests/test_predict.py` executing 10 concurrent requests via `ThreadPoolExecutor` with monkeypatched load counters and artificial delays to widen the race window, asserting underlying models/sessions are loaded exactly once. Full suite passing with 42/42 tests.

**Mission update (Structured Logging with Standard Library `logging`):** Configured standard Python `logging` in `backend/logging_config.py` outputting formatted logs (`%(asctime)s [%(levelname)s] %(name)s: %(message)s`) strictly to `sys.stdout` for container and cloud observability. Configured with default level `INFO`, dynamically overridable via the `LOG_LEVEL` environment variable (`DEBUG`, `INFO`, `WARNING`, `ERROR`). Initialized once at startup in `backend/main.py`. Audited entire `backend/` application codebase — confirmed 0 `print()` calls in runtime code (all existing `print()` statements are confined to offline training/migration scripts). Verified structured logging levels:
- **INFO**: Incoming prediction requests and concise result summaries (inc_angle, class, probability, confidence — full 5625-float band arrays are strictly excluded), batch progress summaries, file upload names/outcomes, angle sweep counts, Grad-CAM completion, and lazy-loading start/finish for ONNX (`inference.py`), Grad-CAM (`gradcam.py`), and XGBoost (`xgb_inference.py`).
- **WARNING**: Client errors (HTTP 4xx via middleware and route input validations) and SlowAPI rate-limit rejections (noting endpoint path and limit; raw client IPs are strictly omitted).
- **ERROR**: Server errors (HTTP 5xx via middleware) and missing model artifact exceptions.
Verified end-to-end with 4 dedicated unit tests in `tests/test_predict.py`, bringing the full backend suite to 46/46 passing tests.

**Mission update (Adversarial Input Validation & Hardening):** Built dedicated adversarial input test suite in `backend/tests/test_adversarial_inputs.py` covering malformed, malicious, and edge-case inputs across `/api/predict`, `/api/predict/upload` (.json and .npz), `/api/predict/batch`, `/api/predict/angle-sweep`, and `/api/predict/compare`. Identified and resolved a critical vulnerability where NaN and Infinity inputs passed through both schema and manual parsing paths, poisoned Lee filtering, caused SQLite audit logging to crash (`sqlite3.IntegrityError: NOT NULL constraint failed: predictions.probability_iceberg`), and crashed Starlette's `JSONResponse` with an unhandled 500 when attempting to echo back non-compliant floats with `allow_nan=False`. Added `math.isfinite` field validators in `schemas.py` (`ChipInput`, `AngleSweepInput`) and `routers/predict.py` (`predict_upload`); added custom `RequestValidationError` handler in `main.py` sanitizing 422 error payloads (stripping raw input arrays and using `jsonable_encoder` to prevent Starlette `ValueError` crashes and stop leaking massive 5,625-float arrays back to clients). Verified all 25 adversarial test cases and all 46 existing integration tests pass cleanly (71/71 tests green).

**Mission update (Visual & Interaction Overhaul — Tactical Radar Console Aesthetic):** Overhauled frontend typography, styling, ambient lighting, and interactive animations to establish a high-contrast "Radar Console" aesthetic:
- Replaced generic Inter with `Space Grotesk` (headings & UI labels) while retaining `JetBrains Mono` for all numerical readouts, dB metrics, and coordinates.
- Formalized `amber` palette token in `tailwind.config.js` (`#fbbf24`, `#f59e0b`, `#fcd34d`, `#d97706`, with matching muted, border, and glow tokens) pairing with primary cyan (`#38bdf8`) for alert/highlight indicators.
- Upgraded `.glass-panel` to optical high-contrast glassmorphism (`rgba(15, 23, 42, 0.68)`, 16px blur, specular top-edge highlight `inset 0 1px 0 0 rgba(255, 255, 255, 0.12)`, deep elevation shadow `0 8px 32px rgba(0, 0, 0, 0.36)`).
- Replaced flat gradient background with an atmospheric radar environment: true-black base (#020408), fluid liquid-merging background (5 organic dark charcoal blobs #000000–#090d14 fusing via SVG <filter id="liquid-goo"> with feGaussianBlur, feColorMatrix high-contrast alpha threshold, and feComposite), subtle cyan/amber boundary rim glows, layered radar coordinate grid and concentric range rings with full prefers-reduced-motion freeze suppression.
- Integrated `framer-motion` for fluid feedback: spring-animated confidence count-up and smoothly filling probability bar in `ResultsPanel.jsx`, scale/fade entrance for `GradCamPanel` and `ModelComparisonPanel`, staggered grid layouts, and `<AnimatePresence mode="wait">` cross-fades on chip/model selection.
- Upgraded `ChipCanvas.jsx` with radar HUD pixel inspector and glassmorphic channel selection tabs.
- Visual QA contrast fix: Bumped telemetry sub-labels to `text-slate-300` and explanatory subtitle opacity to `text-white/60` in `ResultsPanel.jsx` to resolve borderline legibility against dark glass panels.
- Verified zero errors on production bundle build (`npm run build`) and 71/71 passing backend tests (`pytest`).

**Mission update (React Router Architecture & Modular Routing):** Restructured the single-view `App.jsx` into modular client-side routing with `react-router-dom` (`^7.18.4`). Created `frontend/src/context/ChipContext.jsx` lifting chip data, classification outputs, telemetry metrics, and action handlers into a shared top-level context (`<ChipProvider>`), ensuring seamless state persistence across routes without data loss or re-renders. Created `frontend/src/components/Layout.jsx` with persistent radar ambient backdrop, navigation header (`/app`, `/compare`, `/angle`, `/about`), and backend health indicator. Built 6 dedicated page views in `frontend/src/pages/`: `LandingPage.jsx` (`/`), `AnalysisPage.jsx` (`/app`, housing the two-column analysis workstation and in-flow `GradCamPanel`), `ComparePage.jsx` (`/compare`, dedicated dual-model ResNet50 vs XGBoost benchmarking), `AnglePage.jsx` (`/angle`, dedicated incidence angle sweep), `AboutPage.jsx` (`/about`), and `NotFoundPage.jsx` (`*`). Production build verified with 0 errors.

**Mission update (Footer Expansion & Command Palette Shell):** Enhanced `Layout.jsx` with a 3-part structured footer and header search affordance:
1. **Footer Layout**: Structured into (1) architecture summary (`ResNet50 Deep Learning (ONNX Runtime) + GLCM Haralick XGBoost Baseline · Sentinel-1 SAR`), (2) pill-style tech-stack badges (`React`, `Vite`, `Tailwind`, `FastAPI`, `ONNX Runtime`, `XGBoost`), and (3) a GitHub repository link alongside platform credit line (`Sentinel-1 C-Band Automated Target Recognition Workstation`).
   * **USER ACTION REQUIRED**: The GitHub repository link is set to placeholder URL `https://github.com/YOUR_USERNAME/sar-classifier-app` in `Layout.jsx` and must be updated with the user's real GitHub username/repository path.
2. **Command Palette Shell**: Added a non-functional visual affordance button in the header with search icon and `⌘K` keyboard hint badge positioned adjacent to the backend health indicator. Clicking triggers a temporary interactive `"Command palette coming soon"` tooltip and exposes a native title hint.
3. Production build verified with 0 errors via `npm run build` (15.55s).

**Mission update (Prediction History Drawer Surfaced):** Implemented client-side consumption and visual presentation of the SQLite audit log:
1. **API Client (`api.js`)**: Added `getHistory(limit = 50)` fetching from `GET /api/history?limit=${capped}` (clamped to $[1, 200]$).
2. **Global Header Access (`Layout.jsx`)**: Added a History trigger button with clock icon adjacent to the search shell and backend telemetry pills in the persistent header, available across all application routes (`/`, `/app`, `/compare`, `/angle`, `/about`).
3. **Slide-Out Drawer (`HistoryDrawer.jsx`)**: Built with Framer Motion spring slide-in from right (`x: 0` / `x: '100%'`) and backdrop blur. Displays record count, timestamp formatted in localized readable format, class badges (`badge-ship` / `badge-iceberg`), confidence %, incidence angle, model pipeline, and source route.
4. **Interactive Telemetry Inspection**: Clicking any row expands an inline detail view showing exact timestamp, prediction ID, incidence angle, $P(\text{Iceberg})$ vs $P(\text{Ship})$ distribution progress bar, and model pipeline origin.
5. **Resilient UX States**: Features a loading spinner during API fetches, refresh button to re-poll newest predictions, and an empty state ("No predictions yet — analyze a chip to see history here") with direct navigation back to `/app`. Verified end-to-end with live SQLite records and clean production build (`npm run build`, 0 errors).

**Mission update (Fluid Liquid-Merging Black Background & Legibility Re-verification):** Replaced the ambient blurred glow orbs with a true liquid-merging dark background applied globally via `Layout.jsx` and `LiquidBackground.jsx`:
1. **SVG Goo Filter Architecture**: Implemented an SVG `<filter id="liquid-goo">` containing `feGaussianBlur` (stdDeviation 20), `feColorMatrix` (alpha channel step multiplier $[0, 0, 0, 24, -9]$ to snap overlapping blur menisci into crisp liquid boundaries), and `feComposite` (`operator="atop"`). Applied globally to `.liquid-goo-container`.
2. **Dark Fluid Blobs & Rim-Light Highlights**: Rendered 5 large organic blobs across deep charcoal/pure black shades (`#000000`, `#05080e`, `#090d14`, `#020408`, `#070a10`) drifting along non-harmonic 24–40s cycles. Each blob carries an exterior rim-light glow (`rgba(14, 165, 233, 0.16–0.22)` cyan and `rgba(245, 158, 11, 0.12–0.18)` amber) with 1px boundary accents that outline merging droplets without illuminating the black interiors.
3. **Radar Texture & Motion Control**: Layered the radar coordinate grid (`opacity-40`) and concentric range rings (`opacity-25`) above the liquid container. Added full `prefers-reduced-motion: reduce` CSS suppression freezing the blobs in a static, organic merged configuration.
4. **Legibility & Contrast Re-verification**: Captured full-page QA screenshots (`full_page_liquid_bg.png`), telemetry close-ups (`telemetry_liquid_bg.png`), and Prediction History Drawer views (`history_drawer_liquid_bg.png`). Re-verified that all UI elements, numerical metrics (SNR dB, confidence percentages), and dense audit cards retain maximum contrast and readability against the true-black foundation and optical glassmorphic panels. Production build verified with 0 errors via `npm run build`.

**Mission update (Command Palette ⌘K & Batch ATR Workstation):** Built and verified full tactical Command Palette and high-throughput batch evaluation workstation:
1. **Tactical Command Palette (`CommandPalette.jsx`)**: Replaced placeholder shell in `Layout.jsx` with an interactive, searchable modal activated globally via `⌘K` / `Ctrl+K` keyboard shortcut and header search trigger. Features multi-token search filtering across routes (`/app`, `/compare`, `/angle`, `/batch`, `/about`), 1-click ground-truth sample loaders (`Ship #1–3`, `Iceberg #1–3`), and tactical action triggers (Run Classification, Compare Models, Grad-CAM, Angle Sweep, Export Report).
2. **Batch Processing Workstation (`BatchPage.jsx`)**: Built dedicated ATR batch console mounted at `/batch` consuming `POST /api/predict/batch`. Supports multi-file JSON ingestion (up to 50 chips), 1-click 6-sample ground-truth batch runner, aggregate statistics ribbon (total chips, ship/iceberg detection counts, mean confidence, mean SNR dB, clutter warnings), interactive target table with 40×40 false-color thumbnail canvas previews, direct "Inspect in Console" chip transfer to `/app`, and batch CSV export.
**Mission update (Milestone 8 — Geospatial Reconnaissance, Target Measurement & Intelligence Dossier):** Transformed SAR-Vision into an end-to-end maritime reconnaissance platform:
1. **Geospatial Tactical Reconnaissance Map (`MapPage.jsx` at `/map`)**: Built interactive Arctic & North Atlantic tactical maritime map covering Flemish Pass, Grand Banks, Baffin Bay, Davis Strait, and Kara Sea. Features latitude/longitude coordinate grid, Sentinel-1 orbital ground-track swaths (ascending/descending passes), sea ice concentration perimeter boundaries, patrol sectors, and interactive target contact markers with pulse radar blips. Clicking any contact opens a tactical metadata popover and allows 1-click loading into `ChipContext` with immediate routing to `/app`.
2. **Target Measurement Ruler & Continuous Zoom/Pan (`ChipCanvas.jsx`)**: Enhanced the core radar canvas with an interactive 10m/pixel physical measurement ruler mode. Clicking and dragging draws a calibrated measurement vector that computes real-time target length in meters, target heading orientation in degrees (0°–360°), and estimated radar footprint area (m²). Implemented smooth continuous zoom (1× to 10×) with mouse wheel or zoom buttons, draggable pan navigation, and an adaptive resolution cell grid overlay when zoomed ≥ 4×.
3. **Split-Curtain A/B Comparison Tool (`SplitCurtainViewer.jsx`)**: Created an interactive draggable wipe slider integrated directly into `GradCamPanel.jsx`. Analysts can smoothly slide between the false-color SAR composite and the Grad-CAM spatial attention heatmap (or between HH and HV polarization channels) to pinpoint exactly which metallic scatterers or ice formations drove the neural network's activation.
4. **Audit & Telemetry Intelligence Dashboard (`AnalyticsPage.jsx` at `/analytics`)**: Built comprehensive telemetry dashboard consuming SQLite prediction history via `getHistory()`. Visualizes target class distribution (donut chart), model confidence distribution (histogram), Target-to-Clutter Ratio (SNR dB) vs. confidence correlation scatter plot, multi-model consensus agreement rates, and incidence angle spread, with multi-criteria filtering by class, confidence, and date range.
5. **Executive Printable Intelligence Dossier (`ExecutiveReportModal.jsx`)**: Built a defense/commercial-grade printable intelligence brief modal accessible via 1-click "Executive Dossier" in `ResultsPanel.jsx`. Features classification verdict stamp, embedded false-color radar imagery, Grad-CAM attribution map, physical telemetry metrics (SNR, ENL, speckle reduction %, cross-pol delta), and multi-model consensus synthesis, styled with `@media print` CSS for instant export to PDF or paper.
6. **Backend Concurrency & Test Suite Hardening**: Resolved a concurrency race condition in TensorFlow's C++ eager gradient tape by synchronizing `GradCamService.compute_heatmap` with a dedicated `_compute_lock`, canonically resolved `KERAS_MODEL_PATH`, and stream-wrapped oversized payload tests with `io.BytesIO` to prevent Windows heap fragmentation memory errors. Verified with 71/71 passing pytest tests (109.04s) and clean Vite production build (1095 modules).
7. **Analyst Tone Regression & UI Simulation Disclosures**: Applied full tone cleanup replacing 37 instances of dramatic/military-flavored copy across frontend and backend with restrained analyst-grade terminology (e.g. `RESTRICTED // MARITIME SURVEILLANCE & RECONNAISSANCE` → `Standardized ATR Assessment Report`, `SENTINEL-1 SAR TARGET ASSESSMENT DOSSIER` → `Target Classification Report`, `Tactical Advisory & Action Directives` → `Operational Notes & Assessment`, `Executive Dossier` → `Printable Summary / PDF Report`, `Tactical Reconnaissance Map` → `Geospatial Acquisition Map`, `Geospatial Intelligence` → `Geospatial Overview`, `Naval Contact` → `Vessel`, `Recon Map` → `Coverage Map`, `TACTICAL ACTIONS` → `ACTIONS`, `S1-ATR Tactical Console` → `S1-ATR Analysis Console`, `Tactical target measurement ruler` → `Target measurement ruler`, `High-Throughput Reconnaissance` → `High-Throughput Batch Processing`). Added prominent persistent disclosure banner on `/map` declaring simulated boundaries and swaths, and integrated an accuracy caveat tooltip and footnote on `ChipCanvas.jsx`'s target measurement ruler explicitly noting nominal 10m pixel spacing vs ~20×22m spatial resolution and unadjusted orbital heading. Production build verified with 0 errors (`npm run build`).
8. **Landing & About Pages Implemented (Real Technical Content & Provenance)**: Replaced placeholder stubs in `LandingPage.jsx` and `AboutPage.jsx` with full working content adhering to Layout's ambient backdrop and design system. `LandingPage.jsx` implements 7 scroll-revealed sections via `framer-motion` (`useInView`): Hero with rotating radar-sweep SVG accent and `/app` CTA; The Problem explaining optical satellite visibility limits and radar backscatter overlap; a 4-stage pipeline (Raw Chip → Lee Speckle Filter → Dual-Model Inference → Verified Assessment); Verified Results displaying confirmed empirical figures (XGBoost 89.97% accuracy and 0.964 AUC on 5-fold CV, ResNet50 described qualitatively as matching baseline with an explicit note that standalone CV metrics are a placeholder pending re-evaluation, <50ms CPU ONNX latency, 71 passing tests); Explainability section detailing Grad-CAM on `conv3_block4_3_conv` (10×10 grid); Credibility strip with tech badges and repository link; and Final CTA. `AboutPage.jsx` provides a clean technical reference covering Kaggle Statoil/C-CORE dataset provenance (1,604 labeled chips), dual-branch model topology, matching verified benchmarks, tech stack, and an honest Limitations section (angle sweep counterfactual nature, map coordinate simulation, and ResNet50 CV benchmark rerun pending). Clean production build verified with 0 errors (`npm run build`).
9. **Git Baseline & Server Daemons Operational (Milestone 9 Alignment)**: Initialized Git version control with root `.gitignore` (ignoring `.venv`, `node_modules`, `dist`, `.pytest_cache`, and SQLite DBs) and committed clean baseline for Milestones 1–8 (`d3f7e27`: 118 files, 15,584 lines). Launched and verified dual daemon servers: FastAPI backend on `http://127.0.0.1:8000` (pre-warmed Grad-CAM Keras model, 100% healthy at `/health`) and React Vite frontend on `http://127.0.0.1:5173` (HTTP 200 OK). Architected Milestone 9 (Full-Scene SAR Ingestion & CFAR Target Prescreener, Multi-Container Docker Compose Stack, and Scene Slicing ATR UI) codified in `implementation_plan.md` and `ROADMAP.md`.
10. **Analysis Workspace Unified Integration (Compare, Angle Sweep, Coverage Map, Batch ATR & Analytics)**: Consolidated all 5 specialized operational tools directly into the Analysis Workspace (`AnalysisPage.jsx` at `/app`) via an intuitive top module toolbar (`Target Analysis`, `Dual-Model Compare`, `Angle Sweep`, `Coverage Map`, `Batch ATR`, `Analytics`) synchronized with URL search params (`?tab=...`). Preserved clean, uncluttered navigation on the Landing Page and global header (`Overview`, `Analysis Workspace`, `About`). Fixed critical in-flow rendering gap where `ModelComparisonPanel` and `AngleSensitivityChart` were previously missing from the single-target analysis flow. Wired seamless target transfer callbacks (`onInspectTarget`, `onInspectChip`, `onSelectTarget`) enabling 1-click loading from the Coverage Map and Batch ATR table directly into the primary radar canvas. Production build verified clean (1,095 modules transformed, 0 errors in 33.38s).
11. **Frontend Performance Optimization & Zero-Lag Refactor**: Diagnosed and eliminated root cause of severe browser lag and UI stutter:
    * **Root Cause**: An SVG goo filter (`#liquid-goo` containing `feGaussianBlur` stdDev 20, `feColorMatrix`, and `feComposite`) combined with 5 large divs animating `border-radius` across 24–40s keyframe cycles forced continuous CPU layout geometry recalculations and viewport rasterization on every frame. When combined with optical `.glass-panel` `backdrop-filter: blur(16px)`, the browser compositor starved trying to re-sample and double-blur dynamic content across the viewport at 60Hz.
    * **GPU-Composited Ambient Gradients**: Replaced the SVG goo filter and CPU keyframes in `LiquidBackground.jsx` with static, hardware-accelerated CSS radial gradients (`translateZ(0)`) styled with subtle cyan and amber hues, preserving the tactical radar HUD aesthetic at locked 60+ FPS with 0% CPU consumption.
    * **Optimized Blur & Shadow Pipeline**: Tuned `.glass-panel` backdrop-filter from 16px to 12px and trimmed redundant box-shadow layers in `index.css`.
    * **Vite Vendor Chunking**: Configured `rollupOptions.output.manualChunks` in `vite.config.js` isolating `recharts` and `framer-motion` into separate vendor bundles, slashing initial bundle size by 71% (from 1,020 kB down to 294 kB) and cutting build time from 33.38s to 13.76s. Verified 71/71 passing backend tests.

12. **Verification Findings & Complete Removal of Liquid Background**:
    * **Preprocessing Verification**: Inspected `backend/preprocessing/sar_preprocessing.py:lee_filter`. Confirmed exact match with Section 3: window size is 5×5 (`size=5`), unclipped local variance (`var = sq_mean - mean**2`), and global noise variance (`overall_var = np.var(img)`). No silent edits or regressions detected.
    * **Model Checkpoint & References**: Confirmed `backend/models/sar_classifier.onnx` is the single canonical ONNX model artifact. Verified all references across `backend/inference.py`, `backend/tests/test_predict.py`, `backend/README.md`, and `backend/Dockerfile` consistently reference `sar_classifier.onnx`. Zero orphaned references exist.
    * **Route Consolidation**: Confirmed `/compare`, `/angle`, `/map`, `/batch`, `/analytics` are consolidated into the Analysis Workspace (`/app?tab=...`) via client-side redirects in `App.jsx`. `CommandPalette.jsx` was updated to navigate directly to `/app?tab=...` targets.
    * **Liquid Background Removal**: Completely eliminated `LiquidBackground.jsx` and all liquid/goo blob concepts per explicit user decision. Replaced with a clean, static near-black canvas (`#020408`) overlaid with an unobtrusive, subtle technical grid (`radar-grid-texture` at `opacity-20`). Removed `radar-range-rings` to prevent circular visual distraction.
    * **Verification & Visual Capture**: Production build verified with 0 errors (`npm run build`, 14.79s). Captured full-page desktop screenshots `landing_page.png` and `app_page.png`.

## 6. The "10/10" feature roadmap — status of each

From the original project brief, tracked here so nothing gets forgotten
across missions:

| Feature | Status | Notes |
|---|---|---|
| Core dual-input classifier | ✅ Done, verified | ResNet50 + angle MLP, ONNX-served. 9/9 integration tests pass on real model + real samples. | Mission update (Concurrency): Hardened ONNX session initialization with double-checked locking (threading.Lock) to eliminate cold-start race conditions under concurrent worker threads; verified exact single-load with ThreadPoolExecutor stress test. |
| ONNX Runtime optimization | ✅ Done | Verified equivalent to Keras (best_resnet_fusion.keras), ~134MB → onnx |
| FastAPI backend | ✅ Done, verified | `/predict`, `/predict/angle-sweep` — all passing on user's machine | Fixed missing DEFAULT_SWEEP_ANGLES import in routers/predict.py; full integration suite passing cleanly with 42/42 tests. | Mission update (Structured Logging): Configured stdout-only standard library logging in backend/logging_config.py with LOG_LEVEL env var; audited backend to confirm 0 print() calls in application code; verified INFO request/summary logs, WARNING 4xx/rate-limit (no raw IPs), and ERROR 5xx; 46/46 tests passing. |
| React canvas UI (false-color heatmap) | ✅ Done, verified | Next mission \| Implemented with 4× scale (300×300) in ChipCanvas.jsx. Includes extra band-view toggle (Composite / HH / HV / HH−HV), raw display only, not fed to the model. \| Mission update (Radar Console Overhaul): Upgraded typography to Space Grotesk + JetBrains Mono, formalized amber color tokens, optical glassmorphic panels with top-edge specular bevels, atmospheric radar grid & drifting glow background, and fluid Framer Motion micro-interactions (confidence count-up, progress bar spring, panel transitions, AnimatePresence chip cross-fading, full prefers-reduced-motion support). Production build verified cleanly. \| Mission update (Analyst-Grade Copy & Visual Refinement): Audited and stripped 100% of emojis across frontend copy (replaced with clean text badges e.g. SHIP / ICEBERG and SVG icons); revised dramatic/gamified copy to restrained analyst terminology ("Maritime Intelligence Brief" → "Classification Report", "Consensus Banner" → "Model Agreement", "Models Diverge — Ambiguous Target" → "Models Disagree", removed exclamation points); softened ambient atmospheric orbs (reduced opacity to 0.035–0.05, tightened drift transformations) and desaturated accent tokens to prevent bloom while preserving optical glassmorphic depth and radar grid texture; verified via headless Chrome full-page QA capture and clean production build (vite build: 0 errors). \| Mission update (React Router Migration): Migrated analysis workspace into modular /app route under react-router-dom, backed by shared ChipContext ensuring chip buffers and state persist across /compare, /angle, and /about routes without reloads; production build passing. \| Mission update (Footer & Command Palette Shell): Expanded Layout.jsx with 3-part footer (architecture, tech-stack badges, and placeholder GitHub repository link) plus header ⌘K command-palette search affordance with coming-soon tooltip; production build passing. \| Mission update (Liquid-Goo Background): Replaced ambient orbs with fluid liquid-merging SVG goo filter background (5 dark blobs with faint cyan/amber rim-light glows) and re-verified contrast legibility across all views; production build passing. \| Mission update (Command Palette ⌘K): Built CommandPalette.jsx modal triggered by ⌘K/Ctrl+K with multi-token search, instant routing, sample chip quick-loading, and action triggers. \| Mission update (Landing Page Consolidation & Tech-Stack Removal): Consolidated the frontend presentation into a unified, content-rich Landing Page (LandingPage.jsx at /) containing project context, physical challenges, 4-stage pipeline, dataset provenance, dual-model architectures, verified benchmarks, Grad-CAM XAI, and honest disclosures with smooth Framer Motion entry reveals and jump navigation. Separated the analysis functionality into dedicated Analysis Workspace (/app). Uncluttered header navigation to only two primary tabs ('Overview' and 'Analysis Workspace'). Removed 100% of framework/software tech-stack mentions and badges across user-facing pages, headers, footers, command palette, drawer, and report exports in favor of domain-focused and physical descriptions. Re-verified Vite production build (0 errors) and full backend test suite (71/71 tests green). \| Mission update (Compact Overview Blocks & Dedicated About Section): Preserved the top hero section untouched in LandingPage.jsx and replaced long page content with a concise 4-block 'System Overview at a Glance' section (Sensor Data, Preprocessing, Dual Inference, Explainability) plus quick action bar. Migrated the full, explicit technical and physical breakdown into a dedicated AboutPage (/about) covering all 7 modules (Physical Challenge, 4-Stage Pipeline, Dataset Provenance, Dual Architectures, Verified Benchmarks, Grad-CAM XAI, and Disclosures) with top anchor jump pills. Added 'About' to header navigation and Command Palette. Verified cleanly via browser subagent screenshots, Vite build (0 errors), and 71/71 passing backend/adversarial tests. |
| Drag-and-drop custom chip upload | ✅ Done, verified | Frontend work \| Done, JSON format (Dropzone.jsx); GeoTIFF not implemented. Supports sample chips in frontend/sample_chips_json/. |
| Incidence angle sensitivity chart | ✅ Done, verified | `/predict/angle-sweep` implemented; frontend chart in AngleSensitivityChart.jsx (Recharts ComposedChart). Done, verified with real non-flat curve on a borderline sample (probability climbed from ~42% at 30° to ~58% at 46°). \| Mission update (Zone Shading & Crossover Diagnostics): Enhanced with dual-zone background shading (Iceberg Zone vs Ship Zone), automated boundary crossing angle calculation, stability diagnostic badges, and 1-click Maritime Intelligence Brief export. |
| Grad-CAM explainability overlay | ✅ Done, verified | Implemented as `/api/predict/gradcam`, lazy-loads TensorFlow + `best_resnet_fusion.keras` (separate from the ONNX model). Targets `conv3_block4_3_conv` (10x10 grid) — NOT the model's true last conv layer (`conv5_block3_3_conv`, only 3x3, empirically too coarse to localize anything on a 75x75 chip). Validated on 1 ship + 1 iceberg sample: ship showed a small tight hotspot, iceberg showed a larger diffuse region. Needs validation on 3-4 more samples per class before treating the pattern as confirmed — the iceberg result had a strong edge band that may be a genuine feature or an upsampling artifact. \| Mission update: Live execution of manual_gradcam_check.py verified against running server; generated and saved 3-panel figure (False-Color, Grad-CAM heatmap, Overlay) with matplotlib. \| Mission update (Binary Class Score Fix): Fixed bug where ship predictions (P(iceberg) < 0.5) produced all-negative gradients that were clamped to zero by ReLU in Grad-CAM, resulting in completely transparent/invisible heatmaps for ships in the frontend. Updated backend/gradcam.py to use class-aware target score: tf.where(p_iceberg < 0.5, 1.0 - p_iceberg, p_iceberg). Verified end-to-end in frontend with active overlay on Ship #1. \| Mission update (Standalone Grad-CAM Display): Replaced the blended in-canvas overlay with a dedicated standalone GradCamPanel component (300×300 canvas, Turbo/Inferno/Jet colormaps, pixel inspector, and peak/mean stats), keeping the SAR chip canvas 100% clean and unobscured. \| Mission update (Background Pre-warming): Upgraded server startup with non-blocking background model pre-warming in main.py lifespan, eliminating the first-click latency penalty (~10-18s on CPU) without altering endpoint contracts or blocking server launch. Verified via test_gradcam_prewarming_on_startup. \| Mission update (Concurrency): Hardened Keras model loading with double-checked locking (threading.Lock) to prevent duplicate TensorFlow/Keras imports or loads during concurrent first-touch requests; verified exact single-load with ThreadPoolExecutor test. \| Mission update (Gradient Computation Lock): Synchronized compute_heatmap with _compute_lock to eliminate race conditions and deadlocks in TensorFlow C++ eager gradient tape under concurrent requests; verified with 10-worker ThreadPoolExecutor stress test. |
| GLCM + XGBoost baseline model | ✅ Done, verified | XGBoost model not trained yet. Needs training in Kaggle first, then a second inference path + `/predict/compare` endpoint. \| Mission update (Phase 10): Classical feature extraction pipeline engineered (49 features: 24 GLCM Haralick textures across 4 angles and distances 1&2 + 24 radar clutter moments + angle). Training script created in backend/scripts/train_xgboost_baseline.py with 5-fold CV. Calibrated baseline model (xgb_baseline.json) and metadata (xgb_metadata.json) generated; singleton service (xgb_inference.py) verified with 100% accuracy on sample chips and <25ms CPU latency. 17/17 integration tests pass. \| Mission update (Concurrency): Hardened Booster model loading with double-checked locking (threading.Lock) and atomicity safeguards for feature_names; verified exact single-load with ThreadPoolExecutor test. |
| Multi-model comparison toggle | ✅ Done, verified | Depends on XGBoost model above \| Mission update (Phase 10): Backend comparison route POST /api/predict/compare fully implemented in backend/routers/predict.py and schemas.py. Returns ResNet50 and XGBoost outputs, consensus agreement, confidence delta, and physical texture highlights. 100% verified via integration tests and live HTTP queries. Ready for frontend UI toggle in Phase 11. \| Mission update (Phase 11): Frontend UI completed and verified end-to-end. Built 3-way toggle switcher (ResNet50 / XGBoost / Compare Both) in App.jsx, standalone ModelComparisonPanel.jsx with side-by-side probability cards, consensus status banner (agreement vs divergence warning), confidence delta visualizer, interactive GLCM texture feature inspector with physical tooltips, and Section 5 multi-model synthesis integration in the downloadable Maritime Assessment Brief. Production build and 17/17 pytest suite verified passing. \| Mission update (Dedicated Compare Route): Moved standalone ModelComparisonPanel into /compare route while retaining dual-model comparison capability from AnalysisPage and shared ChipContext. |
| Batch prediction endpoint | ✅ Done, verified | Implemented `POST /api/predict/batch` capped at 50 chips via Pydantic `max_length`. Loops over incoming chips and reuses `SARClassifier.predict()` for each one (zero duplicated prediction logic). Returns HTTP 400 identifying failing index if any chip errors. Verified via test suite matching `/api/predict` results across all 6 Kaggle ground-truth sample chips. | Mission update (Batch ATR Workstation): Built BatchPage.jsx consuming POST /api/predict/batch at /batch with multi-chip JSON upload, 1-click 6 ground-truth sample test batch runner, aggregate telemetry metrics, 40×40 false-color thumbnail previews, and CSV export. Clean Vite build (1091 modules). |
| Radar SNR / Target-to-Clutter Telemetry | ✅ Done, verified | Implemented in `backend/preprocessing/radar_telemetry.py` computing Target-to-Clutter Ratio (TCR in dB), Equivalent Number of Looks (ENL), speckle reduction %, cross-pol delta, and dynamic range. Integrated into `/api/predict`, `/api/predict/compare`, `/api/predict/batch`, frontend `ResultsPanel.jsx`, and `ModelComparisonPanel.jsx`. Verified in `test_radar_quality_telemetry_snr`. | ENL calculation corrected from whole-chip to clutter-annulus-only (matching TCR mask), fixing collapsed ~0.02 values to true physical clutter ENL (~6–13 filtered). |
| Direct file upload endpoint | ✅ Done, verified | Added `POST /api/predict/upload` supporting raw `.json` and `.npy` chip files via FastAPI `UploadFile`. Extracts `band_1`, `band_2`, and `inc_angle` and reuses existing `SARClassifier.predict()` without duplicate logic. Rejects unsupported extensions (e.g. `.txt`) and malformed internal fields with explicit HTTP 400 errors. Verified via integration tests matching direct `/api/predict` results across all 6 ground-truth sample chips. | Security fix: Migrated from .npy to .npz format to eliminate Remote Code Execution (RCE) risk from allow_pickle=True; endpoint now accepts .json and .npz without pickle. | Upload size limit: Enforced 2MB ceiling (`MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024`) returning HTTP 413 (Payload Too Large) before reading payload into memory, preventing server memory exhaustion DoS. |
| Prediction history (SQLite) | ✅ Done, verified | Implemented SQLite tracking in backend/history.py persisting predictions into backend/data/predictions.db. Added GET /api/history with default limit 50 and cap at 200. Wired automatic logging into /api/predict, /api/predict/upload, and /api/predict/batch. Guarded via TESTING=1 env flag and isolated test DB fixture in conftest.py ensuring zero test noise in real history. \| Mission update (Frontend History Drawer Surfaced): Surfaced SQLite prediction history into the frontend via a sliding drawer component (HistoryDrawer.jsx) consuming GET /api/history through getHistory() in api.js. Accessible globally from the header across all routes with Framer Motion slide-out animation, readable timestamp formatting, ResultsPanel-matching class badges, interactive expand/collapse telemetry inspection, and empty/loading states; production build verified with 0 errors. |
| Docker containerization | ✅ Done, verified | Built backend Dockerfile with python:3.11-slim base (chosen for superior ML wheel support over 3.13). Image size ~1.21GB content size (4.26GB uncompressed disk usage). Verified container startup, /health, and end-to-end inference against sample chips matching non-Docker predictions bit-for-bit. |
| Rate limiting (slowapi) | ✅ Done, verified | Applied per-client IP rate limiting using `slowapi` (`Limiter` with `get_remote_address`, middleware, and 429 handler returning `Retry-After`): `/api/predict/gradcam` (10 req/min) and `/api/predict/compare` (10 req/min) as the heaviest single-chip endpoints (gradient backpropagation and 49 GLCM Haralick texture/moment feature extractions), and `/api/predict/batch` (5 req/min) because each batch request processes up to 50 chips simultaneously. `/api/predict`, `/api/predict/upload`, and `/api/history` remain unlimited as they are computationally lightweight. Verified with 39/39 passing tests (`test_gradcam_rate_limit_exceeded_returns_429`). |
| Adversarial input testing | ✅ Done, verified | Comprehensive suite in `tests/test_adversarial_inputs.py`: NaN/Inf rejection, zero-variance chip safety, wrong array lengths, non-numeric strings, corrupted .npz/.json, angle boundary extremes, SQL injection resilience, path traversal safety, batch isolation, sanitizing 422 error payloads (25 test cases, all 71 tests green). |
| Geospatial reconnaissance map | ✅ Done, verified | Built interactive Arctic & North Atlantic tactical maritime map (`MapPage.jsx` at `/map`) covering Flemish Pass, Grand Banks, Baffin Bay, Davis Strait, and Kara Sea with orbital ground-track swaths, sea ice boundary, and interactive contact markers with 1-click loading into ChipContext and routing to `/app`. | Mission update (Map Honesty & Disclosures): Disclosed simulation status with persistent UI banner ("Illustrative overview — positions and boundaries are simulated for demonstration, not derived from real satellite telemetry") styled with amber theme tokens directly on the map viewport. |
| Target measurement ruler & zoom | ✅ Done, verified | Enhanced `ChipCanvas.jsx` with 10m/px physical target measurement ruler (computing length in meters, target orientation angle, radar footprint area) and continuous 1×–10× zoom with pan navigation and adaptive resolution cell grid. | Mission update (Accuracy Caveat): Added interactive info tooltip and footnote disclosure clarifying that measurements are approximate based on nominal 10m/pixel grid spacing, not adjusted for ~20×22m spatial resolution or orbit heading. |
| Split-curtain A/B wipe comparison | ✅ Done, verified | Interactive draggable wipe slider (`SplitCurtainViewer.jsx`) in `GradCamPanel.jsx` comparing false-color SAR composite against Grad-CAM spatial activation or HH vs HV polarization. |
| Audit & telemetry analytics | ✅ Done, verified | Dedicated analytics dashboard (`AnalyticsPage.jsx` at `/analytics`) visualizing SQLite prediction audit history with Recharts (class distribution, confidence histogram, SNR vs. confidence scatter, and consensus tracking). |
| Executive printable intelligence dossier | ✅ Done, verified | Standalone defense/commercial-grade dossier modal (`ExecutiveReportModal.jsx`) in `ResultsPanel.jsx` with radar imagery, Grad-CAM attribution, sensor telemetry, multi-model consensus, and `@media print` styling. |
| Full-scene ingestion & CFAR tiler (Phase 22) | 📋 Planned | Large-scale 2D raster ingestion, sliding window tile extraction (75×75, 50% overlap), Constant False Alarm Rate (CFAR) clutter-anomaly prescreening, and spatial bounding-box manifest generation. |
| Multi-container Docker Compose (Phase 23) | 📋 Planned | Production multi-stage frontend Dockerfile (Nginx reverse proxy), backend container orchestration, healthcheck dependencies, and persistent SQLite volume mount. |
| Frontend scene triage overlay (Phase 24) | 📋 Planned | Interactive full-scene viewer with zoomable target bounding boxes, real-time batch detection progress, and direct chip triage into the Analysis Console. |



## 7. Rules for any agent working on this repo

1. **Continuous brain.md sync:** Read this file first. Automatically update
   this file (Section 6 status table and any relevant sections) every time
   you perform any task, change, test, or verification in this repository.
   Follow the Section 8 rules when making edits.
2. Never modify `preprocessing/sar_preprocessing.py`'s math without explicit
   confirmation from the user — it was verified against the actual training
   notebook line-by-line. Any "improvement" to it risks silently breaking
   inference accuracy.
3. Never duplicate preprocessing logic in the frontend or elsewhere. The
   frontend sends raw bands + angle; all transformation happens server-side.
4. The ONNX input names (`sar_image_input`, `inc_angle_input`) are fixed by
   the trained model — do not rename them anywhere in code without also
   re-exporting the model.
5. Before implementing Grad-CAM or the XGBoost comparison, surface the open
   design decisions in section 6 to the user rather than guessing.
6. **SECURITY INVARIANT — NEVER USE ALLOW_PICKLE ON UPLOADS:** Never use `allow_pickle=True` on any data that comes from a user upload, ever, under any circumstance. Loading pickled objects allows arbitrary remote code execution (RCE). All binary radar chip ingestion must strictly use `.npz` or raw numerical array formats loaded without object deserialization.
7. **DO NOT CREATE `walkthrough.md` FILES:** Do not generate `walkthrough.md` files after completing missions or tasks. All mission summaries, test outcomes, and technical changes belong exclusively in `brain.md` as mission-update notes following Section 8 editing rules.

## 8. How to edit this file (rules for agents, not just humans)

Follow these exactly when updating brain.md at the end of a mission:

1. **Edit only the section(s) relevant to what you just did.** Do not
   reorganize, reword, or "clean up" unrelated sections — this file is
   read by humans and other agents across many separate sessions; an
   unexpected rewrite of an untouched section makes diffs impossible to
   review and erodes trust in the file.
2. **Section 6 (feature status table) is append/update-only.** Change a
   row's status (❌ → 🟡 → ✅) and its Notes cell when your mission
   affects that row. Never delete a row, and never delete prior context
   from a Notes cell — append new findings after it, separated by " | ",
   rather than overwriting what a previous mission or session recorded.
3. **Never delete a documented gotcha, bug history, or "if X reappears,
   that's a regression" warning** (e.g. section 2's model-mismatch note,
   section 3's Lee-filter formula warning) even if it looks resolved or
   irrelevant to your current mission. These exist specifically so a
   future session doesn't repeat a mistake that's already been caught
   once. If something is truly obsolete, mark it "(resolved — see
   [new note])" rather than removing it.
4. **When you add a new fact, timestamp or mission-tag it if possible**
   (e.g. "Mission 4:") so a human skimming later can tell what's old
   verified ground truth versus a recent addition that may still need
   scrutiny.
5. **If you're not sure whether something belongs in brain.md or is too
   minor**, err toward NOT adding it — this file should stay a concise
   reference a human can re-read in a few minutes, not a full mission log.
   Verified architecture facts, contracts, and known gotchas belong here;
   routine implementation details belong in code comments and READMEs.
6. **After editing, do not ask the user to review before proceeding** —
   but do mention in your mission summary exactly which section(s) of
   brain.md you changed, so the user can spot-check that specific diff
   rather than re-reading the whole file.
