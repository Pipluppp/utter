import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { WaveformPlayer } from '../components/audio/WaveformPlayer'
import { useTasks } from '../components/tasks/TaskProvider'
import { taskLabel } from '../components/tasks/taskKeys'
import { Button } from '../components/ui/Button'
import { InfoTip } from '../components/ui/InfoTip'
import { Label } from '../components/ui/Label'
import { Message } from '../components/ui/Message'
import { Select } from '../components/ui/Select'
import { Skeleton } from '../components/ui/Skeleton'
import { Textarea } from '../components/ui/Textarea'
import { getUtterDemo } from '../content/utterDemo'
import { apiJson } from '../lib/api'
import { cn } from '../lib/cn'
import { fetchTextUtf8 } from '../lib/fetchTextUtf8'
import {
  resolveProtectedMediaUrl,
  triggerDownload,
} from '../lib/protectedMedia'
import { formatElapsed } from '../lib/time'
import type { GenerateResponse, StoredTask, VoicesResponse } from '../lib/types'
import { useLanguages } from './hooks'

type GenerateFormState = {
  voiceId: string
  language: string
  text: string
}

function GenerateFormSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div>
        <Skeleton className="h-4 w-14" />
        <Skeleton className="mt-3 h-10 w-full" />
      </div>

      <div>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-3 h-10 w-full" />
      </div>

      <div>
        <Skeleton className="h-4 w-12" />
        <Skeleton className="mt-3 h-44 w-full" />
        <div className="mt-2 flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      <Skeleton className="h-11 w-full" />
    </div>
  )
}

function TaskSummaryRow({
  task,
  selected,
  onSelect,
  statusText,
}: {
  task: StoredTask
  selected: boolean
  onSelect: () => void
  statusText: string
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center justify-between gap-3 border border-border bg-background px-3 py-3 text-left hover:bg-muted',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected && 'bg-subtle',
      )}
      onClick={onSelect}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium uppercase tracking-wide">
          {task.description}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{statusText}</div>
      </div>
      <div className="shrink-0 text-xs text-faint">
        {task.status === 'pending' || task.status === 'processing'
          ? formatElapsed(task.startedAt)
          : task.status === 'completed'
            ? 'Ready'
            : task.status === 'cancelled'
              ? 'Cancelled'
              : 'Failed'}
      </div>
    </button>
  )
}

