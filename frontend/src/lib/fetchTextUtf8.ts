export async function fetchTextUtf8(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load text (${res.status})`)
  const buf = await res.arrayBuffer()
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buf)
  return text.replace(/\s+$/, '')
}
