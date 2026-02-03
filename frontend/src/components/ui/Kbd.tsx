import { cn } from '../../lib/cn'

export function Kbd({
  children,
  className,
  ariaHidden = true,
}: {
  children: React.ReactNode
  className?: string
  ariaHidden?: boolean
}) {
  return (
    <kbd
      aria-hidden={ariaHidden || undefined}
        className={cn(
        'inline-flex items-center justify-center',
        'h-[18px] min-w-[16px] px-1',
        'rounded border border-kbd-border bg-kbd-bg',
        'text-[10px] font-medium leading-none text-kbd-text normal-case',
        'shadow-[inset_0_-1px_0_rgb(0_0_0_/_0.14),0_1px_2px_var(--color-kbd-shadow)]',
        'font-[var(--font-mono-ui)]',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
