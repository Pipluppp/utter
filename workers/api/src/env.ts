export interface WorkerEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_PUBLIC_URL?: string;
  CORS_ALLOWED_ORIGIN: string;
  STORAGE_SIGNING_SECRET?: string;

  // Provider/runtime envs
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_BASE_URL?: string;
  DASHSCOPE_REGION?: "intl" | "cn";
  QWEN_VC_TARGET_MODEL?: string;
  QWEN_VD_TARGET_MODEL?: string;
  QWEN_MAX_TEXT_CHARS?: string;
  VOICE_DESIGN_ENABLED?: "true" | "false";
  QWEN_ASR_MODEL?: string;
  QWEN_ASR_BASE_URL?: string;

  TRANSCRIPTION_ENABLED?: "true" | "false";

  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_PACK_30K?: string;
  STRIPE_PRICE_PACK_120K?: string;

  RATE_LIMIT_WINDOW_SECONDS?: string;
  RATE_LIMIT_TIER1_USER_LIMIT?: string;
  RATE_LIMIT_TIER1_IP_LIMIT?: string;
  RATE_LIMIT_TIER1_WINDOW_SECONDS?: string;
  RATE_LIMIT_TIER2_USER_LIMIT?: string;
  RATE_LIMIT_TIER2_IP_LIMIT?: string;
  RATE_LIMIT_TIER2_WINDOW_SECONDS?: string;
  RATE_LIMIT_TIER3_IP_LIMIT?: string;
  RATE_LIMIT_TIER3_WINDOW_SECONDS?: string;
  QUEUE_BILLING_ENABLED?: "true" | "false";

  // Storage bindings.
  R2_REFERENCES?: R2Bucket;
  R2_GENERATIONS?: R2Bucket;

  // Async queue binding.
  TTS_QUEUE?: Queue;
}

export type AppEnv = {
  Bindings: WorkerEnv;
};

export function getAllowedOrigins(env: WorkerEnv): string[] {
  const configured = (env.CORS_ALLOWED_ORIGIN || "*")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return configured.length > 0 ? configured : ["*"];
}
