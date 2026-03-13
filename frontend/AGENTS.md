# Agent notes (frontend)

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS v4
- Format/lint: Oxfmt + Oxlint

## Commands

- Dev: `npm run dev`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Verify: `npm run check`
- Fix: `npm run check:write`
- CI: `npm run ci`

From repo root, you can run:

- `npm --prefix frontend run dev`
- `npm --prefix frontend run check:write`

## Oxc

- Config: `frontend/.oxfmtrc.jsonc`, `frontend/.oxlintrc.json`
- VS Code: `.vscode/settings.json` sets Oxc as the formatter for JS/TS/JSON/CSS.
- Keep save behavior predictable: global fix/organize-import code actions are configured as "explicit".
