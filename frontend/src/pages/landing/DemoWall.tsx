import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { buttonStyles } from '../../components/ui/Button'
import { getUtterDemo, UTTER_DEMOS } from '../../content/utterDemo'
import { cn } from '../../lib/cn'
import { fetchTextUtf8 } from '../../lib/fetchTextUtf8'
import { DemoClipCard } from './DemoClipCard'

const LAYOUT: Record<string, string> = {
  gojo: 'md:col-span-7 lg:col-span-6 md:rotate-[-0.6deg]',
  frieren: 'md:col-span-5 lg:col-span-6 md:translate-y-2 md:rotate-[0.4deg]',
  chungking: 'md:col-span-6 md:-translate-y-2 md:rotate-[0.6deg]',
  parasite: 'md:col-span-6 md:translate-y-3 md:rotate-[-0.4deg]',
  brutalist: 'md:col-span-12 lg:col-span-12 md:rotate-[0.2deg]',
}

export function DemoWall() {
  const demos = UTTER_DEMOS.filter((d) => d.id !== 'chunking')
  const [chunkingText, setChunkingText] = useState<string>('')

  useEffect(() => {
    const demo = getUtterDemo('chunking')
    if (!demo?.transcriptUrl) return
    let cancelled = false
    void (async () => {
      try {
        const text = await fetchTextUtf8(demo.transcriptUrl as string)
        if (cancelled) return
        setChunkingText(text)
      } catch {
        if (cancelled) return
        setChunkingText('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
          'bg-[radial-gradient(60%_80%_at_20%_20%,rgba(0,0,0,0.08),transparent_60%),radial-gradient(70%_90%_at_80%_10%,rgba(0,0,0,0.06),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.02),transparent_40%,rgba(0,0,0,0.02))]',
          'dark:bg-[radial-gradient(60%_80%_at_20%_20%,rgba(255,255,255,0.06),transparent_60%),radial-gradient(70%_90%_at_80%_10%,rgba(0,209,255,0.10),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_40%,rgba(255,255,255,0.04))]',
        )}
      />

      <div className="relative px-4 py-12 md:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold uppercase tracking-[2px]">
                Demo examples
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Each card is playable. No separate “now playing” panel—pick a
                clip and hit play.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="#main"
                className={buttonStyles({ variant: 'secondary', size: 'sm' })}
              >
                Back to top →
              </a>
              <NavLink
                to="/clone"
                className={buttonStyles({ variant: 'primary', size: 'sm' })}
              >
                Clone →
              </NavLink>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-none">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            {demos.map((demo) => (
              <DemoClipCard
                key={demo.id}
                demo={demo}
                className={cn('md:col-span-12', LAYOUT[demo.id])}
              />
            ))}

            <div className="md:col-span-12">
              <div className="border border-border bg-background p-4 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-wide">
                      Long-form text sample
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Use this to stress-test chunking and pacing on the
                      Generate page.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={buttonStyles({
                      variant: 'secondary',
                      size: 'sm',
                    })}
                    disabled={!chunkingText.trim()}
                    onClick={async () => {
                      if (!chunkingText.trim()) return
                      try {
                        await navigator.clipboard.writeText(chunkingText)
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    Copy long text
                  </button>
                </div>

                <div className="mt-4 border border-border bg-subtle p-4">
                  <div className="max-h-44 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                    {chunkingText.trim()
                      ? `${chunkingText.slice(0, 900)}${chunkingText.length > 900 ? '…' : ''}`
                      : 'Loading…'}
                  </div>
                </div>

                <div className="mt-4">
                  <NavLink
                    to="/generate"
                    className={buttonStyles({ variant: 'primary', size: 'sm' })}
                  >
                    Go to Generate →
                  </NavLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
