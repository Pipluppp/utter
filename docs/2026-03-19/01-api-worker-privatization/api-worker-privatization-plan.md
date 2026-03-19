# API Worker Privatization Plan

Date: 2026-03-19
Status: Planned
Scope: `utter-api-staging` exposure reduction

## Goal

Remove the public `workers.dev` bypass for the API Worker so browser traffic reaches the API only through:

`uttervoice.com` -> frontend Worker -> service binding -> API Worker

This keeps the existing branded-domain WAF/rate-limiting path in front of browser API traffic and removes the direct public API hostname as an abuse path.

## Decision Summary

We will:

1. Disable `workers.dev` for the API Worker in code and in the dashboard.
2. Keep browser API traffic on `uttervoice.com/api/*` through the frontend Worker service binding.
3. Make the frontend Worker fail closed in hosted environments if the API service binding is missing, instead of silently falling back to the public API origin.
4. Verify that `uttervoice.com/api/health` still works while `utter-api-staging.duncanb013.workers.dev/api/health` no longer does.

We will not, in this workstream:

- add a separate `api.uttervoice.com` hostname
- redesign rate limiting
- change auth flows
- change signed storage token design
- add Cloudflare Access or mTLS

## Why This Is The Right First Step

Current state:

- The frontend Worker already has a service binding to `utter-api-staging`.
- The frontend Worker already proxies `/api/*` requests through that binding.
- The direct API hostname is still publicly reachable today on `workers.dev`.
- The March 19 Cloudflare security rollout only protects `uttervoice.com`, not direct Worker hostnames.

That means the public API hostname is currently a bypass path:

- `uttervoice.com/api/...` gets zone protections first.
- `utter-api-staging.duncanb013.workers.dev/api/...` does not.

If we disable the API Worker's `workers.dev` route, normal browser traffic still works through the service binding, but the bypass path is removed.

## Confirmed Facts

Cloudflare docs verified on 2026-03-19:

- `workers_dev = false` disables the public `workers.dev` route on the next deploy.
- Disabling `workers.dev` in the dashboard alone is not durable if Wrangler config still leaves it enabled.
- Service bindings allow one Worker to call another without using a publicly accessible URL.
- Service bindings are a documented way to isolate a Worker from the public Internet.
- Disabling `workers.dev` does not disable Preview URLs.

Repo/runtime facts verified on 2026-03-19:

- The frontend Worker has a service binding named `API` to `utter-api-staging`.
- The frontend Worker proxies `/api/*` to `env.API.fetch(...)` when the binding exists.
- The frontend Worker still contains a fallback path to `API_ORIGIN`.
- The API Worker does not currently set `workers_dev = false`.
- Live check: `https://utter-api-staging.duncanb013.workers.dev/api/health` returned `200 OK`.
- Live check: `https://uttervoice.com/api/health` returned `200 OK`.

## Implementation Steps

### Step 1: Lock the decision into repo config

Update `workers/api/wrangler.toml`:

- Add `workers_dev = false` at top level.

Reason:

- This makes the disablement durable across future Wrangler deploys.
- Cloudflare docs explicitly warn that dashboard-only disablement can be undone by the next deploy if config is not updated.

### Step 2: Disable `workers.dev` in the Cloudflare dashboard

For Worker `utter-api-staging`:

1. Cloudflare Dashboard
2. Workers & Pages
3. Select `utter-api-staging`
4. `Settings -> Domains & Routes`
5. Disable `workers.dev`

Reason:

- The dashboard action removes the currently active public route immediately.
- The repo change in Step 1 prevents future re-enablement by deploy.

### Step 3: Keep the service binding as the only hosted path

Do not remove the existing frontend Worker service binding.

Current desired hosted flow:

- Browser requests `https://uttervoice.com/api/...`
- Frontend Worker receives the request on the branded domain
- Frontend Worker forwards internally through `env.API.fetch(...)`
- API Worker handles the request without needing a public hostname

No API custom domain is needed for this step.

### Step 4: Make hosted frontend proxying fail closed

