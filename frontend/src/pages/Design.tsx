import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WaveformPlayer } from '../components/audio/WaveformPlayer'
import { useTasks } from '../components/tasks/TaskProvider'
import { Button } from '../components/ui/Button'
import { InfoTip } from '../components/ui/InfoTip'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Message } from '../components/ui/Message'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { apiForm, apiJson } from '../lib/api'
import { formatElapsed } from '../lib/time'
import type {
  DesignPreviewResponse,
  DesignSaveResponse,
  StoredTask,
} from '../lib/types'
import { useLanguages } from './hooks'

type DesignFormState = {
  name: string
  language: string
  text: string
  instruct: string
}

const EXAMPLES: Array<{ title: string; name: string; instruct: string }> = [
  {
    title: 'Warm & steady',
    name: 'Warm & steady',
    instruct:
      'A warm, steady voice with close-mic intimacy. Calm pacing, soft consonants, and a confident but gentle tone.',
  },
  {
    title: 'Bright & fast',
    name: 'Bright & fast',
    instruct:
      'A bright, energetic voice with crisp articulation. Slightly faster pacing, friendly and upbeat without sounding cartoonish.',
  },
  {
    title: 'Low & cinematic',
    name: 'Low & cinematic',
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
  const [isSavingVoice, setIsSavingVoice] = useState(false)
  const [savedVoiceId, setSavedVoiceId] = useState<string | null>(null)
  const [savedVoiceName, setSavedVoiceName] = useState<string | null>(null)

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

  const saveDesignedVoice = useCallback(
    async (blob: Blob, snapshot: DesignFormState) => {
      setIsSavingVoice(true)
      setSavedVoiceId(null)
      setSavedVoiceName(null)
      setSuccess(null)

      try {
        const form = new FormData()
        form.set('name', snapshot.name.trim())
        form.set('text', snapshot.text.trim())
        form.set('language', snapshot.language)
        form.set('instruct', snapshot.instruct.trim())
        form.set(
          'audio',
          new File([blob], 'preview.wav', {
            type: 'audio/wav',
          }),
        )

        const saved = await apiForm<DesignSaveResponse>(
          '/api/voices/design',
          form,
          {
            method: 'POST',
          },
        )
        setSavedVoiceId(saved.id)
        setSavedVoiceName(saved.name)
        setError(null)
        setSuccess(`Voice "${saved.name}" saved and ready to use.`)
      } catch (e) {
        setSavedVoiceId(null)
        setSavedVoiceName(null)
        setSuccess(null)
        const detail =
          e instanceof Error ? e.message : 'Failed to save voice automatically.'
        setError(
          `Preview generated, but automatic save failed. ${detail} You can try Generate Preview again.`,
        )
      } finally {
        setIsSavingVoice(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!task?.taskId) return
    if (task.status === 'pending' || task.status === 'processing') return

    const terminalKey = `${task.taskId}:${task.status}`
    if (handledTerminalRef.current === terminalKey) return
    handledTerminalRef.current = terminalKey

    if (task.status === 'completed') {
      const taskState = task.formState as Partial<DesignFormState> | null
      const snapshot: DesignFormState = {
        name: typeof taskState?.name === 'string' ? taskState.name : name,
        language:
          typeof taskState?.language === 'string'
            ? taskState.language
            : language,
        text: typeof taskState?.text === 'string' ? taskState.text : text,
        instruct:
          typeof taskState?.instruct === 'string'
            ? taskState.instruct
            : instruct,
      }
      const result = task.result as
        | { audio_base64?: string; audio_url?: string }
        | undefined

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
      previewBlobRef.current = null

      const audioUrl = result?.audio_url?.trim()
      if (audioUrl) {
        void (async () => {
          try {
            const res = await fetch(audioUrl)
            if (!res.ok) throw new Error('Failed to load preview audio.')
            const blob = await res.blob()
            previewBlobRef.current = blob
            const url = URL.createObjectURL(blob)
            objectUrlRef.current = url
            setPreviewUrl(url)
            setError(null)
            setSuccess(null)
            await saveDesignedVoice(blob, snapshot)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load preview.')
          }
        })()
      } else {
        const audioBase64 = result?.audio_base64?.trim()
        if (audioBase64) {
          const bin = atob(audioBase64)
          const bytes = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
          const blob = new Blob([bytes], { type: 'audio/wav' })
          previewBlobRef.current = blob
          const url = URL.createObjectURL(blob)
          objectUrlRef.current = url
          setPreviewUrl(url)
          setError(null)
          setSuccess(null)
          void saveDesignedVoice(blob, snapshot)
        } else {
          setError('Failed to load preview audio.')
        }
      }
    } else if (task.status === 'failed') {
      setError(task.error ?? 'Failed to generate preview.')
    } else if (task.status === 'cancelled') {
      setError('Preview cancelled.')
    }

    window.setTimeout(() => clearTask('design'), 50)
  }, [clearTask, instruct, language, name, saveDesignedVoice, task, text])

  async function onPreview() {
    setError(null)
    setSuccess(null)
    setSavedVoiceId(null)
    setSavedVoiceName(null)
    setPreviewUrl(null)
    previewBlobRef.current = null

    if (!name.trim()) {
      setError('Voice name is required.')
      return
    }
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
      const snapshot: DesignFormState = { name, language, text, instruct }
      const res = await apiJson<DesignPreviewResponse>(
        '/api/voices/design/preview',
        {
          method: 'POST',
          json: { text, language, instruct },
        },
      )
      startTask(res.task_id, 'design', '/design', 'Design preview', snapshot)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start preview.')
    }
  }

  const isRunning = task?.status === 'pending' || task?.status === 'processing'

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-2">
        <h2 className="text-balance text-center text-2xl font-pixel font-medium uppercase tracking-[2px] md:text-3xl">
          Design
        </h2>
        <InfoTip align="end" label="Design tips">
          <div className="space-y-2">
            <div>No reference audio needed. Describe the voice you want.</div>
            <div>
              Generate a short preview first; it is automatically saved as a
              reusable voice.
            </div>
            <div>Preview text and description are limited to 500 chars.</div>
          </div>
        </InfoTip>
      </div>

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
            placeholder="Describe the voice (tone, pacing, timbre, vibe)..."
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
            <span>{instruct.length}/500</span>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.title}
                  type="button"
                  className="border border-border bg-background px-2 py-1 text-[11px] uppercase tracking-wide hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={() => {
                    setName(ex.name)
                    setInstruct(ex.instruct)
                  }}
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
            placeholder="A short line to preview the voice..."
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

        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="submit" block disabled={isRunning || isSavingVoice}>
            {isRunning
              ? `Generating... ${elapsedLabel}`
              : isSavingVoice
                ? 'Saving voice...'
                : 'Generate Preview'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            block
            onClick={() => {
              if (!savedVoiceId) return
              void navigate(
                `/generate?voice=${encodeURIComponent(savedVoiceId)}`,
              )
            }}
            disabled={!savedVoiceId || isRunning || isSavingVoice}
          >
            Use Voice
          </Button>
        </div>
      </form>

      {isRunning ? (
        <div className="border border-border bg-subtle p-4 shadow-elevated">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="font-medium uppercase tracking-wide">
                Progress
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Generating...
              </div>
            </div>
            <div className="text-xs text-faint">{elapsedLabel}</div>
          </div>
        </div>
      ) : null}

      {previewUrl ? (
        <div className="space-y-4 border border-border bg-background p-4 shadow-elevated">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium uppercase tracking-wide">
              Preview
            </div>
            {savedVoiceName ? (
              <div className="text-xs text-faint">{savedVoiceName}</div>
            ) : null}
          </div>
          <WaveformPlayer
            audioUrl={previewUrl}
            audioBlob={previewBlobRef.current ?? undefined}
          />
        </div>
      ) : null}
    </div>
  )
}
