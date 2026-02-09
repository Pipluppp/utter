# Restoration Playbook

Use this document when the Qwen rollout causes production risk, functional regressions, or unbounded cost behavior.

## Incident Types and Trigger Conditions

Trigger restoration when one or more conditions occur:
1. Generate success rate drops below agreed SLO for two consecutive windows.
2. Qwen realtime synthesis failures exceed threshold (transport, protocol, provider errors).
3. Streaming endpoint causes unacceptable client playback failures.
4. Cost anomaly from repeated Qwen design creates or runaway generation volume.
5. Data correctness issue (missing provider metadata, orphaned generations/tasks).
6. Security issue (secret mismatch, wrong region key, leakage risk).

## Fast Rollback via Env Switch (Qwen -> Modal)

This is the default first response.

1. Set provider mode to Modal.
2. Redeploy the API function.
3. Validate critical flows.

Example (project-scoped):

```bash
supabase secrets set TTS_PROVIDER_MODE=modal
supabase functions deploy api
```

If your deployment uses explicit env files locally, update `supabase/.env.local` and restart serve:

```bash
npm run sb:serve
```

## Code Rollback Steps (Branch/Tag + Function Redeploy)

Use when env-only rollback is insufficient.

1. Switch to known-good branch/tag.
2. Deploy the edge function from that revision.
3. Re-run smoke checks.

Example:

```bash
git fetch --all --tags
git switch <known-good-branch-or-tag>
supabase functions deploy api
```

Note:
- `git switch` changes code only.
- It does not automatically revert already applied database migrations or remote secrets.

## Database Posture for Additive Migrations

Expected strategy in this initiative is additive migrations only.

Implications:
1. Rolling code backward is typically safe because old code can ignore new nullable/additive columns.
2. Immediate DB down-migration should not be required for rollback.
3. Destructive schema changes are prohibited before task 12 criteria are met.

If a bad migration was accidentally destructive:
1. Halt rollout.
2. Restore from backup/snapshot.
3. Re-apply last known-good migration sequence.

## Local Recovery Runbook

1. Switch code:

```bash
git switch <known-good-branch>
```

2. Align local DB if needed:

```bash
npm run sb:reset
```

3. Serve local API:

```bash
npm run sb:serve
```

4. Validate:

```bash
npm run test:db
npm run test:edge
npm --prefix frontend run check
npm --prefix frontend run typecheck
```

## Staging/Production Recovery Runbook

1. Flip provider mode to Modal:

```bash
supabase secrets set TTS_PROVIDER_MODE=modal
```

2. Ensure Modal secrets are present and valid:

```bash
supabase secrets set MODAL_JOB_SUBMIT=<url>
supabase secrets set MODAL_JOB_STATUS=<url>
supabase secrets set MODAL_JOB_RESULT=<url>
supabase secrets set MODAL_JOB_CANCEL=<url>
supabase secrets set MODAL_ENDPOINT_VOICE_DESIGN=<url>
```

For forward re-cutover reference, qwen settings are pinned to:
- `DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com`
- `DASHSCOPE_REGION=intl`
- `QWEN_VC_TARGET_MODEL=qwen3-tts-vc-realtime-2026-01-15`
- `QWEN_VD_TARGET_MODEL=qwen3-tts-vd-realtime-2026-01-15`
- `QWEN_MAX_TEXT_CHARS=2000`

3. Redeploy edge function:

```bash
supabase functions deploy api
```

4. Verify with smoke suite:
- `/api/health`
- `/api/languages`
- clone upload-url/finalize
- `/api/generate` + `/api/tasks/:id`
- `/api/voices/design/preview`

5. Confirm monitoring recovery before closing incident.

## Post-Rollback Verification Checklist

- [ ] `GET /api/health` returns `{ ok: true }`.
- [ ] `GET /api/languages` reports expected provider capabilities.
- [ ] Modal generate task creation works and completes.
- [ ] Task polling returns terminal status and audio URL.
- [ ] Voice clone finalize succeeds.
- [ ] Voice design preview succeeds.
- [ ] No cross-tenant leakage in voices/generations/tasks.
- [ ] Error responses remain JSON `{ detail: string }`.

## Incident Report Template

```text
Incident title:
Date/time started (UTC):
Date/time mitigated (UTC):
Environment(s): [local/staging/prod]
Trigger condition(s):
User impact summary:
Provider mode at incident start:
Mitigation actions taken:
Rollback type used: [env switch / code rollback / db restore]
Verification evidence:
Open follow-ups:
Owner:
```

## Linked Task Docs

- Main orchestration: `docs/qwen-integration/README.md`
- Rollout and cutover: `docs/qwen-integration/tasks/11-rollout-cutover.md`
- Cleanup gating: `docs/qwen-integration/tasks/12-post-stabilization-cleanup.md`
