# QualityDoc

QualityDoc is a local-first TISAX documentation tracker built as:

- `frontend/`: React + TypeScript + Vite PWA
- `backend/`: FastAPI + SQLite API and local file opener

## What v1 includes

- Built-in TISAX starter catalog with editable defaults
- Document register with owners, review dates, notes, tags, and external file links
- Local document library scan for Word, Excel, and PDF files kept outside the app
- Smart completeness checks for `missing`, `needs_owner`, `due_soon`, and `overdue`
- Dashboard summaries, CSV export, and browser notifications
- Local backend that can serve the built frontend for simple single-machine use

## Run in development

Backend:

```powershell
cd backend
python -m uvicorn app.main:app --reload
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://127.0.0.1:8000`.

## Local library workflow

This repo now supports scanning a local evidence folder such as:

```text
Total dokument 240326
```

Recommended first-run flow:

1. Start the backend and frontend locally.
2. Open `Settings` and set `Document root path` to the full folder path.
3. Save settings.
4. Open `Library` and run `Scan library`.
5. Review scanned files, save a TISAX mapping where needed, then use `Create record`.

The scan stores metadata only:

- relative path
- parsed title guess
- file date from filename when available
- revision from filename when available
- extension, size, modified time

The original files remain in place and are never copied into Git.

## GitHub Pages demo

GitHub Pages cannot run the FastAPI backend, SQLite database, or Windows file opener.
For remote review, the repo now includes a Pages-specific frontend build that runs in browser-only demo mode with seeded TISAX sample data and browser local storage.

Local preview of the Pages build:

```powershell
cd frontend
npm run build:pages
npm run preview
```

GitHub Actions deployment:

- Workflow file: `.github/workflows/deploy-pages.yml`
- Trigger: push to `main` or manual `workflow_dispatch`
- Output: static Pages demo from `frontend/dist`

Repository setting to confirm once:

- In GitHub repository settings, open `Pages`
- Set `Build and deployment` source to `GitHub Actions`

## Run tests

Backend:

```powershell
cd backend
python -m pytest
```

Frontend:

```powershell
cd frontend
npm run test:run
npm run lint
npm run build
npm run build:pages
```

## Local production-style run

Build the frontend first:

```powershell
cd frontend
npm run build
```

Then run the backend:

```powershell
cd backend
python -m uvicorn app.main:app
```

The FastAPI app will serve the built frontend from `frontend/dist`.

## Notes

- Default SQLite database path: `data/qualitydoc.db`
- Override the database location with `QUALITYDOC_DB_URL`
- The built-in TISAX catalog is a practical starter set, not a compliance guarantee
- The GitHub Pages deployment is a frontend-only demo, not the live local application
- `Total dokument 240326/` is ignored by Git and intended for local-only use
