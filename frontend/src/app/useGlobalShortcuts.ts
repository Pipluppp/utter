import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function useGlobalShortcuts(enabled: boolean) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const to =
        key === "c" ? "/clone" : key === "g" ? "/generate" : key === "d" ? "/design" : null;
      if (!to) return;
      if (location.pathname === to) return;

      event.preventDefault();
      void navigate({ to });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, location.pathname, navigate]);
}
