# 2026-02-24 Task Plans

This bucket holds implementation plans moved from `docs/2026-02-23/`.

1. **Credits management foundation + contract update**
   Path: `credits-management.md`
   Status: foundation shipped; contract updated for trial + prepaid evolution.

2. **Paid credit addition pipeline (prepaid)**
   Path: `paid-credit-addition.md`
   Security integration: anti-cheat + webhook/auth checks are embedded and validated against `../2026-02-23/security-supabase/S9-post-credits-security-gate.md`.

3. **Credits architecture execution (final)**
   Path: `credits-architecture-execution-plan.md`
   Final direction: prepaid-only credits, no monthly replenish, packs `$10 -> 150,000` and `$25 -> 500,000`, generation character billing, design/clone trial-first flat rates.

4. **Credits + trials + billing implementation task**
   Path: `credits-trials-and-billing-task.md`
   Purpose: explicit file-level implementation plan for DB, edge, frontend, and tests.

5. **Qwen API integration**
   Path: `qwen-integration.md`
   Security integration: provider-abuse and data-boundary checks are embedded and validated against `../2026-02-23/security-supabase/S8-post-qwen-security-gate.md`.

Order:

- complete security baseline from `../2026-02-23/security-supabase/README.md`
- implement credits foundation extensions from `credits-trials-and-billing-task.md`
- run S9 gate evidence for credits/billing rollout
- implement Qwen integration and run S8 gate
