import { FeatureEntryLink } from '../../app/FeatureEntryLink'
import { buttonStyles } from '../../components/ui/Button'
import { SVGBlobs } from '../../components/ui/SVGBlobs'
import { cn } from '../../lib/cn'

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className='flex gap-2'>
      <span className='mt-[2px] inline-block size-4 shrink-0 border border-border bg-background' />
      <span>{children}</span>
    </li>
  )
}

function MediaFrame({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden border border-border bg-background shadow-elevated',
        className,
      )}
    >
      <div className='aspect-[16/10] bg-muted'>
        <img
          src={src}
          alt={alt}
          loading='lazy'
          decoding='async'
          className='h-full w-full object-contain'
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
        flip && 'md:[&_[data-col=text]]:order-2 md:[&_[data-col=media]]:order-1',
      )}
    >
      <div data-col='text' className='space-y-4 md:col-span-5'>
        <div>
          <h3 className='text-xl font-pixel font-medium uppercase tracking-[2px]'>{title}</h3>
          <p className='mt-2 text-base text-muted-foreground'>{pitch}</p>
        </div>
        <ul className='space-y-2 text-base text-muted-foreground'>
          {bullets.map((bullet) => (
            <Bullet key={bullet}>{bullet}</Bullet>
          ))}
        </ul>
        {ctaLabel && to ? (
          <div className='pt-1'>
            <FeatureEntryLink
              to={to}
              className={buttonStyles({ variant: 'secondary', size: 'sm' })}
            >
              {`${ctaLabel} ->`}
            </FeatureEntryLink>
          </div>
        ) : null}
      </div>

      <div data-col='media' className='md:col-span-7'>
        <MediaFrame src={mediaSrc} alt={mediaAlt} />
      </div>
    </div>
  )
}

export function FeaturesSection() {
  return (
    <section
      id='features'
      className={cn(
        'relative isolate left-1/2 right-1/2 -mx-[50vw] w-screen',
        'overflow-x-clip',
        'scroll-mt-24 -mt-px border-t border-border/60',
      )}
    >
      <div className='pointer-events-none absolute -left-[16%] top-8 -z-10 w-[52%] overflow-hidden opacity-28 [mask-image:linear-gradient(to_right,#000_0%,#000_48%,transparent_100%)] select-none'>
        <SVGBlobs density='sparse' className='w-full' />
      </div>
      <div className='pointer-events-none absolute -right-[16%] top-8 -z-10 w-[52%] overflow-hidden opacity-28 [mask-image:linear-gradient(to_left,#000_0%,#000_48%,transparent_100%)] select-none'>
        <SVGBlobs density='sparse' className='w-full' />
      </div>
      <div className='mx-auto w-full max-w-5xl space-y-6 px-4 py-12 md:px-6'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h2 className='text-2xl font-pixel font-medium uppercase tracking-[2px] md:text-3xl'>
              Features
            </h2>
          </div>
        </div>

        <div className='space-y-10'>
          <FeatureBlock
            title='Voice Clone'
            pitch='Upload a short clip with its transcript and save a reusable voice for later generation.'
            bullets={[
              'Name your voice, upload reference audio, and add the matching transcript.',
              'Keep cloned voices organized in one library.',
              'Reuse the same saved voice across future generations.',
            ]}
            ctaLabel='Open Clone'
            to='/clone'
            mediaSrc='/feature-media/voice-clone.png'
            mediaAlt='Voice Clone UI screenshot'
          />

          <FeatureBlock
            title='Generate'
            pitch='Pick a saved voice, paste text, and queue speech generation.'
            bullets={[
              'The text cap follows the active Qwen runtime settings.',
              'Queued jobs keep running in the background until audio is ready.',
              'Download finished audio when it sounds right.',
            ]}
            ctaLabel='Open Generate'
            to='/generate'
            mediaSrc='/feature-media/generate.png'
            mediaAlt='Generate UI screenshot'
            flip
          />

          <FeatureBlock
            title='Design'
            pitch='Describe a voice in text, queue a preview, then save the one you want to keep.'
            bullets={[
              'No audio upload required.',
              'Shape tone, age, style, accent, and texture in plain language.',
              'Save a completed preview before using it in Generate.',
            ]}
            mediaSrc='/feature-media/design.png'
            mediaAlt='Design UI screenshot'
          />
        </div>
      </div>
    </section>
  )
}
