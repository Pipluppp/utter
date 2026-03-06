# Security Test Matrix (Starter)

This matrix is the practical execution layer for Plans 03-08.

## Difficulty legend

- `Easy`: single-command or short deterministic check.
- `Moderate`: multi-step check with setup or interpretation needed.
- `Hard`: race/replay/abuse simulation requiring repeated runs and deeper analysis.

## Preflight

1. Start local dependencies:

```bash
supabase start
npm --prefix workers/api run dev
```

2. Baseline checks:

```bash
npm --prefix workers/api run typecheck
npm --prefix frontend run check
npm run test:db
npm run test:worker:local
```

## Matrix

| ID | Area | Check | Method | Command / Procedure | Expected result | Difficulty |
|---|---|---|---|---|---|---|
| FE-01 | Frontend | Hosted Supabase URL only | Static bundle grep | `rg -n "127\.0\.0\.1:54321" frontend/dist` | No matches | Easy |
| FE-02 | Frontend | No secret keys in bundle | Secret pattern grep | `rg -n "service_role|sb_secret_|SUPABASE_SERVICE_ROLE_KEY" frontend/dist` | No matches | Easy |
| FE-03 | Frontend Worker | Security headers baseline | HTTP head check | `curl -I https://utter.duncanb013.workers.dev` | Required headers present (CSP/referrer/nosniff/frame policy as decided) | Moderate |
| FE-04 | Frontend/Auth | Auth works with hosted project | Manual + network inspect | Login at `/auth`, inspect network base URL | Requests target hosted `*.supabase.co` only | Easy |
| API-01 | API authz | Protected routes deny unauth | Route probe | `curl -i -X POST https://utter-api-staging.duncanb013.workers.dev/api/generate` | `401` | Easy |
| API-02 | API authz | Cross-tenant access denied | Integration test | Use two users for `/api/tasks/:id`, `/api/voices/:id/preview` | `403/404` as designed | Moderate |
| API-03 | API validation | Malformed payload handling | Fuzz small set | Send invalid JSON, invalid UUID, oversized text | Stable `4xx`, no crash/leak | Easy |
| API-04 | API side effects | `GET /api/tasks/:id` is read-only | DB diff check | Read task row before+after repeated GET | No writes/side effects from GET | Moderate |
| API-05 | Rate limit | Tier enforcement | Scripted burst | Reuse `rate_limits.test.ts` style loop or curl loop | `429` with retry metadata | Moderate |
| Q-01 | Queue safety | Cancelled task not overwritten | Race simulation | Submit task, cancel quickly, allow consumer retry | Task remains terminal-safe (not flipped to completed) | Hard |
| Q-02 | Queue replay | Duplicate message idempotency | Replay publish | Re-publish equivalent message to queue | No duplicate finalization/ledger corruption | Hard |
| Q-03 | Queue resilience | DLQ path works | Forced failure route | Trigger non-recoverable processing error and inspect DLQ | Message routed to DLQ with traceable reason | Hard |
| DB-01 | Supabase keys | Key boundary correctness | Config review | Verify frontend uses publishable key; worker uses secrets | No secret key in client path | Easy |
| DB-02 | Grants/RLS | Tenant isolation | SQL + API tests | Run existing pgTAP + cross-user API probes | No cross-tenant read/write | Moderate |
| DB-03 | Function exposure | RPC/exec least privilege | Schema audit | Review execute grants on security-sensitive funcs | No privileged function callable by anon/authenticated unexpectedly | Moderate |
| DB-04 | Ledger integrity | Credit/billing idempotency | Duplicate event tests | Repeat debit/refund/webhook events with same idempotency key | Single effect only | Moderate |
| CF-01 | Wrangler env parity | Non-inheritable keys explicitly set | Config + dry-run | `npm --prefix workers/api run check` | Expected bindings listed for target env | Easy |
| CF-02 | Secrets posture | Required secrets exist in env | Wrangler audit | `cd workers/api && npx wrangler secret list --env staging` | Full required set present | Easy |
| CF-03 | R2 access | Signed token tamper resistance | Token mutation test | Modify 1 char in storage token URL and request | `401/403`; no object access | Moderate |
| CF-04 | Queue bindings | Producer/consumer wiring | Wrangler audit | `cd workers/api && npx wrangler queues list` | Expected queue(s), producer(s), consumer(s) | Easy |
| AB-01 | Abuse | Account farming/friction review | Manual + log review | Attempt rapid signup/login patterns in staging | Detection/limits visible; no silent abuse | Moderate |
| AB-02 | Abuse | Credit drain concurrency attempt | Parallel requests | Fire concurrent generate/clone paths with same account | No negative or inconsistent ledger state | Hard |
| AB-03 | Abuse | Queue/resource exhaustion | Burst submission | Rapidly submit async tasks, observe rate/queue behavior | Controlled degradation, no crash, clear signals | Hard |
| OPS-01 | Observability | Security event logs present | Tail verification | `npx wrangler tail utter-api-staging --format pretty` during tests | Auth/rate-limit/queue failure events visible | Easy |
| OPS-02 | Incident readiness | Runbook drill | Tabletop + dry run | Walk one mock incident from detection to closure | Timeline, owner actions, evidence captured | Moderate |

## Recommended first pass (quick win set)

1. FE-01, FE-02, FE-04
2. API-01, API-03
3. DB-01, DB-02
4. CF-01, CF-02, CF-04
5. OPS-01

These checks are mostly `Easy` and catch a large share of common "vibe-coded" security mistakes.
