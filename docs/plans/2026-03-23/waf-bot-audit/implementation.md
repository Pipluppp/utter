# WAF Rule Implementation Plan — 2026-03-23

Step-by-step instructions for applying the WAF changes from [waf-recommendations.md](./waf-recommendations.md) in the Cloudflare dashboard.

**Dashboard path:** Cloudflare → uttervoice.com → Security → WAF → Custom rules

**Constraint:** Free/Pro plan allows 5 custom rules. 4 were already in use, so only 1 new rule could be added. The remaining changes are modifications to existing rules.

**Status: ✅ All steps deployed — 2026-03-23**

---

## Step 1: Add rule — "Block non-API POST requests" (new rule — uses the 5th slot)

This is the single new rule to add. It's the highest-impact option because:
- It's structural — catches all POST-based scanning regardless of source ASN, UA, or path
- Zero false-positive risk — the SPA never accepts POSTs outside `/api/*`
- Future-proof — works against scanners we haven't seen yet
- Eliminates the ReadableStream error log noise entirely (those errors are all triggered by bot POSTs to non-API paths)

1. Click **Create rule**
2. Rule name: `Block non-API POST requests`
3. Switch to **Edit expression**
4. Paste:
```
(http.request.method eq "POST") and not (http.request.uri.path contains "/api/")
```
5. Action: **Block**
6. **Deploy**
7. Drag to position **2** (after "Allow good bots")

**What this blocks:**
- All FBW NETWORKS POST probes to `/form/*`, `/webhook/*`, `/admin/*`, `/upload*` (~314 request lines + ~298 error lines)
- All HK/CN POST probes to `/admin` and `/api` root (10 request lines + 11 error lines)
- Any future POST-based scanner hitting non-API paths

**Verification:** Check Workers logs after 1 hour. Non-API POST traffic should now appear as blocked in Security Events instead of hitting the Worker.

---

## Step 2: Modify rule — "Aggressive crawlers" (existing rule)

This doesn't use a new rule slot — it extends the existing rule.

1. Find the existing **Aggressive crawlers** rule
2. Click **Edit**
3. Switch to **Edit expression**
4. Add these conditions to the end of the existing OR chain:
```
 or (http.user_agent contains "curl") or (http.user_agent contains "HeadlessChrome") or (http.user_agent contains "headlesschrome") or (http.user_agent contains "Headless") or (http.user_agent contains "httpx") or (http.user_agent contains "Go-http-client") or (http.user_agent contains "okhttp" and not http.request.uri.path contains "/api/") or (http.user_agent eq "Mozilla/5.0")
```
5. Action remains: **Managed Challenge**
6. **Save**

**What this catches that Step 1 doesn't:**
- FBW NETWORKS GET requests (if they ever switch from POST to GET) — `curl` UA
- HeadlessChrome scanners from ASN 9009 and any other ASN — `HeadlessChrome` in UA
- WordPress prober's bare `Mozilla/5.0` UA
- `httpx`, `Go-http-client` recon tools
- These are all Managed Challenge (not block), so legitimate users with unusual UAs can still pass through

---

## Step 3: Modify rule — "Block scanner paths, Tor, AI crawlers" (existing rule)

This doesn't use a new rule slot — it extends the existing rule.

1. Find the existing **Block scanner paths** rule
2. Click **Edit**
3. Switch to **Edit expression**
4. Add these conditions to the existing OR chain:
```
 or (http.request.uri.path contains "/wordpress") or (http.request.uri.path contains "/.git") or (http.request.uri.path contains "/secrets") or (http.request.uri.path contains "/cmd_") or (http.request.uri.path contains "/lander/") or (http.request.uri.path contains "/cabinet") or (http.request.uri.path contains "/rest/settings")
```
5. Action remains: **Block**
6. **Save**

**What this catches that Steps 1-2 don't:**
- Russian botnet GET requests to `/lander/sber*`, `/lander/rosneft/` etc. (these are GETs with a normal-looking Chrome UA, so neither the POST block nor the UA rule catches them)
- `/.git/config` exposure probes
- `/wordpress/` probes
- `/cmd_*` command injection probes
- `/cabinet`, `/rest/settings` admin probes

---

## Step 4: Modify rule — "Challenge large providers" (existing rule)

This doesn't use a new rule slot — it extends the existing rule.

1. Find the existing **Challenge large providers** rule
2. Click **Edit**
3. In the ASN list, add `14061`:
```
(ip.src.asnum in {7224 16509 14618 15169 8075 396982 14061})
```
4. Rest of the expression stays the same
5. Action remains: **Managed Challenge**
6. **Save**

---

## What about the hostile ASN block?

The original plan included a "Block hostile ASNs" rule for ASNs 211590, 203020, 134365, 152194, 133380, 9009. Since we can't add a second new rule, here's how the other changes compensate:

| Bot | Covered by |
|---|---|
| FBW NETWORKS (211590) — POST probes | Step 1 (non-API POST block) + Step 2 (`curl` UA challenge) |
| FBW NETWORKS (211590) — GET probes | Step 2 (`curl` UA challenge) |
| HK/CN probes (134365, 152194, 133380) | Step 1 (non-API POST block) — all their traffic is POSTs to `/admin` and `/api` |
| HeadlessChrome (9009) | Step 2 (`HeadlessChrome` UA challenge) |
| Russian botnet (203020) — `/lander/*` paths | Step 3 (`/lander/` path block) |
| Russian botnet (203020) — random short-code GETs | **Not covered** — harmless, just served the SPA shell |

The only remaining gap is the Russian botnet's random short-code GET requests (`/zxDLJZ`, `/9XgxmrM3`, etc.). These use a standard Chrome/94 UA and hit random paths that can't be pattern-matched. They're harmless — the SPA shell is served, no server resources are consumed beyond a trivial static response. If the volume becomes a problem, consider upgrading to get a 6th rule slot for the ASN block.

---

## Final rule order

After all changes, rules should be ordered:

| # | Rule | Action | Status |
|---|---|---|---|
| 1 | Allow good bots | Allow | Existing, unchanged |
| 2 | Block non-API POST requests | Block | **New** |
| 3 | Block scanner paths, Tor, AI crawlers | Block | Modified (Step 3) |
| 4 | Aggressive crawlers | Managed Challenge | Modified (Step 2) |
| 5 | Challenge large providers | Managed Challenge | Modified (Step 4) |

Drag rules in the dashboard to match this order. Allow rules evaluate first, then blocks, then challenges.

---

## Post-deployment verification

After deploying all changes, monitor for 24 hours:

1. **Security → Events:** Confirm blocked/challenged requests appear for the expected patterns
2. **Workers → Logs (utter):** Bot traffic volume should drop significantly. The ReadableStream error lines should disappear entirely.
3. **Workers → Logs (utter-api-staging):** Should remain unchanged (already clean)
4. **False positive check:** Verify no legitimate user traffic from PH, US, DE, IT is being blocked. Check that `/api/*` POST requests (auth, generate, clone) still work normally

---

## Rollback

If any rule causes issues:

1. Go to **Security → WAF → Custom rules**
2. Toggle the problematic rule **off** (disable without deleting)
3. Investigate Security Events to identify false positives
4. Adjust the expression and re-enable

Each rule is independent — disabling one doesn't affect the others.
