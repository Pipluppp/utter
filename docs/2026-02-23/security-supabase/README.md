# Security + Supabase Hardening Specs

Purpose: implementation pack for security workstream. Not brainstorm. Each file is executable spec.

## Scope

- App: `https://utter-wheat.vercel.app`
- Supabase project: `jgmivviwockcwjkvpqra`
- Edge API: `supabase/functions/api/index.ts`
- Tables: `profiles`, `voices`, `generations`, `tasks`
- Storage: `references`, `generations`

## Task board

1. `S0-scope-ground-truth.md` (must read first)
   Status: `active`
   Output: shared baseline, no assumption drift.

2. `S1-access-control-grants-rls.md`
   Status: `active`
   Output: least-privilege grants + RLS + regression tests.

3. `S2-external-probing-supa-sniffer.md`
   Status: `active`
   Output: outside-in attack probes + release evidence.

4. `S3-policy-testing-supashield.md`
   Status: `active`
   Output: DB-level policy lint/test/coverage + drift checks.

5. `S4-owasp-2025-control-map.md`
   Status: `active`
   Output: OWASP concepts mapped to concrete controls in this repo.

6. `S5-security-scanner-pipeline.md`
   Status: `active`
   Output: SAST/SCA/Secrets/DAST CI workflow.

7. `S6-rate-limits-observability.md`
   Status: `active`
   Output: abuse controls + logs + alerts for high-cost endpoints.

8. `S7-runbook-release-gates.md`
   Status: `active`
   Output: operator runbook + release security checklist.

9. `S8-post-qwen-security-gate.md`
   Status: `pending` (run after `../../2026-02-24/qwen-integration.md` implementation)
   Output: proof Qwen path is not abusable and not exposing provider credentials.

10. `S9-post-credits-security-gate.md`
    Status: `pending` (run after `../../2026-02-24/credits-management.md` implementation)
    Output: proof credits cannot be cheated (race, tamper, replay, refund abuse).

## Dependency order

- `S0` -> `S1` -> (`S2` + `S3`) -> `S5` -> `S6` -> `S7`
- `S4` runs parallel. It guides design/triage decisions in all other tasks.
- `S8` runs only after Task 3 (`../../2026-02-24/qwen-integration.md`) ships.
- `S9` runs only after Task 2 (`../../2026-02-24/credits-management.md`) ships.

## Tool-to-task map

- `supa-sniffer`
  - Task: `S2`
  - Purpose: outside-in REST/RPC anonymous exposure check.
  - Output: `supa-sniffer.txt`, high-signal leaks for immediate fix.

- `supashield`
  - Task: `S3`
  - Purpose: DB-level audit/lint/coverage/scenario test/snapshot-diff.
  - Output: `supashield-audit.json`, `supashield-test.json`, drift signal.

- OWASP Top 10 (2025)
  - Task: `S4`
  - Purpose: threat/control framing; maps categories to concrete project controls.
  - Output: control map used by `S5`, `S6`, `S7`.

- SAST/SCA/Secrets/DAST scanners
  - Task: `S5`
  - Purpose: low-hanging-fruit detection in CI.
  - Output: CI artifacts + severity gates.

- Rate-limit + logging stack
  - Task: `S6`
  - Purpose: abuse-cost control and detection.
  - Output: 429 enforcement + alertable telemetry.

- Post-Qwen abuse gate
  - Task: `S8`
  - Purpose: validate provider-key custody, abuse resistance, failure safety after Qwen cutover.
  - Output: pass/fail report + blocking issues.

- Post-credits anti-cheat gate
  - Task: `S9`
  - Purpose: validate atomic debit/idempotency/race resistance and tamper denial.
  - Output: pass/fail report + blocking issues.

## Definition of done (workstream)

- No anon write path on app tables or privileged RPCs.
- Cross-user read/write/delete denied in DB + storage + edge routes.
- Scanner pipeline live in CI, with severity gates.
- `supa-sniffer` and `supashield` both run, artifacts stored.
- Rate limit active on expensive endpoints with 429 contract.
- Runbook usable by another engineer without tribal context.

## Evidence folder convention

- `docs/security/audits/YYYY-MM-DD/`
- Required artifacts per run:
  - `supa-sniffer.txt`
  - `curl-probes.txt`
  - `supashield-audit.json`
  - `supashield-test.json`
  - `security-ci-summary.md`

## Quick command set

```bash
npm run test:all
npx supabase db push --linked --include-all
npx supabase functions deploy api --project-ref jgmivviwockcwjkvpqra
```

Next file to open: `S0-scope-ground-truth.md`.
