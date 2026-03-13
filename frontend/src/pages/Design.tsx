import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WaveformPlayer } from '../components/audio/WaveformPlayer'
import { useTasks } from '../components/tasks/TaskProvider'
import { Button } from '../components/ui/Button'
import { GridArtSurface } from '../components/ui/GridArt'
import { InfoTip } from '../components/ui/InfoTip'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Message } from '../components/ui/Message'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { apiForm, apiJson } from '../lib/api'
import { cn } from '../lib/cn'
import { formatElapsed } from '../lib/time'
import type { DesignPreviewResponse, DesignSaveResponse, StoredTask } from '../lib/types'
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

function TaskSummaryRow({
  task,
  selected,
  statusText,
  onSelect,
}: {
  task: StoredTask
  selected: boolean
  statusText: string
  onSelect: () => void
}) {
  return (
    <button
      type='button'
      className={cn(
        'flex w-full items-center justify-between gap-3 border border-border bg-background px-3 py-3 text-left hover:bg-muted',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected && 'bg-subtle',
      )}
      onClick={onSelect}
    >
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-medium uppercase tracking-wide'>
          {task.description}
        </div>
        <div className='mt-1 text-xs text-muted-foreground'>{statusText}</div>
      </div>
      <div className='shrink-0 text-xs text-faint'>
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

export function DesignPage() {
  const navigate = useNavigate()
  const { languages } = useLanguages()
  const { startTask, getLatestTask, getTasksByType, getStatusText } = useTasks()

  const designTasks = getTasksByType('design_preview')
  const latestTask = getLatestTask('design_preview')

  const [name, setName] = useState('')
  const [language, setLanguage] = useState('English')
  const [text, setText] = useState('')
  const [instruct, setInstruct] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmittingPreview, setIsSubmittingPreview] = useState(false)
  const [sweepNonce, setSweepNonce] = useState(0)
  const [isSavingVoice, setIsSavingVoice] = useState(false)
  const [savedVoiceId, setSavedVoiceId] = useState<string | null>(null)
  const [savedVoiceName, setSavedVoiceName] = useState<string | null>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewBlobRef = useRef<Blob | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const restoredRef = useRef(false)
  const handledTaskKeyRef = useRef<string | null>(null)

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
    if (selectedTaskId && designTasks.some((task) => task.taskId === selectedTaskId)) {
      return
    }
    setSelectedTaskId(designTasks[0]?.taskId ?? null)
  }, [designTasks, selectedTaskId])

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    const storedTask = latestTask as StoredTask | null
    if (storedTask?.formState && typeof storedTask.formState === 'object') {
      const fs = storedTask.formState as Partial<DesignFormState>
      if (typeof fs.name === 'string') setName(fs.name)
      if (typeof fs.language === 'string') setLanguage(fs.language)
      if (typeof fs.text === 'string') setText(fs.text)
      if (typeof fs.instruct === 'string') setInstruct(fs.instruct)
    }
  }, [latestTask])

  const selectedTask = useMemo(
    () => designTasks.find((task) => task.taskId === selectedTaskId) ?? null,
    [designTasks, selectedTaskId],
  )

  useEffect(() => {
    if (!selectedTask) {
      handledTaskKeyRef.current = null
      setPreviewUrl(null)
      previewBlobRef.current = null
      setSavedVoiceId(null)
      setSavedVoiceName(null)
      setSuccess(null)
      return
    }

    setSavedVoiceId(null)
    setSavedVoiceName(null)
    setSuccess(null)

    if (selectedTask.status === 'pending' || selectedTask.status === 'processing') {
      handledTaskKeyRef.current = null
      setPreviewUrl(null)
      previewBlobRef.current = null
      return
    }

    const terminalKey = `${selectedTask.taskId}:${selectedTask.status}`
    if (handledTaskKeyRef.current === terminalKey) return
    handledTaskKeyRef.current = terminalKey

    if (selectedTask.status === 'completed') {
      const result = selectedTask.result as { audio_url?: string } | undefined
      const audioUrl = result?.audio_url?.trim()

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
      previewBlobRef.current = null

      if (!audioUrl) {
        setPreviewUrl(null)
        setError('Failed to load preview audio.')
        return
      }

      void (async () => {
        try {
          const res = await fetch(audioUrl)
          if (!res.ok) throw new Error('Failed to load preview audio.')
          const blob = await res.blob()
          previewBlobRef.current = blob
          const objectUrl = URL.createObjectURL(blob)
          objectUrlRef.current = objectUrl
          setPreviewUrl(objectUrl)
          setError(null)
        } catch (e) {
          setPreviewUrl(null)
          setError(e instanceof Error ? e.message : 'Failed to load preview.')
        }
      })()
      return
    }

    setPreviewUrl(null)
    previewBlobRef.current = null

    if (selectedTask.status === 'failed') {
      setError(selectedTask.error ?? 'Failed to generate preview.')
      return
    }

    setError('Preview cancelled.')
  }, [selectedTask])

  const saveDesignedVoice = useCallback(
    async (blob: Blob, snapshot: DesignFormState, taskId: string) => {
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
        form.set('task_id', taskId)
        form.set(
          'audio',
          new File([blob], 'preview.wav', {
            type: 'audio/wav',
          }),
        )

        const saved = await apiForm<DesignSaveResponse>('/api/voices/design', form, {
          method: 'POST',
        })
        setSavedVoiceId(saved.id)
        setSavedVoiceName(saved.name)
        setError(null)
        setSuccess(`Voice "${saved.name}" saved and ready to use.`)
      } catch (e) {
        setSavedVoiceId(null)
        setSavedVoiceName(null)
        setSuccess(null)
        const detail = e instanceof Error ? e.message : 'Failed to save this preview.'
        setError(`Preview ready, but save failed. ${detail}`)
      } finally {
        setIsSavingVoice(false)
      }
    },
    [],
  )

  async function onPreview() {
    setError(null)
    setSuccess(null)
    setSavedVoiceId(null)
    setSavedVoiceName(null)

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

    setIsSubmittingPreview(true)
    setSweepNonce((value) => value + 1)

    try {
      const snapshot: DesignFormState = { name, language, text, instruct }
      const res = await apiJson<DesignPreviewResponse>('/api/voices/design/preview', {
        method: 'POST',
        json: { text, language, instruct, name },
      })
      startTask(
        res.task_id,
        'design_preview',
        '/design',
        `Design preview: ${name.trim()}`,
        snapshot,
      )
      setSelectedTaskId(res.task_id)
      setPreviewUrl(null)
      previewBlobRef.current = null
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start preview.')
    } finally {
      setIsSubmittingPreview(false)
    }
  }

  async function onSaveSelectedPreview() {
    if (!selectedTask?.taskId || selectedTask.status !== 'completed') return
    if (!previewBlobRef.current) {
      setError('Preview audio is not ready yet.')
      return
    }

    const taskState =
      selectedTask.formState && typeof selectedTask.formState === 'object'
        ? (selectedTask.formState as Partial<DesignFormState>)
        : null

    const snapshot: DesignFormState = {
      name: typeof taskState?.name === 'string' ? taskState.name : name,
      language: typeof taskState?.language === 'string' ? taskState.language : language,
      text: typeof taskState?.text === 'string' ? taskState.text : text,
      instruct: typeof taskState?.instruct === 'string' ? taskState.instruct : instruct,
    }

    await saveDesignedVoice(previewBlobRef.current, snapshot, selectedTask.taskId)
  }

  const selectedStatusText = selectedTask
    ? getStatusText(
        selectedTask.status,
        selectedTask.modalStatus ?? null,
        selectedTask.providerStatus ?? null,
      )
    : null
  const activeDesignCount = designTasks.filter(
    (task) => task.status === 'pending' || task.status === 'processing',
  ).length

  return (
    <GridArtSurface sweepNonce={sweepNonce} contentClassName='space-y-8'>
      <div className='flex items-center justify-center gap-2'>
        <h2 className='text-balance text-center text-2xl font-pixel font-medium uppercase tracking-[2px] md:text-3xl'>
          Design
        </h2>
        <InfoTip align='end' label='Design tips'>
          <div className='space-y-2'>
            <div>No reference audio needed. Describe the voice you want.</div>
            <div>
              Preview runs as a background job. Save the completed preview you want to keep in your
              voice library.
            </div>
            <div>Preview text and description are limited to 500 chars.</div>
          </div>
        </InfoTip>
      </div>

      {error ? <Message variant='error'>{error}</Message> : null}
      {success ? <Message variant='success'>{success}</Message> : null}

      <form
        className='space-y-6'
        onSubmit={(e) => {
          e.preventDefault()
          void onPreview()
        }}
      >
        <div>
          <Label htmlFor='design-voice-name'>Voice Name</Label>
          <Input
            id='design-voice-name'
            name='name'
            autoComplete='off'
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor='design-instruct'>Voice Description</Label>
          <Textarea
            id='design-instruct'
            name='instruct'
            value={instruct}
            onChange={(e) => setInstruct(e.target.value)}
            placeholder='Describe the voice (tone, pacing, timbre, vibe)...'
          />
          <div className='mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-faint'>
            <span>{instruct.length}/500</span>
            <div className='flex flex-wrap gap-2'>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.title}
                  type='button'
                  className='border border-border bg-background px-2 py-1 text-[11px] uppercase tracking-wide hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
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
          <Label htmlFor='design-text'>Preview Text</Label>
          <Textarea
            id='design-text'
            name='text'
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='A short line to preview the voice...'
          />
          <div className='mt-2 text-xs text-faint'>{text.length}/500</div>
        </div>

        <div>
          <Label htmlFor='design-language'>Language</Label>
          <Select
            id='design-language'
            name='language'
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

        <div className='grid gap-3 sm:grid-cols-2'>
          <Button type='submit' block disabled={isSubmittingPreview}>
            {isSubmittingPreview ? 'Starting preview...' : 'Generate Preview'}
          </Button>
          <Button
            type='button'
            variant='secondary'
            block
            onClick={() => {
              if (!savedVoiceId) return
              void navigate(`/generate?voice=${encodeURIComponent(savedVoiceId)}`)
            }}
            disabled={!savedVoiceId || isSavingVoice}
          >
            Use Voice
          </Button>
        </div>
      </form>

      {selectedTask ? (
        <div className='space-y-4 border border-border bg-subtle p-4 shadow-elevated'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <div className='text-sm font-medium uppercase tracking-wide'>Selected Preview</div>
              <div className='mt-1 text-sm text-muted-foreground'>
                {selectedStatusText ?? 'Processing...'}
              </div>
            </div>
            <div className='text-xs text-faint'>
              {selectedTask.status === 'pending' || selectedTask.status === 'processing'
                ? formatElapsed(selectedTask.startedAt)
                : selectedTask.status === 'completed'
                  ? 'Ready to save'
                  : 'Not usable'}
            </div>
          </div>
          {selectedTask.subtitle ? (
            <div className='text-xs text-faint'>{selectedTask.subtitle}</div>
          ) : null}
          {activeDesignCount > 1 ? (
            <div className='text-xs text-faint'>
              {activeDesignCount} design previews currently running.
            </div>
          ) : null}
        </div>
      ) : null}

      {designTasks.length > 0 ? (
        <div className='space-y-3'>
          <div className='text-sm font-medium uppercase tracking-wide'>Tracked Previews</div>
          <div className='space-y-2'>
            {designTasks.map((task) => (
              <TaskSummaryRow
                key={task.taskId}
                task={task}
                selected={task.taskId === selectedTaskId}
                statusText={getStatusText(
                  task.status,
                  task.modalStatus ?? null,
                  task.providerStatus ?? null,
                )}
                onSelect={() => setSelectedTaskId(task.taskId)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {previewUrl ? (
        <div className='space-y-4 border border-border bg-background p-4 shadow-elevated'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <div className='text-sm font-medium uppercase tracking-wide'>Preview</div>
              {savedVoiceName ? (
                <div className='mt-1 text-xs text-faint'>{savedVoiceName}</div>
              ) : null}
            </div>
            <Button
              type='button'
              variant='secondary'
              onClick={() => void onSaveSelectedPreview()}
              disabled={
                !selectedTask ||
                selectedTask.status !== 'completed' ||
                !previewBlobRef.current ||
                isSavingVoice
              }
            >
              {isSavingVoice ? 'Saving voice...' : 'Save This Preview'}
            </Button>
          </div>
          <WaveformPlayer audioUrl={previewUrl} audioBlob={previewBlobRef.current ?? undefined} />
        </div>
      ) : null}
    </GridArtSurface>
  )
}
