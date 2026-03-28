import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { GridArtSurface } from "../../components/molecules/GridArt";
import { cn } from "../../lib/cn";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnimationStep = -1 | 0 | 1 | 2 | 3 | 4 | 5;
type AudioMode = "upload" | "record";

// ---------------------------------------------------------------------------
// Script constants
// ---------------------------------------------------------------------------

export const MOCK_VOICE_NAME = "Aria (warm, close-mic)";
export const MOCK_TRANSCRIPT = "The quick brown fox jumps over the lazy dog near the riverbank.";
export const MOCK_FILENAME = "sample_voice_clip.wav";

// ---------------------------------------------------------------------------
// Step timing tables (ms) — 50% longer than original
// ---------------------------------------------------------------------------

/** Upload mode: file drop → attach → type → language → button → sweep */
const UPLOAD_TIMING: ReadonlyArray<{ duration: number; pause: number }> = [
  /* 0 – file drop nudge      */ { duration: 1050, pause: 450 },
  /* 1 – file attached         */ { duration: 600, pause: 450 },
  /* 2 – typing                */ { duration: 2250, pause: 450 },
  /* 3 – language dropdown     */ { duration: 900, pause: 450 },
  /* 4 – button click          */ { duration: 450, pause: 300 },
  /* 5 – grid sweep            */ { duration: 2250, pause: 0 },
];

/** Record mode: start click → mic level → waveform → type → language → button → sweep */
const RECORD_TIMING: ReadonlyArray<{ duration: number; pause: number }> = [
  /* 0 – start button click    */ { duration: 600, pause: 300 },
  /* 1 – mic level animation   */ { duration: 2400, pause: 450 },
  /* 2 – typing                */ { duration: 2250, pause: 450 },
  /* 3 – language dropdown     */ { duration: 900, pause: 450 },
  /* 4 – button click          */ { duration: 450, pause: 300 },
  /* 5 – grid sweep            */ { duration: 2250, pause: 0 },
];

// ---------------------------------------------------------------------------
// useReducedMotion
// ---------------------------------------------------------------------------

export function useReducedMotion(): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return matches;
}

// ---------------------------------------------------------------------------
// useAnimationSequencer
// ---------------------------------------------------------------------------

interface SequencerState {
  step: AnimationStep;
  voiceName: string;
  transcript: string;
  dropdownOpen: boolean;
  sweepNonce: number;
  /** Upload mode: drop zone nudge active */
  dropNudge: boolean;
  /** Record mode: mic level 0–1 */
  micLevel: number;
  /** Record mode: recording seconds label */
  recordSeconds: number;
  /** Record mode: "start" button pressed visual */
  startPressed: boolean;
}

const IDLE_STATE: SequencerState = {
  step: -1,
  voiceName: "",
  transcript: "",
  dropdownOpen: false,
  sweepNonce: 0,
  dropNudge: false,
  micLevel: 0,
  recordSeconds: 0,
  startPressed: false,
};

function completedState(): SequencerState {
  return {
    step: 5,
    voiceName: MOCK_VOICE_NAME,
    transcript: MOCK_TRANSCRIPT,
    dropdownOpen: false,
    sweepNonce: 0,
    dropNudge: false,
    micLevel: 0,
    recordSeconds: 0,
    startPressed: false,
  };
}