export function GeneratePage() {
  const [params] = useSearchParams()
  const { languages, defaultLanguage, provider, capabilities } = useLanguages()
  const { startTask, getLatestTask, getTasksByType, getStatusText } = useTasks()

  const generateTasks = getTasksByType('generate')
  const latestTask = getLatestTask('generate')

  const [voices, setVoices] = useState<VoicesResponse | null>(null)
  const [loadingVoices, setLoadingVoices] = useState(true)

  const [voiceId, setVoiceId] = useState('')
  const [language, setLanguage] = useState(defaultLanguage)
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  const restoredRef = useRef(false)
  const handledTaskKeyRef = useRef<string | null>(null)
  const loadedDemoRef = useRef<string | null>(null)
  const submitInFlightRef = useRef(false)

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
    if (
      selectedTaskId &&
      generateTasks.some((task) => task.taskId === selectedTaskId)
    ) {
      return
    }
    setSelectedTaskId(generateTasks[0]?.taskId ?? null)
  }, [generateTasks, selectedTaskId])

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    const storedTask = latestTask as StoredTask | null
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
            return
          }
        })()
      }
    }
  }, [latestTask, params])

  const selectedTask = useMemo(
    () => generateTasks.find((task) => task.taskId === selectedTaskId) ?? null,
    [generateTasks, selectedTaskId],
  )

  useEffect(() => {
    if (!selectedTask) {
      handledTaskKeyRef.current = null
      setAudioUrl(null)
      setDownloadUrl(null)
      return
    }

    if (
      selectedTask.status === 'pending' ||
      selectedTask.status === 'processing'
    ) {
      handledTaskKeyRef.current = null
      setAudioUrl(null)
      setDownloadUrl(null)
      return
    }

    const terminalKey = `${selectedTask.taskId}:${selectedTask.status}`
    if (handledTaskKeyRef.current === terminalKey) return
    handledTaskKeyRef.current = terminalKey

    if (selectedTask.status === 'completed') {
      const result = selectedTask.result as { audio_url?: string } | undefined
      const generatedAudioUrl = result?.audio_url
      if (!generatedAudioUrl) {
        setError('Failed to load generation audio.')
        return
      }

      void (async () => {
        try {
          const resolvedUrl = await resolveProtectedMediaUrl(generatedAudioUrl)
          setAudioUrl(resolvedUrl)
          setDownloadUrl(resolvedUrl)
          setError(null)
        } catch (e) {
          setError(
            e instanceof Error ? e.message : 'Failed to load generation audio.',
          )
        }
      })()
      return
    }

    if (selectedTask.status === 'failed') {
      setAudioUrl(null)
      setDownloadUrl(null)
      setError(selectedTask.error ?? 'Generation failed. Please try again.')
      return
    }

    setAudioUrl(null)
    setDownloadUrl(null)
    setError('Generation was cancelled.')
  }, [selectedTask])

  async function onDownload() {
    if (!downloadUrl) return
    try {
      const resolvedUrl = await resolveProtectedMediaUrl(downloadUrl)
      triggerDownload(resolvedUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to download audio.')
    }
  }

  const charCount = text.length
  const maxTextChars = capabilities?.max_text_chars ?? 10000
  const selectedVoice = voices?.voices.find((v) => v.id === voiceId) ?? null
  const selectedVoiceProvider = selectedVoice?.tts_provider ?? 'qwen'
  const selectedVoiceCompatible = !selectedVoice
    ? true
    : selectedVoiceProvider === provider
  const activeGenerateCount = generateTasks.filter(
    (task) => task.status === 'pending' || task.status === 'processing',
  ).length
  const statusText = selectedTask
    ? getStatusText(
        selectedTask.status,
        selectedTask.modalStatus ?? null,
        selectedTask.providerStatus ?? null,
      )
    : null

  const canSubmit =
    !loadingVoices &&
    Boolean(voiceId) &&
    selectedVoiceCompatible &&
    Boolean(text.trim()) &&
    charCount <= maxTextChars &&
    !isSubmitting

  const formState: GenerateFormState = useMemo(
    () => ({ voiceId, language, text }),
    [language, text, voiceId],
  )

  async function onGenerate() {
    if (submitInFlightRef.current) return

    setError(null)
    setAudioUrl(null)
    setDownloadUrl(null)

    if (!canSubmit) {
      if (!selectedVoiceCompatible) {
        setError('Selected voice is not compatible with the current runtime.')
        return
      }
      setError('Please select a voice and enter some text.')
      return
    }

    submitInFlightRef.current = true
    setIsSubmitting(true)

    try {
      const res = await apiJson<GenerateResponse>('/api/generate', {
        method: 'POST',
        json: { voice_id: voiceId, text, language, model: '0.6B' },
      })
      const description = `Generate: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`
      startTask(res.task_id, 'generate', '/generate', description, formState)
      setSelectedTaskId(res.task_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start generation.')
    } finally {
      setIsSubmitting(false)
      submitInFlightRef.current = false
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-2">
        <h2 className="text-balance text-center text-2xl font-pixel font-medium uppercase tracking-[2px] md:text-3xl">
          Generate
        </h2>
        <InfoTip align="end" label="Generate tips">
          <div className="space-y-2">
            <div>Pick a voice, enter text, then start generation.</div>
            <div>
              Generate runs as a background job, so queued or processing work
              keeps moving even if you leave the page.
            </div>
            <div>Max input: {maxTextChars.toLocaleString()} characters.</div>
          </div>
        </InfoTip>
      </div>

      {error ? <Message variant="error">{error}</Message> : null}

      {loadingVoices ? (
        <GenerateFormSkeleton />
      ) : (
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
              <option value="">Select a voice</option>
              {voices?.voices.map((v) => {
                const voiceProvider = v.tts_provider ?? 'qwen'
                const incompatible = voiceProvider !== provider
                return (
                  <option key={v.id} value={v.id} disabled={incompatible}>
                    {v.name}
                    {incompatible ? ' (not available in this runtime)' : ''}
                  </option>
                )
              })}
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
              placeholder="Type what you want the voice to say..."
              className="min-h-44"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-faint">
              <span
                className={cn(
                  charCount > maxTextChars && 'text-red-700 dark:text-red-400',
                )}
              >
                {charCount}/{maxTextChars}
              </span>
              <span>Max {maxTextChars.toLocaleString()} characters</span>
            </div>
          </div>

          <Button type="submit" block disabled={!canSubmit}>
            {isSubmitting ? 'Starting generation...' : 'Generate Speech'}
          </Button>
        </form>
      )}

      {selectedTask ? (
        <div className="space-y-4 border border-border bg-subtle p-4 shadow-elevated">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium uppercase tracking-wide">
                Selected Job
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {statusText ?? 'Processing...'}
              </div>
            </div>
            <div className="text-xs text-faint">
              {selectedTask.status === 'pending' ||
              selectedTask.status === 'processing'
                ? formatElapsed(selectedTask.startedAt)
                : taskLabel(selectedTask.type)}
            </div>
          </div>
          {selectedTask.subtitle ? (
            <div className="text-xs text-faint">{selectedTask.subtitle}</div>
          ) : null}
          {activeGenerateCount > 1 ? (
            <div className="text-xs text-faint">
              {activeGenerateCount} generate jobs currently running.
            </div>
          ) : null}
        </div>
      ) : null}

      {generateTasks.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm font-medium uppercase tracking-wide">
            Tracked Jobs
          </div>
          <div className="space-y-2">
            {generateTasks.map((task) => (
              <TaskSummaryRow
                key={task.taskId}
                task={task}
                selected={task.taskId === selectedTaskId}
                onSelect={() => setSelectedTaskId(task.taskId)}
                statusText={getStatusText(
                  task.status,
                  task.modalStatus ?? null,
                  task.providerStatus ?? null,
                )}
              />
            ))}
          </div>
        </div>
      ) : null}

      {audioUrl ? (
        <div className="space-y-4 border border-border bg-background p-4 shadow-elevated">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-medium uppercase tracking-wide">
              Result
            </div>
            {downloadUrl ? (
              <button
                type="button"
                className="border border-border bg-background px-3 py-2 text-[12px] uppercase tracking-wide hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => void onDownload()}
              >
                Download
              </button>
            ) : null}
          </div>
          <WaveformPlayer audioUrl={audioUrl} />
        </div>
      ) : null}
    </div>
  )
}
