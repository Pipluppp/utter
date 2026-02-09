import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { WaveformPlayer } from '../components/audio/WaveformPlayer'
import { Button } from '../components/ui/Button'
import { InfoTip } from '../components/ui/InfoTip'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Message } from '../components/ui/Message'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { getUtterDemo } from '../content/utterDemo'
import { apiForm, apiJson } from '../lib/api'
import {
  createWavHeaderPcm16Mono,
  downsampleFloat32,
  float32ToPcm16leBytes,
  rmsLevel,
} from '../lib/audio'
import { cn } from '../lib/cn'
import { fetchTextUtf8 } from '../lib/fetchTextUtf8'
import { formatElapsed } from '../lib/time'
import type { CloneResponse } from '../lib/types'
import { useLanguages } from './hooks'

const MAX_FILE_BYTES = 50 * 1024 * 1024
const ALLOWED_EXTS = new Set(['.wav', '.mp3', '.m4a'])

function extOf(name: string) {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

function contentTypeForFile(file: File): string {
  const byType = file.type?.trim()
  if (byType) return byType

  const ext = extOf(file.name)
  if (ext === '.wav') return 'audio/wav'
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.m4a') return 'audio/mp4'
  return 'application/octet-stream'
}

export function ClonePage() {
  const [params] = useSearchParams()
  const { languages, defaultLanguage, provider, transcription } = useLanguages()

  const inputRef = useRef<HTMLInputElement | null>(null)
  const firstModalActionRef = useRef<HTMLAnchorElement | null>(null)
  const loadedDemoRef = useRef<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [audioMode, setAudioMode] = useState<'upload' | 'record'>('upload')

  const transcriptionEnabled = transcription?.enabled ?? false
  const [transcribing, setTranscribing] = useState(false)

  const [recording, setRecording] = useState(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [micLevel, setMicLevel] = useState(0)
  const [recordSeconds, setRecordSeconds] = useState(0)

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const workletRef = useRef<AudioWorkletNode | null>(null)
  const pcmChunksRef = useRef<ArrayBuffer[]>([])
  const pcmBytesRef = useRef(0)
  const recordTimerRef = useRef<number | null>(null)
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(
    null,
  )

  const [name, setName] = useState('')
  const [transcript, setTranscript] = useState('')
  const [language, setLanguage] = useState(defaultLanguage)

  const [submitting, setSubmitting] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsedLabel, setElapsedLabel] = useState('0:00')

  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CloneResponse | null>(null)

  useEffect(() => setLanguage(defaultLanguage), [defaultLanguage])

  useEffect(() => {
    if (transcriptionEnabled) return
    if (audioMode === 'record') setAudioMode('upload')
  }, [audioMode, transcriptionEnabled])

  useEffect(() => {
    if (!submitting || !startedAt) return
    const t = window.setInterval(
      () => setElapsedLabel(formatElapsed(startedAt)),
      1000,
    )
    return () => window.clearInterval(t)
  }, [startedAt, submitting])

  const transcriptRequired = provider === 'qwen'

  const fileInfo = useMemo(() => {
    if (!file) return null
    return `${file.name} • ${(file.size / (1024 * 1024)).toFixed(1)} MB`
  }, [file])

  const recordTimeLabel = useMemo(() => {
    const mins = Math.floor(recordSeconds / 60)
    const secs = recordSeconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [recordSeconds])

  useEffect(() => {
    if (audioMode !== 'record' || !file) {
      setRecordedPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setRecordedPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [audioMode, file])

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current)
        recordTimerRef.current = null
      }

      const processor = processorRef.current
      processorRef.current = null
      if (processor) {
        try {
          processor.disconnect()
        } catch {}
        processor.onaudioprocess = null
      }

      const audioCtx = audioCtxRef.current
      audioCtxRef.current = null
      if (audioCtx) {
        void audioCtx.close().catch(() => {})
      }

      const stream = streamRef.current
      streamRef.current = null
      if (stream) {
        for (const t of stream.getTracks()) t.stop()
      }
    }
  }, [])

  const validateAndSetFile = useCallback((next: File | null) => {
    setFileError(null)
    setFile(null)
    if (!next) return

    const ext = extOf(next.name)
    if (!ALLOWED_EXTS.has(ext)) {
      setFileError('File must be WAV, MP3, or M4A.')
      return
    }
    if (next.size > MAX_FILE_BYTES) {
      setFileError('File too large (max 50MB).')
      return
    }
    setFile(next)
  }, [])

  async function onTranscribeAudio(
    nextFile: File | null = file,
    opts?: { errorTarget?: 'page' | 'record' },
  ) {
    const errorTarget = opts?.errorTarget ?? 'page'

    if (errorTarget === 'record') {
      setRecordingError(null)
    } else {
      setError(null)
    }

    if (!transcriptionEnabled) {
      const msg = 'Transcription is not enabled on this server.'
      if (errorTarget === 'record') setRecordingError(msg)
      else setError(msg)
      return
    }
    if (!nextFile) {
      const msg = 'Please select an audio file to transcribe.'
      if (errorTarget === 'record') setRecordingError(msg)
      else setError(msg)
      return
    }

    setTranscribing(true)
    try {
      const form = new FormData()
      form.set('audio', nextFile)
      form.set('language', language)
      const res = await apiForm<{
        text: string
        model: string
        language: string | null
      }>('/api/transcriptions', form, { method: 'POST' })
      setTranscript(res.text)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to transcribe audio.'
      if (errorTarget === 'record') setRecordingError(msg)
      else setError(msg)
    } finally {
      setTranscribing(false)
    }
  }

  function stopRecordingTimer() {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
  }

  async function cleanupRecording() {
    stopRecordingTimer()
    setMicLevel(0)

    const worklet = workletRef.current
    workletRef.current = null
    if (worklet) {
      try {
        worklet.disconnect()
      } catch {}
      try {
        worklet.port.onmessage = null
      } catch {}
    }

    const processor = processorRef.current
    processorRef.current = null
    if (processor) {
      try {
        processor.disconnect()
      } catch {}
      processor.onaudioprocess = null
    }

    const audioCtx = audioCtxRef.current
    audioCtxRef.current = null
    if (audioCtx) {
      try {
        await audioCtx.close()
      } catch {}
    }

    const stream = streamRef.current
    streamRef.current = null
    if (stream) {
      for (const t of stream.getTracks()) t.stop()
    }
  }

  async function startRecording() {
    setError(null)
    setRecordingError(null)
    setFileError(null)

    if (recording) return

    setRecordSeconds(0)
    pcmChunksRef.current = []
    pcmBytesRef.current = 0

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      try {
        await audioCtx.resume()
      } catch {}

      const source = audioCtx.createMediaStreamSource(stream)
      const zeroGain = audioCtx.createGain()
      zeroGain.gain.value = 0

      const processChunk = (input: Float32Array) => {
        if (!input || input.length === 0) return

        setMicLevel(rmsLevel(input))

        const down = downsampleFloat32(input, audioCtx.sampleRate, 16000)
        const pcmBytes = float32ToPcm16leBytes(down)

        pcmChunksRef.current.push(pcmBytes.buffer)
        pcmBytesRef.current += pcmBytes.byteLength
      }

      let captureNode: AudioNode | null = null

      if (audioCtx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
        try {
          await audioCtx.audioWorklet.addModule(
            new URL('../lib/pcmCapture.worklet.js', import.meta.url),
          )

          const worklet = new AudioWorkletNode(audioCtx, 'utter-pcm-capture', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            channelCount: 1,
          })
          workletRef.current = worklet
          worklet.port.onmessage = (ev) => {
            const data = ev.data as unknown
            if (!data || typeof data !== 'object') return
            if ((data as { type?: unknown }).type !== 'chunk') return
            const buffer = (data as { buffer?: unknown }).buffer
            if (!(buffer instanceof ArrayBuffer)) return
            processChunk(new Float32Array(buffer))
          }
          captureNode = worklet
        } catch {
          captureNode = null
        }
      }

      if (!captureNode) {
        const processor = audioCtx.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor
        processor.onaudioprocess = (e) => {
          processChunk(e.inputBuffer.getChannelData(0))
        }
        captureNode = processor
      }

      source.connect(captureNode)
      captureNode.connect(zeroGain)
      zeroGain.connect(audioCtx.destination)

      setRecording(true)
      stopRecordingTimer()
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1)
      }, 1000)
    } catch (e) {
      await cleanupRecording()
      setRecordingError(
        e instanceof Error ? e.message : 'Failed to access microphone.',
      )
      setRecording(false)
    }
  }

  async function stopRecording() {
    if (!recording) return

    setRecording(false)
    stopRecordingTimer()
    await cleanupRecording()

    const pcmByteLength = pcmBytesRef.current
    if (pcmByteLength <= 0) {
      setRecordingError('No audio captured.')
      return
    }

    const header = createWavHeaderPcm16Mono(pcmByteLength, 16000)
    const blob = new Blob([header, ...pcmChunksRef.current], {
      type: 'audio/wav',
    })
    const nextFile = new File([blob], `recording-${Date.now()}.wav`, {
      type: 'audio/wav',
    })

    validateAndSetFile(nextFile)
    await onTranscribeAudio(nextFile, { errorTarget: 'record' })
  }

  async function onTryExample() {
    setError(null)
    setFileError(null)
    try {
      const [textRes, audioRes] = await Promise.all([
        fetch('/static/examples/audio_text.txt'),
        fetch('/static/examples/audio.wav'),
      ])
      if (!textRes.ok || !audioRes.ok)
        throw new Error('Failed to load example.')
      const exampleText = await textRes.text()
      const audioBlob = await audioRes.blob()
      const exampleFile = new File([audioBlob], 'audio.wav', {
        type: 'audio/wav',
      })
      setName('ASMR')
      setTranscript(exampleText.trim())
      validateAndSetFile(exampleFile)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load example.')
    }
  }

  useEffect(() => {
    const demoId = params.get('demo')
    if (!demoId) return
    if (loadedDemoRef.current === demoId) return
    loadedDemoRef.current = demoId

    const demo = getUtterDemo(demoId)
    const audioUrl = demo?.audioUrl
    if (!demo || !audioUrl) return

    setError(null)
    setFileError(null)

    void (async () => {
      try {
        const [audioRes, transcript] = await Promise.all([
          fetch(audioUrl),
          demo.transcriptUrl
            ? fetchTextUtf8(demo.transcriptUrl)
            : Promise.resolve(''),
        ])
        if (!audioRes.ok) throw new Error('Failed to load demo audio.')
        const audioBlob = await audioRes.blob()
        const ext = extOf(new URL(audioUrl, window.location.href).pathname)
        const fileName = `${demo.id}${ext || '.mp3'}`
        const nextFile = new File([audioBlob], fileName, {
          type: audioBlob.type || 'audio/mpeg',
        })

        setName(demo.suggestedCloneName ?? `${demo.title} (demo)`)
        setTranscript(transcript.trim())
        validateAndSetFile(nextFile)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load demo.')
      }
    })()
  }, [params, validateAndSetFile])

  async function onSubmit() {
    setError(null)
    setCreated(null)
    setFileError(null)

    if (!name.trim()) {
      setError('Please enter a voice name.')
      return
    }
    if (!file) {
      setError('Please select an audio file.')
      return
    }
    if (transcriptRequired && transcript.trim().length < 10) {
      setError('Please provide a transcript (at least 10 characters).')
      return
    }

    setSubmitting(true)
    const t0 = Date.now()
    setStartedAt(t0)
    setElapsedLabel('0:00')

    try {
      const { voice_id, upload_url } = await apiJson<{
        voice_id: string
        upload_url: string
        object_key: string
      }>('/api/clone/upload-url', {
        method: 'POST',
        json: {
          name: name.trim(),
          language,
          transcript: transcript.trim(),
        },
      })

      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': contentTypeForFile(file) },
      })
      if (!uploadRes.ok) {
        throw new Error('Failed to upload audio file.')
      }

      const res = await apiJson<CloneResponse>('/api/clone/finalize', {
        method: 'POST',
        json: {
          voice_id,
          name: name.trim(),
          language,
          transcript: transcript.trim(),
        },
      })
      setCreated(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clone voice.')
    } finally {
      setSubmitting(false)
      setStartedAt(null)
    }
  }

  const reset = useCallback(() => {
    setCreated(null)
    setError(null)
    setFileError(null)
    setName('')
    setTranscript('')
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  useEffect(() => {
    if (!created) return
    firstModalActionRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        reset()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [created, reset])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-2">
        <h2 className="text-balance text-center text-2xl font-pixel font-medium uppercase tracking-[2px] md:text-3xl">
          Clone
        </h2>
        <InfoTip align="end" label="Clone tips">
          <div className="space-y-2">
            <div>
              Upload WAV/MP3/M4A (max 50MB) or record 3+ seconds of clean
              speech.
            </div>
            {transcriptionEnabled ? (
              <div>
                Record mode: stopping capture auto-runs transcription and fills
                the transcript box.
              </div>
            ) : (
              <div>
                Recording and transcription are disabled on this server.
              </div>
            )}
            <div>
              {transcriptionEnabled
                ? 'Upload mode: use "Transcribe" to create a draft transcript, then edit it to match the audio.'
                : 'Upload mode: type/paste the transcript manually.'}
            </div>
            <div>
              {transcriptRequired
                ? 'Transcript is required.'
                : 'Transcript may be optional for your current provider.'}
            </div>
          </div>
        </InfoTip>
      </div>

      {error ? <Message variant="error">{error}</Message> : null}
      {recordingError ? (
        <Message variant="error">{recordingError}</Message>
      ) : null}

      <div className="flex items-center justify-center">
        <div className="inline-flex overflow-hidden border border-border bg-background shadow-elevated">
          <button
            type="button"
            className={cn(
              'px-4 py-2 text-xs font-medium uppercase tracking-wide',
              audioMode === 'upload'
                ? 'bg-foreground text-background'
                : 'bg-background text-foreground hover:bg-subtle',
            )}
            aria-pressed={audioMode === 'upload'}
            onClick={() => setAudioMode('upload')}
            disabled={recording}
          >
            Upload
          </button>
          {transcriptionEnabled ? (
            <button
              type="button"
              className={cn(
                'px-4 py-2 text-xs font-medium uppercase tracking-wide',
                audioMode === 'record'
                  ? 'bg-foreground text-background'
                  : 'bg-background text-foreground hover:bg-subtle',
              )}
              aria-pressed={audioMode === 'record'}
              onClick={() => setAudioMode('record')}
              disabled={recording}
            >
              Record
            </button>
          ) : null}
        </div>
      </div>

      {audioMode === 'record' && transcriptionEnabled ? (
        <div className="space-y-4 border border-border bg-background p-6 shadow-elevated">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold uppercase tracking-wide">
              Record Reference Audio
            </div>
            <div className="text-xs text-faint">{recordTimeLabel}</div>
          </div>

          <div className="h-2 w-full overflow-hidden border border-border bg-muted">
            <div
              className="h-full bg-foreground transition-[width]"
              style={{ width: `${Math.min(100, micLevel * 180)}%` }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void startRecording()}
              disabled={recording || submitting || transcribing}
            >
              {recording ? 'Recording...' : 'Start'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void stopRecording()}
              disabled={!recording}
            >
              Stop
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                void cleanupRecording()
                setRecordingError(null)
                setTranscript('')
                setRecordSeconds(0)
                setFile(null)
              }}
              disabled={recording || transcribing}
            >
              Clear
            </Button>
          </div>

          {transcribing ? (
            <div className="text-xs font-medium uppercase tracking-wide text-faint">
              Transcribing recorded audio...
            </div>
          ) : null}

          {recordedPreviewUrl ? (
            <div className="border border-border bg-background p-3">
              <WaveformPlayer
                audioUrl={recordedPreviewUrl}
                audioBlob={file ?? undefined}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="relative">
          <button
            type="button"
            className={cn(
              'w-full cursor-pointer border border-dashed border-border bg-background p-6 text-center shadow-elevated hover:bg-subtle',
              'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              validateAndSetFile(e.dataTransfer.files?.[0] ?? null)
            }}
            onClick={() => inputRef.current?.click()}
            aria-label="Select audio file"
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".wav,.mp3,.m4a"
              onChange={(e) => validateAndSetFile(e.target.files?.[0] ?? null)}
            />
            <div className="text-sm text-muted-foreground">
              Drag &amp; drop audio here, or click to browse.
            </div>
            <div className="mt-2 text-xs text-faint">
              WAV / MP3 / M4A • max 50MB
            </div>
            {fileInfo ? (
              <div className="mt-3 text-xs text-foreground">{fileInfo}</div>
            ) : null}
            {fileError ? (
              <div className="mt-3 text-xs text-red-700 dark:text-red-400">
                {fileError}
              </div>
            ) : null}
          </button>

          {transcriptionEnabled && file ? (
            <Button
              className="absolute right-4 top-4 z-10"
              variant="secondary"
              size="sm"
              type="button"
              loading={transcribing}
              disabled={submitting}
              onClick={() => void onTranscribeAudio()}
            >
              {transcribing ? 'Transcribing...' : 'Transcribe'}
            </Button>
          ) : null}
        </div>
      )}

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void onSubmit()
        }}
      >
        <div>
          <Label htmlFor="clone-voice-name">Voice Name</Label>
          <Input
            id="clone-voice-name"
            name="name"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Duncan (calm, close-mic)…"
          />
        </div>

        <div>
          <Label htmlFor="clone-transcript">Transcript</Label>
          <Textarea
            id="clone-transcript"
            name="transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste the transcript of the reference audio…"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-faint">
            <span>{transcript.length} chars</span>
          </div>
        </div>

        <div>
          <Label htmlFor="clone-language">Language</Label>
          <Select
            id="clone-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            name="language"
          >
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="secondary"
            type="button"
            block
            onClick={() => void onTryExample()}
          >
            Try Example Voice
          </Button>
          <Button type="submit" block disabled={submitting}>
            {submitting ? `Cloning… ${elapsedLabel}` : 'Clone Voice'}
          </Button>
        </div>
      </form>

      {submitting ? (
        <div className="border border-border bg-subtle p-4 shadow-elevated">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="font-medium uppercase tracking-wide">
                Progress
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Cloning...
              </div>
            </div>
            <div className="text-xs text-faint">{elapsedLabel}</div>
          </div>
        </div>
      ) : null}
      {created ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overscroll-contain backdrop-blur-sm">
          <div
            className="w-full max-w-md border border-border bg-background p-6 shadow-elevated"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clone-success-title"
          >
            <h3
              id="clone-success-title"
              className="text-sm font-semibold uppercase tracking-wide"
            >
              Clone Success
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Voice <span className="text-foreground">{created.name}</span> is
              ready.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <NavLink
                ref={firstModalActionRef}
                to={`/generate?voice=${created.id}`}
                className="inline-flex items-center justify-center border border-foreground bg-foreground px-6 py-3 text-sm font-medium uppercase tracking-wide text-background hover:bg-foreground/80 hover:border-foreground/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Go to Generate →
              </NavLink>
              <Button variant="secondary" type="button" onClick={reset}>
                Clone Another Voice
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
