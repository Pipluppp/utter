# S3: Policy Testing with SupaShield

Backlinks: `README.md`, `S1-access-control-grants-rls.md`, `S2-external-probing-supa-sniffer.md`

Goal: deep DB policy/grant/storage tests with scenario expectations and drift detection.

## Tool detail: what `supashield` does

Repo: <https://github.com/Rodrigotari1/supashield>
Site: <https://supashield.app/>

It connects directly to Postgres and does:
- `audit`: detect RLS disabled, unsafe grants, public buckets, sensitive column grants.
- `lint`: static lint on policy expressions.
- `coverage`: report role-operation coverage by table.
- `test`: execute scenario-based CRUD permission tests.
- `test-storage`: same model for storage policies.
- `snapshot` + `diff`: detect policy drift over time.
- `export-pgtap`: emit pgTAP-style tests from policy config.

Strength:
- deeper than HTTP probes.
- machine-readable JSON for CI.
- good for regression and drift detection.

Limits:
- needs DB credential (`SUPASHIELD_DATABASE_URL`).
- best on local/staging first. prod use needs strict credential policy.

## Dashboard criticism response (short)

"Dashboard already shows RLS and bucket visibility" is incomplete.
- true for obvious states.
- false for full regression safety, scenario coverage, drift detection.
- we already had a real gap found by probe tooling.

Decision: dashboard is quick visual check only, not security gate.

## Implementation steps

1. Install and pin tool version in dev workflow.

```bash
npm install -D supashield
```

2. Bootstrap config.

```bash
supashield init --url "$SUPASHIELD_DATABASE_URL"
```

3. Author `.supashield/policy.yaml` for current app model.
- tables: `public.profiles`, `public.voices`, `public.generations`, `public.tasks`
- buckets: `references`, `generations`
- scenarios:
  - `anonymous_user`
  - `authenticated_owner`
  - `authenticated_other_user`

4. Run baseline suite.

```bash
supashield audit --url "$SUPASHIELD_DATABASE_URL"
supashield lint --url "$SUPASHIELD_DATABASE_URL"
supashield coverage --url "$SUPASHIELD_DATABASE_URL"
supashield test --url "$SUPASHIELD_DATABASE_URL" --json
supashield test-storage --url "$SUPASHIELD_DATABASE_URL"
supashield snapshot --url "$SUPASHIELD_DATABASE_URL"
```

5. Add drift check.

```bash
supashield diff --url "$SUPASHIELD_DATABASE_URL"
```

6. CI integration (phase 1 non-blocking, phase 2 blocking).

## Credential policy

- prefer local/staging DB URL.
- avoid broad prod superuser in CI.
- use dedicated secret-scoped DB role where possible.

## Verification

- findings map to real policy/grant gaps, not noise only.
- reruns stable.
- diff catches policy changes between runs.
- JSON artifacts archived to `docs/security/audits/YYYY-MM-DD/`.

## Exit criteria

- supashield baseline adopted.
- policy.yaml reflects real app permission model.
- CI job exists (non-blocking at first).

Next: `S4-owasp-2025-control-map.md`.
