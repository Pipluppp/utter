const TARGET_FRAMES = 4096

class UtterPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.queue = []
    this.queuedFrames = 0
  }

  process(inputs) {
    const channel = inputs[0]?.[0]
    if (!channel || channel.length === 0) return true

    const copy = new Float32Array(channel.length)
    copy.set(channel)

    this.queue.push(copy)
    this.queuedFrames += copy.length

    while (this.queuedFrames >= TARGET_FRAMES) {
      const out = new Float32Array(TARGET_FRAMES)
      let offset = 0

      while (offset < TARGET_FRAMES) {
        const first = this.queue[0]
        if (!first) break

        const needed = TARGET_FRAMES - offset
        if (first.length <= needed) {
          out.set(first, offset)
          offset += first.length
          this.queue.shift()
          continue
        }

        out.set(first.subarray(0, needed), offset)
        offset += needed
        this.queue[0] = first.subarray(needed)
      }

      this.queuedFrames -= TARGET_FRAMES

      this.port.postMessage({ type: 'chunk', buffer: out.buffer }, [out.buffer])
    }

    return true
  }
}

registerProcessor('utter-pcm-capture', UtterPcmCaptureProcessor)

export {}
