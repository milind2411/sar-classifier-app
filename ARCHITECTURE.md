# ARCHITECTURE.md — SAR-Vision

This file documents *intent*, not implementation. For what's actually been
built and verified, see `brain.md`. For where files live, see the file tree.
This file exists so an agent understands *why* the system is shaped the way
it is, and doesn't "fix" a decision that was made on purpose.

---

## 1 | What's in the system?

This project has an unusual fourth layer most web apps don't: an **offline
training stage** that lives entirely outside the running application.

```
Kaggle (offline, external)  →  Model Artifacts  →  Backend Services  →  API  →  Frontend
   training notebook            .onnx / .keras       inference.py       FastAPI    React
   (not part of runtime)        .json (xgboost)       gradcam.py         routers/   Vite+Tailwind
                                                       xgboost_service.py
                                                       radar_telemetry.py
                                                       history.py (→ SQLite)
```

**Kaggle is not a live pipeline.** There is no automated retraining, no
scheduled job, no CI step that touches Kaggle. A human trains a model,
manually exports it, manually copies the file into `backend/models/`. If a
task implies "the model should update automatically," that's not how this
system works — flag it rather than build toward it silently.

The frontend never talks to a database or a model file directly. Everything
goes: **Client → API (routers/predict.py) → Services → Model artifacts or SQLite.**

---

## 2 | Who's responsible for what?

Every responsibility has exactly one owner. If a task seems to need touching
two of these for one job, that's a signal to stop and check, not proceed.

| Responsibility | Owner | Notes |
|---|---|---|
| Raw radar bands → model input tensor | `preprocessing/sar_preprocessing.py` | The ONLY place Lee filtering happens. Every consumer imports from here — nothing reimplements it. |
| Deep learning inference (ResNet50) | `inference.py` | ONNX only. Fast path. No TensorFlow. |
| Explainability (Grad-CAM) | `gradcam.py` | Owns the ONLY TensorFlow/Keras dependency in the backend. Lazy-loaded + pre-warmed at startup. |
| Classical ML baseline | `xgboost_service.py` + `glcm_features.py` | Imports `lee_filter` from preprocessing rather than redefining it — this is what makes the comparison against ResNet50 fair. |
| Radar physics diagnostics | `preprocessing/radar_telemetry.py` | Independent of any ML model — TCR/ENL/speckle metrics are pure signal-processing, computed the same regardless of which model ran. |
| Prediction persistence | `history.py` | Owns all SQLite access. Nothing else touches `predictions.db` directly. |
| HTTP contract, request orchestration | `routers/predict.py` | Thin. Validates input, calls exactly one service, shapes the response. Contains no math. |
| API request/response shapes | `schemas.py` | The only place a Pydantic model gets defined. |
| Chip visualization (raw, for humans) | `frontend/.../ChipCanvas.jsx` + `colormap.js` | Deliberately shows unfiltered data — see section 3. |
| Prediction display (single) | `ResultsPanel.jsx` | |
| Multi-model display | `ModelComparisonPanel.jsx` | |
| State + API orchestration | `App.jsx` | The only place that calls `api.js`. Components receive data as props, they don't fetch their own. |

---

## 3 | Why is it built this way?

The reasoning that isn't visible from reading the code alone:

- **ONNX for serving, Keras only for Grad-CAM.** ONNX Runtime is fast and
  lightweight (~100MB); TensorFlow is ~500MB and slow to import. Grad-CAM
  genuinely needs TensorFlow (it needs real gradients, which ONNX doesn't
  expose), so it's isolated to its own lazy-loaded module rather than
  pulling TensorFlow into the main request path.

- **`conv3_block4_3_conv` for Grad-CAM, not the model's actual last conv
  layer.** On a 75×75 chip, ResNet50's true final conv layer collapses to a
  3×3 spatial grid — empirically confirmed too coarse to localize anything
  (it produced a smooth gradient, not a real heatmap). This layer choice
  looks arbitrary without that context; it isn't.

- **The frontend's band-view toggle shows RAW, unfiltered radar data —
  deliberately not the same data the model sees.** Its purpose is letting a
  human inspect real SAR speckle. The model always receives Lee-filtered
  input via the backend. These are two different, legitimate purposes for
  two different audiences (human eye vs. model). Do not "fix" this by
  making the frontend match the backend's filtering — that would eliminate
  the raw-inspection view's entire reason for existing.

