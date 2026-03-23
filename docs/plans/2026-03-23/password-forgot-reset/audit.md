# Security Audit: Password Forgot & Reset Flows

**Date:** 2026-03-23
**Target:** https://uttervoice.com
**Method:** Chrome DevTools MCP (live browser session)
**Scope:** `/api/auth/sign-in`, `/api/auth/sign-out`, `/api/auth/update-password`, `/api/auth/forgot-password`, `/api/auth/session`, `/account/update-password` (recovery landing)

---

## Test Flows Executed

1. Authenticated change-password from `/account/profile` (same-password rejection)
2. Sign-in with email + password
3. Sign-out
4. Forgot-password with real email
5. Forgot-password with nonexistent email (enumeration test)
6. Recovery link landing page inspection (`/account/update-password`)
7. `document.cookie` evaluation on multiple pages
8. Console message review

---

## Results

| Check | Result | Notes |
|---|---|---|
| Token leakage (URLs, response bodies) | PASS | No access/refresh tokens in response JSON or URL params |
| Email enumeration | PASS | Identical 200 + identical body for real and fake emails |
| Password in URLs | PASS | Passwords only in POST request bodies |
| Cookie flags | PASS | `HttpOnly; Secure; SameSite=Lax; Path=/` on both tokens |
| Cache headers | PASS | `cache-control: no-store` + `pragma: no-cache` on all auth endpoints |
| CORS | PASS | `access-control-allow-origin: https://uttervoice.com` (no wildcard) |
| Error messages | PASS | No stack traces, DB errors, or Supabase internals leaked |
| Console output | PASS | Only Cloudflare Turnstile messages; no app errors or sensitive data |
| JS cookie access | PASS | `document.cookie` returns `""` (HttpOnly enforced) |
| Captcha (Turnstile) | PASS | Required on sign-in and forgot-password forms |
| Recovery link URL | PASS | `/account/update-password` — no tokens in query params or hash |

---

## Endpoint Details

### POST `/api/auth/sign-in`

**Request body:**
```json
{"captcha_token":"<turnstile>","email":"<email>","password":"<password>"}
```

**Response (200):**
```json
{"signed_in":true,"user":{"email":"<email>","id":"<uuid>"}}
```

**Set-Cookie headers:**
```
utter_sb_access_token=<jwt>; Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Lax
utter_sb_refresh_token=<opaque>; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax
```

**Security headers:**
```
cache-control: no-store
pragma: no-cache
access-control-allow-origin: https://uttervoice.com
```

### POST `/api/auth/sign-out`

**Request body:**
```json
{}
```

**Response (200):**
```json
{"signed_in":false,"user":null}
```

**Set-Cookie headers (clears both cookies):**
```
utter_sb_access_token=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax
utter_sb_refresh_token=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; Secure; SameSite=Lax
```

### POST `/api/auth/update-password`

**Request body:**
```json
{"password":"<new_password>"}
```

**Response (422, same-password rejection):**
```json
{"detail":"New password should be different from the old password."}
```

**Security headers:**
```
cache-control: no-store
pragma: no-cache
access-control-allow-origin: https://uttervoice.com
```

### POST `/api/auth/forgot-password`

**Request body:**
```json
{"captcha_token":"<turnstile>","email":"<email>"}
```

**Response (200, real email):**
```json
{"detail":"If an account exists for that email, a recovery link has been sent."}
```

**Response (200, nonexistent email):**
```json
{"detail":"If an account exists for that email, a recovery link has been sent."}
```

Both responses are identical in status code, headers, and body shape — no email enumeration possible.

### GET `/api/auth/session`

**Response (200, authenticated):**
```json
{"signed_in":true,"user":{"email":"<email>","id":"<uuid>"},"identities":[{"provider":"email"},{"provider":"google"}]}
```

**Response (200, unauthenticated):**
```json
{"signed_in":false,"user":null}
```

No tokens in response body. Session state derived server-side from HttpOnly cookies.

### `/account/update-password` (recovery landing)

- URL: `https://uttervoice.com/account/update-password`
- No tokens in query params (`window.location.search` = `""`)
- No tokens in hash fragment (`window.location.hash` = `""`)
- Recovery token exchange happens server-side via the frontend Worker intercepting the Supabase redirect
- `document.cookie` returns `""` on this page

---

## CORS Headers (consistent across all auth endpoints)

```
access-control-allow-origin: https://uttervoice.com
access-control-allow-methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
access-control-allow-headers: authorization, x-client-info, apikey, content-type
access-control-max-age: 86400
```

---

## Console Messages

All console output originated from Cloudflare Turnstile challenge widget internals. No application-level errors, warnings, or sensitive data observed. One `ERR_BLOCKED_BY_CLIENT` from a browser extension (ad blocker) — irrelevant.

---

## Findings

None. All checks passed.
