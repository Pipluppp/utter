import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { GridArtSurface } from "../../components/ui/GridArt";
import { cn } from "../../lib/cn";
import { useReducedMotion } from "./MockCloneFeature";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DesignStep = -1 | 0 | 1 | 2 | 3 | 4 | 5;

interface DesignSequencerState {
  step: DesignStep;
  voiceName: string;
  instruct: string;
  previewText: string;
  langDropdownOpen: boolean;
  sweepNonce: number;
  presetPressed: boolean;
  previewStatus: "hidden" | "pending" | "completed";
  showResult: boolean;
  resultOpacity: number;
}

// ---------------------------------------------------------------------------
// Script constants
// ---------------------------------------------------------------------------

const MOCK_DESIGN_VOICE_NAME = "Warm & steady";
const MOCK_DESIGN_INSTRUCT =
  "A warm, steady voice with close-mic intimacy. Calm pacing, soft consonants, and a confident but gentle tone.";
const MOCK_DESIGN_PREVIEW_TEXT = "Every great journey begins with a single step forward.";

// ---------------------------------------------------------------------------
// Timing table
// ---------------------------------------------------------------------------

const DESIGN_TIMING: ReadonlyArray<{ duration: number; pause: number }> = [
  /* 0 – type voice name      */ { duration: 1200, pause: 450 },
  /* 1 – preset button press   */ { duration: 600, pause: 450 },
  /* 2 – type preview text     */ { duration: 2400, pause: 450 },
  /* 3 – language dropdown     */ { duration: 900, pause: 450 },
  /* 4 – button click          */ { duration: 450, pause: 300 },
  /* 5 – sweep + result reveal */ { duration: 2250, pause: 0 },
];

// ---------------------------------------------------------------------------
// Sequencer states
// ---------------------------------------------------------------------------

const IDLE_STATE: DesignSequencerState = {
  step: -1,
  voiceName: "",
  instruct: "",
  previewText: "",
  langDropdownOpen: false,
  sweepNonce: 0,
  presetPressed: false,
  previewStatus: "hidden",
  showResult: false,
  resultOpacity: 0.2,
};

function completedState(): DesignSequencerState {
  return {
    step: 5,
    voiceName: MOCK_DESIGN_VOICE_NAME,
    instruct: MOCK_DESIGN_INSTRUCT,
    previewText: MOCK_DESIGN_PREVIEW_TEXT,
    langDropdownOpen: false,
    sweepNonce: 0,
    presetPressed: true,
    previewStatus: "completed",
    showResult: true,
    resultOpacity: 1,
  };
}

// ---------------------------------------------------------------------------
// useDesignAnimationSequencer
// ---------------------------------------------------------------------------

