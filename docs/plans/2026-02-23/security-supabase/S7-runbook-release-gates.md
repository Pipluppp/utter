# S7: Runbook + Release Security Gates

Backlinks: `README.md`, `S5-security-scanner-pipeline.md`, `S6-rate-limits-observability.md`

Goal: operational clarity. any engineer can run checks and ship safely.

## Required docs to add

1. `docs/security/runbook.md`
2. `docs/security/checklists/release-security-checklist.md`
3. `docs/security/incidents/incident-template.md`

## Release gate checklist (must pass)

1. Tests:
- `npm run test:all` green.

2. Access control:
- pgTAP grants tests green.
- no new RPC/table without explicit grant policy + tests.

3. Probe results:
- latest `supa-sniffer` run no critical exposure.
- curl matrix no anon write/RPC bypass.

4. Policy checks:
- latest `supashield` audit/lint/test baseline acceptable.

5. Scanner pipeline:
- no unresolved critical/high findings.

6. Observability:
- rate-limit logs present.
- alert hooks healthy.

## Incident playbook (minimum)

Trigger examples:
- suspicious 429 spike
- unexpected RPC/table accessibility
- secrets leak alert

Immediate actions:
1. confirm signal with reproducible probe.
2. contain:
- tighten rate limits
- revoke risky grants
- disable vulnerable route if needed
3. rotate exposed credentials.
4. deploy fix + rerun probes.
5. write incident report and prevention action.

## Cadence

- weekly: quick probes + scanner delta review.
- monthly: full supashield + supa-sniffer + manual checklist.
- pre-release: gate checklist mandatory.

## Exit criteria

- runbook docs exist and are reviewed.
- release gate used in at least one real release cycle.
- incident drill completed once.

Done state for security workstream: back to `README.md` checklist, mark items complete.
