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

- `PP-DocLayout_plus-L`: layout/table detection
- `RT-DETR-L_wired_table_cell_det`: cell detection
- `en_PP-OCRv5_mobile_rec`: text recognition

### Extraction Strategy

- Detect table region.
- Detect cell boxes.
- Run multiple preprocessing variants per cell.
- Pick best-confidence recognition output.
- Parse into row labels (`a..g`) and question columns (`1..8`).

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

- Node.js (v14+)
- MongoDB
- Redis
- Python 3.8+

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

To run the backend tests and generate a coverage report:
```bash
cd server
npm test
```

---

## Scripts

### Server (`server/package.json`)

- `npm run dev` - start backend with nodemon
- `npm start` - start backend in normal mode
- `npm run create-admin` - create admin account helper
- `npm run seed-po` - seed program outcomes
- `npm test` - run Jest with coverage
- `npm run test:watch` - watch-mode tests
- `npm run test:redis` - Redis connectivity test

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