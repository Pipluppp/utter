import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { GridArtSurface } from "../../components/molecules/GridArt";
import { cn } from "../../lib/cn";
import { useReducedMotion } from "./MockCloneFeature";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GenerateStep = -1 | 0 | 1 | 2 | 3 | 4 | 5;

interface GenerateSequencerState {
  step: GenerateStep;
  voiceDropdownOpen: boolean;
  selectedVoice: string;
  langDropdownOpen: boolean;
  text: string;
  sweepNonce: number;
  jobStatus: "hidden" | "pending" | "completed";
  showResult: boolean;
  resultOpacity: number;
}

// ---------------------------------------------------------------------------
// Script constants
// ---------------------------------------------------------------------------

const MOCK_GENERATE_VOICE = "Aria (warm, close-mic)";
const MOCK_GENERATE_TEXT = "The quick brown fox jumps over the lazy dog near the riverbank.";

// ---------------------------------------------------------------------------
// Timing table
// ---------------------------------------------------------------------------

const GENERATE_TIMING: ReadonlyArray<{ duration: number; pause: number }> = [
  /* 0 – voice dropdown    */ { duration: 900, pause: 450 },
  /* 1 – language dropdown  */ { duration: 900, pause: 450 },
  /* 2 – typing text        */ { duration: 2400, pause: 450 },
  /* 3 – button click       */ { duration: 450, pause: 300 },
  /* 4 – grid sweep         */ { duration: 2250, pause: 600 },
  /* 5 – result reveal      */ { duration: 1500, pause: 0 },
];

// ---------------------------------------------------------------------------
// Sequencer states
// ---------------------------------------------------------------------------

const IDLE_STATE: GenerateSequencerState = {
  step: -1,
  voiceDropdownOpen: false,
  selectedVoice: "",
  langDropdownOpen: false,
  text: "",
  sweepNonce: 0,
  jobStatus: "hidden",
  showResult: false,
  resultOpacity: 0.2,
};

function completedState(): GenerateSequencerState {
  return {
    step: 5,
    voiceDropdownOpen: false,
    selectedVoice: MOCK_GENERATE_VOICE,
    langDropdownOpen: false,
    text: MOCK_GENERATE_TEXT,
    sweepNonce: 0,
    jobStatus: "completed",
    showResult: true,
    resultOpacity: 1,
  };
}

// ---------------------------------------------------------------------------
// useGenerateAnimationSequencer
// ---------------------------------------------------------------------------

