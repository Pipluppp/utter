# S5: Security Scanner Pipeline (CI)

Backlinks: `README.md`, `S3-policy-testing-supashield.md`, `S4-owasp-2025-control-map.md`

Goal: automated low-hanging-fruit detection in PR and scheduled runs.

## Pipeline shape

New workflow: `.github/workflows/security.yml`

Jobs:
1. `semgrep_sast`
2. `osv_sca`
3. `gitleaks_secrets`
4. `zap_dast_baseline`
5. `supashield_policy` (staging/local context only, phase-based)

## Step-by-step implementation

1. Add workflow with triggers.
- PR to `main`
- push to `main`
- nightly schedule

2. Add SAST job.
- run Semgrep (or CodeQL if GH-native preference).
- output SARIF/JSON artifact.

3. Add SCA job.
- run OSV-Scanner on lockfiles and manifests.
- attach results artifact.

4. Add secret scan job.
- run gitleaks.
- fail on verified secret exposures.

5. Add DAST baseline job.
- run OWASP ZAP baseline against `https://utter-wheat.vercel.app`.
- include API-relevant paths (`/auth`, `/generate`, `/voices`, `/history`).

6. Add supashield job (phase 1 optional/non-blocking).
- uses `SUPASHIELD_DATABASE_URL` from secrets.
- run `audit`, `lint`, `test --json`.
- upload artifacts.

## Gating policy (phased)

Phase 1:
- all jobs run.
- only secrets fail hard.
- others warn + artifact + issue.

Phase 2:
- fail on critical/high SAST/SCA/DAST.
- fail on supashield critical drift or policy test failures.

Phase 3:
- enforce SLA gates on unresolved medium findings.

## Verification

- workflow runs on PR and nightly.
- artifacts downloadable.
- fail/pass behavior matches phase policy.

## Exit criteria

- security workflow merged and active.
- triage rubric documented in `S7` release checklist.

Next: `S6-rate-limits-observability.md`.
