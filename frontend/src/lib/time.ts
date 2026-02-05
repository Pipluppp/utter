export function formatElapsed(startedAtMs: number, nowMs: number = Date.now()) {
  const totalSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