Update `workers/frontend/src/index.ts` so hosted environments do not silently fall back to `API_ORIGIN` when `env.API` is missing.

Desired behavior:

- Hosted staging/prod: require the `API` service binding
- Local-only development: fallback is acceptable if explicitly intended

Recommended rule:

- If request path starts with `/api/` and `env.API` is present, use the service binding.
- If request path starts with `/api/` and the request host is a hosted domain but `env.API` is missing, return `500` with a clear configuration error.
- Only use `API_ORIGIN` fallback in explicitly local or non-hosted development flows.

Reason:

- After privatizing the API Worker, a silent fallback to the old public origin becomes both broken and misleading.
- Fail-closed behavior makes deployment mistakes obvious.

### Step 5: Review any references to the direct API hostname

Search for and review references to:

- `utter-api-staging.duncanb013.workers.dev`
- `API_ORIGIN`

Expected outcomes:

- Hosted browser traffic should use the service binding path.
- Direct public API links should not be present in user-facing docs for hosted usage.
- Any remaining fallback references should be local-dev-only or removed.

### Step 6: Deploy order

Recommended deploy order:

1. Merge config/code changes
2. Deploy API Worker with `workers_dev = false`
3. Disable `workers.dev` in dashboard if still present
4. Deploy frontend Worker if fail-closed proxy changes were made
5. Run hosted verification checks

If only Step 1 is implemented and deployed, the API Worker should already lose its public `workers.dev` route on redeploy.

## Verification Plan

### Expected success checks

- `https://uttervoice.com/api/health` returns `200`
- normal app flows continue to work on `uttervoice.com`
- frontend API requests still succeed in browser

### Expected deny/fail checks

- `https://utter-api-staging.duncanb013.workers.dev/api/health` no longer returns the API response
- `https://utter-api-staging.duncanb013.workers.dev/api/languages` no longer returns the API response

### Important nuance

Disabling `workers.dev` does not disable Preview URLs.

That means verification must distinguish:

- `workers.dev` route disabled
- Preview URLs still available unless separately disabled

Preview URLs are a separate follow-up decision. They are not needed to remove the main public bypass path identified here.

## Rollback Plan

If branded app traffic breaks after privatization:

1. Check that the frontend Worker still has the `API` service binding configured
2. Check that the frontend Worker is actually using `env.API.fetch(...)`
3. Re-enable `workers.dev` temporarily in the dashboard only if emergency recovery is required
4. If rollback is needed for more than an emergency window, revert the repo config change and redeploy

Rollback priority is restoring `uttervoice.com/api/*`, not restoring the public API hostname permanently.

## Risks And Edge Cases

### Risk: frontend binding misconfiguration

Impact:

- `uttervoice.com/api/*` breaks after the public API hostname is removed

Mitigation:

- Keep the current service binding
- Add fail-closed hosted behavior
- Verify immediately after deploy

### Risk: hidden dependency on direct API hostname

Impact:

- Some tool, test, or script may still target the old public hostname

Mitigation:

- Search the repo and docs before rollout
- Update any hosted references to use `uttervoice.com/api/*`

### Risk: Preview URLs remain public

Impact:

- A different Cloudflare-generated URL may still exist even after disabling `workers.dev`

Mitigation:

- Treat this as a separate follow-up decision
- Document clearly that this rollout removes the `workers.dev` bypass, not every possible preview surface

## Success Criteria

This workstream is complete when:

- the API Worker is no longer reachable on `utter-api-staging.duncanb013.workers.dev`
- the app still works through `uttervoice.com/api/*`
- the frontend Worker uses the service binding as the hosted API path
- hosted deployments fail clearly if the service binding is missing

## Follow-ups Deferred

After this lands, the next backend hardening items remain:

1. move the first abuse gate off Supabase
2. fix rate-limit identity and trust order
3. review storage token TTL and replay behavior
4. decide whether Preview URLs should also be disabled
5. decide whether a separate machine-to-machine API hostname is ever needed
