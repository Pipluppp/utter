# Frontend Loading Skeleton Implementation Prompt

Use this prompt to kick off implementation of the loading skeleton plan in this repo.

## Prompt

```md
Implement the frontend loading skeleton plan in this repo.

Start by reading:
- `AGENTS.md`
- `docs/2026-03-07/frontend-loading-skeleton-plan.md`

Use these skills for this task, in this order:
- `frontend-design` (`C:/Users/Duncan/Desktop/utter/.agents/skills/frontend-design/SKILL.md`)
- `tailwind-design-system` (`C:/Users/Duncan/Desktop/utter/.agents/skills/tailwind-design-system/SKILL.md`)
- `vercel-react-best-practices` (`C:/Users/Duncan/Desktop/utter/.agents/skills/vercel-react-best-practices/SKILL.md`)

Project context:
- Frontend stack: React 19 + Vite + TypeScript + Tailwind v4
- Formatter/linter: Biome
- Existing generic skeleton primitive: `frontend/src/components/ui/Skeleton.tsx`
- Existing strong references: `frontend/src/pages/Voices.tsx` and `frontend/src/pages/History.tsx`
- Preserve the current Utter visual language. Do not introduce a new design system or a generic SaaS look.

Goal:
- replace low-context loading text with layout-matched skeletons where the user is waiting on route or data structure
- keep user-triggered action loaders as button/progress states where that is already the correct UX

Primary targets:
1. `frontend/src/app/Layout.tsx`
2. `frontend/src/app/RequireAuth.tsx`
3. `frontend/src/app/TopBar.tsx`
4. `frontend/src/pages/Generate.tsx`
5. `frontend/src/pages/About.tsx`
6. `frontend/src/pages/account/AccountLayout.tsx`
7. `frontend/src/pages/account/Overview.tsx`
8. `frontend/src/pages/account/Credits.tsx`
9. `frontend/src/pages/account/Profile.tsx`

Implementation requirements:
- keep using `frontend/src/components/ui/Skeleton.tsx` as the base primitive
- create reusable skeleton components where it reduces duplication
- make route-level fallbacks shape-accurate for marketing, app, and account surfaces
- ensure account pages do not render misleading `0`, `...`, `Loading...`, or empty-state content during initial load
- replace the fake loading option in the Generate voice select with a proper skeleton treatment
- replace the About languages inline loading text with a small skeleton fragment
- do not degrade existing `VoicesSkeleton` or `HistorySkeleton`
- do not add broad try/catch blocks or success-shaped fallbacks
- keep the code ASCII-only unless the file already requires otherwise

Explicit non-goals:
- do not replace action-driven loading states in `Auth`, `Clone`, `Design`, `Voices`, or `History` with skeletons
- do not redesign unrelated page layouts
- do not add new dependencies unless clearly necessary

Execution steps:
1. Audit the current loading branches in the target files.
2. Implement shared skeleton components first.
3. Wire route-level and account-level loading states.
4. Update Generate and About.
5. Run `npm --prefix frontend run check`.
6. Summarize what changed, what was intentionally left alone, and any follow-up risks.

Acceptance criteria:
1. No lazy route fallback shows only the word `Loading...`.
2. Pending auth uses a skeletonized shell instead of plain text.
3. `/account`, `/account/profile`, and `/account/credits` show skeletons instead of placeholder text or misleading empty content during initial fetch.
4. `/generate` no longer exposes loading as a select option label.
5. `/about` no longer shows a raw inline loading word for languages.
6. `frontend` Biome checks pass.
```
