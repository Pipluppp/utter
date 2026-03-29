# Environment & Configuration

How env vars, secrets, and config flow through local dev, staging builds, and deployed Workers.

## Overview

There are two separate config surfaces:

1. **Frontend (Vite)** — env vars baked into the JS bundle at build time via `import.meta.env.VITE_*`
2. **API Worker (Wrangler)** — runtime vars/secrets injected by Cloudflare, or `.dev.vars` locally

They never share files. A Vite env var cannot reach the Worker, and a Wrangler secret cannot reach the frontend bundle.

## Frontend (Vite) Env Files

Vite loads env files from `frontend/` in this order per mode. Later files win on conflicts.

| File                | Loaded when       | Git-tracked                       |
| ------------------- | ----------------- | --------------------------------- |
| `.env`              | Always            | Yes                               |
| `.env.local`        | Always            | No (`.env.local` in `.gitignore`) |
| `.env.[mode]`       | Only in that mode | Yes                               |
| `.env.[mode].local` | Only in that mode | No (`*.local` in `.gitignore`)    |

### Which mode runs when

| Command                 | Vite mode     | Files loaded                                                          |
| ----------------------- | ------------- | --------------------------------------------------------------------- |
| `npm run dev`           | `development` | `.env` → `.env.local` → `.env.development` → `.env.development.local` |
| `npm run build:staging` | `staging`     | `.env` → `.env.local` → `.env.staging` → `.env.staging.local`         |
| `npm run build`         | `production`  | `.env` → `.env.local` → `.env.production` → `.env.production.local`   |

### Current files

| File                     | Purpose                          | Contents                                   |
| ------------------------ | -------------------------------- | ------------------------------------------ |
| `.env.example`           | Template for new devs            | Commented defaults, copy instructions      |
| `.env.development.local` | Local dev only                   | `VITE_MOCK_CLONE=true`, test Turnstile key |
| `.env.staging`           | Staging builds (`build:staging`) | Real Turnstile site key                    |
| `.env.tunnel`            | Tunnel mode (`dev:tunnel`)       | `VITE_SKIP_AUTH=true`                      |

There is no `.env.local` on purpose. That file loads in ALL modes (dev, staging, production) and is how mock flags leaked into the production bundle. If you ever need a universal local override, create it — but prefer mode-specific files instead.

### Rules

- **Dev-only flags go in `.env.development.local`**, never `.env.local`. This is how we prevent mock flags from leaking into deployed builds.
- `.env.staging` is committed to git. It holds non-secret staging config (Turnstile site key).
- Only `VITE_`-prefixed vars are exposed to client code. `BACKEND_ORIGIN` (no prefix) is only available to the Vite dev server process.

### Toggling mocks for local dev

Edit `frontend/.env.development.local`:

```bash
# Mocks ON (UI-only iteration, no backend needed):
VITE_MOCK_CLONE=true

# Mocks OFF (test against real local API Worker):
# VITE_MOCK_CLONE=true
```

Restart the Vite dev server after changing env files.

## API Worker (Wrangler) Config

Config lives in `workers/api/wrangler.jsonc`. Secrets live in `.dev.vars` (local) or Cloudflare dashboard (deployed).

### Config structure

```
workers/api/wrangler.jsonc
├── top-level          ← local dev defaults (wrangler dev --local)
│   ├── vars           ← non-secret config (CORS origin, model names, feature flags)
│   ├── secrets        ← declares required secret names (validated on deploy)
│   ├── r2_buckets     ← local R2 bucket bindings (*-local suffix)
│   └── queues         ← local queue bindings (*-local suffix)
├── env.staging        ← staging overrides (wrangler deploy --env staging)
│   ├── vars           ← staging CORS origins, feature flags
│   ├── r2_buckets     ← staging R2 buckets (*-staging suffix)
│   └── queues         ← staging queues (*-staging suffix)
└── env.production     ← production overrides (not yet fully wired)
```

### Wrangler vars vs secrets

| Type      | Where defined                                          | Visible in config    | Example                                          |
| --------- | ------------------------------------------------------ | -------------------- | ------------------------------------------------ |
| `vars`    | `wrangler.jsonc`                                       | Yes (committed)      | `CORS_ALLOWED_ORIGIN`, `DASHSCOPE_REGION`        |
| `secrets` | `.dev.vars` (local) or Cloudflare dashboard (deployed) | No (never committed) | `SUPABASE_SERVICE_ROLE_KEY`, `DASHSCOPE_API_KEY` |

Wrangler `vars`, `r2_buckets`, and `queues` are **non-inheritable** — each environment must declare its own full set. The top-level block is only used by `wrangler dev --local`.

### Local dev secrets

`workers/api/.dev.vars` (git-ignored) holds secrets for local development:

```bash
cp workers/api/.dev.vars.example workers/api/.dev.vars
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, etc.
```

### Staging secrets

Set via Wrangler CLI (stored in Cloudflare, never in git):

```bash
echo "value" | wrangler secret put SECRET_NAME --env staging --config workers/api/wrangler.jsonc
```

## Frontend Worker Config

`workers/frontend/wrangler.jsonc` is simpler — it serves static assets and proxies `/api/*` to the API Worker via a service binding.

```
workers/frontend/wrangler.jsonc
├── top-level          ← local dev defaults
│   └── assets         ← points to frontend/dist
└── env.staging
    ├── services       ← binds to utter-api-staging Worker
    └── routes         ← uttervoice.com custom domain
```

No secrets. No env vars. The frontend Worker is a thin proxy.

## What runs where — summary

| Context                    | Frontend env source      | API config source                     | API secrets source |
| -------------------------- | ------------------------ | ------------------------------------- | ------------------ |
| `npm run dev` (Vite)       | `.env.development.local` | N/A (Vite proxy → Worker)             | N/A                |
| `npm run dev` (API Worker) | N/A                      | `wrangler.jsonc` top-level `vars`     | `.dev.vars`        |
| `npm run build:staging`    | `.env.staging`           | N/A (build-time only)                 | N/A                |
| Deployed (uttervoice.com)  | Baked into JS bundle     | `wrangler.jsonc` `env.staging` `vars` | Cloudflare secrets |

## Deploy commands

```bash
# Full staging deploy (API + frontend build + frontend deploy)
npm run cf:deploy:staging

# Or step by step:
npm run cf:deploy:api:staging          # 1. Deploy API Worker
npm run cf:frontend:build:staging      # 2. Build frontend (mode=staging)
npm run cf:deploy:frontend:staging     # 3. Deploy frontend Worker + assets
```

## Gotchas

1. **No `.env.local` by design.** That file loads in all Vite modes and is how mock flags leaked into production. Use `.env.development.local` for dev-only overrides instead.
2. **Wrangler bindings are non-inheritable.** If you add an R2 bucket to top-level, you must also add it to `env.staging` (with the staging bucket name) or it won't exist in staging.
3. **Restart after env changes.** Both Vite and Wrangler load env files at startup.
4. **`VITE_` prefix required.** Only `VITE_*` vars are exposed to frontend code. Anything else is invisible to `import.meta.env`.
5. **Secrets are typed as `string`.** The `secrets.required` array in `wrangler.jsonc` is for deploy-time validation and type generation, not for setting values.

## Read next

- [setup.md](./setup.md) — local dev quickstart
- [deploy.md](./deploy.md) — staging/production deploy flow
- [backend.md](./backend.md) — API Worker routes and runtime
