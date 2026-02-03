import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Message } from '../components/ui/Message'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { apiForm } from '../lib/api'
import { cn } from '../lib/cn'
import { formatElapsed } from '../lib/time'
import type { CloneResponse } from '../lib/types'
import { useLanguages } from './hooks'

const MAX_FILE_BYTES = 50 * 1024 * 1024
const ALLOWED_EXTS = new Set(['.wav', '.mp3', '.m4a'])

function extOf(name: string) {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

export function ClonePage() {
  const { languages, defaultLanguage, provider } = useLanguages()

  const inputRef = useRef<HTMLInputElement | null>(null)
  const firstModalActionRef = useRef<HTMLAnchorElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

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
    if (!submitting || !startedAt) return
    const t = window.setInterval(() => setElapsedLabel(formatElapsed(startedAt)), 1000)
    return () => window.clearInterval(t)
  }, [startedAt, submitting])

  const transcriptRequired = provider === 'qwen'

  const fileInfo = useMemo(() => {
    if (!file) return null
    return `${file.name} • ${(file.size / (1024 * 1024)).toFixed(1)} MB`
  }, [file])

  function validateAndSetFile(next: File | null) {
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
  }

  async function onTryExample() {
    setError(null)
    setFileError(null)
    try {
      const [textRes, audioRes] = await Promise.all([
        fetch('/static/examples/audio_text.txt'),
        fetch('/static/examples/audio.wav'),
      ])
      if (!textRes.ok || !audioRes.ok) throw new Error('Failed to load example.')
      const exampleText = await textRes.text()
      const audioBlob = await audioRes.blob()
      const exampleFile = new File([audioBlob], 'audio.wav', { type: 'audio/wav' })
      setName('Example Voice')
      setTranscript(exampleText.trim())
      validateAndSetFile(exampleFile)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load example.')
    }
  }

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
      const form = new FormData()
      form.set('name', name.trim())
      form.set('audio', file)
      form.set('transcript', transcript.trim())
      form.set('language', language)

      const res = await apiForm<CloneResponse>('/api/clone', form, { method: 'POST' })
      setCreated(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clone voice.')
    } finally {
      setSubmitting(false)
      setStartedAt(null)
    }
  }

  function reset() {
    setCreated(null)
    setError(null)
    setFileError(null)
    setName('')
    setTranscript('')
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

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
  }, [created])

  return (
    <div className="space-y-8">
      <h2 className="text-balance text-center text-xl font-semibold uppercase tracking-[2px]">
        Clone
      </h2>

      {error ? <Message variant="error">{error}</Message> : null}

      <div
        className={cn(
          'cursor-pointer border border-dashed border-border bg-background p-6 text-center hover:bg-subtle',
          'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          validateAndSetFile(e.dataTransfer.files?.[0] ?? null)
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        role="button"
        tabIndex={0}
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
        <div className="mt-2 text-xs text-faint">WAV / MP3 / M4A • max 50MB</div>
        {fileInfo ? <div className="mt-3 text-xs text-foreground">{fileInfo}</div> : null}
        {fileError ? (
          <div className="mt-3 text-xs text-red-700 dark:text-red-400">
            {fileError}
          </div>
        ) : null}
      </div>

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
            placeholder="e.g. Duncan (calm, close-mic)"
          />
        </div>

        <div>
          <Label htmlFor="clone-transcript">Transcript</Label>
          <Textarea
            id="clone-transcript"
            name="transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste the transcript of the reference audio."
          />
          <div className="mt-2 flex items-center justify-between text-xs text-faint">
            <span>{transcriptRequired ? 'Required for Qwen3-TTS.' : 'Optional.'}</span>
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button variant="secondary" type="button" onClick={() => void onTryExample()}>
            Try Example Voice
          </Button>
          <Button type="submit" block loading={submitting}>
            {submitting ? `Cloning… ${elapsedLabel}` : 'Clone Voice'}
          </Button>
        </div>
      </form>

      {created ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overscroll-contain backdrop-blur-sm">
          <div
            className="w-full max-w-md border border-border bg-background p-6"
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
              Voice <span className="text-foreground">{created.name}</span> is ready.
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
