import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'
import { useAuthState } from './auth/AuthStateProvider'
import { buildAuthHref } from './navigation'

export function FeatureEntryLink({
  to,
  className,
  children,
}: {
  to: string
  className?: string
  children: React.ReactNode
}) {
  const authState = useAuthState()

  const disabled = authState.status === 'loading'
  const destination = authState.status === 'signed_in' ? to : buildAuthHref(to)

  return (
    <Link
      to={destination}
      aria-disabled={disabled || undefined}
      className={cn(disabled && 'pointer-events-none opacity-60', className)}
      onClick={(event) => {
        if (!disabled) {
          return
        }
        event.preventDefault()
      }}
    >
      {children}
    </Link>
  )
}
