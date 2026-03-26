import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Button, Dialog, DialogTrigger, Modal, ModalOverlay } from "react-aria-components";
import { cn } from "../../lib/cn";

/** Module-level Set to deduplicate prefetch requests across all InfoTip instances */
const prefetchedUrls = new Set<string>();

/** Fire-and-forget image prefetch — triggers a browser cache fetch if not already done */
function prefetchImage(url: string): void {
  if (prefetchedUrls.has(url)) return;
  prefetchedUrls.add(url);
  new Image().src = url;
}

/** Pure navigation helpers (exported for testing) */
export function advance(index: number, length: number): number {
  return (index + 1) % length;
}

export function retreat(index: number, length: number): number {
  return (index - 1 + length) % length;
}

export function formatIndicator(index: number, length: number): string {
  return `${index + 1} / ${length}`;
}

type InfoTipProps = {
  /** Accessible label for the dialog (e.g., "Clone tips") */
  label?: string;
  /** Array of tip strings to display in the carousel */
  tips: string[];
  /** Which halftone image to use as the modal background */
  halftoneImage?: "fire" | "grass" | "lilac";
};

export function InfoTip({ label = "Information", tips, halftoneImage = "fire" }: InfoTipProps) {
  if (tips.length === 0) return null;

  const imageUrl = `/static/${halftoneImage}.jpg`;

  return (
    <DialogTrigger>
      <Button
        aria-label={label}
        onHoverStart={() => prefetchImage(imageUrl)}
        onFocus={() => prefetchImage(imageUrl)}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-full bg-transparent text-muted-foreground press-scale",
          "hover:bg-muted hover:text-foreground",
          "pressed:bg-muted pressed:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <Info className="icon-md" strokeWidth={1.5} aria-hidden="true" />
      </Button>
      <ModalOverlay
        isDismissable
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-black/[50%] p-4 overscroll-contain backdrop-blur-lg",
          "entering:animate-in entering:fade-in entering:duration-200 entering:ease-out",
          "exiting:animate-out exiting:fade-out exiting:duration-150 exiting:ease-in",
          "motion-reduce:duration-0",
        )}
      >
        <Modal
          className={cn(
            "w-[min(600px,calc(100vw-2rem))] overflow-hidden rounded-2xl shadow-2xl bg-clip-padding",
            "entering:animate-in entering:zoom-in-105 entering:ease-out entering:duration-200",
            "exiting:animate-out exiting:zoom-out-95 exiting:ease-in exiting:duration-150",
            "motion-reduce:duration-0",
          )}
        >
          <TipsDialog label={label} tips={tips} halftoneImage={halftoneImage} />
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

function TipsDialog({
  label,
  tips,
  halftoneImage,
}: {
  label: string;
  tips: string[];
  halftoneImage: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("right");

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  function goNext() {
    setDirection("right");
    setCurrentIndex((i) => advance(i, tips.length));
  }

  function goPrev() {
    setDirection("left");
    setCurrentIndex((i) => retreat(i, tips.length));
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    }
  }

  return (
    <Dialog aria-label={label} className="relative outline-none">
      {/* Image-dominant layout: square ratio, content centered */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="relative aspect-[5/4] w-full outline-none"
      >
        {/* Halftone background image — fills entire modal */}
        <div className="absolute inset-0 bg-neutral-800 dark:bg-neutral-200">
          <img
            src={`/static/${halftoneImage}.jpg`}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
        </div>

        {/* Content block — centered in the image */}
        <div className="absolute inset-0 flex items-center justify-center px-14 sm:px-16">
          <div
            className={cn(
              "w-full rounded-2xl px-6 py-5 sm:px-8 sm:py-6",
              "bg-black text-white",
              "dark:bg-white dark:text-black",
            )}
          >
            <div
              aria-live="polite"
              aria-atomic="true"
              className="relative min-h-[4rem] overflow-hidden font-[family-name:var(--font-pixel-square)] text-base leading-relaxed sm:text-lg"
            >
              <p
                key={currentIndex}
                className={cn(
                  "animate-in fade-in duration-200",
                  direction === "right" ? "slide-in-from-right-4" : "slide-in-from-left-4",
                  "motion-reduce:duration-0 motion-reduce:animate-none",
                )}
              >
                {tips[currentIndex]}
              </p>
            </div>

            {/* Dot indicators — each is a pressable Button for direct navigation */}
            <div className="mt-4 flex items-center justify-center gap-0.5" role="tablist">
              {tips.map((_, i) => (
                <Button
                  key={i}
                  aria-label={`Tip ${i + 1} of ${tips.length}`}
                  onPress={() => {
                    setDirection(i > currentIndex ? "right" : "left");
                    setCurrentIndex(i);
                  }}
                  className="group flex items-center justify-center p-2 focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "block size-2 rounded-full transition-all duration-200",
                      "group-focus-visible:ring-2 group-focus-visible:ring-white/50 dark:group-focus-visible:ring-black/50",
                      i === currentIndex
                        ? "scale-110 bg-white dark:bg-black"
                        : "bg-white/30 group-hover:bg-white/60 dark:bg-black/30 dark:group-hover:bg-black/60",
                    )}
                  />
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation arrows — SVG chevrons on the sides */}
        <Button
          aria-label="Previous tip"
          onPress={goPrev}
          className={cn(
            "absolute left-2 top-1/2 -translate-y-1/2",
            "inline-flex size-10 items-center justify-center rounded-full press-scale",
            "text-white/70 hover:text-white hover:bg-white/10",
            "dark:text-black/70 dark:hover:text-black dark:hover:bg-black/10",
            "focus-visible:ring-2 focus-visible:ring-white/30 dark:focus-visible:ring-black/30",
          )}
        >
          <ChevronLeft className="icon-nav translate-x-[-1px]" strokeWidth={2.5} />
        </Button>

        <Button
          aria-label="Next tip"
          onPress={goNext}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2",
            "inline-flex size-10 items-center justify-center rounded-full press-scale",
            "text-white/70 hover:text-white hover:bg-white/10",
            "dark:text-black/70 dark:hover:text-black dark:hover:bg-black/10",
            "focus-visible:ring-2 focus-visible:ring-white/30 dark:focus-visible:ring-black/30",
          )}
        >
          <ChevronRight className="icon-nav translate-x-[1px]" strokeWidth={2.5} />
        </Button>
      </div>
    </Dialog>
  );
}

/** Exported for testing only — allows tests to inspect and reset the prefetch cache */
export const _testUtils = {
  prefetchedUrls,
  resetPrefetchCache: () => prefetchedUrls.clear(),
};