function useDesignAnimationSequencer(
  playing: boolean,
  reducedMotion: boolean,
): DesignSequencerState {
  const [state, setState] = useState<DesignSequencerState>(IDLE_STATE);
  const timers = useRef(new Set<number>());

  const schedule = (fn: () => void, ms: number): number => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  };

  const scheduleInterval = (fn: () => void, ms: number): number => {
    const id = window.setInterval(fn, ms);
    timers.current.add(id);
    return id;
  };

  const clearAllTimers = () => {
    for (const id of timers.current) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
    timers.current.clear();
  };

  useEffect(() => {
    if (!playing) {
      clearAllTimers();
      setState(IDLE_STATE);
      return;
    }

    if (reducedMotion) {
      clearAllTimers();
      setState(completedState());
      return;
    }

    clearAllTimers();
    let elapsed = 0;

    // Step 0 – typewriter voice name
    schedule(() => {
      setState((s) => ({ ...s, step: 0 }));
      const totalChars = MOCK_DESIGN_VOICE_NAME.length;
      const intervalMs = Math.max(1, Math.floor(DESIGN_TIMING[0].duration / totalChars));
      let charIndex = 0;
      const intervalId = scheduleInterval(() => {
        charIndex++;
        setState((s) => ({
          ...s,
          voiceName: MOCK_DESIGN_VOICE_NAME.slice(0, charIndex),
        }));
        if (charIndex >= totalChars) {
          window.clearInterval(intervalId);
          timers.current.delete(intervalId);
        }
      }, intervalMs);
    }, elapsed);
    elapsed += DESIGN_TIMING[0].duration + DESIGN_TIMING[0].pause;

    // Step 1 – preset button press + instant instruct fill
    schedule(() => {
      setState((s) => ({
        ...s,
        step: 1,
        presetPressed: true,
        instruct: MOCK_DESIGN_INSTRUCT,
      }));
    }, elapsed);
    elapsed += DESIGN_TIMING[1].duration + DESIGN_TIMING[1].pause;

    // Step 2 – typewriter preview text
    schedule(() => {
      setState((s) => ({ ...s, step: 2 }));
      const totalChars = MOCK_DESIGN_PREVIEW_TEXT.length;
      const intervalMs = Math.max(1, Math.floor(DESIGN_TIMING[2].duration / totalChars));
      let charIndex = 0;
      const intervalId = scheduleInterval(() => {
        charIndex++;
        setState((s) => ({
          ...s,
          previewText: MOCK_DESIGN_PREVIEW_TEXT.slice(0, charIndex),
        }));
        if (charIndex >= totalChars) {
          window.clearInterval(intervalId);
          timers.current.delete(intervalId);
        }
      }, intervalMs);
    }, elapsed);
    elapsed += DESIGN_TIMING[2].duration + DESIGN_TIMING[2].pause;

    // Step 3 – language dropdown open/close
    schedule(() => {
      setState((s) => ({ ...s, step: 3, langDropdownOpen: true }));
      schedule(() => {
        setState((s) => ({ ...s, langDropdownOpen: false }));
      }, DESIGN_TIMING[3].duration);
    }, elapsed);
    elapsed += DESIGN_TIMING[3].duration + DESIGN_TIMING[3].pause;

    // Step 4 – button press
    schedule(() => {
      setState((s) => ({ ...s, step: 4, resultOpacity: 0.4 }));
    }, elapsed);
    elapsed += DESIGN_TIMING[4].duration + DESIGN_TIMING[4].pause;

    // Step 5 – sweep + result reveal
    schedule(() => {
      setState((s) => ({
        ...s,
        step: 5,
        sweepNonce: s.sweepNonce + 1,
        previewStatus: "pending",
        resultOpacity: 1,
      }));
      schedule(() => {
        setState((s) => ({ ...s, previewStatus: "completed" }));
      }, DESIGN_TIMING[5].duration * 0.5);
      schedule(() => {
        setState((s) => ({ ...s, showResult: true }));
      }, DESIGN_TIMING[5].duration * 0.7);
    }, elapsed);

    return () => {
      clearAllTimers();
    };
  }, [playing, reducedMotion]);

  return state;
}

// ---------------------------------------------------------------------------
// Mock waveform bars
// ---------------------------------------------------------------------------