- **`best_resnet_fusion.keras` is the single canonical model source**, not
  because it's special, but because a prior session accidentally derived
  `sar_classifier.onnx` from a *different* checkpoint (`model.h5`) than what
  Grad-CAM used, and the two silently disagreed by ~15% on the same input
  until caught. Every model artifact in `backend/models/` must trace back
  to this one checkpoint. If this is ever unclear, treat it as a blocking
  question, not an assumption to make.

- **`.npz`, never `.npy` + `allow_pickle=True`, for any user-facing file
  format.** Pickle deserialization of untrusted input is a real
  remote-code-execution risk, not a theoretical one. This is a hard rule,
  not a style preference — see section 6.

- **`brain.md` exists because Kaggle sessions are ephemeral and Antigravity
  sessions get interrupted.** Model checkpoints, fold splits, and even
  `df_train` itself have been lost to restarts multiple times during this
  project. `brain.md` is the durable memory that survives what the runtime
  environment doesn't.

---

## 4 | What's allowed to touch what?

```
Frontend (React)
      ↓  (HTTP only, via api.js)
routers/predict.py   (validation + orchestration, no math)
      ↓
Services (inference.py, gradcam.py, xgboost_service.py,
          glcm_features.py, radar_telemetry.py, history.py)
      ↓
preprocessing/sar_preprocessing.py   (shared foundation — everything sits on this)
      ↓
Model artifacts (.onnx, .keras, .json) / SQLite (predictions.db)
```

**Explicitly banned:**
- The frontend must never implement Lee filtering, GLCM extraction, or any
  model-input math. It sends raw bands and an angle; the backend does 100%
  of the transformation.
- `routers/predict.py` must never contain filtering, feature extraction, or
  model-calling logic inline — it calls exactly one service function and
  shapes the response.
- No service may redefine or duplicate `lee_filter` (or any function
  already in `sar_preprocessing.py`). Import it. If it doesn't do what a
  new use case needs, extend the shared module — don't fork it.
- No new model backend gets wired in without confirming which checkpoint
  file it's built from and recording that in `brain.md`.
- Heavy dependencies (TensorFlow, XGBoost, scikit-image) must never be
  imported at module load time in a way that slows down `/api/predict`'s
  path — lazy-load, following the existing singleton pattern.

---

## 5 | How does data actually move?

**Single prediction (JSON):**
`Dropzone.jsx` → `App.jsx` calls `api.js:predict()` → `POST /api/predict`
→ `routers/predict.py` validates `ChipInput` → `SARClassifier.predict()`
→ `sar_preprocessing.process_chip_for_inference()` → ONNX `session.run()`
→ `radar_telemetry.compute_radar_quality_metrics()` attached →
`history.log_prediction()` → `PredictionOutput` returned → `ResultsPanel.jsx`
renders.

**File upload:** Same path from `SARClassifier.predict()` onward — the
upload endpoint only handles parsing `.json`/`.npz` into the same shape,
never a separate prediction implementation.

**Grad-CAM:** Toggle clicked → `POST /api/predict/gradcam` →
`GradCamService` (Keras model, pre-warmed at server startup, not on first
request) → `build_composite_tensor()` (same preprocessing module) →
gradient tape against `conv3_block4_3_conv` → 75×75 heatmap → frontend
composites it onto `ChipCanvas` using its own colormap — the backend
returns raw numbers, never a rendered image.

**Compare:** `POST /api/predict/compare` runs `SARClassifier.predict()`
(ONNX) and `XGBoostService.predict()` (GLCM features, same `lee_filter`)
independently, returns both plus an agreement flag. Neither path knows
about the other — the router is the only place they're combined.

**Model update (offline, human-in-the-loop, NOT automated):** Kaggle
notebook → `df_train` → `lee_filter` / `build_composite_tensor` → train →
export `.keras` + convert to `.onnx` (verified via a PASS diff check
against a real sample) → human downloads the file → human uploads it into
`backend/models/` → `brain.md` updated by hand or by an agent mission. At
no point does the running backend reach out to Kaggle itself.

---

## 6 | What can never break?

- `sar_preprocessing.py`'s Lee filter formula must never change without
  re-verifying against the original Kaggle training notebook. It uses the
  *global* variance of the raw image (`np.var(img)`) as the noise estimate
  — not a local/mean-of-local-variance approximation. This exact detail
  was wrong once already and silently would have shipped bad predictions.
