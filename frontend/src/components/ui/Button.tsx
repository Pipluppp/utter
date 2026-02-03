import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary'
export type ButtonSize = 'sm' | 'md'

export function buttonStyles({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  loading?: boolean
  className?: string
}) {
  return cn(
    'relative inline-flex cursor-pointer items-center justify-center gap-2 border font-medium uppercase tracking-wide transition-colors',
    size === 'md' ? 'px-6 py-3 text-sm' : 'px-3 py-2 text-[12px]',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-faint',
    variant === 'primary' &&
      'border-foreground bg-foreground text-background hover:bg-foreground/80 hover:border-foreground/80',
    variant === 'secondary' &&
      'border-border bg-background text-foreground hover:bg-subtle',
    block && 'w-full',
    loading && 'text-transparent',
    className,
  )
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  loading?: boolean
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  block,
  loading,
  disabled,
  children,
  ...props
}: Props) {
  return (
    <button
      className={buttonStyles({ variant, size, block, loading, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
      {loading ? (
        <span
          className={cn(
            'pointer-events-none absolute inset-0 m-auto size-4 animate-spin rounded-full border-2 border-r-transparent',
            variant === 'primary'
              ? 'border-background/70'
              : 'border-foreground/60',
          )}
        />
      ) : null}
    </button>
  )
}
