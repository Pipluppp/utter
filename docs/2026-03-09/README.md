# 2026-03-09 Task Plans

This folder captures the March 9 triage and the next implementation plans for the non-security workstreams discussed today.

## Scope for today

- Review unfinished planning work from `docs/2026-03-07/`
- Confirm whether loading skeleton work is already done
- Prioritize the next implementation branch from `main`
- Write fresh implementation plans for the selected tasks
- Skip the `security` workstream for now

## Outcome

1. `00-triage-and-branching.md`
2. `01-multi-job-workflows-plan.md`
3. `02-design-language-graphics-plan.md`
4. `03-loading-skeleton-plan.md`
5. `04-copy-alignment-plan.md`
6. `05-privacy-and-terms-alignment-plan.md`
7. `06-pricing-and-credit-rebalance-plan.md`

## Selected branch

- Branch: `feature/multi-job-workflows`
- Reason: the highest product gap is still task orchestration and task visibility. Current code still blocks concurrent `generate` jobs, tracks only one task per type on the frontend, and has no `GET /api/tasks` feed for a real job center.
