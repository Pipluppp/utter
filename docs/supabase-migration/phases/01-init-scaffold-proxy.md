# Phase 01 — Init + Scaffold + Proxy Switch

> **Status**: Not Started
> **Prerequisites**: [Phase 00](./00-prerequisites.md) complete
> **Goal**: Get the React SPA calling a Supabase Edge Function. This is the "hello world" moment — proof that the new stack works end-to-end.

---

## Why this phase exists

Switching the Vite proxy early means every subsequent phase can be tested against the real SPA immediately. No more "build 4 phases of backend then hope it works" — we validate on every step.

---

## Steps

### 1. Initialize Supabase in the repo

- [ ] Run from repo root:
  ```bash
  npx supabase init
  ```
- [ ] This creates `supabase/` with `config.toml`, `.gitignore`, and `seed.sql`
- [ ] Verify the directory structure:
  ```
  supabase/
    config.toml
    seed.sql
    .gitignore
  ```

**What to verify**: `supabase/config.toml` exists and is valid TOML.

### 2. Configure `verify_jwt = false` for the `api` function

- [ ] Edit `supabase/config.toml` and add:

```toml
[functions.api]
verify_jwt = false
```

**Why**: Our `api` function has both public routes (`/languages`) and protected routes. We disable gateway-level JWT verification and handle auth per-route inside the Hono router instead. Without this, unauthenticated requests to `/api/languages` would be rejected by the gateway.

### 3. Start the local Supabase stack

- [ ] Run:
  ```bash
  npm run sb:start
  ```
- [ ] First run pulls Docker images (~2-5 min depending on network)
- [ ] Note the output — it prints all local URLs and keys:
  ```
  API URL: http://127.0.0.1:54321
  anon key: eyJhbGciOi...
  service_role key: eyJhbGciOi...
  Studio URL: http://127.0.0.1:54323
  Inbucket URL: http://127.0.0.1:54324
  ```
- [ ] **Save these values** — you'll need the anon key for the frontend `.env`

**What to verify**: `http://localhost:54323` loads Supabase Studio in your browser.

### 4. Copy local keys into `frontend/.env`

- [ ] See [manual-steps.md](../manual-steps.md#copy-local-supabase-keys-into-frontend-env) for details
- [ ] Add/update in `frontend/.env`:
  ```env
  VITE_SUPABASE_URL=http://127.0.0.1:54321
  VITE_SUPABASE_ANON_KEY=<anon key from step 3>
  ```

**Why**: The frontend's `supabase-js` client reads these at build time. They must point to the local stack during development.

**What to verify**: `frontend/.env` has both values set. These are stable across restarts.

### 5. Create the `supabase/.env.local` secrets file

- [ ] Create `supabase/.env.local` with your Modal endpoint URLs:
  ```env
  MODAL_JOB_SUBMIT=<url from backend/config.py or existing .env>
  MODAL_JOB_STATUS=<url>
  MODAL_JOB_RESULT=<url>
  MODAL_JOB_CANCEL=<url>
  MODAL_ENDPOINT_VOICE_DESIGN=<url>
  TTS_PROVIDER=qwen
  ```
- [ ] See [manual-steps.md](../manual-steps.md#copy-modal-endpoint-urls-into-supabaseenvlocal) for where to find these values

**Why**: Edge Functions need Modal endpoints for generate/design. These are separate from Vite env vars to prevent accidental frontend exposure.

**What to verify**: File exists at `supabase/.env.local` and is NOT tracked by git (`git status` should not show it).

### 6. Create the Edge Function scaffold

- [ ] Run:
  ```bash
  npx supabase functions new api
  ```
- [ ] This creates `supabase/functions/api/index.ts` with a starter template

Now create the shared modules and the initial router:

#### 6a. `supabase/functions/_shared/cors.ts`

- [ ] Create this file:

```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Restrict in production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Max-Age': '86400',
}
```

**Why**: Edge Functions don't auto-handle CORS. The OPTIONS handler MUST run before any code that might throw — otherwise CORS preflight fails and the browser blocks all requests.

#### 6b. `supabase/functions/_shared/supabase.ts`

- [ ] Create this file with two client factories:

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

// User-scoped client: respects RLS, uses caller's JWT
export function createUserClient(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    },
  )
}

// Admin client: bypasses RLS, for edge-only writes
export function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}
```

**Why two clients**: User-scoped for reads where RLS should enforce "only my rows". Admin for writes that only the backend should do (task creation, generation updates, storage operations). See [README.md](../README.md#two-supabase-clients-in-edge-functions).

#### 6c. `supabase/functions/_shared/auth.ts`

- [ ] Create the `requireUser` middleware:

```typescript
import { createUserClient } from './supabase.ts'

