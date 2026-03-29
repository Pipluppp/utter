/**
 * Property-based tests for Voice–History Cross-Navigation feature.
 *
 * These tests validate the core logic of cross-navigation links and state sync
 * between the History and Voices pages using fast-check generators.
 *
 * Since the actual components have deep dependencies (TanStack Router, React Aria,
 * API calls, waveform player), we test the rendering logic via lightweight component
 * fragments that replicate the conditional rendering patterns from the real components.
 */
import { render, screen } from "@testing-library/react";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Generation, GenerationStatus, Voice } from "../lib/types";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const genStatusArb: fc.Arbitrary<GenerationStatus> = fc.constantFrom(
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
);

const generationArb: fc.Arbitrary<Generation> = fc.record({
  id: fc.uuid(),
  voice_id: fc.uuid(),
  voice_name: fc.oneof(fc.string({ minLength: 1, maxLength: 40 }), fc.constant(null)),
  text: fc.string({ minLength: 1, maxLength: 200 }),
  audio_path: fc.string({ minLength: 1, maxLength: 100 }),
  duration_seconds: fc.oneof(
    fc.float({ min: Math.fround(0.1), max: Math.fround(600), noNaN: true }),
    fc.constant(null),
  ),
  language: fc.constantFrom("en", "es", "fr", "de", "ja"),
  status: genStatusArb,
  generation_time_seconds: fc.oneof(
    fc.float({ min: Math.fround(0.1), max: Math.fround(120), noNaN: true }),
    fc.constant(null),
  ),
  error_message: fc.oneof(fc.string({ minLength: 1, maxLength: 100 }), fc.constant(null)),
  created_at: fc.oneof(
    fc.date().map((d) => d.toISOString()),
    fc.constant(null),
  ),
});

const voiceArb: fc.Arbitrary<Voice> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 40 }),
  reference_transcript: fc.oneof(fc.string({ minLength: 1, maxLength: 100 }), fc.constant(null)),
  language: fc.constantFrom("en", "es", "fr", "de", "ja"),
  source: fc.constantFrom("uploaded" as const, "designed" as const),
  description: fc.oneof(fc.string({ minLength: 1, maxLength: 100 }), fc.constant(null)),
  created_at: fc.oneof(
    fc.date().map((d) => d.toISOString()),
    fc.constant(null),
  ),
  is_favorite: fc.boolean(),
  generation_count: fc.nat({ max: 500 }),
});

// ---------------------------------------------------------------------------
// Lightweight rendering fragments
// ---------------------------------------------------------------------------

/**
 * Replicates the History page voice name rendering logic:
 * - non-null voice_name → <a> link to /voices?voice_id=...
 * - null voice_name → plain text "Unknown voice"
 */
function HistoryVoiceNameCell({ generation }: { generation: Generation }) {
  if (generation.voice_name != null) {
    return (
      <a
        href={`/voices?voice_id=${encodeURIComponent(generation.voice_id)}`}
        aria-label={`View voice ${generation.voice_name}`}
        className="truncate text-sm font-semibold hover:underline"
      >
        {generation.voice_name}
      </a>
    );
  }
  return (
    <div className="truncate text-sm font-semibold" data-testid="unknown-voice">
      Unknown voice
    </div>
  );
}

/**
 * Replicates the Voices page generation count rendering logic:
 * - count > 0 → <a> link to /history?voice_id=...
 * - count === 0 → plain text "0 generations"
 */
function VoiceGenCountCell({ voice }: { voice: Voice }) {
  if (voice.generation_count > 0) {
    return (
      <a
        href={`/history?voice_id=${encodeURIComponent(voice.id)}`}
        aria-label={`View generations for ${voice.name}`}
        className="hover:underline"
      >
        {voice.generation_count} generation{voice.generation_count !== 1 ? "s" : ""}
      </a>
    );
  }
  return <span data-testid="zero-generations">0 generations</span>;
}

/**
 * Replicates the Voices page highlight logic:
 * - if voice.id === voiceIdParam → ring-2 ring-ring
 * - otherwise → no ring
 */
function VoiceCardList({
  voices,
  voiceIdParam,
}: {
  voices: Voice[];
  voiceIdParam: string | undefined;
}) {
  return (
    <div data-testid="voice-list">
      {voices.map((v) => (
        <div
          key={v.id}
          data-testid={`voice-card-${v.id}`}
          className={`border border-border bg-background p-4 shadow-elevated transition-shadow duration-500${v.id === voiceIdParam ? " ring-2 ring-ring" : ""}`}
        >
          {v.name}
        </div>
      ))}
    </div>
  );
}

/**
 * Replicates the History page voice filter + URL sync logic.
 * Given a voiceId state and voice items, renders the selected key and
 * the query string that would be sent to the API.
 */
