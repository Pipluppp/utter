# 2026-02-03 Frontend Refactor + UX Fix Plans

This folder consolidates the React/Tailwind refactor docs and the follow-up plans for improving the current Jinja/vanilla frontend while the refactor is in flight.

---

## React Refactor Docs (source of truth)

| Doc | Purpose |
|-----|---------|
| **[frontend-refactor/](./frontend-refactor/README.md)** | Index of the React refactor docs |
| **[react-refactor-plan.md](./frontend-refactor/react-refactor-plan.md)** | End-to-end plan to migrate the frontend to React + Tailwind |
| **[frontend-inventory.md](./frontend-refactor/frontend-inventory.md)** | Ground truth of current pages/behaviors/state/API calls to preserve |
| **[react-frontend-guidelines.md](./frontend-refactor/react-frontend-guidelines.md)** | Guardrails to keep the React rewrite appropriately simple |

## Codex skills (available)

This repo/session currently includes:
- `frontend-design`: build/beautify UI components/pages with high design quality (React or HTML/CSS)
- `tailwind-design-system`: Tailwind CSS v4 design tokens + component patterns (variants, responsive, accessibility)
- `web-design-guidelines`: audit UI against Web Interface Guidelines (UX + accessibility best practices)
- `skill-creator`: create/update a custom skill (turn our conventions into a repeatable workflow)
- `skill-installer`: install additional skills (curated list or from a repo path)

Use them as needed:
- Designing/styling UI: `frontend-design`
- Standardizing Tailwind v4 tokens/components: `tailwind-design-system`
- Pre-ship UI audit (a11y/UX): `web-design-guidelines`

---

## Implementation Plans (current frontend)

| Plan | Goal |
|------|------|
| **[history-search-voice-highlight-plan.md](./history-search-voice-highlight-plan.md)** | Search History by voice name + highlight matches |
| **[design-preview-playback-fix-plan.md](./design-preview-playback-fix-plan.md)** | Fix `/design` preview play button not playing |
| **[voices-page-improvements-plan.md](./voices-page-improvements-plan.md)** | Tag clone vs designed voices, show reference transcript, add Voices search + pagination |
