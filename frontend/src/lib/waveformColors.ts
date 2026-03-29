/**
 * Shared waveform color resolution for WaveSurfer instances.
 * Reads CSS custom properties with dark/light fallbacks.
 */
function resolve(resolvedTheme: "dark" | "light" | string) {
  const styles = getComputedStyle(document.documentElement);
  const foreground =
    styles.getPropertyValue("--color-foreground").trim() ||
    (resolvedTheme === "dark" ? "#f5f5f5" : "#111111");
  const mutedForeground =
    styles.getPropertyValue("--color-muted-foreground").trim() ||
    (resolvedTheme === "dark" ? "#b3b3b3" : "#555555");
  const faint = styles.getPropertyValue("--color-faint").trim() || "#888888";

  return {
    waveColor: resolvedTheme === "dark" ? foreground : faint,
    progressColor: resolvedTheme === "dark" ? mutedForeground : foreground,
  };
}

export const waveformColors = { resolve };
