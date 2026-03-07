import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function AccountPanel({
  kicker,
  title,
  description,
  children,
  className,
}: {
  kicker?: string
  title?: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'border border-border bg-background p-5 shadow-elevated md:p-7',
        className,
      )}
    >
      {kicker ? (
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/65">
          {kicker}
        </div>
      ) : null}
      {title ? (
        <h3 className="mt-3 text-xl font-medium leading-tight text-foreground md:text-2xl">
          {title}
        </h3>
      ) : null}
      {description ? (
        <p className="mt-2 max-w-2xl text-[15px] leading-7 text-foreground/72">
          {description}
        </p>
      ) : null}
      <div className={cn((title || kicker || description) && 'mt-6')}>
        {children}
      </div>
    </section>
  )
}

export function AccountNotice({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'success' | 'error'
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'border px-4 py-3 text-[15px] leading-6 shadow-elevated',
        tone === 'neutral' && 'border-border bg-subtle text-muted-foreground',
        tone === 'success' && 'border-border-strong bg-subtle text-foreground',
        tone === 'error' && 'border-red-400 bg-red-50 text-red-700',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function AccountEmptyState({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <div className="border border-border bg-subtle px-4 py-5 text-[15px] leading-6 shadow-elevated">
      <div className="font-medium text-foreground">{title}</div>
      <div className="mt-2 text-foreground/68">{body}</div>
    </div>
  )
}
