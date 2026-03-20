# Implementation Checklist (2026-03-03 Security Sweep)

## Phase A: Maturity and modeling

- [ ] `owners-and-sla.md` completed with named owners and escalation path
- [ ] Plan 01 completed (ownership, severity, response process)
- [ ] Plan 02 completed (threat model and attack-surface register)

## Phase B: Component security sweeps

- [ ] Quick-win set from `security-test-matrix.md` executed
- [ ] Plan 03 completed (frontend/session/security headers/dependency posture)
- [ ] Plan 04 completed (API authz, queue/task invariants, rate-limit abuse)
- [ ] Plan 05 completed (Supabase auth/key model, RLS, grants, integrity)
- [ ] Plan 06 completed (Cloudflare env/bindings, secrets, R2, queue/DLQ)
- [ ] Plan 07 completed (abuse/fraud/platform misuse)

## Phase C: Pen testing and remediation

- [ ] Plan 08 completed (active pen testing execution)
- [ ] Plan 09 completed (fixes, verification, governance)
- [ ] Findings captured with `evidence-template.md`

## Release gate

- [ ] Critical findings resolved or risk-accepted
- [ ] High findings remediated or formally deferred with owner/date
- [ ] Regression tests added for high-risk classes
- [ ] Runbooks updated and exercised
