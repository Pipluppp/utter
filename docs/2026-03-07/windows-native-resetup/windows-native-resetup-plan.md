# Windows Native Re-Setup Plan (2026-03-05)

## Goal
Restore full local dev/test workflow in native Windows PowerShell without changing runtime behavior.

## Scope
- Reinstall Windows-targeted dependencies/tooling.
- Re-authenticate Windows-side CLIs.
- Validate local run/test commands from docs.
- Do not modify runtime code, schema, or API contracts.

## Success Criteria
- `supabase start`, API Worker dev server, and frontend dev server run successfully.
- `GET http://127.0.0.1:8787/api/health` returns `{ "ok": true }`.
- `npm run test:db` and `npm run test:worker:local` both pass.
- No Linux binary mismatch errors (`ELF`, wrong `workerd-*` package).

## Phase 0: Preflight (PowerShell)
Run from repo root (`C:\Users\Duncan\Desktop\utter`) and capture output:

```powershell
$PSVersionTable.PSVersion
node -v
npm -v
docker --version
supabase --version
wrangler --version
git status --short
```

If `supabase`/`wrangler` are missing, continue and resolve in Phase 2.

## Phase 1: Clean Reinstall Windows Dependencies
1. Stop any running local dev processes (Supabase, Worker, Vite).
2. Remove local dependency folders/caches:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force frontend/node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force workers/api/node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force workers/api/.wrangler -ErrorAction SilentlyContinue
```

3. Reinstall using lockfiles:

```powershell
npm ci
npm --prefix workers/api ci
npm --prefix frontend ci
```

If `npm ci` fails because lockfile is out-of-sync, use `npm install` only for the failing package directory and keep that change intentional/reviewed.

## Phase 2: Bootstrap Windows CLI/Auth State
Recommended:

```powershell
scripts\cloudflare-migration\bootstrap-auth.cmd
```

Expected outcomes:
- `wrangler whoami` succeeds (prompts login if needed).
- `supabase projects list` succeeds (prompts login if needed).
- Supabase link target is `jgmivviwockcwjkvpqra` (project `utter-dev`).

Manual fallback commands:

```powershell
npx wrangler login
npx supabase login
npx supabase link --project-ref jgmivviwockcwjkvpqra
```

## Phase 3: Start Local Services
Terminal 1:

```powershell
supabase start
```

Terminal 2:

```powershell
if (-not (Test-Path workers/api/.dev.vars)) { Copy-Item workers/api/.dev.vars.example workers/api/.dev.vars }
npm --prefix workers/api run dev
```

Terminal 3:

```powershell
$env:BACKEND_ORIGIN = "http://127.0.0.1:8787"
npm --prefix frontend run dev
```

## Phase 4: Verification
Run once services are up:

```powershell
npm run sb:status
Invoke-RestMethod http://127.0.0.1:8787/api/health
Invoke-RestMethod http://127.0.0.1:8787/api/languages
npm --prefix workers/api run check
npm run test:db
npm run test:worker:local
npm --prefix frontend run ci
```

Expected checks:
- `/api/health` returns `ok = true`.
- `/api/languages` includes `provider: "qwen"`.
- All commands exit with code `0`.

## Troubleshooting (Windows-Specific)
- `supabase` or `wrangler` not recognized:
  - Use `npx supabase ...` / `npx wrangler ...` and re-open terminal after login/install.
- Linux binary mismatch (`ELF`, wrong `workerd-*` package):
  - Repeat Phase 1 from Windows PowerShell only.
- `supabase start` fails:
  - Ensure Docker Desktop is running and healthy.
- Frontend cannot hit local API:
  - Confirm Terminal 3 has `BACKEND_ORIGIN=http://127.0.0.1:8787`.

## Guardrails
- Do not run `npm install` from WSL in this same Windows working copy after resetup.
- Do not commit machine-local artifacts (`.dev.vars`, `node_modules`, `.wrangler`).
- `bootstrap-auth.cmd` may update local tooling state; review and avoid committing unintended dependency/tooling churn.
