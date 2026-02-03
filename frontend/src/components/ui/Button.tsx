import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
  block?: boolean
  loading?: boolean
}

export function Button({
  className,
  variant = 'primary',
  block,
  loading,
  disabled,
  children,
  ...props
}: Props) {
  return (
    <button
      className={cn(
        'relative inline-flex items-center justify-center gap-2 border px-6 py-3 text-sm font-medium uppercase tracking-wide transition-colors',
        'focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-faint',
        variant === 'primary' &&
          'border-foreground bg-foreground text-background hover:bg-foreground/80 hover:border-foreground/80',
        variant === 'secondary' &&
          'border-border bg-background text-foreground hover:bg-subtle',
        block && 'w-full',
        loading && 'text-transparent',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
      {loading ? (
        <span className="pointer-events-none absolute inset-0 m-auto size-4 animate-spin rounded-full border-2 border-background/70 border-r-transparent" />
      ) : null}
    </button>
  )
}
