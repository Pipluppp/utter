import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const CREDIT_UNIT_LABEL = "1 credit = 1 character";

export const MONTHLY_CREDITS_BY_TIER: Record<string, number> = {
  free: 100,
  creator: 15000,
  pro: 45000,
};

export type CreditOperation =
  | "generate"
  | "design_preview"
  | "clone"
  | "monthly_allocation"
  | "manual_adjustment";

export type CreditEventKind = "debit" | "refund" | "grant" | "adjustment";

export type CreditApplyEventParams = {
  userId: string;
  eventKind: CreditEventKind;
  operation: CreditOperation;
  amount: number;
  referenceType: "task" | "generation" | "voice" | "profile" | "system";
  referenceId?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

export type CreditApplyEventRow = {
  applied: boolean;
  duplicate: boolean;
  insufficient: boolean;
  balance_remaining: number;
  ledger_id: number | null;
  signed_amount: number;
  event_kind: CreditEventKind;
};

export type CreditRateCardRow = {
  action: string;
  cost: string;
  note: string;
};

export const CREDIT_RATE_CARD: CreditRateCardRow[] = [
  {
    action: "Generate speech",
    cost: "1 credit per character",
    note: "Charged from input text length.",
  },
  {
    action: "Voice design preview",
    cost: "text chars + description chars",
    note: "Charged from preview text plus voice description.",
  },
  {
    action: "Voice clone",
    cost: "transcript chars",
    note: "Charged from submitted transcript length.",
  },
];

export function formatInsufficientCreditsDetail(
  needed: number,
  balance: number,
): string {
  return `Insufficient credits: need ${needed.toLocaleString()}, have ${balance.toLocaleString()}. 1 credit = 1 character.`;
}

export function creditsForGenerateText(text: string): number {
  return Math.max(1, text.length);
}

export function creditsForDesignPreview(
  text: string,
  instruct: string,
): number {
  return Math.max(1, text.length + instruct.length);
}

export function creditsForCloneTranscript(transcript: string): number {
  return Math.max(1, transcript.length);
}

export function monthlyCreditsForTier(tier: string): number {
  return MONTHLY_CREDITS_BY_TIER[tier] ?? MONTHLY_CREDITS_BY_TIER.free;
}

function asCreditApplyRow(data: unknown): CreditApplyEventRow | null {
  if (Array.isArray(data)) {
    return (data[0] ?? null) as CreditApplyEventRow | null;
  }
  if (data && typeof data === "object") {
    return data as CreditApplyEventRow;
  }
  return null;
}

export async function applyCreditEvent(
  admin: SupabaseClient,
  params: CreditApplyEventParams,
): Promise<
  { row: CreditApplyEventRow | null; error: { message?: string } | null }
> {
  const { data, error } = await admin.rpc("credit_apply_event", {
    p_user_id: params.userId,
    p_event_kind: params.eventKind,
    p_operation: params.operation,
    p_amount: params.amount,
    p_reference_type: params.referenceType,
    p_reference_id: params.referenceId ?? null,
    p_idempotency_key: params.idempotencyKey,
    p_metadata: params.metadata ?? {},
  });

  if (error) {
    return { row: null, error: { message: error.message } };
  }

  return { row: asCreditApplyRow(data), error: null };
}
