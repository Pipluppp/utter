import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/atoms/Button";
import { cn } from "../../../lib/cn";

const STEPS = [3, 2, 1] as const;

interface CountdownProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function Countdown({ onComplete, onCancel }: CountdownProps) {
  const [current, setCurrent] = useState(3);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (current <= 0) {
      onCompleteRef.current();
      return;
    }
    const timer = window.setTimeout(() => setCurrent((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [current]);

  return (
    <div
      className="relative flex h-14 items-center justify-center"
      role="status"
      aria-live="assertive"
      aria-label={`Recording starts in ${current}`}
    >
      <div className="flex items-center gap-6">
        {STEPS.map((n) => (
          <span
            key={n}
            className={cn(
              "inline-flex size-10 items-center justify-center font-mono text-2xl font-bold tabular-nums transition-all duration-300 ease-out select-none",
              n === current
                ? "scale-150 text-foreground opacity-100"
                : "scale-100 text-faint opacity-30",
            )}
          >
            {n}
          </span>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        square
        onPress={onCancel}
        aria-label="Cancel recording"
        className="absolute right-0 top-1/2 -translate-y-1/2"
      >
        <X className="icon-xs" aria-hidden="true" />
      </Button>
    </div>
  );
}
