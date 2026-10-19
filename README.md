# SAR-Vision: Sentinel-1 Automated Target Recognition

<!-- TODO: Once the GitHub repository is published, replace USERNAME/REPO with actual repository path to activate the CI badge -->
[![CI](https://github.com/USERNAME/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/USERNAME/REPO/actions/workflows/ci.yml)

Automated Target Recognition (ATR) system classifying Synthetic Aperture Radar (SAR) satellite imagery into vessel (ship) or iceberg contacts. Dual-branch ResNet50 neural network and classical Haralick GLCM + XGBoost baseline trained on Sentinel-1 C-band dual-polarization (HH/HV) imagery.

## System Components

- **Backend (`/backend`)**: FastAPI inference service with ONNX Runtime, XGBoost, and optional TensorFlow/Keras Grad-CAM spatial explainability.
- **Frontend (`/frontend`)**: React SPA with false-color radar composite visualization, interactive target measurement ruler, split-curtain wipe comparison, batch processing, and telemetry audit analytics.

## CI Workflow

Continuous Integration runs on every push and pull request via [`.github/workflows/ci.yml`](.github/workflows/ci.yml):
- **Backend Job**: Python 3.11 on `ubuntu-latest`, pinned dependencies from `backend/requirements.lock`, automated pytest suite with CI-safe model skip guards.
- **Frontend Job**: Node LTS on `ubuntu-latest`, `npm ci`, and clean production bundle validation (`npm run build`).

## Quickstart

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.lock
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
