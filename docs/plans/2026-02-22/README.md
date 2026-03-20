# 2026-02-22 Tasks

## Context

App live at `https://utter-wheat.vercel.app` on Supabase project `jgmivviwockcwjkvpqra`. Auth pages shipped in `cee4676`. Current focus: cleanup, security hardening, and removing legacy confusion.

## Ordered tasks

1. **Remove legacy FastAPI backend**
   Path: `remove-fastapi-backend.md`
   What it achieves: deletes the dead `backend/` directory and all references to FastAPI as the current stack, eliminating the #1 source of codebase confusion.

2. **Profile column guards**
   Path: `profile-column-guards.md`
   What it achieves: prevents clients from escalating credits/subscription tier via direct PostgREST writes. Required before any billing or credit system work.

3. **CORS lockdown**
   Path: `cors-lockdown.md`
   What it achieves: restricts edge function CORS from `*` to the actual Vercel production origin.

4. **Documentation cleanup**
   Path: `docs-cleanup.md`
   What it achieves: updates stale docs that still describe FastAPI/SQLite as the current stack, archives obsolete planning docs, and aligns everything to the deployed Supabase reality.

## Dependency

Tasks 1-4 are independent — can be worked in any order. Task 4 (docs cleanup) is best done after task 1 (FastAPI removal) so file references are already gone.
