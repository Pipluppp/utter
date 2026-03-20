# S2: External Probing with supa-sniffer + curl

Backlinks: `README.md`, `S0-scope-ground-truth.md`, `S1-access-control-grants-rls.md`

Goal: test from attacker viewpoint against deployed Supabase REST/RPC.

## Tool detail: what `supa-sniffer` actually does

Repo: <https://github.com/tuliperis/supa-sniffer>

Behavior:
1. hits `/rest/v1/` to fetch OpenAPI spec.
2. extracts table/view names and RPC paths.
3. attempts anonymous reads on tables.
4. attempts RPC execution with placeholder payload.

Strength:
- fast real-world exposure signal.
- catches accidental anon-access paths.

Limits:
- weak on authenticated cross-user matrix.
- spec discovery may differ by key type/config.
- placeholder payloads can produce false positives/false negatives.

## Why it matters here

- It found a real production issue in this project (anon callable RPC).
- It is proof that visual dashboard checks are not sufficient.

## Implementation steps

1. Add runbook script wrappers.
- `scripts/security/probes/run_supa_sniffer.sh`
- `scripts/security/probes/run_curl_matrix.sh`

2. Implement curl matrix by endpoint class.
- table reads: `profiles`, `voices`, `generations`, `tasks`
- table writes: insert/update/delete attempts with publishable key
- RPC execute: critical functions, especially polling/counter helpers
- profile tamper: direct PATCH on protected fields

3. Include both key modes where possible.
- publishable key path
- legacy anon key path (if still present)

4. Store outputs for every run.
- location: `docs/security/audits/YYYY-MM-DD/`
- files: `supa-sniffer.txt`, `curl-probes.txt`

## Example command pattern

Get key from Supabase CLI:

```bash
npx supabase projects api-keys --project-ref jgmivviwockcwjkvpqra -o json
```

Run scanner:

```bash
python main.py https://jgmivviwockcwjkvpqra.supabase.co <anon_or_publishable_key>
```

## Verification checklist

- no app table exposes cross-user rows anonymously.
- anon/publishable writes denied.
- privileged RPCs deny anon/publishable execute.
- output evidence archived.

## Exit criteria

- repeatable outside-in probe suite exists.
- suite used pre-release and monthly.

Next: `S3-policy-testing-supashield.md`.