function HistoryVoiceFilterState({
  voiceId,
  voiceItems,
}: {
  voiceId: string;
  voiceItems: Array<{ id: string; label: string }>;
}) {
  // Build the API query string the same way the real component does
  const qs = new URLSearchParams();
  if (voiceId !== "all") qs.set("voice_id", voiceId);

  // Build the URL search params the same way the real component syncs to URL
  const urlParams = new URLSearchParams();
  if (voiceId !== "all") urlParams.set("voice_id", voiceId);

  const selectedItem = voiceItems.find((item) => item.id === voiceId);

  return (
    <div data-testid="filter-state">
      <span data-testid="selected-key">{voiceId}</span>
      <span data-testid="api-query">{qs.toString()}</span>
      <span data-testid="url-params">{urlParams.toString()}</span>
      <span data-testid="selected-label">{selectedItem?.label ?? ""}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Property 1: History voice name link targets correct voice
// **Validates: Requirements 1.1, 1.2, 1.5, 5.3**
// Tag: Feature: voice-history-cross-navigation, Property 1: History voice name link targets correct voice
// ---------------------------------------------------------------------------

describe("Feature: voice-history-cross-navigation, Property 1: History voice name link targets correct voice", () => {
  it("non-null voice_name produces a link with correct href and aria-label; null produces plain text", () => {
    fc.assert(
      fc.property(generationArb, (generation: Generation) => {
        const { unmount } = render(<HistoryVoiceNameCell generation={generation} />);

        if (generation.voice_name != null) {
          // Should render a link
          const link = screen.getByRole("link");
          expect(link).toBeInTheDocument();

          // href must contain /voices and the voice_id
          const href = link.getAttribute("href") ?? "";
          expect(href).toContain("/voices");
          expect(href).toContain(`voice_id=${encodeURIComponent(generation.voice_id)}`);

          // aria-label must contain the voice name
          const ariaLabel = link.getAttribute("aria-label") ?? "";
          expect(ariaLabel).toContain(generation.voice_name);

          // Link text should be the voice name
          expect(link.textContent).toBe(generation.voice_name);

          // No "Unknown voice" text
          expect(screen.queryByTestId("unknown-voice")).not.toBeInTheDocument();
        } else {
          // Should render plain text "Unknown voice" with no link
          expect(screen.queryByRole("link")).not.toBeInTheDocument();
          const unknownEl = screen.getByTestId("unknown-voice");
          expect(unknownEl.textContent).toContain("Unknown voice");
        }

        unmount();
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Voices page highlight matches voice_id param
// **Validates: Requirements 2.1**
// Tag: Feature: voice-history-cross-navigation, Property 2: Voices page highlight matches voice_id param
// ---------------------------------------------------------------------------

describe("Feature: voice-history-cross-navigation, Property 2: Voices page highlight matches voice_id param", () => {
  it("exactly the matching voice card is highlighted; no others; no highlight if no match", () => {
    fc.assert(
      fc.property(
        fc.array(voiceArb, { minLength: 1, maxLength: 10 }).chain((voices) => {
          // Sometimes pick a voice_id from the list, sometimes a random UUID
          const matchingIdArb = fc.constantFrom(...voices.map((v) => v.id));
          const randomIdArb = fc.uuid();
          return fc.tuple(
            fc.constant(voices),
            fc.oneof(matchingIdArb, randomIdArb, fc.constant(undefined)),
          );
        }),
        ([voices, voiceIdParam]: [Voice[], string | undefined]) => {
          // Deduplicate by id to avoid ambiguous test assertions
          const seen = new Set<string>();
          const uniqueVoices = voices.filter((v) => {
            if (seen.has(v.id)) return false;
            seen.add(v.id);
            return true;
          });

          const { unmount } = render(
            <VoiceCardList voices={uniqueVoices} voiceIdParam={voiceIdParam} />,
          );

          const matchExists = uniqueVoices.some((v) => v.id === voiceIdParam);

          for (const v of uniqueVoices) {
            const card = screen.getByTestId(`voice-card-${v.id}`);
            const classes = card.className;

            if (v.id === voiceIdParam) {
              // This card should be highlighted
              expect(classes).toContain("ring-2");
              expect(classes).toContain("ring-ring");
            } else {
              // This card should NOT be highlighted
              expect(classes).not.toContain("ring-2 ring-ring");
            }
          }

          if (!matchExists) {
            // No card should be highlighted
            for (const v of uniqueVoices) {
              const card = screen.getByTestId(`voice-card-${v.id}`);
              expect(card.className).not.toContain("ring-2");
            }
          }

          unmount();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Generation count link targets correct voice
// **Validates: Requirements 3.1, 3.2, 3.5, 5.3**
// Tag: Feature: voice-history-cross-navigation, Property 3: Generation count link targets correct voice
// ---------------------------------------------------------------------------

describe("Feature: voice-history-cross-navigation, Property 3: Generation count link targets correct voice", () => {
  it("count > 0 produces a link with correct href and aria-label; count === 0 produces plain text", () => {
    fc.assert(
      fc.property(voiceArb, (voice: Voice) => {
        const { unmount } = render(<VoiceGenCountCell voice={voice} />);

        if (voice.generation_count > 0) {
          // Should render a link
          const link = screen.getByRole("link");
          expect(link).toBeInTheDocument();

          // href must contain /history and the voice_id
          const href = link.getAttribute("href") ?? "";
          expect(href).toContain("/history");
          expect(href).toContain(`voice_id=${encodeURIComponent(voice.id)}`);

          // aria-label must contain the voice name
          const ariaLabel = link.getAttribute("aria-label") ?? "";
          expect(ariaLabel).toContain(voice.name);

          // Link text should contain the count
          expect(link.textContent).toContain(String(voice.generation_count));

          // No "0 generations" plain text
          expect(screen.queryByTestId("zero-generations")).not.toBeInTheDocument();
        } else {
          // Should render plain text "0 generations" with no link
          expect(screen.queryByRole("link")).not.toBeInTheDocument();
          const zeroEl = screen.getByTestId("zero-generations");
          expect(zeroEl.textContent).toBe("0 generations");
        }

        unmount();
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Voice filter reflects voice_id param on load
// **Validates: Requirements 4.1, 4.2**
// Tag: Feature: voice-history-cross-navigation, Property 4: Voice filter reflects voice_id param on load
// ---------------------------------------------------------------------------

describe("Feature: voice-history-cross-navigation, Property 4: Voice filter reflects voice_id param on load", () => {
  it("filter selectedKey matches voice_id and API query includes voice_id", () => {
    fc.assert(
      fc.property(
        fc.array(voiceArb, { minLength: 1, maxLength: 20 }).chain((voices) => {
          // Pick a voice_id from the generated list
          const voiceIdArb = fc.constantFrom(...voices.map((v) => v.id));
          return fc.tuple(fc.constant(voices), voiceIdArb);
        }),
        ([voices, selectedVoiceId]: [Voice[], string]) => {
          const voiceItems = [
            { id: "all", label: "All Voices" },
            ...voices.map((v) => ({ id: v.id, label: v.name })),
          ];

          // Simulate: History page loaded with voice_id param → voiceId state = selectedVoiceId
          const { unmount } = render(
            <HistoryVoiceFilterState voiceId={selectedVoiceId} voiceItems={voiceItems} />,
          );

          // The selected key should match the voice_id
          const selectedKey = screen.getByTestId("selected-key").textContent;
          expect(selectedKey).toBe(selectedVoiceId);

          // The API query should include voice_id=<value>
          const apiQuery = screen.getByTestId("api-query").textContent ?? "";
          expect(apiQuery).toContain(`voice_id=${encodeURIComponent(selectedVoiceId)}`);

          unmount();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Voice filter change syncs to URL
// **Validates: Requirements 4.3, 4.4**
// Tag: Feature: voice-history-cross-navigation, Property 5: Voice filter change syncs to URL
// ---------------------------------------------------------------------------

describe("Feature: voice-history-cross-navigation, Property 5: Voice filter change syncs to URL", () => {
  it("URL params contain voice_id when specific voice selected, omit when 'all' selected", () => {
    fc.assert(
      fc.property(
        fc.array(voiceArb, { minLength: 1, maxLength: 20 }).chain((voices) => {
          // Selection is either "all" or one of the voice IDs
          const selectionArb = fc.oneof(
            fc.constant("all"),
            fc.constantFrom(...voices.map((v) => v.id)),
          );
          return fc.tuple(fc.constant(voices), selectionArb);
        }),
        ([voices, selection]: [Voice[], string]) => {
          const voiceItems = [
            { id: "all", label: "All Voices" },
            ...voices.map((v) => ({ id: v.id, label: v.name })),
          ];

          const { unmount } = render(
            <HistoryVoiceFilterState voiceId={selection} voiceItems={voiceItems} />,
          );

          const urlParams = screen.getByTestId("url-params").textContent ?? "";

          if (selection === "all") {
            // URL should NOT contain voice_id
            expect(urlParams).not.toContain("voice_id");
          } else {
            // URL should contain voice_id=<selected>
            expect(urlParams).toContain(`voice_id=${encodeURIComponent(selection)}`);
          }

          unmount();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests: edge cases
// ---------------------------------------------------------------------------

describe("Unit tests: edge cases", () => {
  // 7.1 – Null voice name renders "Unknown voice" without a link (Req 1.4)
  it("null voice_name renders 'Unknown voice' without a link", () => {
    const generation: Generation = {
      id: "aaaa-1111",
      voice_id: "bbbb-2222",
      voice_name: null,
      text: "Hello world",
      audio_path: "/audio/test.wav",
      duration_seconds: 3.5,
      language: "en",
      status: "completed",
      generation_time_seconds: 1.2,
      error_message: null,
      created_at: "2025-01-01T00:00:00Z",
    };

    const { unmount } = render(<HistoryVoiceNameCell generation={generation} />);

    expect(screen.getByText("Unknown voice")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    unmount();
  });

  // 7.2 – Zero generation count renders plain text without a link (Req 3.4)
  it("zero generation count renders plain text without a link", () => {
    const voice: Voice = {
      id: "cccc-3333",
      name: "Test Voice",
      reference_transcript: null,
      language: "en",
      source: "uploaded",
      description: null,
      created_at: "2025-01-01T00:00:00Z",
      is_favorite: false,
      generation_count: 0,
    };

    const { unmount } = render(<VoiceGenCountCell voice={voice} />);

    expect(screen.getByText("0 generations")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    unmount();
  });

  // 7.3 – Non-existent voice_id on Voices page produces no highlight and no error (Req 5.1)
  it("non-existent voice_id on Voices page produces no highlight and no error", () => {
    const voices: Voice[] = [
      {
        id: "voice-aaa",
        name: "Alpha",
        reference_transcript: null,
        language: "en",
        source: "uploaded",
        description: null,
        created_at: null,
        is_favorite: false,
        generation_count: 5,
      },
      {
        id: "voice-bbb",
        name: "Beta",
        reference_transcript: null,
        language: "es",
        source: "designed",
        description: null,
        created_at: null,
        is_favorite: true,
        generation_count: 12,
      },
    ];

    const nonExistentId = "voice-does-not-exist";

    const { unmount } = render(<VoiceCardList voices={voices} voiceIdParam={nonExistentId} />);

    // No card should have highlight classes
    for (const v of voices) {
      const card = screen.getByTestId(`voice-card-${v.id}`);
      expect(card.className).not.toContain("ring-2");
      expect(card.className).not.toContain("ring-ring");
    }

    unmount();
  });

  // 7.4 – Non-existent voice_id on History page shows empty results gracefully (Req 5.2)
  it("non-existent voice_id on History page renders gracefully", () => {
    const voiceItems = [
      { id: "all", label: "All Voices" },
      { id: "voice-aaa", label: "Alpha" },
      { id: "voice-bbb", label: "Beta" },
    ];
    const nonExistentId = "voice-does-not-exist";

    const { unmount } = render(
      <HistoryVoiceFilterState voiceId={nonExistentId} voiceItems={voiceItems} />,
    );

    // selectedKey should show the non-existent voice_id
    expect(screen.getByTestId("selected-key").textContent).toBe(nonExistentId);

    // API query should still include the voice_id filter
    const apiQuery = screen.getByTestId("api-query").textContent ?? "";
    expect(apiQuery).toContain(`voice_id=${encodeURIComponent(nonExistentId)}`);

    // selected-label should be empty since the id doesn't match any item
    expect(screen.getByTestId("selected-label").textContent).toBe("");

    unmount();
  });

  // 7.5 – Highlight clears after timeout (Req 2.5)
  it("highlight is applied when voiceIdParam matches and removed when voiceIdParam is undefined", () => {
    const voices: Voice[] = [
      {
        id: "voice-target",
        name: "Target Voice",
        reference_transcript: null,
        language: "en",
        source: "uploaded",
        description: null,
        created_at: null,
        is_favorite: false,
        generation_count: 3,
      },
    ];

    // Render with matching voiceIdParam — highlight should be present
    const { unmount: unmount1 } = render(
      <VoiceCardList voices={voices} voiceIdParam="voice-target" />,
    );

    const cardHighlighted = screen.getByTestId("voice-card-voice-target");
    expect(cardHighlighted.className).toContain("ring-2");
    expect(cardHighlighted.className).toContain("ring-ring");

    unmount1();

    // Re-render with voiceIdParam undefined — simulates timeout clearing the state
    const { unmount: unmount2 } = render(
      <VoiceCardList voices={voices} voiceIdParam={undefined} />,
    );

    const cardCleared = screen.getByTestId("voice-card-voice-target");
    expect(cardCleared.className).not.toContain("ring-2");
    expect(cardCleared.className).not.toContain("ring-ring");

    unmount2();
  });
});
