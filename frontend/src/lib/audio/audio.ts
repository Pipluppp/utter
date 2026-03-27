export function concatFloat32Chunks(chunks: Float32Array[], totalLength: number) {
  const merged = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

export function float32ToPcm16leBytes(buffer: Float32Array) {
  const ab = new ArrayBuffer(buffer.length * 2);
  const view = new DataView(ab);
  for (let i = 0; i < buffer.length; i++) {
    let s = buffer[i] ?? 0;
    if (s > 1) s = 1;
    if (s < -1) s = -1;
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(ab);
}

export function createWavHeaderPcm16Mono(pcmByteLength: number, sampleRate: number) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  const writeAscii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  };

  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + pcmByteLength, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audio format: PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, "data");
  view.setUint32(40, pcmByteLength, true);

  return header;
}

export function buildWavFile(
  chunks: Float32Array[],
  totalSamples: number,
  sampleRate: number,
): File {
  const merged = concatFloat32Chunks(chunks, totalSamples);
  const pcmBytes = float32ToPcm16leBytes(merged);
  const header = createWavHeaderPcm16Mono(pcmBytes.byteLength, sampleRate);
  return new File([header, pcmBytes], "recording.wav", { type: "audio/wav" });
}

export function getAudioDurationSeconds(file: File) {
  return new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();

    const cleanup = () => {
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
    };

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : null;
      cleanup();
      resolve(duration);
    };
    audio.onerror = () => {
      cleanup();
      resolve(null);
    };
    audio.src = url;
  });
}