function MockWaveform() {
  // Mimic WaveSurfer: barWidth=2, barGap=2, centered bars mirrored around midline
  const bars = [
    0.2, 0.45, 0.7, 0.5, 0.85, 0.6, 0.4, 0.75, 0.9, 0.55, 0.35, 0.8, 0.65, 0.45, 0.95, 0.5, 0.7,
    0.4, 0.6, 0.85, 0.3, 0.55, 0.75, 0.5, 0.15, 0.1, 0.15, 0.1, 0.2, 0.4, 0.65, 0.85, 0.55, 0.7,
    0.9, 0.45, 0.6, 0.8, 0.5, 0.35, 0.75, 0.55, 0.4, 0.65, 0.8, 0.5, 0.3, 0.6,
  ];
  return (
    <div className="relative flex h-12 items-center gap-[2px]">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-foreground/15" />
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-[2px] shrink-0 bg-foreground/50"
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MockDesignFeature
// ---------------------------------------------------------------------------

export function MockDesignFeature(): ReactNode {
  const [isInView, setIsInView] = useState(false);
  const reducedMotion = useReducedMotion();
  const {
    step,
    voiceName,
    instruct,
    previewText,
    langDropdownOpen,
    sweepNonce,
    presetPressed,
    previewStatus,
    showResult,
    resultOpacity,
  } = useDesignAnimationSequencer(isInView, reducedMotion);

  const observerRef = useRef<IntersectionObserver | null>(null);

  const refCallback = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (!node) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsInView(entry.isIntersecting);
        }
      },
      { threshold: 0.1 },
    );
    observerRef.current.observe(node);
  }, []);

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  return (
    <div ref={refCallback} className="overflow-hidden">
      <GridArtSurface sweepNonce={sweepNonce}>
        <div aria-hidden="true" className="space-y-6 p-6">
          {/* Voice name input */}
          <div>
            <span className="mb-2 block text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Voice Name
            </span>
            <div className="w-full border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated">
              {voiceName || <span className="text-faint">Name your voice...</span>}
            </div>
          </div>

          {/* Voice description + presets */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                Voice Description
              </span>
              <span className="text-[12px] text-faint">{instruct.length} / 1000</span>
            </div>
            <div className="min-h-20 w-full border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated">
              {instruct || (
                <span className="text-faint">Describe the voice you want to create...</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {["Warm & steady", "Bright & fast", "Low & cinematic"].map((label) => (
                <div
                  key={label}
                  className={cn(
                    "border border-border bg-background px-3 py-1.5 text-[12px] font-medium uppercase tracking-wide text-foreground transition-transform motion-reduce:transition-none",
                    presetPressed && label === "Warm & steady" ? "scale-95" : "scale-100",
                  )}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Preview text */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                Preview Text
              </span>
              <span className="text-[12px] text-faint">{previewText.length} / 500</span>
            </div>
            <div className="min-h-16 w-full border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated">
              {previewText || (
                <span className="text-faint">Enter text to preview the voice...</span>
              )}
            </div>
          </div>

          {/* Language selector */}
          <div>
            <span className="mb-2 block text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Language
            </span>
            <div className="relative">
              <div className="w-full appearance-none border border-border bg-background px-4 py-3 pr-10 text-sm text-foreground shadow-elevated">
                English
              </div>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M8 11L3 6h10l-5 5z" />
              </svg>
              <div
                className={cn(
                  "absolute left-0 top-full z-20 mt-1 w-full border border-border bg-background shadow-elevated transition-opacity motion-reduce:transition-none",
                  langDropdownOpen ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                <div className="bg-foreground/10 px-4 py-2 text-sm text-foreground">English</div>
                <div className="px-4 py-2 text-sm text-muted-foreground">Spanish</div>
                <div className="px-4 py-2 text-sm text-muted-foreground">French</div>
              </div>
            </div>
          </div>

          {/* Button row */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div
              className={cn(
                "relative inline-flex w-full cursor-pointer items-center justify-center gap-2 border border-foreground bg-foreground px-6 py-3 text-sm font-medium uppercase tracking-wide text-background transition-transform motion-reduce:transition-none",
                step === 4 ? "scale-95" : "scale-100",
              )}
            >
              Generate Preview
            </div>
            <div className="relative inline-flex w-full items-center justify-center gap-2 border border-border bg-background px-6 py-3 text-sm font-medium uppercase tracking-wide text-foreground">
              Use Voice
            </div>
          </div>

          {/* Tracked preview row */}
          <div
            className="border border-border bg-subtle px-4 py-3 transition-[opacity] duration-600 ease-in-out motion-reduce:transition-none"
            style={{ opacity: resultOpacity }}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">Voice Preview</span>
              <span
                className={cn(
                  "text-[12px] font-medium uppercase tracking-wide",
                  previewStatus === "completed" ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {previewStatus === "completed" ? "Completed" : "Pending..."}
              </span>
            </div>
          </div>

          {/* Waveform preview area */}
          <div
            className="space-y-3 border border-border bg-background p-4 transition-[opacity] duration-600 ease-in-out motion-reduce:transition-none"
            style={{ opacity: resultOpacity }}
          >
            <MockWaveform />
            <div className="inline-flex items-center justify-center border border-border bg-background px-4 py-2 text-[12px] font-medium uppercase tracking-wide text-foreground">
              Save This Preview
            </div>
          </div>
        </div>
      </GridArtSurface>
    </div>
  );
}
