# Task 3: Qwen API Integration

## Goal

Integrate official Qwen API as a production provider path while preserving reliability through controlled rollout and fallback behavior.

## Why this is third

- Provider integration should land after security and credit controls are trustworthy.
- Cost-bearing API calls need abuse protection and usage enforcement already in place.

## Scope (initial)

### A. Provider abstraction and feature flags

- Ensure provider selection can be controlled by env/config/flags.
- Keep safe fallback behavior (Modal path) during rollout.

### B. Qwen client integration

- Add request/response mapping for clone/design/generate paths as applicable.
- Implement retry/timeout/error normalization.
- Capture provider-specific metadata for debugging and cost tracking.

### C. Progressive rollout

- Start with limited traffic/canary users.
- Compare latency, output quality, and failure rate against current provider.
- Define rollback triggers and a fast fallback switch.

### D. Post-cutover cleanup

- Remove dead code paths once confidence is high.
- Update docs and runbooks to reflect final provider topology.

## Integrated security requirements (blocking)

Security checks are part of this plan execution, not a later add-on:

1. Credential custody.
- Qwen API key is server-side secret only.
- no credential leak in frontend bundle, logs, or error responses.

2. Route access control.
- all Qwen cost-bearing routes remain JWT-protected.
- no anonymous trigger path for generate/design/clone.

3. Abuse resistance.
- payload bounds are enforced (text/file/request constraints).
- burst attempts are rate-limited and return controlled `429`.

4. Failure safety.
- upstream provider errors/timeouts do not leak internals.
- retries are bounded.
- kill switch/fallback to Modal is fast and documented.

5. Cross-user data boundary.
- no cross-tenant task/voice/audio read or write through Qwen path.

6. Observability.
- logs include request_id, user_id, endpoint, provider, and cost-significant outcomes.
- alertable signals exist for provider failures and abuse spikes.

## Explicit non-goals (for this task)

- Broad model experimentation unrelated to current product flows.
- Large frontend redesigns unrelated to provider integration.

## Deliverables

- Qwen provider client integrated behind feature flags.
- Canary rollout plan and rollback procedure.
- Monitoring dashboard metrics for provider health/cost.
- Updated docs covering runtime behavior and operations.

## Acceptance criteria (initial)

- [ ] Qwen path is callable for selected traffic without breaking existing flows.
- [ ] Fallback to existing provider is immediate and reliable.
- [ ] Error rates and latency are within agreed thresholds.
- [ ] Provider usage is visible in logs/metrics for operational debugging.
- [ ] Security checks above are validated in testing + rollout steps with evidence artifacts.

## Open questions for next planning pass

- Which endpoints migrate first (generate-only vs full feature set)?
- What are cutover thresholds for quality/cost/latency?
- When should legacy provider paths be fully retired?

## Mandatory post-implementation security gate

During implementation and before final completion, execute and record:
- `docs/2026-02-23/security-supabase/S8-post-qwen-security-gate.md`

Do not treat Qwen integration as complete until S8-mapped evidence passes.
