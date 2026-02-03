import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}

export function useGlobalShortcuts() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (e.repeat) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      const key = e.key.toLowerCase()
      const to =
        key === 'c'
          ? '/clone'
          : key === 'g'
            ? '/generate'
            : key === 'd'
              ? '/design'
              : null
      if (!to) return
      if (location.pathname === to) return

      e.preventDefault()
      navigate(to)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [location.pathname, navigate])
}
