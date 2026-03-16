// API contract types — mirrored from frontend/src/lib/types.ts.
// Keep in sync when backend contracts change.

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type TaskType = 'generate' | 'design_preview' | 'clone';

export type StoredTask = {
  taskId: string;
  type: TaskType;
  originPage: string;
  description: string;
  formState: unknown | null;
  startedAt: number;
  status: TaskStatus;
  dismissed: boolean;
  modalStatus?: string | null;
  providerStatus?: string | null;
  result?: unknown;
  error?: string | null;
  completedAt?: number;
  createdAt?: string | null;
  title?: string | null;
  subtitle?: string | null;
  language?: string | null;
  voiceName?: string | null;
  textPreview?: string | null;
  estimatedDurationMinutes?: number | null;
};

export type BackendTask = {
  id: string;
  type: TaskType | string;
  status: TaskStatus;
  result?: unknown;
  error?: string | null;
  provider?: 'modal' | 'qwen' | string;
  provider_status?: string | null;
  modal_status?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  title?: string | null;
  subtitle?: string | null;
  language?: string | null;
  voice_name?: string | null;
  text_preview?: string | null;
  estimated_duration_minutes?: number | null;
  origin_page?: string | null;
  supports_cancel?: boolean;
};

export type Voice = {
  id: string;
  name: string;
  reference_transcript: string | null;
  language: string;
  source: 'uploaded' | 'designed';
  description: string | null;
  created_at: string | null;
  tts_provider?: 'modal' | 'qwen' | string;
};

export type VoicesResponse = {
  voices: Voice[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
};

export type GenerateResponse = {
  task_id: string;
  status: TaskStatus;
  is_long_running: boolean;
  estimated_duration_minutes: number;
  generation_id: string;
};

export type Generation = {
  id: string;
  voice_id: string;
  voice_name: string | null;
  text: string;
  audio_path: string;
  duration_seconds: number | null;
  language: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  generation_time_seconds: number | null;
  error_message: string | null;
  created_at: string | null;
};

export type GenerationsResponse = {
  generations: Generation[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
};

export type LanguagesResponse = {
  languages: string[];
  default: string;
  provider: 'modal' | 'qwen' | string;
  capabilities?: {
    supports_generate: boolean;
    supports_generate_stream: boolean;
    default_generate_mode: 'task';
    allow_generate_mode_toggle: boolean;
    max_text_chars: number;
  };
  transcription?: {
    enabled: boolean;
    provider: string;
    model: string;
  };
};

export type CloneResponse = { id: string; name: string };

export type RegenerateResponse = {
  voice_id: string;
  text: string;
  language: string;
  redirect_url: string;
};

export type DesignPreviewResponse = { task_id: string; status: TaskStatus };

export type DesignSaveResponse = {
  id: string;
  name: string;
  description: string;
  language: string;
  source: 'designed';
  preview_url: string;
};

export type MeResponse = {
  signed_in: boolean;
  user: { id: string } | null;
  profile: {
    id: string;
    handle: string | null;
    display_name: string | null;
    avatar_url: string | null;
    subscription_tier: string;
    credits_remaining: number;
    created_at: string;
    updated_at: string;
  } | null;
};

export type CreditsUsageResponse = {
  credit_unit: string;
  window_days: number;
  plan: { tier: string };
  balance: number;
  trials: {
    design_remaining: number;
    clone_remaining: number;
  };
  usage: {
    debited: number;
    credited: number;
    net: number;
  };
  rate_card: { action: string; cost: string; note: string }[];
  events: {
    id: number;
    event_kind: 'debit' | 'refund' | 'grant' | 'adjustment';
    operation: string;
    amount: number;
    signed_amount: number;
    balance_after: number;
    reference_type: string;
    reference_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }[];
};
