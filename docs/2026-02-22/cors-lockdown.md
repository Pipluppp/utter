# Task 3: CORS Lockdown

## Problem

`supabase/functions/_shared/cors.ts` currently sets:

```ts
"Access-Control-Allow-Origin": "*"
```

This allows any website to make authenticated API requests to the Utter edge functions from the browser. While Supabase Auth still protects endpoints (a valid JWT is required), the open CORS policy:

- Enables phishing sites to make API calls using a stolen/leaked JWT
- Violates defense-in-depth — CORS is an easy layer to restrict
- The code itself has a comment acknowledging this: "Restrict in production"

## Solution

Restrict the `Access-Control-Allow-Origin` header to known Vercel origins. Use an environment variable so local dev keeps working with `*`.

## Implementation

### 1. Update `supabase/functions/_shared/cors.ts`

```ts
// Allowed origins for CORS.
// In production, this is set via Supabase secrets.
// In local dev, defaults to * for convenience.
const ALLOWED_ORIGIN = Deno.env.get("CORS_ALLOWED_ORIGIN") ?? "*";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
};
```

### 2. Set secret on Supabase project

```bash
supabase secrets set CORS_ALLOWED_ORIGIN=https://utter-wheat.vercel.app
```

If the app has multiple origins (e.g. a custom domain later), this can be expanded to a comma-separated list with origin matching logic. For now, a single origin is sufficient.

### 3. Keep local dev working

`supabase/.env.local` does NOT need a `CORS_ALLOWED_ORIGIN` entry — the `?? "*"` fallback handles local dev automatically.

### 4. Verify

After deploying:

```bash
# Should succeed (correct origin)
curl -I -X OPTIONS \
  -H "Origin: https://utter-wheat.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  https://jgmivviwockcwjkvpqra.supabase.co/functions/v1/api/languages

# Check the Access-Control-Allow-Origin header is NOT *

# Should fail CORS (wrong origin)
# Browser would block this; curl doesn't enforce CORS but the header will show the allowed origin
curl -I -X OPTIONS \
  -H "Origin: https://evil-site.com" \
  -H "Access-Control-Request-Method: POST" \
  https://jgmivviwockcwjkvpqra.supabase.co/functions/v1/api/languages
```

### 5. Edge case: Vercel preview deployments

Vercel preview deploys get URLs like `utter-git-branch-name.vercel.app`. If you want these to work too, expand to multi-origin matching:

```ts
const ALLOWED_ORIGINS = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "*").split(",");

function getAllowedOrigin(request: Request): string {
  const origin = request.headers.get("Origin") ?? "";
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0]; // default to primary
}
```

This is optional — start with the single-origin approach and expand if needed.

## Acceptance criteria

- [ ] `cors.ts` reads origin from `CORS_ALLOWED_ORIGIN` env var
- [ ] Local dev (`supabase functions serve`) still works (falls back to `*`)
- [ ] Production responds with `Access-Control-Allow-Origin: https://utter-wheat.vercel.app`
- [ ] Secret set on remote project via `supabase secrets set`
- [ ] Frontend app still loads and makes API calls without CORS errors
