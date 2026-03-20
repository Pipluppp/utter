# Task 4: Documentation Cleanup

## Problem

Several docs still describe FastAPI + SQLite as the "current" stack, milestones as "planned" work, and architecture as "target state" — all of which shipped on 2026-02-17. This creates confusion for anyone reading the docs about what's actually running.

## Audit results

### STALE — needs content update

| File | Issue |
|------|-------|
| `/README.md` | Lines 15-16: "Legacy FastAPI app (being replaced)" — already replaced. Lines 64-74: "Legacy backend (optional)" section implies FastAPI is usable. |
| `/AGENTS.md` | Lines 3-10: Describes "Python FastAPI backend" as current. Setup instructions reference FastAPI. Should describe Supabase Edge Functions. |
| `/docs/features.md` | Lines 37-78: "Current Technology Stack" table lists FastAPI + SQLite. Architecture diagram shows old stack. |
| `/docs/milestone.md` | Uses future tense ("We want", "This is the plan") for completed work. "Current state" section describes FastAPI/SQLite. |
| `/docs/backend.md` | Written as a migration *plan* (2026-02-05). The plan is now the implemented reality. Framing is outdated. |
| `/docs/database.md` | Same as backend.md — describes schema as "design goals" when it's now deployed. |

### OBSOLETE — archive or delete

These are pre-migration planning/research docs. The work they describe is complete. They have historical value but should not be in the main doc tree where someone might mistake them for current guidance.

| Directory | Content | Recommendation |
|-----------|---------|----------------|
| `docs/2026-01-17/` | Early project planning | Move to `docs/_archive/` |
| `docs/2026-01-18-modal-integration-plan/` | Modal research | Move to `docs/_archive/` |
| `docs/2026-01-19/` | Early planning | Move to `docs/_archive/` |
| `docs/2026-01-22/` | Smart editor, dark mode planning | Move to `docs/_archive/` |
| `docs/2026-01-26-qwen3-tts-modal-deployment/` | Modal deployment guides | Move to `docs/_archive/` |
| `docs/2026-02-02/` | Pre-edge deployment planning | Move to `docs/_archive/` |
| `docs/2026-02-03/` | React refactor planning | Move to `docs/_archive/` |
| `docs/2026-02-05/milestone-plan-react-to-supabase.md` | Migration roadmap (completed) | Move to `docs/_archive/` |
| `backend/AGENTS.md` | Describes obsolete FastAPI stack | Deleted with backend/ (Task 1) |

### CURRENT — no changes needed

| File | Notes |
|------|-------|
| `docs/README.md` | Correctly indexed |
| `docs/architecture.md` | Comprehensive, describes deployed architecture |
| `docs/edge-orchestration.md` | Describes implemented Modal + Edge pattern |
| `docs/deployment-architecture.md` | Billing/cost reference (forward-looking) |
| `docs/supabase.md` | Evergreen CLI reference |
| `docs/supabase-learn.md` | Evergreen educational |
| `docs/supabase-security.md` | Security checklist (still relevant) |
| `docs/vercel-frontend.md` | Describes deployed Vercel setup |
| `docs/biome.md` | Frontend tooling reference |
| `docs/design.md` | Visual direction |
| `docs/costs.md` | Cost projections |
| `docs/tooling.md` | Dev tooling |
| `docs/qwen3-tts-models-map.md` | Model reference |
| `docs/qwen-api.md` | API reference |
| `docs/transcription.md` | Mistral reference |
| `docs/2026-02-05/job-based-edge-orchestration.md` | Describes implemented pattern (keep in place) |
| `docs/2026-02-07/` | Keep if content is about implemented work |
| `docs/2026-02-09/` | Keep if content is about implemented work |
| `docs/2026-02-16/` | Deployment execution (completed, accurate) |
| `docs/2026-02-19/` | Auth pages + Qwen cutover (active) |
| `docs/2026-02-22/` | Current tasks (this batch) |
| `docs/supabase-migration/phases/` | Implementation guides (reference, all complete) |
| `docs/qwen-integration/` | Active planning |

## Steps

### 1. Archive obsolete date-stamped folders

```bash
mkdir -p docs/_archive
git mv docs/2026-01-17 docs/_archive/
git mv docs/2026-01-18-modal-integration-plan docs/_archive/
git mv docs/2026-01-19 docs/_archive/
git mv docs/2026-01-22 docs/_archive/
git mv docs/2026-01-26-qwen3-tts-modal-deployment docs/_archive/
git mv docs/2026-02-02 docs/_archive/
git mv docs/2026-02-03 docs/_archive/
git mv docs/2026-02-05/milestone-plan-react-to-supabase.md docs/_archive/
```

Add a `docs/_archive/README.md`:
```
# Archived Documentation

Historical planning and research docs from before the Supabase migration (completed 2026-02-17).
Kept for reference. Not reflective of the current architecture.
```

### 2. Update `/README.md`

- Replace "Legacy FastAPI app (being replaced by Supabase Edge Functions)" with clear statement that the backend IS Supabase Edge Functions
- Remove "Legacy backend (optional)" section entirely
- Update technology stack to: Supabase (Postgres + Edge Functions + Auth + Storage) + Vercel (React SPA) + Modal (GPU TTS) + Mistral (transcription)

### 3. Update `/AGENTS.md`

Rewrite to describe:
- Frontend: React 19 + Vite + Tailwind v4, hosted on Vercel
- Backend: Supabase Edge Functions (Deno/Hono), project `utter-dev`
- Database: Supabase Postgres with RLS
- Storage: Supabase Storage (references + generated buckets)
- Local dev: `supabase start` + `supabase functions serve` + `npm run dev` (frontend)

### 4. Update `/docs/features.md`

- Replace "Current Technology Stack" table with the deployed stack
- Update architecture diagram to show: Browser → Vercel → Supabase Edge Functions → Postgres / Storage / Modal
- Mark the "Future Features" section with notes on what's now done (auth, storage migration, task persistence)

### 5. Update `/docs/milestone.md`

- Mark all milestones 0-8 as COMPLETE
- Add completion date (2026-02-17)
- Change tense from future ("We want") to past ("Completed")

### 6. Update `/docs/backend.md` and `/docs/database.md`

- Add header: "Implementation complete — deployed 2026-02-17"
- Change "design goals" framing to "implemented design"
- Update dates

### 7. Update `/docs/tasks.md`

Add the 2026-02-22 tasks to the active list and move auth pages / Qwen cutover appropriately.

## Acceptance criteria

- [ ] No doc in the main tree describes FastAPI/SQLite as the "current" backend
- [ ] Obsolete planning docs moved to `docs/_archive/`
- [ ] `README.md` and `AGENTS.md` accurately describe the deployed stack
- [ ] `features.md` architecture diagram shows the Supabase stack
- [ ] `milestone.md` shows all migration milestones as complete
- [ ] `tasks.md` updated with current task pointers
