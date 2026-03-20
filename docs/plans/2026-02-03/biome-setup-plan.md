# Biome setup plan (formatter + linter)

Goal: adopt Biome as the single formatter + linter for the `frontend/` React + TypeScript + Tailwind (v4) app, with minimal configuration and a predictable VS Code experience.

## Baseline (repo audit)

- `frontend/` has no ESLint and no Prettier config today.
- Formatting is already "Biome-friendly" style-wise: 2 spaces, single quotes, and no semicolons in TS/TSX.
- Tailwind v4 directives are present in `frontend/src/styles/index.css` (e.g. `@theme`, `@apply`, `@custom-variant`) and need parser support.

## What the Biome docs imply for our setup

### Commands and workflow

- `biome format` formats files.
- `biome lint` lints files.
- `biome check` runs the "all-in-one" pass (format + lint + import organization) and is the best default for local dev.
- `biome ci` is the "CI-friendly" command (no writes) to enforce the same checks on CI.
- Biome does not encourage shell globs in CLI invocations; prefer passing directories (and constrain scope via config `files.includes` if needed).

### Configuration model (important for monorepos)

- Biome discovers configuration by walking up parent directories and uses the nearest `biome.json` / `biome.jsonc`.
- Nested configs are supported in monorepos; the `root` option stops Biome from searching further up.
- VS Code integration is simplest when the workspace folder contains the relevant `biome.json`, or when the extension is pointed at it.

### Tailwind class sorting reality check

Biome's Tailwind class sorting rule is `useSortedClasses` (nursery). Per the rule docs:

- Supported patterns: `class`/`className` attributes, string concatenation/template literals, and `clsx()` calls.
- Not supported: object properties passed to `clsx()`, and custom `clsx`-like wrappers (e.g. our `cn()` helper).
- No configuration options are available.
- Fixes are "unsafe", so they require running with `--unsafe` (not recommended for always-on save/CI by default).

Recommendation: keep Tailwind sorting **optional** in the initial rollout. Enable it later only if we're happy with the limited coverage (given our heavy `cn()` usage) and are okay with `--unsafe` being required.

## Proposed minimal configuration (v2-compatible)

Biome defaults are fine for most settings; we only configure what matters for our current codebase and Tailwind CSS directives.

Create `frontend/biome.json`:

```json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "root": true,
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "assist": {
    "enabled": true,
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded"
    }
  },
  "css": {
    "formatter": {
      "enabled": true
    },
    "parser": {
      "tailwindDirectives": true
    }
  }
}
```

Optional (later): enable Tailwind sorting (unsafe) by adding:

```json
{
  "linter": {
    "rules": {
      "nursery": {
        "useSortedClasses": "warn"
      }
    }
  }
}
```

## Installation and scripts (frontend)

From `frontend/`:

```bash
npm install --save-dev --save-exact @biomejs/biome
npx @biomejs/biome init
```

Then add scripts to `frontend/package.json`:

```json
{
  "scripts": {
    "lint": "biome lint ./src",
    "format": "biome format --write ./src",
    "check": "biome check ./src",
    "check:write": "biome check --write ./src",
    "ci": "biome ci ./src"
  }
}
```

Optional scripts if we later adopt Tailwind sorting (unsafe fixes):

```json
{
  "scripts": {
    "check:write:unsafe": "biome check --write --unsafe ./src"
  }
}
```

### Developer shortcuts (repo root)

If you keep your terminal at the repo root, these equivalents avoid `cd frontend`:

```bash
npm --prefix frontend run check
npm --prefix frontend run check:write
npm --prefix frontend run ci
```

### Applying unsafe fixes (intentionally)

If/when we enable `useSortedClasses`, apply its fixes only when you explicitly opt in:

```bash
cd frontend
npm run check:write:unsafe
```

## VS Code setup (official Biome extension)

Install the Biome extension and add `.vscode/settings.json` (repo root) with language-scoped defaults:

```json
{
  "[javascript]": { "editor.defaultFormatter": "biomejs.biome" },
  "[javascriptreact]": { "editor.defaultFormatter": "biomejs.biome" },
  "[typescript]": { "editor.defaultFormatter": "biomejs.biome" },
  "[typescriptreact]": { "editor.defaultFormatter": "biomejs.biome" },
  "[json]": { "editor.defaultFormatter": "biomejs.biome" },
  "[css]": { "editor.defaultFormatter": "biomejs.biome" },

  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

Monorepo note (this repo): because `biome.json` will live in `frontend/`, the smoothest options are:

- Option A (simplest): open `frontend/` as the VS Code workspace folder while working on the web app.
- Option B (repo-root workspace): set `"biome.configurationPath": "frontend/biome.json"` in `.vscode/settings.json`.

## CI integration (GitHub Actions sketch)

```yaml
name: Biome
on: [push, pull_request]
jobs:
  biome:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
        working-directory: frontend
      - run: npm run ci
        working-directory: frontend
```

## Rollout checklist (implementation order)

- [ ] Add `@biomejs/biome` to `frontend/devDependencies`
- [ ] Create `frontend/biome.json` (minimal config above)
- [ ] Add `frontend` scripts (`check`, `check:write`, `ci`)
- [ ] Add `.vscode/settings.json` (and decide "frontend workspace" vs `biome.configurationPath`)
- [ ] Run `npm run check:write` once to format/lint/organize imports
- [ ] Review diff (especially CSS) and adjust config only if necessary
- [ ] Add CI job running `npm run ci`

## Troubleshooting (common gotchas)

- VS Code does not format: confirm the Biome extension is installed, `editor.defaultFormatter` is set to `biomejs.biome` for TS/TSX, and (if using repo-root workspace) set `biome.configurationPath` to `frontend/biome.json`.
- CSS parse errors on Tailwind directives: ensure `css.parser.tailwindDirectives` is `true` in `frontend/biome.json`.
- Conflicting formatters (Prettier/ESLint): keep the language-scoped `editor.defaultFormatter` overrides in `.vscode/settings.json` so Biome stays the formatter of record for JS/TS/JSON/CSS.

## References (official docs)

- https://biomejs.dev/guides/getting-started/
- https://biomejs.dev/guides/configure-biome/
- https://biomejs.dev/reference/vscode/
- https://biomejs.dev/formatter/
- https://biomejs.dev/linter/
- https://biomejs.dev/linter/rules/use-sorted-classes/
