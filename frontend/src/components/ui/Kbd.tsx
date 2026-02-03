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
        'inline-flex items-center rounded border border-border-strong bg-subtle px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground normal-case',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
