import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { WaveformPlayer } from '../components/audio/WaveformPlayer'
import { useTasks } from '../components/tasks/TaskProvider'
import { Button } from '../components/ui/Button'
import { InfoTip } from '../components/ui/InfoTip'
import { Label } from '../components/ui/Label'
import { Message } from '../components/ui/Message'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { getUtterDemo } from '../content/utterDemo'
import { apiJson } from '../lib/api'
import { cn } from '../lib/cn'
import { fetchTextUtf8 } from '../lib/fetchTextUtf8'
import { formatElapsed } from '../lib/time'
import type { GenerateResponse, StoredTask, VoicesResponse } from '../lib/types'
import { useLanguages } from './hooks'

type GenerateFormState = {
  voiceId: string
  language: string
  text: string
}

export function GeneratePage() {
  const [params] = useSearchParams()
  const { languages, defaultLanguage } = useLanguages()
  const { tasks, startTask, clearTask, getStatusText } = useTasks()

  const task = tasks.generate

  const [voices, setVoices] = useState<VoicesResponse | null>(null)
  const [loadingVoices, setLoadingVoices] = useState(true)

  const [voiceId, setVoiceId] = useState('')
  const [language, setLanguage] = useState(defaultLanguage)
  const [text, setText] = useState('')

  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsedLabel, setElapsedLabel] = useState('0:00')

  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  const restoredRef = useRef(false)
  const handledTerminalRef = useRef<string | null>(null)
  const loadedDemoRef = useRef<string | null>(null)

  useEffect(() => setLanguage(defaultLanguage), [defaultLanguage])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const res = await apiJson<VoicesResponse>('/api/voices')
        if (!active) return
        setVoices(res)
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Failed to load voices.')
      } finally {
        if (active) setLoadingVoices(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    const storedTask = task as StoredTask | undefined
    if (storedTask?.formState && typeof storedTask.formState === 'object') {
      const fs = storedTask.formState as Partial<GenerateFormState>
      if (typeof fs.voiceId === 'string') setVoiceId(fs.voiceId)
      if (typeof fs.language === 'string') setLanguage(fs.language)
      if (typeof fs.text === 'string') setText(fs.text)
    }

    const voice = params.get('voice')
    const qsText = params.get('text')
    const qsLang = params.get('language')
    const demoId = params.get('demo')
    if (voice) setVoiceId(voice)
    if (typeof qsText === 'string' && qsText.length > 0) setText(qsText)
    if (typeof qsLang === 'string' && qsLang.length > 0) setLanguage(qsLang)

    if (demoId && loadedDemoRef.current !== demoId) {
      loadedDemoRef.current = demoId
      const demo = getUtterDemo(demoId)
      if (demo?.transcriptUrl) {
        void (async () => {
          try {
            const demoText = await fetchTextUtf8(demo.transcriptUrl as string)
            setText(demoText.trim())
          } catch {
            // ignore
          }
        })()
      }
    }
  }, [params, task])

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
    if (task.status === 'pending' || task.status === 'processing') return

    const terminalKey = `${task.taskId}:${task.status}`
    if (handledTerminalRef.current === terminalKey) return
    handledTerminalRef.current = terminalKey

    if (task.status === 'completed') {
      const result = task.result as { audio_url?: string } | undefined
      if (result?.audio_url) {
        setAudioUrl(result.audio_url)
        setDownloadUrl(result.audio_url)
        setError(null)
      }
    } else if (task.status === 'failed') {
      setError(task.error ?? 'Generation failed. Please try again.')
    } else if (task.status === 'cancelled') {
      setError('Generation was cancelled.')
    }

    window.setTimeout(() => clearTask('generate'), 50)
  }, [clearTask, task])

  const charCount = text.length
  const isRunning = task?.status === 'pending' || task?.status === 'processing'
  const statusText = task
    ? getStatusText(task.status, task.modalStatus ?? null)
    : null

  const canSubmit =
    !loadingVoices &&
    Boolean(voiceId) &&
    Boolean(text.trim()) &&
    charCount <= 10000

  const formState: GenerateFormState = useMemo(
    () => ({ voiceId, language, text }),
    [language, text, voiceId],
  )

  async function onGenerate() {
    setError(null)
    setAudioUrl(null)
    setDownloadUrl(null)

    if (!canSubmit) {
      setError('Please select a voice and enter some text.')
      return
    }

    try {
      const res = await apiJson<GenerateResponse>('/api/generate', {
        method: 'POST',
        json: { voice_id: voiceId, text, language, model: '0.6B' },
      })
      const description = `Generate: ${text.slice(0, 50)}${text.length > 50 ? '…' : ''}`
      startTask(res.task_id, 'generate', '/generate', description, formState)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start generation.')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-2">
        <h2 className="text-balance text-center text-xl font-semibold uppercase tracking-[2px]">
          Generate
        </h2>
        <InfoTip align="end" label="Generate tips">
          <div className="space-y-2">
            <div>Pick a voice, enter text, then start generation.</div>
            <div>
              Generation runs as a background task. Time varies by text length
              and server load.
            </div>
            <div>Max input: 10,000 characters.</div>
          </div>
        </InfoTip>
      </div>

      {error ? <Message variant="error">{error}</Message> : null}

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void onGenerate()
        }}
      >
        <div>
          <Label htmlFor="generate-voice">Voice</Label>
          <Select
            id="generate-voice"
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            disabled={loadingVoices}
            name="voice_id"
          >
            <option value="">
              {loadingVoices ? 'Loading…' : 'Select a voice'}
            </option>
            {voices?.voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="generate-language">Language</Label>
          <Select
            id="generate-language"
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

        <div>
          <Label htmlFor="generate-text">Text</Label>
          <Textarea
            id="generate-text"
            name="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type what you want the voice to say…"
            className="min-h-44"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-faint">
            <span
              className={cn(
                charCount > 10000 && 'text-red-700 dark:text-red-400',
              )}
            >
              {charCount}/10000
            </span>
            <span>Max 10,000 characters</span>
          </div>
        </div>

        <Button type="submit" block loading={isRunning}>
          {isRunning ? `Generating… ${elapsedLabel}` : 'Generate Speech'}
        </Button>
      </form>

      {isRunning ? (
        <div className="border border-border bg-subtle p-4 shadow-elevated">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="font-medium uppercase tracking-wide">
                Progress
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {statusText ?? 'Processing…'}
              </div>
            </div>
            <div className="text-xs text-faint">{elapsedLabel}</div>
          </div>
        </div>
      ) : null}

      {audioUrl ? (
        <div className="space-y-4 border border-border bg-background p-4 shadow-elevated">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-medium uppercase tracking-wide">
              Result
            </div>
            <div className="flex items-center gap-2">
              {downloadUrl ? (
                <a
                  className="border border-border bg-background px-3 py-2 text-[12px] uppercase tracking-wide hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  href={downloadUrl}
                >
                  Download
                </a>
              ) : null}
            </div>
          </div>
          <WaveformPlayer audioUrl={audioUrl} />
        </div>
      ) : null}
    </div>
  )
}
