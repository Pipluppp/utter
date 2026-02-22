# Utter

Voice cloning + TTS app powered by Qwen3-TTS on Modal. React 19 + Vite + Tailwind v4 frontend, Supabase backend (Postgres, Edge Functions, Auth, Storage).

<img width="2785" height="1703" alt="image" src="https://github.com/user-attachments/assets/8902baa6-3995-492c-9085-ef66c6c736b0" />

![demo](https://github.com/user-attachments/assets/82bd2201-81e4-4b0c-b317-8c5a49ba8826)

<img width="2785" height="1710" alt="image" src="https://github.com/user-attachments/assets/db37cea6-7741-4f14-9b58-614a798c625f" />

## What's in here

- `frontend/`: React 19 + Vite + TS + Tailwind v4 (hosted on Vercel)
- `supabase/`: Edge Functions (Deno/Hono), Postgres migrations, Storage config, tests
- `modal_app/`: Modal deploy code for Qwen3-TTS (serverless GPU)
- `docs/`: docs (start with `docs/README.md`)

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) (`npm i -g supabase` or `brew install supabase/tap/supabase`)
- [Docker](https://www.docker.com/) (required by `supabase start`)

## Run locally

You need **two terminals**: one for Supabase (database + edge functions) and one for the frontend dev server.

### 1. Supabase (database + edge functions)

```bash
# Start the local Supabase stack (Postgres, Auth, Storage, etc.)
supabase start

# Copy the env template and fill in your keys
cp supabase/.env.local.example supabase/.env.local
# Edit supabase/.env.local with your MISTRAL_API_KEY, Modal URLs, etc.

# Serve edge functions locally (reads env from .env.local)
supabase functions serve --env-file supabase/.env.local
```

`supabase start` prints local URLs and keys. You'll need `API URL` and `anon key` for the frontend env.

### 2. Frontend

```bash
# Copy the env template
cp frontend/.env.example frontend/.env.local

# Fill in the Supabase values from `supabase status`:
#   VITE_SUPABASE_URL=http://127.0.0.1:54321
#   VITE_SUPABASE_ANON_KEY=<anon key from supabase start>

cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Vite proxies `/api` requests to `http://localhost:54321/functions/v1` (see `frontend/vite.config.ts`).

## Testing

```bash
# Database tests (pgTAP)
supabase test db

# Edge function tests (Deno)
deno test --allow-all supabase/functions/tests/
```

## Code style

Frontend uses **Biome** (formatter + linter).

- Verify: `npm --prefix frontend run check`
- Fix: `npm --prefix frontend run check:write`
- CI: `npm --prefix frontend run ci`

More: `docs/biome.md`.

