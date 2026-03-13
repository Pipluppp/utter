export function resampleFloat32Linear(
  buffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
) {
  if (outputSampleRate === inputSampleRate) return buffer
  if (inputSampleRate <= 0 || outputSampleRate <= 0) {
    throw new Error('resampleFloat32Linear: sample rates must be positive')
  }

  const ratio = inputSampleRate / outputSampleRate
  const newLength = Math.max(1, Math.round(buffer.length / ratio))
  const result = new Float32Array(newLength)

  for (let i = 0; i < newLength; i++) {
    const sourceIndex = i * ratio
    const leftIndex = Math.floor(sourceIndex)
    const rightIndex = Math.min(buffer.length - 1, leftIndex + 1)
    const mix = sourceIndex - leftIndex
    const left = buffer[leftIndex] ?? 0
    const right = buffer[rightIndex] ?? left
    result[i] = left + (right - left) * mix
  }

  return result
}

export function concatFloat32Chunks(chunks: Float32Array[], totalLength: number) {
  const merged = new Float32Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }

  return merged
}

export function float32ToPcm16leBytes(buffer: Float32Array) {
  const ab = new ArrayBuffer(buffer.length * 2)
  const view = new DataView(ab)
  for (let i = 0; i < buffer.length; i++) {
    let s = buffer[i] ?? 0
    if (s > 1) s = 1
    if (s < -1) s = -1
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Uint8Array(ab)
}

export function createWavHeaderPcm16Mono(pcmByteLength: number, sampleRate: number) {
  const header = new ArrayBuffer(44)
  const view = new DataView(header)

  const writeAscii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i))
    }
  }

  const numChannels = 1
  const bitsPerSample = 16
  const blockAlign = (numChannels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + pcmByteLength, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM fmt chunk size
  view.setUint16(20, 1, true) // audio format: PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeAscii(36, 'data')
  view.setUint32(40, pcmByteLength, true)

  return header
}

export function rmsLevel(buffer: Float32Array) {
  let sumSq = 0
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i] ?? 0
    sumSq += v * v
  }
  return Math.sqrt(sumSq / Math.max(1, buffer.length))
}

export function getTargetRecordingSampleRate(sampleRate: number) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return 24000
  return Math.max(24000, Math.min(48000, Math.round(sampleRate)))
}

export function getAudioDurationSeconds(file: File) {
  return new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()

    const cleanup = () => {
      audio.removeAttribute('src')
      audio.load()
      URL.revokeObjectURL(url)
    }

    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : null
      cleanup()
      resolve(duration)
    }
    audio.onerror = () => {
      cleanup()
      resolve(null)
    }
    audio.src = url
  })
}
