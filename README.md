# ML-Integrated Learning Management System (LMS)

This project is an Outcome-Based Education (OBE) focused LMS with OCR-assisted marks extraction.

It is composed of four major parts:

- `client/`: React frontend for admin, teacher, and student dashboards.
- `server/`: Node.js + Express API with MongoDB persistence and role-based access control.
- `ml_server/`: FastAPI OCR service for local/self-hosted inference.
- `ml_server_huggingface/`: FastAPI OCR service variant optimized for Hugging Face Spaces deployment.

The system supports regular LMS workflows (courses, users, outcomes, marks, results) and adds asynchronous OCR processing via Redis + Bull + worker routing.

## Table of Contents

- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
	- [Startup Flow (Backend)](#startup-flow-backend)
- [Core Functional Areas](#core-functional-areas)
- [Backend API Modules (`server/routes`)](#backend-api-modules-serverroutes)
- [OCR Processing Pipeline](#ocr-processing-pipeline)
- [ML Services](#ml-services)
	- [OCR Model Stack](#ocr-model-stack)
	- [Extraction Strategy](#extraction-strategy)
- [Frontend Overview (`client`)](#frontend-overview-client)
- [Data Model Highlights (`server/models`)](#data-model-highlights-servermodels)
- [Configuration](#configuration)
- [Running Locally](#running-locally)
- [Testing](#testing)
- [Reproducing the Benchmark](#reproducing-the-benchmark)
- [Scripts](#scripts)
- [Security Notes](#security-notes)
- [Project Structure](#project-structure)
- [Notes](#notes)

## Tech Stack

| Technology | Usage |
|---|---|
| React 18 | Frontend SPA (`client/`) |
| Node.js + Express | Core backend API (`server/`) |
| MongoDB + Mongoose | Application data store |
| Redis + Bull | OCR job queue and background processing |
| Python + FastAPI | OCR microservices (`ml_server`, `ml_server_huggingface`) |
| PaddleOCR + PaddleX | Table detection, cell detection, text recognition |
| Multer + ExcelJS/XLSX | File uploads and spreadsheet import/export |

---

## System Architecture

```text
React Client (client)
	|
	| HTTP / JWT
	v
Express API Server (server)
	|\
	| \__ MongoDB (users, courses, outcomes, attainments, results)
	|
	\____ Redis + Bull Queue (OCR jobs)
				 |
				 v
		  OCR Worker (server/workers/ocrWorker.js)
				 |
				 | HTTP + X-API-Key
				 v
FastAPI OCR Service (ml_server or ml_server_huggingface)
```

### Startup Flow (Backend)

The backend (`server/server.js`) initializes in this sequence:

1. Loads environment variables and security middleware (`helmet`, `cors`, payload limits).
2. Connects to MongoDB and runs course outcome index migration.
3. Initializes worker registry and OCR worker.
4. Starts OCR job cleanup and stuck-job monitoring.
5. Registers route modules under `/api/*`.
6. Starts the HTTP server (default `PORT=5000`).

---

## Core Functional Areas

### 1. User and Access Management

- JWT-based authentication (`/api/auth/login`).
- Teacher self-registration with OTP email verification and admin approval.
- Student onboarding via admin Excel import.
- Role-based access controls for `admin`, `teacher`, `student`.

### 2. Curriculum and OBE Data

- Course CRUD and assignment to teachers/batches.
- Course Outcomes (CO) and Program Outcomes (PO) management.
- CO-PO mapping matrix generation and PO attainment calculations.
- Course profile and CLO updates.

### 3. Assessment and Attainment

- CT, Assignment, Lab Activity, Section A workflows in attainment routes.
- Term exam marks capture per student and course.
- Batch/term result computation and publish/unpublish controls.

### 4. OCR-Assisted Marks Extraction

- Teacher/admin submits OCR jobs with image payload.
- Jobs are queued in Redis/Bull and processed asynchronously.
- Worker selects healthy ML endpoint and sends image for OCR.
- Parsed marks are returned and stored as job output for retrieval.

---

## Backend API Modules (`server/routes`)

| Module | Base Path | Purpose |
|---|---|---|
| `authRoutes.js` | `/api/auth` | Register/login, OTP verify/resend, forgot/reset password, profile |
| `adminRoutes.js` | `/api/admin` | User approval/status, bulk imports/exports, teacher/batch assignment |
| `courseRoutes.js` | `/api/courses` | Course CRUD, OBE validation, curriculum queries, enrolled students |
| `courseOutcomeRoutes.js` | `/api/courses` and `/api/course-outcomes` | CO CRUD and course profile data |
| `programOutcomeRoutes.js` | `/api/program-outcomes` | PO listing and admin update |
| `copoMappingRoutes.js` | `/api` | CO-PO mappings, matrix and PO attainment |
| `courseProposalRoutes.js` | `/api/course-proposals` | Teacher proposals and admin review |
| `termExamMarksRoutes.js` | `/api/term-exam-marks` | Save/get/delete exam marks |
| `attainmentRoutes.js` | `/api/attainment` | CT/Assignment/Lab/Section A workflows and sheet data |
| `courseProfileRoutes.js` | `/api/course-profile` | Course profile read/update |
| `ocrRoutes.js` | `/api/ocr` | OCR submit, status, queue status, job list/delete |
| `workerRoutes.js` | `/api/workers` | OCR worker registry and health management |
| `resultRoutes.js` | `/api/results` | Compute/publish/unpublish and student/batch result views |

---

## OCR Processing Pipeline

1. `POST /api/ocr/submit` accepts a base64 `data:image/...` payload.
2. Backend creates job metadata and enqueues work in Bull.
3. `server/workers/ocrWorker.js` pulls job(s) with configurable concurrency.
4. Worker selects healthy ML server from registry and forwards image via `multipart/form-data`.
5. ML server runs table detection, cell detection, and OCR recognition.
6. Worker stores extracted marks + confidence and marks job as completed.
7. Client polls `/api/ocr/status/:jobId` for progress/result.
8. The teacher checks the pre-filled marks grid and saves. Some cells are highlighted until the teacher changes them. The ML service returns these cells in `review`:
   - marks recognised with a score below 0.90;
   - digits rejected below the 0.55 threshold;
   - every row from a row label that could not be read, when marks follow it, because those rows may have moved up by one.

Security characteristics:

- Rejects non-data-URI image URLs (SSRF mitigation).
- Payload size limits in API server.
- ML endpoint protected by `X-API-Key`.

---

## ML Services

Both `ml_server/app.py` and `ml_server_huggingface/app.py` expose:

- `GET /`: service info
- `GET /health`: health and model state
- `POST /api/extract-marks`: OCR extraction (requires `X-API-Key`)

### OCR Model Stack

| Model | Role |
|---|---|
| `PP-DocLayout_plus-L` | layout/table detection |
| `RT-DETR-L_wired_table_cell_det` | cell detection |
| `en_PP-OCRv5_mobile_rec` | text recognition |

All three are pretrained PaddlePaddle models used without fine-tuning. On first start, PaddleX downloads them from Hugging Face into `~/.paddlex/official_models/`.

#### Model versions used for the published benchmark

The benchmark results were produced with `paddleocr==3.3.2`, `paddlex==3.3.12` and `paddlepaddle==3.0.0` (CPU), using these model revisions:

| Model | Hugging Face revision | SHA-256 of `inference.pdiparams` |
|---|---|---|
| [`PaddlePaddle/PP-DocLayout_plus-L`](https://huggingface.co/PaddlePaddle/PP-DocLayout_plus-L) | `aa52b8528c84f9b1a34ac3a88fe0e576edb9d11d` | `24ca3e2e442164505e250deef59f7ee9a54ea12dd32875c9cd6155d959dc97da` |
| [`PaddlePaddle/RT-DETR-L_wired_table_cell_det`](https://huggingface.co/PaddlePaddle/RT-DETR-L_wired_table_cell_det) | `e2bd53c06b3a815d86acbf5c6779dada58819cfe` | `357321c2845f0a035e8d118622649685a3cdb89d28b09a64e45a5a3df7a9fedc` |
| [`PaddlePaddle/en_PP-OCRv5_mobile_rec`](https://huggingface.co/PaddlePaddle/en_PP-OCRv5_mobile_rec) | `267c36e24c331595590fe7bd72bde2436fd286f2` | `3ec8a97ed6cefe8568d3e2ee90bb193299b566a7661aa4fd52d224b96b59f66b` |

To check a local copy, compare `sha256sum ~/.paddlex/official_models/<model>/inference.pdiparams` with the table. To fetch exactly these revisions, download each repository at the listed revision (for example `huggingface-cli download PaddlePaddle/en_PP-OCRv5_mobile_rec --revision 267c36e24c331595590fe7bd72bde2436fd286f2 --local-dir ~/.paddlex/official_models/en_PP-OCRv5_mobile_rec`) before starting the service.

### Extraction Strategy

- Detect table region.
- Detect cell boxes.
- Run multiple preprocessing variants per cell.
- Pick best-confidence recognition output.
- Parse into row labels (`a..g`) and question columns (`1..8`).
- Flag the cells the teacher should check (`review` in the response; see step 8 of the OCR processing pipeline).

---

## Frontend Overview (`client`)

The React app (`client/src/App.js`) provides:

- Public routes: home, register, login, forgot-password.
- Protected profile route.
- Role-based dashboards: admin, teacher, student.
- OBE views: attainment and course profile pages.

Key frontend capabilities:

- Token-aware API communication with axios interceptor.
- Attainment sheet interaction and mark entry workflows.
- OCR job submission/status integration.
- Export and reporting support using Excel/PDF-related libraries.

---

## Data Model Highlights (`server/models`)

- `User`: auth, role, approval, profile metadata.
- `Course`: curriculum metadata, assigned teachers, batch assignment.
- `CourseOutcome`: CO definitions with soft-delete support.
- `ProgramOutcome`: PO reference set (PO_A to PO_L).
- `COPOMapping`: CO to PO linkage.
- `CTAttainment`, `AssignmentAttainment`, `LabActivityAttainment`, `TermExamAttainment`: attainment layer.
- `TermExamMarks`: raw marks storage.
- `TermResult`: computed academic result storage.

---

## Configuration

Environment variables are documented in `server/.env.example`.

Important keys:

- `PORT`, `NODE_ENV`
- `MONGO_URI`
- `JWT_SECRET`, `JWT_EXPIRE`
- `REDIS_URL`
- `ML_SERVER_URL` and optionally `ML_WORKER_URLS`
- `OCR_CONCURRENCY`
- Email settings (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, ...)
- `CLIENT_URL`

---

## Running Locally

### Prerequisites

- Node.js 20 or later (Docker images use Node 20; development used Node 22)
- MongoDB
- Redis
- Python 3.10

### 1) Start Redis

```bash
# Docker example
docker run -d -p 6379:6379 --name redis redis:latest
```

### 2) Start ML Service

```bash
cd ml_server
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

### 3) Start Backend API

```bash
cd server
npm install
npm run seed-po   # one-time reference data seeding
npm run dev
```

### 4) Start Frontend

```bash
cd client
npm install
npm start
```

### 5) Run with Docker (Client and Server Separately)

Start backend:

```bash
cd server
docker compose up -d
```

Start frontend:

```bash
cd client
docker compose up -d
```

Notes:

- The first run will build images automatically from each service Dockerfile.
- Keep Redis and MongoDB running and reachable from the backend container.
- If backend is not exposed on `localhost:5000` from your browser context, update `REACT_APP_API_URL` accordingly.

---

## Testing

The project includes an automated testing suite focused on backend stability and core LMS workflows. The test environment is isolated to prevent unintended side effects on local development or production data.

### Backend Testing (`server/`)

The backend test suite uses **Jest** and **Supertest** to validate API endpoints, middleware, and Mongoose models without requiring a live database or external services.

- **In-Memory Database:** Tests use `mongodb-memory-server` (`__tests__/setup/db.js`), ensuring a clean database state for each test suite without mutating the real MongoDB instance.
- **Service Mocking:** External connections like Redis (`ioredis`) and Bull queues are manually mocked in `server/__mocks__/` to prevent hanging processes, open handles, or unwanted background jobs during test execution. 
- **Execution:** Operations like `app.listen`, scheduled cleanup jobs, and background workers are dynamically bypassed when running with `NODE_ENV=test`.

#### Current Test Suites & Coverage
The backend tests are designed to cover both base models and integration behavior for core features:

- **User Model Tests (`models/User.test.js`):** Used to validate schema constraints, require role designations, verify data encryptions, and assure no invalid entries can be saved to the database.
- **Authentication Integration (`controllers/authController.test.js`):** Used to verify the system login flows. It ensures passwords are valid, correct JWT tokens are generated, and role-based metadata is assigned directly upon login.
- **Attainment Integration (`controllers/attainmentController.test.js`):** Used to test the most complex module: Core OBE Business Logic. It verifies that Teachers have proper role permissions, evaluates saving structures for Continuous Assessment (CT/Assignments) marks, and successfully intercepts/purges data cache pipelines during resets.
- **Course Integration (`controllers/courseController.test.js`):** Used to validate curriculum creation. Ensures that only System Admins can create courses, parses specific course codes (e.g. Sessional/Theory odd-even digit constraints), processes KPA arrays, and enforces appropriate reading roles.
- **Program Outcome Integration (`controllers/programOutcomeController.test.js`):** Used to check PO listing and lookup by code, and that only an authenticated admin can update a PO.
- **Worker Registry Unit Tests (`utils/workerRegistry.test.js`):** Used to check OCR worker routing on failure: a worker whose connection fails is excluded at once, readmitted after its next successful health check, and kept out while health checks keep failing.
- **Curriculum Validation Unit Tests (`utils/curriculumValidation.test.js`):** Used to validate OBE consistency helpers (CO validation, PO coverage aggregation, semester-year consistency, assessment plan checks, and CO-PO matrix generation).
- **Token Utility Unit Tests (`utils/tokenUtils.test.js`):** Used to validate secure token generation and deterministic SHA-256 hashing behavior for auth/password-reset flows.
- **CO Attainment Unit Tests (`utils/coAttainmentCalc.test.js`):** Used to check course-level theory CO attainment: Section B allocations, COs assessed in both sections, allocations limited to attempted questions, and agreement with the per-student values shown in the CO Attainment sheet.

To run the backend tests and generate a coverage report:
```bash
cd server
npm test
```

To run only utility unit tests:
```bash
cd server
npx jest __tests__/utils
```

### Frontend Testing (`client/`)

The frontend test suite uses the default Create React App Jest setup (`react-scripts test`) and currently covers core client-side utilities and auth guard helpers.

- **Helpers Utility Tests (`src/__tests__/utils/helpers.js`):** Validates retry behavior, debounce/throttle timing logic, safe JSON parsing fallback, and async batch processing.
- **Token Storage Utility Tests (`src/__tests__/utils/tokenUtils.js`):** Validates token save/read/clear behavior in `localStorage`.
- **Protected Route Helper Tests (`src/__tests__/components/ProtectedRoute.js`):** Validates authentication checks, user parsing, role extraction, and logout cleanup behavior.

To run frontend tests:
```bash
cd client
npm test
```

### Continuous Integration

GitHub Actions (`.github/workflows/ci.yml`) runs the server and client test suites on every push to `main` and on every pull request. The server suites need no `.env`: `__tests__/setup/env.js` supplies test values for the JWT settings.

---

## Reproducing the Benchmark

The scripts in `ml_server/benchmark/` and `server/benchmark/` produce the OCR and throughput results reported in the OBESynK paper. All results were produced with release `v1.0.2`, on CPU only.

### Data

The benchmark dataset is archived on Zenodo: https://doi.org/10.5281/zenodo.23387173. It contains:

| Path | Content |
|---|---|
| `images/image_01.jpg` … `image_100.jpg` | 100 phone photographs of the answer-script marks table |
| `ground_truth.json` | Transcribed marks for every cell (rows a–g × 4 questions per image) |
| `images.csv` | Section, split (`dev`: `image_01`–`30`, one writer; `test`: `image_31`–`100`, seven other writers) and writer ID |

Images 66–100 rely on their EXIF Orientation tag. The scripts apply it; any other tool must too.

### Setup

```bash
cd ml_server
python -m venv venv
venv/Scripts/activate          # Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
```

Use the model revisions listed under [Model versions used for the published benchmark](#model-versions-used-for-the-published-benchmark). The direct-OCR baseline also uses PaddleOCR's default text-detection model, `PP-OCRv5_server_det`, which is downloaded on its first run. The commands below are run from `ml_server/`, with `DATA` set to the unpacked dataset and `RUNS` to an output folder:

```bash
DATA=../obesynk_benchmark
RUNS=../benchmark_runs
```

### OCR accuracy, ablation and processing time

Each configuration is run once over all 100 images. The run folder names are the ones `analyze.py` expects.

```bash
python benchmark/run_ocr_benchmark.py --config full        --images $DATA/images --gt $DATA/ground_truth.json --out $RUNS/A0_full
python benchmark/run_ocr_benchmark.py --config full_client --images $DATA/images --gt $DATA/ground_truth.json --out $RUNS/A0c_full_client
python benchmark/run_ocr_benchmark.py --config no_layout   --images $DATA/images --gt $DATA/ground_truth.json --out $RUNS/A1_no_layout
python benchmark/run_ocr_benchmark.py --config direct_ocr  --images $DATA/images --gt $DATA/ground_truth.json --out $RUNS/B1_direct_ocr

python benchmark/analyze.py --runs $RUNS --gt $DATA/ground_truth.json --manifest $DATA/images.csv
```

| Configuration | Description |
|---|---|
| `full` | The production pipeline in `app.py`, unchanged |
| `full_client` | The same pipeline on the image as the web client uploads it (orientation applied, longest side 1920 px, JPEG quality 0.92) |
| `no_layout` | The production pipeline without the layout crop |
| `direct_ocr` | Baseline: PaddleOCR text detection and the same recognizer on the whole photograph, with each value assigned to the nearest row and column of the printed grid (`baselines.py`) |

`analyze.py` writes to `$RUNS/analysis/`:
- `RESULTS.md`: all tables.
- `main_table.csv`: accuracy, precision, recall, F1, Wilson intervals, McNemar tests and time per script, for each configuration and split. The single-variant rows (v1–v4) are rebuilt offline from the `full` log, using the same selection rule and the same 0.55 threshold.
- `a0_error_cells.csv`: every error of the full pipeline, with its cause.
- `per_writer.csv`, `per_image.csv` and `threshold_sweep.csv`: the per-writer, per-image and threshold breakdowns.

Processing times depend on the hardware. The paper's times were measured on an Intel Core i3-1215U laptop with 16 GB RAM. The extracted marks were identical on the two laptops tested.

### Throughput and failure handling

These runs use the real submission path: API, Bull queue and OCR worker pool. They need:
- a local Redis on `127.0.0.1:6379` (database 7 is used and flushed);
- `npm install` in `server/`.

Each run starts its own in-memory MongoDB, ML workers and API, with random credentials. It never reads `server/.env`.

```bash
# The 30 development images as the web client uploads them
python benchmark/make_client_inputs.py --images $DATA/images --out $RUNS/client_inputs

# One and two workers on this machine (the paper ran each configuration twice: _r1, _r2)
python benchmark/run_scalability.py --workers 1 --images $RUNS/client_inputs --gt $DATA/ground_truth.json --out $RUNS/scalability/L1_r1
python benchmark/run_scalability.py --workers 2 --images $RUNS/client_inputs --gt $DATA/ground_truth.json --out $RUNS/scalability/L2_r1

# Failure test: worker 2 is stopped 60 s into the burst and restarted 120 s later
python benchmark/run_scalability.py --workers 2 --images $RUNS/client_inputs --gt $DATA/ground_truth.json --out $RUNS/scalability/F2_r1 \
    --kill-worker 2 --kill-at 60 --restart-at 180

# Second machine: start a worker there first (same requirements and models):
#   ML_API_KEY=<key> uvicorn app:app --host 0.0.0.0 --port 8000
python benchmark/run_scalability.py --workers 1 --remote-workers http://<host>:8000 --api-key <key> \
    --images $RUNS/client_inputs --gt $DATA/ground_truth.json --out $RUNS/scalability/M2_r1

python benchmark/summarize_scalability.py --runs $RUNS/scalability --a0 $RUNS/A0c_full_client
```

`summarize_scalability.py` writes `SCALABILITY.md` and `runs_summary.json`. They contain throughput, queue waiting time, processing time, CPU use and peak memory per process, failed and retried jobs, and a check that the marks returned under load equal the single-image `full_client` run. To record CPU and memory on a remote worker, run `benchmark/monitor_worker.py --out <file.csv>` on that machine during the burst.

`measure_resources.py` and `summarize_resources.py` measure the CPU and memory of a single configuration outside the queue; see the usage notes at the top of each script.

---

## Scripts

### Server (`server/package.json`)

- `npm run dev` - start backend with nodemon
- `npm start` - start backend in normal mode
- `npm run create-admin` - create admin account helper
- `npm run seed-po` - seed program outcomes
- `npm test` - run Jest with coverage
- `npm run test:watch` - watch-mode tests

### Client (`client/package.json`)

- `npm start` - start React dev server
- `npm run build` - build production bundle
- `npm test` - run frontend tests

---

## Security Notes

- Helmet headers and CORS restrictions are enabled in backend bootstrap.
- Auth routes include rate limiting for login/OTP/registration abuse resistance.
- OCR input is constrained to base64 image data URIs.
- Production log behavior suppresses verbose stack trace leakage.
- ML service requires API key verification for extraction endpoint.

---

## Project Structure

```text
client/                  # React frontend
server/                  # Express API + MongoDB + Redis/Bull workers
ml_server/               # FastAPI OCR service (local/general deployment)
ml_server_huggingface/   # FastAPI OCR service (HF Spaces deployment)
README.md                # This document
```

---

## Notes

- Seed Program Outcomes before production/first full use: `npm run seed-po`.
- OCR reliability depends on input image quality and table alignment.
- For multi-worker ML deployment, configure `ML_WORKER_URLS` and tune `OCR_CONCURRENCY`.