function useGenerateAnimationSequencer(
  playing: boolean,
  reducedMotion: boolean,
): GenerateSequencerState {
  const [state, setState] = useState<GenerateSequencerState>(IDLE_STATE);
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

    // Step 0 – voice dropdown open/close
    schedule(() => {
      setState((s) => ({ ...s, step: 0, voiceDropdownOpen: true }));
      schedule(() => {
        setState((s) => ({
          ...s,
          voiceDropdownOpen: false,
          selectedVoice: MOCK_GENERATE_VOICE,
        }));
      }, GENERATE_TIMING[0].duration);
    }, elapsed);
    elapsed += GENERATE_TIMING[0].duration + GENERATE_TIMING[0].pause;

    // Step 1 – language dropdown open/close
    schedule(() => {
      setState((s) => ({ ...s, step: 1, langDropdownOpen: true }));
      schedule(() => {
        setState((s) => ({ ...s, langDropdownOpen: false }));
      }, GENERATE_TIMING[1].duration);
    }, elapsed);
    elapsed += GENERATE_TIMING[1].duration + GENERATE_TIMING[1].pause;

    // Step 2 – typewriter text
    schedule(() => {
      setState((s) => ({ ...s, step: 2 }));
      const totalChars = MOCK_GENERATE_TEXT.length;
      const intervalMs = Math.max(1, Math.floor(GENERATE_TIMING[2].duration / totalChars));
      let charIndex = 0;
      const intervalId = scheduleInterval(() => {
        charIndex++;
        setState((s) => ({
          ...s,
          text: MOCK_GENERATE_TEXT.slice(0, charIndex),
        }));
        if (charIndex >= totalChars) {
          window.clearInterval(intervalId);
          timers.current.delete(intervalId);
        }
      }, intervalMs);
    }, elapsed);
    elapsed += GENERATE_TIMING[2].duration + GENERATE_TIMING[2].pause;

    // Step 3 – button press
    schedule(() => {
      setState((s) => ({ ...s, step: 3 }));
    }, elapsed);
    elapsed += GENERATE_TIMING[3].duration + GENERATE_TIMING[3].pause;

    // Step 4 – sweep
    schedule(() => {
      setState((s) => ({
        ...s,
        step: 4,
        sweepNonce: s.sweepNonce + 1,
        jobStatus: "pending",
        resultOpacity: 0.55,
      }));
      // Transition to completed partway through sweep
      schedule(() => {
        setState((s) => ({ ...s, jobStatus: "completed" }));
      }, GENERATE_TIMING[4].duration * 0.6);
    }, elapsed);
    elapsed += GENERATE_TIMING[4].duration + GENERATE_TIMING[4].pause;

    // Step 5 – result reveal
    schedule(() => {
      setState((s) => ({ ...s, step: 5, showResult: true, resultOpacity: 1 }));
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
    0.15, 0.35, 0.55, 0.8, 0.45, 0.7, 0.9, 0.5, 0.3, 0.65, 0.85, 0.4, 0.95, 0.6, 0.75, 0.35, 0.5,
    0.8, 0.45, 0.7, 0.25, 0.6, 0.9, 0.55, 0.4, 0.15, 0.1, 0.15, 0.1, 0.15, 0.3, 0.55, 0.75, 0.5,
    0.85, 0.65, 0.4, 0.9, 0.7, 0.55, 0.35, 0.8, 0.6, 0.45, 0.7, 0.5, 0.3, 0.65,
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
// MockGenerateFeature
// ---------------------------------------------------------------------------

export function MockGenerateFeature(): ReactNode {
  const [isInView, setIsInView] = useState(false);
  const reducedMotion = useReducedMotion();
  const {
    step,
    voiceDropdownOpen,
    selectedVoice,
    langDropdownOpen,
    text,
    sweepNonce,
    jobStatus,
    resultOpacity,
  } = useGenerateAnimationSequencer(isInView, reducedMotion);

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
          {/* Voice selector */}
          <div>
            <span className="mb-2 block label-style">Voice</span>
            <div className="relative">
              <div className="w-full border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated">
                {selectedVoice || <span className="text-faint">Select a voice...</span>}
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
                  voiceDropdownOpen ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                <div className="bg-foreground/10 px-4 py-2 text-sm text-foreground">
                  Aria (warm, close-mic)
                </div>
                <div className="px-4 py-2 text-sm text-muted-foreground">Duncan (calm, studio)</div>
                <div className="px-4 py-2 text-sm text-muted-foreground">
                  Nova (bright, podcast)
                </div>
              </div>
            </div>
          </div>

          {/* Language selector */}
          <div>
            <span className="mb-2 block label-style">Language</span>
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

          {/* Text area */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label-style">Text</span>
              <span className="text-caption text-faint">{text.length} / 500</span>
            </div>
            <div className="min-h-20 w-full border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated">
              {text || <span className="text-faint">Enter text to generate speech...</span>}
            </div>
          </div>

          {/* Generate button */}
          <div
            className={cn(
              "relative inline-flex w-full cursor-pointer items-center justify-center gap-2 border border-foreground bg-foreground px-6 py-3 text-sm font-medium uppercase tracking-wide text-background transition-transform motion-reduce:transition-none",
              step === 3 ? "scale-95" : "scale-100",
            )}
          >
            Generate Speech
          </div>

          {/* Tracked job row */}
          <div
            className="border border-border bg-subtle px-4 py-3 transition-[opacity] duration-600 ease-in-out motion-reduce:transition-none"
            style={{ opacity: resultOpacity }}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">Speech Generation</span>
              <span
                className={cn(
                  "text-caption font-medium uppercase tracking-wide",
                  jobStatus === "completed" ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {jobStatus === "completed" ? "Completed" : "Pending..."}
              </span>
            </div>
          </div>

          {/* Waveform result area */}
          <div
            className="space-y-3 border border-border bg-background p-4 transition-[opacity] duration-600 ease-in-out motion-reduce:transition-none"
            style={{ opacity: resultOpacity }}
          >
            <MockWaveform />
            <div className="inline-flex items-center justify-center border border-border bg-background px-4 py-2 text-caption font-medium uppercase tracking-wide text-foreground">
              Download
            </div>
          </div>
        </div>
      </GridArtSurface>
    </div>
  );
}