export function useAnimationSequencer(
  playing: boolean,
  reducedMotion: boolean,
  mode: AudioMode,
): SequencerState {
  const [state, setState] = useState<SequencerState>(IDLE_STATE);
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
    const timing = mode === "record" ? RECORD_TIMING : UPLOAD_TIMING;
    let elapsed = 0;

    if (mode === "upload") {
      // --- UPLOAD SEQUENCE ---

      // Step 0 – drop zone nudge (scale down then back)
      schedule(() => {
        setState((s) => ({ ...s, step: 0, dropNudge: true }));
        schedule(() => {
          setState((s) => ({ ...s, dropNudge: false }));
        }, 180);
      }, elapsed);
      elapsed += timing[0].duration + timing[0].pause;

      // Step 1 – file attached
      schedule(() => {
        setState((s) => ({ ...s, step: 1 }));
      }, elapsed);
      elapsed += timing[1].duration + timing[1].pause;

      // Step 2 – typing
      const typingStart = elapsed;
      schedule(() => {
        setState((s) => ({ ...s, step: 2 }));
        const totalChars = MOCK_VOICE_NAME.length + MOCK_TRANSCRIPT.length;
        const intervalMs = Math.max(1, Math.floor(timing[2].duration / totalChars));
        let charIndex = 0;
        const intervalId = scheduleInterval(() => {
          charIndex++;
          if (charIndex <= MOCK_VOICE_NAME.length) {
            setState((s) => ({
              ...s,
              voiceName: MOCK_VOICE_NAME.slice(0, charIndex),
            }));
          } else {
            const ti = charIndex - MOCK_VOICE_NAME.length;
            setState((s) => ({
              ...s,
              voiceName: MOCK_VOICE_NAME,
              transcript: MOCK_TRANSCRIPT.slice(0, ti),
            }));
          }
          if (charIndex >= totalChars) {
            window.clearInterval(intervalId);
            timers.current.delete(intervalId);
          }
        }, intervalMs);
      }, typingStart);
      elapsed += timing[2].duration + timing[2].pause;

      // Step 3 – language dropdown
      schedule(() => {
        setState((s) => ({ ...s, step: 3, dropdownOpen: true }));
        schedule(() => {
          setState((s) => ({ ...s, dropdownOpen: false }));
        }, timing[3].duration);
      }, elapsed);
      elapsed += timing[3].duration + timing[3].pause;

      // Step 4 – button click
      schedule(() => {
        setState((s) => ({ ...s, step: 4 }));
      }, elapsed);
      elapsed += timing[4].duration + timing[4].pause;

      // Step 5 – grid sweep
      schedule(() => {
        setState((s) => ({ ...s, step: 5, sweepNonce: s.sweepNonce + 1 }));
      }, elapsed);
    } else {
      // --- RECORD SEQUENCE ---

      // Step 0 – start button press
      schedule(() => {
        setState((s) => ({ ...s, step: 0, startPressed: true }));
        schedule(() => {
          setState((s) => ({ ...s, startPressed: false }));
        }, 200);
      }, elapsed);
      elapsed += timing[0].duration + timing[0].pause;

      // Step 1 – mic level animation + waveform reveal + seconds counter
      const micStart = elapsed;
      schedule(() => {
        setState((s) => ({ ...s, step: 1 }));
        const micDuration = timing[1].duration;
        const tickMs = 60;
        let tick = 0;
        const totalTicks = Math.floor(micDuration / tickMs);
        const intervalId = scheduleInterval(() => {
          tick++;
          // Pseudo-random mic level using sine waves
          const level =
            0.3 +
            0.35 * Math.sin(tick * 0.7) +
            0.2 * Math.sin(tick * 1.3) +
            0.15 * Math.cos(tick * 0.4);
          const clampedLevel = Math.max(0.05, Math.min(1, level));
          setState((s) => ({
            ...s,
            micLevel: clampedLevel,
            recordSeconds: Math.floor((tick / totalTicks) * 12),
          }));
          if (tick >= totalTicks) {
            window.clearInterval(intervalId);
            timers.current.delete(intervalId);
            setState((s) => ({
              ...s,
              micLevel: 0,
              recordSeconds: 12,
            }));
          }
        }, tickMs);
      }, micStart);
      elapsed += timing[1].duration + timing[1].pause;

      // Step 2 – typing (same as upload)
      const typingStart = elapsed;
      schedule(() => {
        setState((s) => ({ ...s, step: 2 }));
        const totalChars = MOCK_VOICE_NAME.length + MOCK_TRANSCRIPT.length;
        const intervalMs = Math.max(1, Math.floor(timing[2].duration / totalChars));
        let charIndex = 0;
        const intervalId = scheduleInterval(() => {
          charIndex++;
          if (charIndex <= MOCK_VOICE_NAME.length) {
            setState((s) => ({
              ...s,
              voiceName: MOCK_VOICE_NAME.slice(0, charIndex),
            }));
          } else {
            const ti = charIndex - MOCK_VOICE_NAME.length;
            setState((s) => ({
              ...s,
              voiceName: MOCK_VOICE_NAME,
              transcript: MOCK_TRANSCRIPT.slice(0, ti),
            }));
          }
          if (charIndex >= totalChars) {
            window.clearInterval(intervalId);
            timers.current.delete(intervalId);
          }
        }, intervalMs);
      }, typingStart);
      elapsed += timing[2].duration + timing[2].pause;

      // Step 3 – language dropdown
      schedule(() => {
        setState((s) => ({ ...s, step: 3, dropdownOpen: true }));
        schedule(() => {
          setState((s) => ({ ...s, dropdownOpen: false }));
        }, timing[3].duration);
      }, elapsed);
      elapsed += timing[3].duration + timing[3].pause;

      // Step 4 – button click
      schedule(() => {
        setState((s) => ({ ...s, step: 4 }));
      }, elapsed);
      elapsed += timing[4].duration + timing[4].pause;

      // Step 5 – grid sweep
      schedule(() => {
        setState((s) => ({ ...s, step: 5, sweepNonce: s.sweepNonce + 1 }));
      }, elapsed);
    }

    return () => {
      clearAllTimers();
    };
  }, [playing, reducedMotion, mode]);

  return state;
}

