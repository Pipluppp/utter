import { useEffect, useState } from "react";

/**
 * Returns a `nowMs` timestamp that updates every ~1 second while `isActive`
 * is true. When inactive, returns `Date.now()` without running an interval.
 *
 * Designed to drive `formatElapsed(task.startedAt, nowMs)` in components
 * that display elapsed time for active tasks.
 */
export function useElapsedTick(isActive: boolean): number {
  const [nowMs, setNowMs] = useState(Date.now);

  useEffect(() => {
    if (!isActive) return;

    // Sync immediately so the first render after activation is fresh
    setNowMs(Date.now());

    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(id);
  }, [isActive]);

  return nowMs;
}
