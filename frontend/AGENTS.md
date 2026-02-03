# Agent notes (frontend)

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS v4
- Format/lint: Biome

## Commands

- Dev: `npm run dev`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Biome verify: `npm run check`
- Biome fix: `npm run check:write`
- Biome CI: `npm run ci`

From repo root, you can run:

- `npm --prefix frontend run dev`
- `npm --prefix frontend run check:write`

## Biome

- Config: `frontend/biome.json`
- VS Code: `.vscode/settings.json` sets Biome as the formatter for JS/TS/JSON/CSS.
- Keep save behavior predictable: fixes/import-organize are configured as “explicit” code actions.

