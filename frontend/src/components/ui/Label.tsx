import type { LabelHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: wrapper component; association is provided via props (e.g. htmlFor or nested control)
    <label
      className={cn(
        'mb-2 block text-[12px] font-medium uppercase tracking-wide text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}
