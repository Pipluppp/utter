import { apiRedirectUrl } from './api'

function isApiPath(url: string) {
  return url.startsWith('/api/')
}

export async function resolveProtectedMediaUrl(url: string): Promise<string> {
  if (!isApiPath(url)) return url
  return apiRedirectUrl(url)
}

export function triggerDownload(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = ''
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
