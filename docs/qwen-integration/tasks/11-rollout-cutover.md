# 11 - Rollout and Cutover

## Goal

Execute a safe staged rollout from Modal-default to Qwen-default with measurable gates and immediate restoration options.

## In Scope

- Staging rollout sequence.
- Production cutover checkpoints.
- Secrets/env management for both providers.
- Monitoring and operational gates.

## Out of Scope

- Post-stabilization destructive cleanup.
- Long-term cost optimization redesign.

## Interfaces Impacted

- Supabase secrets and edge function deployment.
- API route behavior by `TTS_PROVIDER_MODE`.
- Frontend provider-aware generate behavior.

## Files/Modules Expected to Change

- Deployment runbooks (docs only in this task).
- Environment/secrets configuration in Supabase project.

## Step-by-Step Implementation Notes

1. Pre-cutover requirements.
- Tasks 01-10 completed and signed off.
- Restoration playbook tested once in staging.
- Model Studio is activated in the target account.
- DashScope API key is created in the intended workspace and validated against intl endpoint.
- Security matrix from task 10 is green (auth, abuse, isolation, failure safety, observability).
- S8 evidence draft is prepared for final signoff.

2. Staging rollout sequence.
1. Deploy additive schema migrations.
2. Deploy provider-adapter code with mode still `modal`.
3. Verify Modal regressions.
4. Set Qwen secrets and qwen target model envs.
5. Flip staging `TTS_PROVIDER_MODE=qwen`.
6. Run qwen smoke checks (clone/design/generate task flow).
7. Run staging security probes (auth deny, burst behavior, cross-user isolation, failure safety).
8. Record metrics and defects.

3. Production cutover sequence.
1. Confirm staging gates met.
2. Confirm restoration owner on call.
3. Confirm S8 security evidence has no unresolved high/critical findings.
4. Set production `TTS_PROVIDER_MODE=qwen`.
5. Redeploy edge function.
6. Run production smoke checks.
7. Run focused post-deploy security checks (auth deny + burst + cross-user spot checks).
8. Monitor first window intensively.

4. Required secrets matrix.
- Modal:
- `MODAL_JOB_SUBMIT`
- `MODAL_JOB_STATUS`
- `MODAL_JOB_RESULT`
- `MODAL_JOB_CANCEL`
- `MODAL_ENDPOINT_VOICE_DESIGN`
- Qwen:
- `DASHSCOPE_API_KEY`
- `DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com`
- `DASHSCOPE_REGION=intl`
- `QWEN_VC_TARGET_MODEL=qwen3-tts-vc-2026-01-22`
- `QWEN_VD_TARGET_MODEL=qwen3-tts-vd-2026-01-26`
- `QWEN_MAX_TEXT_CHARS=600`
- Runtime:
- `TTS_PROVIDER_MODE`

5. Monitoring checkpoints.
- Generate start success rate.
- Task completion rate.
- Durable audio persistence success rate.
- Median generation latency.
- Cancel success rate.
- Provider-specific failure categories.

6. Abort criteria.
- Breach of error/latency thresholds for sustained window.
- Data corruption or cross-tenant exposure.
- Unbounded provider billing behavior.
- Security regression in authz/abuse/failure-safety checks.
- Note: this phase does not add a new advanced quota system. Cost control relies on existing controls plus verified route-level abuse protections.

## Data and Failure Modes

Failure modes:
1. Secrets mismatch by region endpoint.
- Mitigation: preflight endpoint/key validation in staging.
2. Hidden modal-only assumptions in qwen mode.
- Mitigation: run full mode matrix before production cutover.
3. Partial rollout without owner coverage.
- Mitigation: explicit change window and incident commander assignment.

## Validation Checks

### Preconditions

- Task 10 validation matrix is green.
- Restoration process has been rehearsed in staging.

### Command list

```bash
supabase secrets set TTS_PROVIDER_MODE=qwen
supabase functions deploy api
curl -s https://<project-ref>.supabase.co/functions/v1/api/health
curl -s https://<project-ref>.supabase.co/functions/v1/api/languages
```

Operational checks:

```text
1) Clone finalize in qwen mode
2) Design preview + save in qwen mode
3) Generate v1 task mode
4) Cancel task path
5) Inputs over configured cap are rejected consistently
6) Completed tasks include durable replayable output
7) Protected routes deny anon/invalid-token requests
8) Burst traffic shows controlled limiting behavior
9) Cross-user read/write spot checks remain denied
```

### Expected success output/state

- Provider mode flips cleanly by env without code change.
- Core flows pass smoke checks immediately after deploy.
- Monitoring remains within agreed thresholds.
- Security checks remain green after cutover.

### Failure signatures

- Mode flips but `/api/languages` capabilities do not update.
- Qwen routes fail due to missing region/key mapping.
- Completed qwen tasks are missing durable output.
- Auth-protected Qwen endpoints accept unauthenticated traffic.
- Provider failure responses leak internal details or sensitive config.

## Exit Criteria

- Production runs in qwen mode within SLOs.
- Restoration path remains available and tested.
- Stabilization window starts with no blocker defects.
- S8 security gate evidence is complete and approved.

## Rollback Note

Follow `docs/qwen-integration/restoration.md` immediately when abort criteria are met.
