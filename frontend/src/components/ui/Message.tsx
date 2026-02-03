import { cn } from '../../lib/cn'

export function Message({
  variant,
  children,
}: {
  variant: 'error' | 'success' | 'info'
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'border px-4 py-3 text-sm shadow-elevated',
        variant === 'error' &&
          'border-red-500/40 bg-red-500/10 text-red-950 dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-200',
        variant === 'success' &&
          'border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-200',
        variant === 'info' && 'border-border bg-subtle text-foreground',
      )}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
    >
      {children}
    </div>
  )
}
