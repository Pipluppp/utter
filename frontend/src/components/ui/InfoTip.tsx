import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

export function InfoTip({
  align = 'start',
  label = 'Information',
  children,
}: {
  align?: 'start' | 'end'
  label?: string
  children: React.ReactNode
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current
      if (!root) return
      if (e.target instanceof Node && root.contains(e.target)) return
      setOpen(false)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setOpen(false)
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        className={cn(
          'inline-flex size-6 items-center justify-center rounded-full border border-border bg-background text-[12px] font-semibold text-muted-foreground',
          'hover:bg-muted hover:text-foreground',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>

      {open ? (
        <span
          id={id}
          role="dialog"
          aria-label={label}
          className={cn(
            'absolute top-full z-20 mt-2 w-[min(320px,calc(100vw-2rem))] border border-border bg-background p-3 text-sm text-muted-foreground shadow-lg',
            align === 'start' ? 'left-0' : 'right-0',
          )}
        >
          {children}
        </span>
      ) : null}
    </span>
  )
}
