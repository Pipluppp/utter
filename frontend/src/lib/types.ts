export type TaskStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type TaskType = 'generate' | 'design' | 'clone'

export type StoredTask = {
  taskId: string | null
  type: TaskType
  originPage: string
  description: string
  formState: unknown | null
  startedAt: number
  status: TaskStatus
  dismissed: boolean
  modalStatus?: string | null
  result?: unknown
  error?: string | null
  completedAt?: number
}

export type BackendTask = {
  id: string
  type: string
  status: TaskStatus
  result?: unknown
  error?: string | null
  modal_status?: string | null
  modal_elapsed_seconds?: number | null
  modal_poll_count?: number | null
}

export type Voice = {
  id: string
  name: string
  reference_transcript: string | null
  language: string
  source: 'uploaded' | 'designed'
  description: string | null
  created_at: string | null
}

export type VoicesResponse = {
  voices: Voice[]
  pagination: {
    page: number
    per_page: number
    total: number
    pages: number
  }
}

export type GenerateResponse = {
  task_id: string
  status: TaskStatus
  is_long_running: boolean
  estimated_duration_minutes: number
  generation_id: string
}

export type GenerationStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type Generation = {
  id: string
  voice_id: string
  voice_name: string | null
  text: string
  audio_path: string
  duration_seconds: number | null
  language: string
  status: GenerationStatus
  generation_time_seconds: number | null
  error_message: string | null
  created_at: string | null
}

export type GenerationsResponse = {
  generations: Generation[]
  pagination: {
    page: number
    per_page: number
    total: number
    pages: number
  }
}

export type LanguagesResponse = {
  languages: string[]
  default: string
  provider: string
  transcription?: {
    enabled: boolean
    provider: string
    model: string
  }
}

export type CloneResponse = { id: string; name: string }

export type DesignPreviewResponse = { task_id: string; status: TaskStatus }

export type DesignSaveResponse = {
  id: string
  name: string
  description: string
  language: string
  source: 'designed'
  preview_url: string
}

export type RegenerateResponse = {
  voice_id: string
  text: string
  language: string
  redirect_url: string
}

export type CreditRateCardItem = {
  action: string
  cost: string
  note: string
}

export type CreditLedgerEvent = {
  id: number
  event_kind: 'debit' | 'refund' | 'grant' | 'adjustment'
  operation: string
  amount: number
  signed_amount: number
  balance_after: number
  reference_type: string
  reference_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type CreditsUsageResponse = {
  credit_unit: string
  window_days: number
  plan: {
    tier: string
    monthly_credits: number
  }
  balance: number
  usage: {
    debited: number
    credited: number
    net: number
  }
  rate_card: CreditRateCardItem[]
  events: CreditLedgerEvent[]
}
