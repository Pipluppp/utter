import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    CLONE_TRIAL_LIMIT,
    CREDIT_RATE_CARD,
    creditsForCloneTranscript,
    creditsForDesignPreview,
    creditsForGenerateText,
    DESIGN_TRIAL_LIMIT,
    formatInsufficientCreditsDetail,
    PREPAID_PACKS,
    prepaidPackFromId,
} from "../../src/_shared/credits.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("credits constants", () => {
  it("DESIGN_TRIAL_LIMIT equals 2", () => {
    expect(DESIGN_TRIAL_LIMIT).toBe(2);
  });

  it("CLONE_TRIAL_LIMIT equals 2", () => {
    expect(CLONE_TRIAL_LIMIT).toBe(2);
  });

  it("creditsForDesignPreview returns 2400", () => {
    expect(creditsForDesignPreview()).toBe(2400);
  });

  it("creditsForCloneTranscript returns 200", () => {
    expect(creditsForCloneTranscript()).toBe(200);
  });
});

describe("PREPAID_PACKS", () => {
  it("pack_30k has 30000 credits at $2.99", () => {
    const pack = PREPAID_PACKS.pack_30k;
    expect(pack.id).toBe("pack_30k");
    expect(pack.credits).toBe(30000);
    expect(pack.priceUsd).toBe(2.99);
  });

  it("pack_120k has 120000 credits at $9.99", () => {
    const pack = PREPAID_PACKS.pack_120k;
    expect(pack.id).toBe("pack_120k");
    expect(pack.credits).toBe(120000);
    expect(pack.priceUsd).toBe(9.99);
  });
});

describe("CREDIT_RATE_CARD", () => {
  it("contains an entry for generate speech", () => {
    expect(CREDIT_RATE_CARD.some((r) => r.action === "Generate speech")).toBe(true);
  });

  it("contains an entry for voice design preview", () => {
    expect(CREDIT_RATE_CARD.some((r) => r.action === "Voice design preview")).toBe(true);
  });

  it("contains an entry for voice clone", () => {
    expect(CREDIT_RATE_CARD.some((r) => r.action === "Voice clone")).toBe(true);
  });
});

describe("prepaidPackFromId", () => {
  it("returns pack_30k for valid ID", () => {
    const pack = prepaidPackFromId("pack_30k");
    expect(pack).not.toBeNull();
    expect(pack!.id).toBe("pack_30k");
    expect(pack!.credits).toBe(30000);
  });

  it("returns pack_120k for valid ID", () => {
    const pack = prepaidPackFromId("pack_120k");
    expect(pack).not.toBeNull();
    expect(pack!.id).toBe("pack_120k");
    expect(pack!.credits).toBe(120000);
  });
});

// Feature: test-suite-restructure, Property 1: Generate text credit cost equals character count
// **Validates: Requirements 2.1**
describe("creditsForGenerateText (property)", () => {
  it("for any string, creditsForGenerateText(text) equals text.length", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(creditsForGenerateText(text)).toBe(text.length);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: test-suite-restructure, Property 2: Invalid pack IDs return null
// **Validates: Requirements 2.4**
describe("prepaidPackFromId (property)", () => {
  it("for any string not in valid IDs, prepaidPackFromId returns null", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s !== "pack_30k" && s !== "pack_120k"),
        (s) => {
          expect(prepaidPackFromId(s)).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: test-suite-restructure, Property 3: Insufficient credits message contains both values
// **Validates: Requirements 2.5**
describe("formatInsufficientCreditsDetail (property)", () => {
  it("for any (needed, balance) nat pair, output contains both values as locale strings", () => {
    fc.assert(
      fc.property(fc.nat(), fc.nat(), (needed, balance) => {
        const result = formatInsufficientCreditsDetail(needed, balance);
        expect(result).toContain(needed.toLocaleString());
        expect(result).toContain(balance.toLocaleString());
      }),
      { numRuns: 100 },
    );
  });
});
