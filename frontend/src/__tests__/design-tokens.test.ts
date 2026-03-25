import * as fc from "fast-check";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = resolve(__dirname, "..");
const CSS_PATH = join(ROOT, "styles", "index.css");
const cssContent = readFileSync(CSS_PATH, "utf-8");

/** Recursively collect all `.tsx` files under a directory. */
function collectTsxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      results.push(...collectTsxFiles(full));
    } else if (entry.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

const tsxFiles = collectTsxFiles(ROOT);
const tsxContents = tsxFiles.map((p) => ({
  path: p,
  content: readFileSync(p, "utf-8"),
}));

/** Extract a CSS block by its selector/at-rule opener. */
function extractBlock(css: string, opener: string): string {
  // For ".dark", match the standalone selector (not inside @custom-variant)
  const pattern =
    opener === ".dark"
      ? /^\.dark\s*\{/m
      : new RegExp(opener.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{");
  const match = pattern.exec(css);
  if (!match) return "";
  const braceStart = css.indexOf("{", match.index);
  if (braceStart === -1) return "";
  let depth = 1;
  let i = braceStart + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
    i++;
  }
  return css.slice(braceStart + 1, i - 1);
}

/** Parse `--prop: value;` declarations from a CSS block string. */
function parseDeclarations(block: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    map.set(m[1].trim(), m[2].trim());
  }
  return map;
}

/**
 * Check if content contains the five-class label pattern in any className.
 * Searches for className="..." strings that contain all five classes.
 */
function containsLabelPattern(content: string): boolean {
  const labelClasses = [
    "text-[12px]",
    "font-medium",
    "uppercase",
    "tracking-wide",
    "text-muted-foreground",
  ];
  // Match className="..." strings (double-quoted)
  const classNameRegex = /className="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = classNameRegex.exec(content)) !== null) {
    const classStr = match[1];
    if (labelClasses.every((cls) => classStr.includes(cls))) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Property 1: Token value fidelity
// **Validates: Requirements 1.1, 1.2, 1.3, 4.1, 4.2, 4.4**
// ---------------------------------------------------------------------------

describe("Property 1: Token value fidelity", () => {
  const expectedLight: Record<string, string> = {
    "--color-status-error": "#b91c1c",
    "--color-status-error-border": "rgb(239 68 68 / 0.4)",
    "--color-status-error-bg": "rgb(239 68 68 / 0.1)",
    "--color-status-success": "#022c22",
    "--color-status-success-border": "rgb(16 185 129 / 0.4)",
    "--color-status-success-bg": "rgb(16 185 129 / 0.1)",
  };

  const expectedDark: Record<string, string> = {
    "--color-status-error": "#f87171",
    "--color-status-error-border": "rgb(248 113 113 / 0.4)",
    "--color-status-error-bg": "rgb(248 113 113 / 0.1)",
    "--color-status-success": "#a7f3d0",
    "--color-status-success-border": "rgb(52 211 153 / 0.4)",
    "--color-status-success-bg": "rgb(52 211 153 / 0.1)",
  };

  const themeBlock = extractBlock(cssContent, "@theme");
  const darkBlock = extractBlock(cssContent, ".dark");
  const themeTokens = parseDeclarations(themeBlock);
  const darkTokens = parseDeclarations(darkBlock);

  const allTokenEntries = [
    ...Object.entries(expectedLight).map(([k, v]) => ({
      mode: "light" as const,
      token: k,
      expected: v,
    })),
    ...Object.entries(expectedDark).map(([k, v]) => ({
      mode: "dark" as const,
      token: k,
      expected: v,
    })),
  ];

  it("all 12 status color token values match expected Tailwind color values", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: allTokenEntries.length - 1 }), (idx: number) => {
        const { mode, token, expected } = allTokenEntries[idx];
        const actual = mode === "light" ? themeTokens.get(token) : darkTokens.get(token);
        expect(actual).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Zero banned status color patterns
// **Validates: Requirements 1.4, 1.5**
// ---------------------------------------------------------------------------

describe("Property 2: Zero banned status color patterns in consumer files", () => {
  const bannedPatterns = [
    "text-red-700 dark:text-red-400",
    "text-red-600 dark:text-red-400",
    "text-red-950 dark:text-red-200",
    "text-emerald-950 dark:text-emerald-200",
    "text-green-600 dark:text-green-400",
  ];

  const pairedBannedPatterns = [
    { pattern: "border-red-500/40", darkPair: "dark:border-red" },
    { pattern: "bg-red-500/10", darkPair: "dark:bg-red" },
    { pattern: "border-emerald-500/40", darkPair: "dark:border-emerald" },
    { pattern: "bg-emerald-500/10", darkPair: "dark:bg-emerald" },
  ];

  it("no tsx file contains banned raw status color patterns", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: bannedPatterns.length - 1 }),
        fc.integer({ min: 0, max: Math.max(tsxContents.length - 1, 0) }),
        (patIdx: number, fileIdx: number) => {
          if (tsxContents.length === 0) return;
          const file = tsxContents[fileIdx];
          const pattern = bannedPatterns[patIdx];
          expect(file.content).not.toContain(pattern);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("no tsx file contains paired banned border/bg patterns with dark variants", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: pairedBannedPatterns.length - 1 }),
        fc.integer({ min: 0, max: Math.max(tsxContents.length - 1, 0) }),
        (patIdx: number, fileIdx: number) => {
          if (tsxContents.length === 0) return;
          const file = tsxContents[fileIdx];
          const { pattern, darkPair } = pairedBannedPatterns[patIdx];
          if (file.content.includes(pattern)) {
            expect(file.content).not.toContain(darkPair);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Zero `text-[12px]`
// **Validates: Requirements 2.2, 2.3**
// ---------------------------------------------------------------------------

describe("Property 3: Zero arbitrary caption size in consumer files", () => {
  it("no tsx file contains text-[12px]", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Math.max(tsxContents.length - 1, 0) }),
        (fileIdx: number) => {
          if (tsxContents.length === 0) return;
          const file = tsxContents[fileIdx];
          expect(file.content).not.toContain("text-[12px]");
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Zero raw label pattern
// **Validates: Requirements 3.2, 3.4**
// ---------------------------------------------------------------------------

describe("Property 4: Zero raw label pattern in consumer files", () => {
  it("no tsx file contains the five-class label pattern in a className", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Math.max(tsxContents.length - 1, 0) }),
        (fileIdx: number) => {
          if (tsxContents.length === 0) return;
          const file = tsxContents[fileIdx];
          expect(containsLabelPattern(file.content)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Existing tokens and utilities preserved
// **Validates: Requirements 5.1, 5.2, 5.3**
// ---------------------------------------------------------------------------

describe("Property 5: Existing tokens and utilities preserved", () => {
  const themeBlock = extractBlock(cssContent, "@theme");
  const themeTokens = parseDeclarations(themeBlock);

  const knownPreExistingTokens: Record<string, string> = {
    "--color-background": "#ffffff",
    "--color-foreground": "#111111",
    "--color-border": "#cccccc",
    "--color-subtle": "#fafafa",
    "--color-muted": "#f0f0f0",
    "--color-muted-foreground": "#555555",
    "--color-faint": "#636363",
    "--color-border-strong": "#999999",
    "--color-ring": "#111111",
    "--color-kbd-bg": "#e8e8e8",
    "--color-kbd-border": "#d0d0d0",
    "--color-kbd-text": "#2f2f2f",
    "--color-kbd-shadow": "rgb(0 0 0 / 0.12)",
    "--shadow-elevated": "0 1px 0 rgb(0 0 0 / 0.03), 0 8px 20px rgb(0 0 0 / 0.06)",
    "--color-surface-hover": "#ebebeb",
    "--color-surface-selected": "#e0e0e0",
    "--color-popover": "#f0f0f0",
    "--color-popover-hover": "#e6e6e6",
    "--color-popover-selected": "#dbdbdb",
    "--shadow-popover": "0 1px 0 rgb(0 0 0 / 0.03), 0 12px 28px rgb(0 0 0 / 0.12)",
  };

  const knownFontTokens = ["--font-mono", "--font-mono-ui", "--font-pixel", "--font-pixel-square"];

  const knownUtilities = ["shadow-elevated", "shadow-popover", "font-pixel"];

  const tokenEntries = Object.entries(knownPreExistingTokens);

  it("pre-existing theme tokens are present with original values", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: tokenEntries.length - 1 }), (idx: number) => {
        const [token, expectedValue] = tokenEntries[idx];
        const actual = themeTokens.get(token);
        expect(actual).toBe(expectedValue);
      }),
      { numRuns: 100 },
    );
  });

  it("pre-existing font tokens are present in @theme block", () => {
    for (const token of knownFontTokens) {
      expect(themeBlock).toContain(token);
    }
  });

  it("pre-existing @utility directives are present", () => {
    for (const util of knownUtilities) {
      expect(cssContent).toContain("@utility " + util);
    }
  });

  it("@custom-variant dark directive is present", () => {
    expect(cssContent).toContain("@custom-variant dark");
  });
});
