# Integration branch — full-stack OilSetu (real backend, no mocks)

Branch layout: `main` (frontend) + `backend` (FastAPI) + `ai.nlp` (AI scripts) merged
here. `main` stays deploy-clean; nothing here auto-deploys. The frontend on this branch
talks to the backend for EVERYTHING — the localStorage mock is only a fallback for the
Analyze preview when the backend is unreachable.

## Run the full stack locally

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
./node_modules/.bin/esbuild scripts/dump-seed.ts --bundle --platform=node \
  --format=cjs --outfile=/tmp/dump-seed.cjs && node /tmp/dump-seed.cjs
backend/.venv/bin/python backend/seed_oilsetu.py
set -a; source .env; set +a
backend/.venv/bin/uvicorn backend.app.main:app --port 8000
```

```bash
npm run dev                  # frontend on :5173, backend on :8000
```

`scripts/dump-seed.ts` exports the frontend seed (activities + full demo story) to
gitignored `data/*.json`. `backend/seed_oilsetu.py` wipes the domain tables and reloads
the full story (3 users, CDU-3 project, 61 activities, assignments, reports, matches,
threads, delays, 25 audit events, 5 workers, attendance history, and worker-task assignments).
Reset anytime from the manager UI (Reset demo data) or
`POST /api/v1/dev/reset`.

## Demo credentials (local only)

All passwords are `oilsetu123` (pbkdf2-hashed in SQLite):

| Who | Email | Role |
|-----|-------|------|
| Priya Sharma | priya.sharma@oilindia.in | manager (Project Planner) |
| Rajesh Kumar | rajesh.kumar@oilindia.in | supervisor |
| Amit Singh | amit.singh@oilindia.in | supervisor |
| Kiran Iyer | kiran.iyer@oilindia.in | worker |
| Manoj Verma | manoj.verma@oilindia.in | worker |
| Amit Dsouza | amit.dsouza@oilindia.in | worker |

The login page's email/password form is the real JWT login; the Supervisor/Planner/Worker
buttons are one-click demo logins (dev-only `POST /auth/demo-login`).

## What is real

- Auth: JWT (12h) + pbkdf2 passwords; manager-only guards on projects, assignments,
  schedule import/generate, reconciliation decisions.
- Projects, activities (with hierarchy, assignees, actuals, server-side rollups),
  assignments, reports + submit flow (AUTO-apply, delays, audits, rollups),
  reconciliation decisions (incl. ASK→thread), threads/messages, delays + at-risk,
  audit trail, dashboard aggregates, computed insights.
- Worker management: supervisors can view the worker roster, mark a worker absent,
  manually allocate an L6 task, and trigger automatic same-discipline reallocation.
  The algorithm excludes absent/PTO/leave workers, chooses lowest effective workload,
  then highest availability, and records every change in the audit trail.
- Worker portal: worker accounts have a view-only dashboard for assigned tasks and
  attendance history. Workers can mark only their own dates as PTO/LEAVE; they cannot
  alter tasks or another worker's attendance.
- Schedule upload parses a real `.xlsx` (`POST /projects/{id}/schedule/import`); the
  wizard's sample-file button generates a synthetic tree
  (`POST /projects/{id}/schedule/generate`).
- Analyze (`POST /api/v1/analyze`): Gemini extraction (`GEMINI_MODEL`, default
  `gemini-3.6-flash`) + terminology normalization + embedding match against
  `data/oilsetu_schedule.xlsx`, bands still applied client-side from 90/70.
  Needs `GEMINI_API_KEY` in gitignored `.env`, loaded via `set -a; source .env`.

## Backend changes made on this branch

- New tables: users, projects, assignments, daily_reports, report_entries, ai_matches,
  conversation_threads, messages, delay_events, audit_events, workers, worker_attendance,
  worker_task_assignments; new columns on
  schedule_activities (`project_id`, `parent_id`, `assignee_id`, actuals, rollup fields).
- New routers: auth, projects (+import/generate), assignments, reports (+submit/decide),
  workers (+attendance/worker assignments/dashboard), threads, delays, audit, dashboard,
  insights, dev. CORS for :5173.
- Fixes: `requirements.txt` (+pinned torch 2.2.2 set for x86_64 mac), lazy embedding
  import, `None → ""` 500 fix, `POST /execution-reports` null-date fix.
- `ai/` scripts vendored under `ai/` (unwired except via `/analyze`); photo verification
  still needs site photos; Hindi reports fall back to mock extraction.

## Known gaps

- `execution_reports`/`visual_proofs` (teammate tables) untouched; every Analyze click
  still persists rows there by backend design (local only).
- No rate limiting, no HTTPS, dev JWT secret default — local dev only.
- Never commit `.env`, `data/`, or `raw data/`.
