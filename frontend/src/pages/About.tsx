import { useLanguages } from './hooks'

export function AboutPage() {
  const { provider, languages } = useLanguages()

  return (
    <div className="space-y-8">
      <h2 className="text-balance text-center text-xl font-pixel font-medium uppercase tracking-[2px]">
        About
      </h2>

      <p className="text-sm text-muted-foreground">
        Utter is a voice cloning and speech generation app powered by Qwen3-TTS.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="border border-border bg-background p-4 shadow-elevated">
          <div className="text-[12px] font-semibold uppercase tracking-wide">
            Clone
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload reference audio (and a matching transcript when required) to
            create a reusable voice.
          </p>
        </div>
        <div className="border border-border bg-background p-4 shadow-elevated">
          <div className="text-[12px] font-semibold uppercase tracking-wide">
            Design
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Describe a voice in plain language and generate a preview that is
            saved automatically for later use.
          </p>
        </div>
        <div className="border border-border bg-background p-4 shadow-elevated">
          <div className="text-[12px] font-semibold uppercase tracking-wide">
            Generate
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Type text and generate speech in any of your saved voices. Results
            are stored in History.
          </p>
        </div>
      </div>

      <div className="space-y-3 border border-border bg-subtle p-4 shadow-elevated">
        <div className="text-[12px] font-semibold uppercase tracking-wide">
          Constraints & tips
        </div>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Reference audio: WAV/MP3/M4A, max 50MB, 3 seconds to ~5 minutes.
          </li>
          <li>
            Transcript: paste the words spoken in the reference audio as closely
            as possible.
          </li>
          <li>
            Some providers require a transcript (current provider:{' '}
            <span className="text-foreground">{provider}</span>).
          </li>
          <li>
            Generation time scales with text length and server load; long inputs
            can take minutes.
          </li>
        </ul>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-foreground">
          Languages
        </div>
        <div className="leading-relaxed">
          {languages.length > 0 ? languages.join(', ') : 'Loading…'}
        </div>
      </div>
    </div>
  )
}
