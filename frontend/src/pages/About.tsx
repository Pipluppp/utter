export function AboutPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-balance text-center text-xl font-semibold uppercase tracking-[2px]">
        About
      </h2>
      <p className="text-sm text-muted-foreground">
        Utter is a FastAPI + Modal (Qwen3-TTS) voice cloning and generation app.
      </p>
      <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        <li>Clone voices from reference audio (+ transcript for Qwen3-TTS).</li>
        <li>Design voices from text descriptions.</li>
        <li>Generate speech using your saved voices.</li>
        <li>Long-running work is tracked via tasks (polling).</li>
      </ul>
      <p className="text-sm text-muted-foreground">
        Supported languages and provider are exposed via{' '}
        <code>GET /api/languages</code>.
      </p>
    </div>
  )
}