- **No file from an untrusted source (any user upload) is ever loaded with
  `allow_pickle=True`.** `.npz` only, for anything user-facing. This is
  non-negotiable, not a preference.
- The ONNX input names (`sar_image_input`, `inc_angle_input`) never change
  without re-exporting the model — they're baked into the graph.
- Every model artifact in `backend/models/` traces back to the same
  canonical checkpoint (`best_resnet_fusion.keras`). Two artifacts silently
  representing different trained weights is a category of bug that already
  happened once and cost real debugging time.
- Tests never write to the real `predictions.db` — the isolated fixture in
  `conftest.py` plus the `TESTING` env-var guard are both required, not
  redundant with each other.
- Radar telemetry metrics (TCR, ENL) that assume a homogeneous region must
  only ever be computed over the clutter annulus mask, never the whole
  chip — mixing target and background into one statistic breaks the math's
  core assumption, not just its accuracy.
- **The lazy singleton pattern for model loading must strictly use double-checked locking (`threading.Lock()`).**
  Under concurrent traffic during cold-start, multiple simultaneous requests can both observe `cls._model is None`
  and trigger duplicate, memory-intensive initializations (or worse, briefly reference a partially-initialized object).
  Because FastAPI path operation functions are declared with standard synchronous `def`, requests run in a worker
  threadpool where `threading.Lock()` is required (fast-path null check -> acquire lock -> inside null check -> load).
- **Finite numeric validation and error sanitization on all client inputs:** All entry points accepting floating-point arrays or values (both Pydantic schemas and manual upload parsers) must explicitly enforce `math.isfinite` to reject NaN/Infinity before numerical operations, Lee filtering, or database logging. Furthermore, FastAPI's `RequestValidationError` handler in `main.py` must sanitize error detail payloads to strip raw input arrays (`input`) before serialization — this prevents Starlette `JSONResponse` crashes (`allow_nan=False` `ValueError`), avoids echoing massive band arrays (5,625 floats) back to clients, and ensures clean HTTP 422 responses.
- **Any simulated, mocked, or illustrative data displayed in the UI must be clearly disclosed to the viewer at the point of display — not just noted internally.** This is the same principle that already governs the Stitch landing-page content; now it's codified as a permanent rule for any future feature, not just this one instance.
- CORS, upload size limits, and rate limiting must be locked down before
  any public deployment — currently open for local development only.

---

## 7 | Where does new code belong?

- **A new preprocessing transform** → `preprocessing/sar_preprocessing.py`
  (or a clearly-named sibling module if it's a genuinely different concern,
  like `radar_telemetry.py` is) — exposed as an importable function, never
  copy-pasted into a consumer.
- **A new model backend** → its own `{name}_service.py` at the backend
  root, following the lazy-singleton pattern in `gradcam.py` or
  `xgboost_service.py` if it has any heavy dependency.
- **A new HTTP endpoint** → `routers/predict.py` if it's about prediction;
  a new router file if it's a genuinely different domain (e.g. a future
  auth or user-management concern). Route functions stay thin.
- **A new response/request shape** → `schemas.py`.
- **A new frontend visual** → its own component under `src/components/`,
  receiving data as props from `App.jsx`. Components don't call `fetch()`
  or `api.js` directly.
- **A new physics/quality metric** → `radar_telemetry.py`, reusing the
  existing clutter mask where the metric requires a homogeneous region.

---

## 8 | When does Claude stop and ask?

Stop, name the conflict, show what it affects, and suggest the smallest
fix that doesn't break the rule — rather than proceeding — whenever a task
would:

- Change `sar_preprocessing.py`'s filtering math
- Change which model file is treated as canonical
- Rename or reshape the ONNX input contract
- Reintroduce `allow_pickle=True` on any user-facing path
- Duplicate logic that already has a home (e.g. reimplementing filtering in
  a new service, or in the frontend)
- Skip test isolation for the history database
- Have the frontend compute model-input features itself
- Put business logic or math directly inside a route handler
- Compute a homogeneous-region radar metric (TCR, ENL) over a
  non-homogeneous area
- Introduce a second way of doing something this project already has an
  established pattern for (a second preprocessing path, a second db access
  point, a second model-loading pattern that doesn't follow the lazy
  singleton convention)

If none of these apply, proceed normally — this list exists to catch the
cases where silent "improvement" would actually be regression.
