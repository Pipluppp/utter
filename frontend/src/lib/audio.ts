export function downsampleFloat32(
  buffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
) {
  if (outputSampleRate === inputSampleRate) return buffer
  if (outputSampleRate > inputSampleRate) {
    throw new Error(
      'downsampleFloat32: outputSampleRate must be <= inputSampleRate',
    )
  }

  const ratio = inputSampleRate / outputSampleRate
  const newLength = Math.round(buffer.length / ratio)
  const result = new Float32Array(newLength)

  let offsetBuffer = 0
  for (let i = 0; i < result.length; i++) {
    const nextOffsetBuffer = Math.round((i + 1) * ratio)
    let sum = 0
    let count = 0
    for (let j = offsetBuffer; j < nextOffsetBuffer && j < buffer.length; j++) {
      sum += buffer[j]
      count++
    }
    result[i] = count > 0 ? sum / count : 0
    offsetBuffer = nextOffsetBuffer
  }

  return result
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

export function createWavHeaderPcm16Mono(
  pcmByteLength: number,
  sampleRate: number,
) {
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
