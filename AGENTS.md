# Agent notes (repo working guide)

This repo is a voice cloning + TTS app. The backend is Supabase (Postgres + Edge Functions + Auth + Storage), the frontend is React 19 on Vercel, and GPU inference runs on Modal.com.

## Layout

- `frontend/`: React 19 + Vite + TypeScript + Tailwind v4 SPA (hosted on Vercel)
- `supabase/`: Edge Functions (Deno/Hono), Postgres migrations, Storage config, tests
- `modal_app/`: Modal deployment code for Qwen3-TTS
- `docs/`: documentation (start with `docs/README.md`)

## Production

- Frontend: `https://utter-wheat.vercel.app` (Vercel)
- Backend: Supabase project `utter-dev` (`jgmivviwockcwjkvpqra`)
- `/api/*` requests are rewritten by Vercel to Supabase Edge Functions (see `frontend/vercel.json`)

## Local dev (2 terminals)

Supabase (database + edge functions):

```bash
supabase start
supabase functions serve --env-file supabase/.env.local
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173` (Vite proxies `/api` to `http://localhost:54321/functions/v1`)

## Frontend formatting + linting (Biome)

Biome is the formatter+linter for `frontend/src`:

- Verify: `npm --prefix frontend run check`
- Fix: `npm --prefix frontend run check:write`
- CI check: `npm --prefix frontend run ci`

Config lives at `frontend/biome.json`. VS Code integration lives in `.vscode/`.

Avoid adding ESLint/Prettier unless explicitly requested; Biome is the source of truth.

## Testing

```bash
# Database tests (pgTAP)
supabase test db

# Edge function tests (Deno)
deno test --allow-all supabase/functions/tests/
```

## Docs pointers

- Biome explainer: `docs/biome.md`
- Project docs index: `docs/README.md`
- Architecture: `docs/architecture.md`
- Edge function backend: `docs/backend.md`
- Database schema + RLS: `docs/database.md`