// ---------------------------------------------------------------------------
// MockCloneFeature
// ---------------------------------------------------------------------------

export function MockCloneFeature(): ReactNode {
  const [isInView, setIsInView] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>("record");
  const reducedMotion = useReducedMotion();
  const {
    step,
    voiceName,
    transcript,
    dropdownOpen,
    sweepNonce,
    dropNudge,
    micLevel,
    recordSeconds,
    startPressed,
  } = useAnimationSequencer(isInView, reducedMotion, audioMode);

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

  const recordTimeLabel = `${Math.floor(recordSeconds / 60)}:${String(recordSeconds % 60).padStart(2, "0")}`;

  return (
    <div ref={refCallback} className="overflow-hidden">
      <GridArtSurface sweepNonce={sweepNonce}>
        <div aria-hidden="true" className="space-y-6 p-6">
          {/* Upload / Record toggle */}
          <div className="flex items-center justify-center">
            <div className="inline-flex overflow-hidden border border-border bg-background shadow-elevated">
              <Button
                className={cn(
                  "cursor-default press-scale px-4 py-2 text-xs uppercase tracking-wide motion-reduce:transition-none",
                  audioMode === "upload"
                    ? "bg-foreground font-semibold text-background"
                    : "bg-background font-medium text-foreground data-[hovered]:bg-subtle data-[pressed]:bg-subtle",
                )}
                onPress={() => setAudioMode("upload")}
              >
                Upload
              </Button>
              <Button
                className={cn(
                  "cursor-default press-scale px-4 py-2 text-xs uppercase tracking-wide motion-reduce:transition-none",
                  audioMode === "record"
                    ? "bg-foreground font-semibold text-background"
                    : "bg-background font-medium text-foreground data-[hovered]:bg-subtle data-[pressed]:bg-subtle",
                )}
                onPress={() => setAudioMode("record")}
              >
                Record
              </Button>
            </div>
          </div>

          {/* Audio input area — both rendered, only active one visible, to keep height stable */}
          <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
            <div className={audioMode === "upload" ? "visible" : "invisible"}>
              {/* Drop zone */}
              <div>
                <div
                  className={cn(
                    "w-full border border-dashed bg-background p-6 text-center shadow-elevated transition-all duration-150 motion-reduce:transition-none",
                    step >= 0 && audioMode === "upload" ? "border-foreground/60" : "border-border",
                    dropNudge ? "scale-[0.97]" : "scale-100",
                  )}
                >
                  <div className="text-sm text-muted-foreground">
                    Drag &amp; drop audio here, or click to browse.
                  </div>
                  <div className="mt-2 text-xs text-faint">
                    WAV / MP3 / M4A - max 10MB - 60s max
                  </div>
                </div>
                <div
                  className={cn(
                    "mt-2 text-xs text-foreground transition-opacity motion-reduce:transition-none",
                    step >= 1 && audioMode === "upload" ? "opacity-100" : "opacity-0",
                  )}
                >
                  {MOCK_FILENAME}
                </div>
              </div>
            </div>

            <div className={audioMode === "record" ? "visible" : "invisible"}>
              {/* Record mode panel */}
              <div className="space-y-4 border border-border bg-background p-6 shadow-elevated">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold uppercase tracking-wide">
                    Record Reference Audio
                  </div>
                  <div className="text-xs text-faint">{recordTimeLabel}</div>
                </div>
                <div className="text-xs text-faint">
                  Aim for 10-20 seconds. Recording stops automatically at 60 seconds.
                </div>

                {/* Mic level bar */}
                <div className="h-2 w-full overflow-hidden border border-border bg-muted">
                  <div
                    className="h-full bg-foreground transition-[width] duration-100 motion-reduce:transition-none"
                    style={{
                      width: `${Math.min(100, micLevel * 180)}%`,
                    }}
                  />
                </div>

                {/* Start / Stop / Clear buttons */}
                <div className="flex flex-wrap gap-2">
                  <div
                    className={cn(
                      "inline-flex items-center justify-center border px-3 py-2 text-caption font-medium uppercase tracking-wide transition-transform duration-100 motion-reduce:transition-none",
                      step >= 1
                        ? "border-border bg-muted text-faint"
                        : "border-foreground bg-foreground text-background",
                      startPressed ? "scale-95" : "scale-100",
                    )}
                  >
                    {step >= 1 ? "Recording..." : "Start"}
                  </div>
                  <div className="inline-flex items-center justify-center border border-border bg-background px-3 py-2 text-caption font-medium uppercase tracking-wide text-foreground">
                    Stop
                  </div>
                  <div className="inline-flex items-center justify-center border border-border bg-background px-3 py-2 text-caption font-medium uppercase tracking-wide text-foreground">
                    Clear
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form fields */}
          <div className="space-y-6">
            <div>
              <span className="mb-2 block label-style">Voice Name</span>
              <div className="w-full border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated">
                {voiceName || <span className="text-faint">e.g. Duncan (calm, close-mic)...</span>}
              </div>
            </div>

            <div>
              <span className="mb-2 block label-style">Transcript</span>
              <div className="min-h-20 w-full border border-border bg-background px-4 py-3 text-sm text-foreground shadow-elevated">
                {transcript || (
                  <span className="text-faint">Paste the transcript of the reference audio...</span>
                )}
              </div>
            </div>

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
                    dropdownOpen ? "opacity-100" : "pointer-events-none opacity-0",
                  )}
                >
                  <div className="bg-foreground/10 px-4 py-2 text-sm text-foreground">English</div>
                  <div className="px-4 py-2 text-sm text-muted-foreground">Spanish</div>
                  <div className="px-4 py-2 text-sm text-muted-foreground">French</div>
                </div>
              </div>
            </div>
          </div>

          {/* Button row */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative inline-flex w-full items-center justify-center gap-2 border border-border bg-background px-6 py-3 text-sm font-medium uppercase tracking-wide text-foreground">
              Try Example Voice
            </div>
            <div
              className={cn(
                "relative inline-flex w-full cursor-default items-center justify-center gap-2 border border-foreground bg-foreground px-6 py-3 text-sm font-medium uppercase tracking-wide text-background transition-transform motion-reduce:transition-none",
                step === 4 ? "scale-95" : "scale-100",
              )}
            >
              Clone Voice
            </div>
          </div>
        </div>
      </GridArtSurface>
    </div>
  );
}
