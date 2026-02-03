import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WaveformPlayer } from '../components/audio/WaveformPlayer'
import { useTasks } from '../components/tasks/TaskProvider'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Message } from '../components/ui/Message'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { apiForm, apiJson } from '../lib/api'
import { formatElapsed } from '../lib/time'
import type { DesignPreviewResponse, StoredTask } from '../lib/types'
import { useLanguages } from './hooks'

type DesignFormState = {
  name: string
  language: string
  text: string
  instruct: string
}

function base64ToBlob(base64: string, mime: string) {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

const EXAMPLES: Array<{ title: string; instruct: string }> = [
  {
    title: 'Warm & steady',
    instruct:
      'A warm, steady voice with close-mic intimacy. Calm pacing, soft consonants, and a confident but gentle tone.',
  },
  {
    title: 'Bright & fast',
    instruct:
      'A bright, energetic voice with crisp articulation. Slightly faster pacing, friendly and upbeat without sounding cartoonish.',
  },
  {
    title: 'Low & cinematic',
    instruct:
      'A low, cinematic voice with a restrained intensity. Slow pacing, rich timbre, and subtle breathiness.',
  },
]

export function DesignPage() {
  const navigate = useNavigate()
  const { languages } = useLanguages()
  const { tasks, startTask, clearTask } = useTasks()

  const task = tasks.design

  const [name, setName] = useState('')
  const [language, setLanguage] = useState('English')
  const [text, setText] = useState('')
  const [instruct, setInstruct] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsedLabel, setElapsedLabel] = useState('0:00')

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewBlobRef = useRef<Blob | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const restoredRef = useRef(false)
  const handledTerminalRef = useRef<string | null>(null)

  useEffect(() => {
    if (languages.length > 0 && !languages.includes(language)) {
      setLanguage(languages[0] ?? 'English')
    }
  }, [language, languages])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    const storedTask = task as StoredTask | undefined
    if (storedTask?.formState && typeof storedTask.formState === 'object') {
      const fs = storedTask.formState as Partial<DesignFormState>
      if (typeof fs.name === 'string') setName(fs.name)
      if (typeof fs.language === 'string') setLanguage(fs.language)
      if (typeof fs.text === 'string') setText(fs.text)
      if (typeof fs.instruct === 'string') setInstruct(fs.instruct)
    }
  }, [task])

  useEffect(() => {
    if (!task) {
      setStartedAt(null)
      return
    }
    if (task.status === 'pending' || task.status === 'processing') {
      setStartedAt(task.startedAt)
      return
    }
    setStartedAt(null)
  }, [task])

  useEffect(() => {
    if (!startedAt) return
    const t = window.setInterval(
      () => setElapsedLabel(formatElapsed(startedAt)),
      1000,
    )
    return () => window.clearInterval(t)
  }, [startedAt])

  useEffect(() => {
    if (!task?.taskId) return
    if (task.originPage !== '/design') return
    if (task.status === 'pending' || task.status === 'processing') return

    const terminalKey = `${task.taskId}:${task.status}`
    if (handledTerminalRef.current === terminalKey) return
    handledTerminalRef.current = terminalKey

    if (task.status === 'completed') {
      const result = task.result as { audio_base64?: string } | undefined
      if (result?.audio_base64) {
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        const blob = base64ToBlob(result.audio_base64, 'audio/wav')
        previewBlobRef.current = blob
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url
        setPreviewUrl(url)
        setError(null)
        setSuccess(null)
      }
    } else if (task.status === 'failed') {
      setError(task.error ?? 'Failed to generate preview.')
    }

    window.setTimeout(() => clearTask('design'), 50)
  }, [clearTask, task])

  const formState: DesignFormState = useMemo(
    () => ({ name, language, text, instruct }),
    [instruct, language, name, text],
  )

  async function onPreview() {
    setError(null)
    setSuccess(null)
    setPreviewUrl(null)
    previewBlobRef.current = null

    if (!text.trim()) {
      setError('Preview text is required.')
      return
    }
    if (text.length > 500) {
      setError('Preview text must be 500 characters or less.')
      return
    }
    if (!instruct.trim()) {
      setError('Voice description is required.')
      return
    }
    if (instruct.length > 500) {
      setError('Voice description must be 500 characters or less.')
      return
    }

    try {
      const res = await apiJson<DesignPreviewResponse>(
        '/api/voices/design/preview',
        {
          method: 'POST',
          json: { text, language, instruct },
        },
      )
      startTask(res.task_id, 'design', '/design', 'Design preview', formState)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start preview.')
    }
  }

  async function onSave() {
    setError(null)
    setSuccess(null)

    if (!previewBlobRef.current) {
      setError('Generate a preview first.')
      return
    }
    if (!name.trim()) {
      setError('Voice name is required.')
      return
    }

    try {
      const form = new FormData()
      form.set('name', name.trim())
      form.set('text', text.trim())
      form.set('language', language)
      form.set('instruct', instruct.trim())
      form.set(
        'audio',
        new File([previewBlobRef.current], 'preview.wav', {
          type: 'audio/wav',
        }),
      )

      await apiForm('/api/voices/design', form, { method: 'POST' })
      setSuccess('Voice saved. Redirecting to Voices…')
      window.setTimeout(() => navigate('/voices'), 600)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save voice.')
    }
  }

  const isRunning = task?.status === 'pending' || task?.status === 'processing'

  return (
    <div className="space-y-8">
      <h2 className="text-balance text-center text-xl font-semibold uppercase tracking-[2px]">
        Design
      </h2>

      {error ? <Message variant="error">{error}</Message> : null}
      {success ? <Message variant="success">{success}</Message> : null}

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void onPreview()
        }}
      >
        <div>
          <Label htmlFor="design-voice-name">Voice Name</Label>
          <Input
            id="design-voice-name"
            name="name"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="design-instruct">Voice Description</Label>
          <Textarea
            id="design-instruct"
            name="instruct"
            value={instruct}
            onChange={(e) => setInstruct(e.target.value)}
            placeholder="Describe the voice (tone, pacing, timbre, vibe)…"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
            <span>{instruct.length}/500</span>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.title}
                  type="button"
                  className="border border-border bg-background px-2 py-1 text-[11px] uppercase tracking-wide hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={() => setInstruct(ex.instruct)}
                >
                  {ex.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="design-text">Preview Text</Label>
          <Textarea
            id="design-text"
            name="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="A short line to preview the voice…"
          />
          <div className="mt-2 text-xs text-faint">{text.length}/500</div>
        </div>

        <div>
          <Label htmlFor="design-language">Language</Label>
          <Select
            id="design-language"
            name="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" block loading={isRunning}>
            {isRunning ? `Generating… ${elapsedLabel}` : 'Generate Preview'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void onSave()}
            disabled={!previewUrl}
          >
            Save Voice
          </Button>
        </div>
      </form>

      {isRunning ? (
        <div className="border border-border bg-subtle p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="font-medium uppercase tracking-wide">
                Progress
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Generating…
              </div>
            </div>
            <div className="text-xs text-faint">{elapsedLabel}</div>
          </div>
        </div>
      ) : null}

      {previewUrl ? (
        <div className="space-y-4 border border-border bg-background p-4">
          <div className="text-sm font-medium uppercase tracking-wide">
            Preview
          </div>
          <WaveformPlayer audioUrl={previewUrl} />
        </div>
      ) : null}
    </div>
  )
}
