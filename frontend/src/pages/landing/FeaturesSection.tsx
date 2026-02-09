import { NavLink } from 'react-router-dom'
import { buttonStyles } from '../../components/ui/Button'
import { cn } from '../../lib/cn'

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-[2px] inline-block size-4 shrink-0 border border-border bg-background" />
      <span>{children}</span>
    </li>
  )
}

function MediaFrame({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden border border-border bg-background shadow-elevated',
        className,
      )}
    >
      <div className="aspect-[16/10] bg-muted">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
        />
      </div>
    </div>
  )
}

function FeatureBlock({
  title,
  pitch,
  bullets,
  ctaLabel,
  to,
  mediaSrc,
  mediaAlt,
  flip,
}: {
  title: string
  pitch: string
  bullets: string[]
  ctaLabel?: string
  to?: string
  mediaSrc: string
  mediaAlt: string
  flip?: boolean
}) {
  return (
    <div
      className={cn(
        'grid items-center gap-5 md:grid-cols-12 md:gap-8',
        flip &&
          'md:[&_[data-col=text]]:order-2 md:[&_[data-col=media]]:order-1',
      )}
    >
      <div data-col="text" className="space-y-4 md:col-span-5">
        <div>
          <h3 className="text-xl font-pixel font-medium uppercase tracking-[2px]">
            {title}
          </h3>
          <p className="mt-2 text-base text-muted-foreground">{pitch}</p>
        </div>
        <ul className="space-y-2 text-base text-muted-foreground">
          {bullets.map((b) => (
            <Bullet key={b}>{b}</Bullet>
          ))}
        </ul>
        {ctaLabel && to ? (
          <div className="pt-1">
            <NavLink
              to={to}
              className={buttonStyles({ variant: 'secondary', size: 'sm' })}
            >
              {ctaLabel} →
            </NavLink>
          </div>
        ) : null}
      </div>

      <div data-col="media" className="md:col-span-7">
        <MediaFrame src={mediaSrc} alt={mediaAlt} />
      </div>
    </div>
  )
}

export function FeaturesSection() {
  return (
    <section
      id="features"
      className={cn(
        'relative left-1/2 right-1/2 -mx-[50vw] w-screen',
        'scroll-mt-24 -mt-px border-t border-border/60',
      )}
    >
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-12 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-pixel font-medium uppercase tracking-[2px] md:text-3xl">
              Features
            </h2>
          </div>
        </div>

        <div className="space-y-10">
          <FeatureBlock
            title="Voice Clone"
            pitch="Upload a short clip and get a reusable voice you can generate with any time."
            bullets={[
              'Name your voice, upload a reference clip, and submit.',
              'Keep clones organized in a single voice library.',
              'Use the same voice for short prompts or long-form text.',
            ]}
            ctaLabel="Open Clone"
            to="/clone"
            mediaSrc="/feature-media/voice-clone.png"
            mediaAlt="Voice Clone UI screenshot"
          />

          <FeatureBlock
            title="Generate"
            pitch="Pick a voice, paste text, and generate speech with fast iteration."
            bullets={[
              'Up to 10k characters per request.',
              'Preview audio quickly and download when it sounds right.',
              'Reuse voices across projects without re-uploading.',
            ]}
            ctaLabel="Open Generate"
            to="/generate"
            mediaSrc="/feature-media/generate.png"
            mediaAlt="Generate UI screenshot"
            flip
          />

          <FeatureBlock
            title="Design"
            pitch="Describe a voice in text, generate candidates, then save the best one to your library."
            bullets={[
              'No audio upload required.',
              'Iterate on tone, age, style, accent, and texture.',
              'Promote a designed voice directly into generation.',
            ]}
            mediaSrc="/feature-media/design.png"
            mediaAlt="Design UI screenshot"
          />
        </div>
      </div>
    </section>
  )
}