export async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new Response(JSON.stringify({ detail: 'Missing authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createUserClient(req)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Response(JSON.stringify({ detail: 'Invalid or expired token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return { user, supabase }
}
```

**Why `getUser()` not `getSession()`**: `getUser()` validates the JWT against the Auth server. `getSession()` only decodes locally — it doesn't verify the token hasn't been revoked.

#### 6d. `supabase/functions/api/index.ts` — Hono router

- [ ] Replace the generated `index.ts` with:

```typescript
import { Hono } from 'npm:hono@4'
import { corsHeaders } from '../_shared/cors.ts'

const app = new Hono().basePath('/api')

// CORS preflight — must be first
app.options('*', (c) => {
  return c.body(null, 204, corsHeaders)
})

// Add CORS headers to all responses
app.use('*', async (c, next) => {
  await next()
  Object.entries(corsHeaders).forEach(([k, v]) => {
    c.header(k, v)
  })
})

// --- Public routes ---

app.get('/health', (c) => c.json({ ok: true }))

app.get('/languages', (c) => {
  return c.json({
    languages: [
      'Auto', 'English', 'Chinese', 'Japanese', 'Korean',
      'French', 'German', 'Spanish', 'Italian', 'Portuguese',
      'Russian', 'Arabic', 'Hindi', 'Dutch', 'Turkish',
    ],
    default: 'Auto',
    provider: 'qwen',
    transcription: {
      enabled: false,
      provider: 'mistral',
      model: 'mistral-large-latest',
      realtime_model: 'mistral-large-latest',
    },
  })
})

// --- Protected routes (added in later phases) ---

Deno.serve(app.fetch)
```

**Why Hono**: Lightweight router with TypeScript support that runs in Deno. One "fat function" = one cold start for all routes.

**Why `.basePath('/api')`**: Supabase serves functions at `/functions/v1/<function-name>/...`. Our function is named `api`, so Supabase paths it at `/functions/v1/api/...`. The Hono basePath ensures route handlers match `/api/languages` etc.

### 7. Switch the frontend Vite proxy

- [ ] Edit `frontend/vite.config.ts`:

**Change from:**
```typescript
const FASTAPI_ORIGIN = process.env.FASTAPI_ORIGIN ?? 'http://localhost:8000'

export default defineConfig({
  // ...
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: FASTAPI_ORIGIN, changeOrigin: true, ws: true },
      '/uploads': { target: FASTAPI_ORIGIN, changeOrigin: true },
      '/static': { target: FASTAPI_ORIGIN, changeOrigin: true },
    },
  },
})
```

**Change to:**
```typescript
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? 'http://localhost:54321/functions/v1'

export default defineConfig({
  // ...
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: BACKEND_ORIGIN, changeOrigin: true },
    },
  },
})
```

**What's removed**: `/uploads` proxy (audio will come from Storage signed URLs), `/static` proxy (static assets will move to `frontend/public/` in Phase 07), `ws: true` (no WebSocket proxy needed for MVP).

### 8. Serve Edge Functions locally

- [ ] In a second terminal, run:
  ```bash
  npm run sb:serve
  ```
- [ ] Output should show the `api` function is being served
- [ ] Test directly: `curl http://localhost:54321/functions/v1/api/languages`
- [ ] Should return the languages JSON

### 9. Test the full loop

- [ ] In a third terminal, start the frontend:
  ```bash
  npm --prefix frontend run dev
  ```
- [ ] Open `http://localhost:5173` in your browser
- [ ] Navigate to the Generate page (which calls `GET /api/languages` on mount)
- [ ] The languages dropdown should populate with the list from the Edge Function
- [ ] Open browser DevTools → Network tab → filter for `languages`
- [ ] Verify the request goes to `localhost:5173/api/languages` and is proxied to `localhost:54321/functions/v1/api/languages`

**This is the "hello world" moment.** The React SPA is now calling a Supabase Edge Function.

---

## Files created

| File | Purpose |
|------|---------|
| `supabase/config.toml` | Supabase project config (generated by `supabase init`) |
| `supabase/seed.sql` | Dev seed data (empty for now, populated in Phase 03) |
| `supabase/.env.local` | Modal endpoint secrets (gitignored) |
| `supabase/functions/api/index.ts` | Hono router with `/languages` and `/health` |
| `supabase/functions/_shared/cors.ts` | CORS headers helper |
| `supabase/functions/_shared/supabase.ts` | User-scoped + admin client factories |
| `supabase/functions/_shared/auth.ts` | `requireUser()` middleware |

## Files modified

| File | Change |
|------|--------|
| `frontend/vite.config.ts` | Proxy target: FastAPI → Supabase Edge Functions. Remove `/uploads` and `/static` proxies. |

---

## Acceptance criteria

- [ ] `npm run sb:start` boots Supabase without errors
- [ ] `npm run sb:serve` serves the `api` function
- [ ] `curl http://localhost:54321/functions/v1/api/health` returns `{"ok":true}`
- [ ] `curl http://localhost:54321/functions/v1/api/languages` returns languages JSON
- [ ] Frontend Generate page shows languages dropdown populated from Edge Function
- [ ] Network tab shows proxy chain: `localhost:5173/api/languages` → `localhost:54321/functions/v1/api/languages`

---

## Gotchas

- **First `sb:start` is slow**: Docker pulls ~10 images. Subsequent starts are fast (~10s).
- **Port conflicts**: If port 54321/54322/54323 is in use, `supabase start` will fail. Stop other services or configure ports in `config.toml`.
- **CORS must be first**: If you add middleware or imports above the OPTIONS handler that throw, CORS preflight breaks and the browser blocks everything.
- **Hono `basePath`**: Don't forget `.basePath('/api')`. Without it, routes won't match the proxied paths.
