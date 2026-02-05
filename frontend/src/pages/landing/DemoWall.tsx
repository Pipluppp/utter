import { UTTER_DEMOS } from '../../content/utterDemo'
import { cn } from '../../lib/cn'
import { DemoClipCard } from './DemoClipCard'

const LAYOUT: Record<string, string> = {
  gojo: 'md:col-span-5 md:col-start-2 md:rotate-[-2.6deg] md:translate-y-2 md:-translate-x-1',
  frieren:
    'md:col-span-5 md:col-start-7 md:rotate-[2.3deg] md:-translate-y-1 md:translate-x-1',
  chungking:
    'md:col-span-5 md:col-start-7 md:rotate-[2.8deg] md:-translate-y-3 md:translate-x-1',
  eeaao:
    'md:col-span-5 md:col-start-2 md:rotate-[-2.1deg] md:translate-y-4 md:-translate-x-1',
  brutalist: 'md:col-span-6 md:col-start-4 md:rotate-[2.1deg] md:translate-y-3',
}

export function DemoWall() {
  const demos = UTTER_DEMOS

  return (
    <section
      id="demos"
      className={cn(
        'relative left-1/2 right-1/2 -mx-[50vw] w-screen',
        'border-y border-border bg-subtle',
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0',
          'opacity-70',
          '[background-image:radial-gradient(circle,rgba(0,0,0,0.12)_1px,transparent_1.2px),linear-gradient(to_bottom,rgba(0,0,0,0.05),transparent_30%,rgba(0,0,0,0.05))]',
          '[background-size:12px_12px,auto]',
          'dark:[background-image:radial-gradient(circle,rgba(255,255,255,0.10)_1px,transparent_1.2px),linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent_35%,rgba(255,255,255,0.06))]',
          '[mask-image:radial-gradient(70%_70%_at_50%_20%,#000,transparent_70%)]',
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 mix-blend-multiply dark:mix-blend-screen',
          'opacity-40',
          '[background-image:linear-gradient(115deg,rgba(0,0,0,0.10),transparent_55%,rgba(0,0,0,0.06))]',
          'dark:[background-image:linear-gradient(115deg,rgba(0,209,255,0.10),transparent_55%,rgba(255,255,255,0.06))]',
        )}
      />

      <div className="relative px-4 py-12 md:px-10">
        <div className="mx-auto max-w-none">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            {demos.map((demo) => (
              <DemoClipCard
                key={demo.id}
                demo={demo}
                className={cn('md:col-span-12', LAYOUT[demo.id])}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
