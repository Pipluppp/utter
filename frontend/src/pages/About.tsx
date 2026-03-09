import { Skeleton } from '../components/ui/Skeleton'
import { useLanguages } from './hooks'

function AboutLanguagesSkeleton() {
  return (
    <div className="flex flex-wrap gap-2" aria-hidden="true">
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-6 w-16" />
    </div>
  )
}

export function AboutPage() {
  const { languages, loading } = useLanguages()

  return (
    <div className="space-y-8">
      <h2 className="text-balance text-center text-xl font-pixel font-medium uppercase tracking-[2px]">
        About
      </h2>

      <p className="text-sm text-muted-foreground">
        Utter is a Qwen-powered app for voice cloning, voice design, and speech
        generation.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="border border-border bg-background p-4 shadow-elevated">
          <div className="text-[12px] font-semibold uppercase tracking-wide">
            Clone
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload reference audio with a matching transcript to create a
            reusable voice.
          </p>
        </div>
        <div className="border border-border bg-background p-4 shadow-elevated">
          <div className="text-[12px] font-semibold uppercase tracking-wide">
            Design
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Describe a voice in plain language, queue a preview, then save the
            version you want to keep.
          </p>
        </div>
        <div className="border border-border bg-background p-4 shadow-elevated">
          <div className="text-[12px] font-semibold uppercase tracking-wide">
            Generate
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Type text and queue speech in any of your saved voices. Finished
            audio is stored in History.
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
            Transcript: voice cloning requires text that matches the reference
            audio as closely as possible.
          </li>
          <li>
            Generation and design preview run as async jobs and can take longer
            under load.
          </li>
          <li>
            Long text is limited by the current Qwen character cap shown in
            Generate.
          </li>
        </ul>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-foreground">
          Supported languages
        </div>
        <div className="leading-relaxed">
          {loading ? <AboutLanguagesSkeleton /> : languages.join(', ')}
        </div>
      </div>
    </div>
  )
}
