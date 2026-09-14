# OilSetu — Infrastructure Project Progress Monitoring (Prototype)

Role-based frontend prototype that bridges planned L1–L6 schedules (Primavera / MS Project)
with messy field execution data — daily reports, voice notes, site diaries — through a
**mocked AI reconciliation layer** (canned responses behind a service interface).
The real AI plugs in later without UI changes.

> **Prototype note:** there is no real NLP / OCR / ASR / fuzzy matching here. Every
> "AI" result is simulated frontend data, clearly tagged in the UI.

## Live demo

https://avalanche-ag.github.io/Oilsetu/

## Roles & demo accounts

| Account | Role | UI language |
|---|---|---|
| Priya Sharma | Manager / Admin (desktop-first) | English |
| Rajesh Kumar | Supervisor (mobile-first) | Hindi |
| Amit Singh | Supervisor (mobile-first) | Hindi |

Just pick an account on the login screen — authentication is simulated.

## What it does

- **Manager:** create projects, upload baseline schedules (simulated parse), explore the
  L1–L6 hierarchy, assign work packages, review flagged AI matches (70–89% band only —
  ≥90% auto-applies), monitor delays & risks, chat with supervisors on activity-linked
  threads, audit trail, historical insights.
- **Supervisor:** view assigned work, submit daily progress as text / voice (simulated) /
  document, see the mock-AI interpretation before submitting, track history, answer
  manager questions — in English or Hindi.

## Quick start

```bash
npm install
npm run dev        
npm run typecheck  # strict TS must pass
npm run build      # production build to dist/
```

## Stack

React 18 + TypeScript + Vite · Tailwind CSS · React Router (hash routing for static hosting) ·
TanStack Query + service layer (`src/services/api.ts`) · Zustand · react-i18next (en/hi) ·
Recharts · fixtures .
