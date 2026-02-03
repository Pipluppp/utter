# Biome (Formatter + Linter) Guide

This repo uses [Biome](https://biomejs.dev/) to format and lint the React + TypeScript + Tailwind frontend in `frontend/`.

## What Biome is (mental model)

Biome is a single toolchain that provides:

- **Formatter**: consistent formatting for supported file types.
- **Linter**: static analysis rules (code quality, correctness, a11y, etc.).
- **Assists**: editor/CLI code actions (for example, **organize imports**).

You typically run **one command** (`biome check`) during development, and **one command** (`biome ci`) in CI.

## Files Biome needs (in this repo)

- `frontend/package.json` / `frontend/package-lock.json`
  - Biome is installed as `@biomejs/biome` in `devDependencies`.
- `frontend/biome.json`
  - Biome configuration for the frontend project.
  - Includes Tailwind v4 CSS directive parsing (`css.parser.tailwindDirectives: true`) so `@theme`, `@apply`, etc. parse correctly.
- `.vscode/settings.json` (recommended)
  - VS Code settings to use Biome as the formatter for JS/TS/JSON/CSS.
- `.vscode/extensions.json` (recommended)
  - Recommends installing the official Biome VS Code extension.

## How Biome finds configuration

Biome discovers configuration by looking for the nearest `biome.json` / `biome.jsonc` while walking up parent directories.

In this repo:

- `frontend/biome.json` has `"root": true`, which makes `frontend/` act like the Biome project root and prevents config lookup from continuing upward (useful in monorepos).

## Commands (what to run, when)

All commands below target only the frontend source tree (`frontend/src`).

### From the repo root (recommended)

- Verify (no writes): `npm --prefix frontend run check`
- Apply formatting + safe fixes: `npm --prefix frontend run check:write`
- Lint only: `npm --prefix frontend run lint`
- Format only: `npm --prefix frontend run format`
- CI check (no writes): `npm --prefix frontend run ci`

### From `frontend/`

- `npm run check`
- `npm run check:write`
- `npm run ci`

### What each Biome command means

- `biome format`: formatting only.
- `biome lint`: linting only.
- `biome check`: runs the combined pipeline (format + lint + configured assists).
- `biome check --write`: applies fixes/formatting to disk.
- `biome ci`: CI-friendly verification (no writes).

## VS Code setup (official extension)

1. Install the **Biome** extension (publisher: `biomejs`).
2. This repo ships `.vscode/settings.json` that:
   - sets Biome as the default formatter for JS/TS/JSON/CSS
   - turns on `editor.formatOnSave`
   - configures Biome actions on save as **explicit** (opt-in)

### Why “explicit” code actions on save?

In `.vscode/settings.json`, these are set to `"explicit"`:

- `source.fixAll.biome`
- `source.organizeImports.biome`

This keeps saves predictable: formatting happens on save, but “fix all” and “organize imports” are applied only when you explicitly request them (via command palette / code actions).

### Monorepo note (if VS Code isn’t picking up config)

If you open the repo root in VS Code and Biome doesn’t behave as expected:

- Option A (simplest): open `frontend/` as the workspace folder.
- Option B (repo-root workspace): set `biome.configurationPath` to `frontend/biome.json` in `.vscode/settings.json`.

## Tailwind notes

- This repo enables Tailwind v4 CSS directive parsing in Biome (`css.parser.tailwindDirectives: true`).
- Tailwind class sorting via `useSortedClasses` is **not enabled by default** here because:
  - it’s a nursery rule
  - fixes are “unsafe” and typically require running with `--unsafe`
  - coverage is limited in some patterns (especially custom class helper wrappers)

If you decide to enable it later, do so intentionally and consider adding a separate script like:

- `biome check --write --unsafe ./src`

## Troubleshooting

- **VS Code doesn’t format**
  - Ensure the Biome extension is installed.
  - Ensure `.vscode/settings.json` sets `"editor.defaultFormatter": "biomejs.biome"` for TS/TSX.
  - If working from repo-root workspace, set `biome.configurationPath` to `frontend/biome.json`.
- **CSS parse errors around Tailwind directives**
  - Confirm `frontend/biome.json` includes `css.parser.tailwindDirectives: true`.
- **Unexpected import changes**
  - Import organization is configured as an assist action in `frontend/biome.json`. If you want it to happen only on demand, keep VS Code code actions “explicit” and use `check:write` when you want to apply project-wide fixes.

## Recommended README snippet

```md
## Code style (Biome)

- `npm --prefix frontend run check` — verify formatting + lint
- `npm --prefix frontend run check:write` — apply formatting + safe fixes
- `npm --prefix frontend run ci` — CI verification (no writes)
```

