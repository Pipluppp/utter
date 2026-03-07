# Owners and SLA Template (2026-03-03 Security Sweep)

Use this file to assign explicit ownership and response times before starting active penetration testing.

## 1) Owner matrix

| Surface | Primary owner | Backup owner | Escalation owner | Notes |
|---|---|---|---|---|
| Frontend SPA + frontend worker | _TBD_ | _TBD_ | _TBD_ | Auth UX, headers, bundle exposure |
| API Worker (`/api/*`) | _TBD_ | _TBD_ | _TBD_ | Route authz, validation, errors |
| Queue consumer + orchestration | _TBD_ | _TBD_ | _TBD_ | Retry, replay, terminal-state safety |
| Supabase Auth + key model | _TBD_ | _TBD_ | _TBD_ | Publishable vs secret/service key boundaries |
| Postgres/RLS/grants/functions | _TBD_ | _TBD_ | _TBD_ | Tenant isolation and function exposure |
| Credits + billing + Stripe webhook | _TBD_ | _TBD_ | _TBD_ | Ledger integrity/idempotency/fraud controls |
| Cloudflare infra (Wrangler, R2, Queues, secrets) | _TBD_ | _TBD_ | _TBD_ | Env parity and misconfiguration risk |
| Incident commander/security triage | _TBD_ | _TBD_ | _TBD_ | Final severity and release decision |

## 2) Severity rubric

| Severity | Definition | Example in this system |
|---|---|---|
| Critical | Active exploit path with major impact; no meaningful compensating control | Cross-tenant read/write, service key leakage, credits/billing forgery |
| High | Likely exploitable weakness with strong business/security impact | Auth bypass on protected route, queue replay causing state corruption |
| Medium | Security weakness needing fix but lower exploitability/impact | Overly broad CORS, weak logging on sensitive actions |
| Low | Hard-to-exploit weakness or hygiene gap | Missing non-sensitive security header, low-risk dependency warning |

## 3) SLA targets

| Severity | Triage SLA | Mitigation SLA | Permanent fix SLA |
|---|---|---|---|
| Critical | 4 hours | 24 hours | 72 hours |
| High | 1 business day | 3 business days | 7 business days |
| Medium | 3 business days | 10 business days | Next planned sprint |
| Low | 5 business days | As scheduled | Backlog |

## 4) Release policy

1. Critical findings: must be fixed or formally risk-accepted by escalation owner before release.
2. High findings: must be fixed, mitigated, or deferred with explicit owner/date and written rationale.
3. Medium/Low findings: tracked in backlog with owner/date; no silent deferral.

## 5) Triage workflow

1. Intake: log finding in tracker with reproduction evidence.
2. Validate: reproduce in staging and confirm severity.
3. Contain: apply immediate control if needed (disable route, tighten limit, rotate secret).
4. Remediate: implement fix and regression test.
5. Verify: retest and attach evidence.
6. Close: sign-off by owner and incident commander.

## 6) Minimum artifact set per finding

1. Evidence file using `evidence-template.md`
2. Linked PR/commit with fix
3. Regression test reference
4. Final severity and closure decision
