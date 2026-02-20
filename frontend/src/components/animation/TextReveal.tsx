// Taken from https://gist.github.com/cristicretu/b808942d39ec8178f9c9a8bdfd13bbb9
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'

const ACCENT_COLORS = ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#6a4c93']
const SYMBOLS = ['✣', '◈', '⌁', '✦', '◎', '⊹', '⟡', '△']
const PERIOD_COLOR = '#2a9d8f'
const STEP_MS = 70

function randomFrom<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

interface Burst {
  color: string
  symbol: string
}

interface Props {
  lines: string[]
  className?: string
}

export function TextReveal({ lines, className }: Props) {
  const { words, lineBreakAfter } = useMemo(() => {
    const w: string[] = []
    const breaks = new Set<number>()
    for (let i = 0; i < lines.length; i++) {
      const lineWords = lines[i].trim().split(/\s+/).filter(Boolean)
      w.push(...lineWords)
      if (i < lines.length - 1) breaks.add(w.length - 1)
    }
    return { words: w, lineBreakAfter: breaks }
  }, [lines])

  // 2 steps per word: burst → reveal. +1 final step for period settle.
  const totalSteps = words.length * 2 + 1
  const prefersReduced = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [step, setStep] = useState(prefersReduced.current ? totalSteps : 0)

  // Pre-generate one burst per word so colors don't change on re-render
  const bursts = useRef<Burst[]>([])
  if (bursts.current.length !== words.length) {
    bursts.current = words.map(() => ({
      color: randomFrom(ACCENT_COLORS),
      symbol: randomFrom(SYMBOLS),
    }))
  }

  useEffect(() => {
    if (prefersReduced.current) return
    setStep(0)
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 1; i <= totalSteps; i++) {
      timers.push(setTimeout(() => setStep(i), i * STEP_MS))
    }
    return () => timers.forEach(clearTimeout)
  }, [totalSteps])

  const h1Classes =
    'text-balance text-[clamp(34px,6vw,64px)] font-pixel font-medium uppercase tracking-[2px] text-center'

  return (
    <div className={className} style={{ position: 'relative' }}>
      {/* Invisible placeholder reserves layout space */}
      <h1 className={h1Classes} aria-hidden style={{ visibility: 'hidden' }}>
        {lines.map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {line}
          </Fragment>
        ))}
      </h1>

      {/* Animated overlay */}
      <h1
        className={h1Classes}
        aria-label={lines.join(' ')}
        style={{ position: 'absolute', inset: 0 }}
      >
        {words.map((word, wi) => {
          const burstStep = wi * 2 + 1
          const revealStep = wi * 2 + 2
          const burst = bursts.current[wi]
          const isLast = wi === words.length - 1

          let content: React.ReactNode = null

          if (step < burstStep) {
            // Not reached yet — render nothing
            content = null
          } else if (step === burstStep) {
            // Symbol burst phase
            content = (
              <span style={{ color: burst.color }} className="font-mono">
                {burst.symbol}
              </span>
            )
          } else if (step === revealStep) {
            // Word revealed in accent color
            content = <span style={{ color: burst.color }}>{word}</span>
          } else {
            // Settled — inherit foreground color, period gets special color on settle step
            const isPeriodSettle =
              step === totalSteps && isLast && /[.!?]$/.test(word)
            content = (
              <span
                className="transition-colors duration-300"
                style={isPeriodSettle ? { color: PERIOD_COLOR } : undefined}
              >
                {word}
              </span>
            )
          }

          return (
            <Fragment key={wi}>
              {wi > 0 && !lineBreakAfter.has(wi - 1) && ' '}
              {lineBreakAfter.has(wi - 1) && <br />}
              {content}
            </Fragment>
          )
        })}
      </h1>
    </div>
  )
}
