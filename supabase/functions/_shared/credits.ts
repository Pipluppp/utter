import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const CREDIT_UNIT_LABEL = "1 credit = 1 character";

export const DESIGN_TRIAL_LIMIT = 2;
export const CLONE_TRIAL_LIMIT = 2;
export const DESIGN_PREVIEW_FLAT_CREDITS = 5000;
export const CLONE_FINALIZE_FLAT_CREDITS = 1000;

export type PrepaidPackId = "pack_150k" | "pack_500k";

export type PrepaidPack = {
  id: PrepaidPackId;
  name: string;
  priceUsd: number;
  credits: number;
  stripePriceEnv: "STRIPE_PRICE_PACK_150K" | "STRIPE_PRICE_PACK_500K";
};

export const PREPAID_PACKS: Record<PrepaidPackId, PrepaidPack> = {
  pack_150k: {
    id: "pack_150k",
    name: "150k credits",
    priceUsd: 10,
    credits: 150000,
    stripePriceEnv: "STRIPE_PRICE_PACK_150K",
  },
  pack_500k: {
    id: "pack_500k",
    name: "500k credits",
    priceUsd: 25,
    credits: 500000,
    stripePriceEnv: "STRIPE_PRICE_PACK_500K",
  },
};

export function prepaidPackFromId(packId: string): PrepaidPack | null {
  if (packId === "pack_150k" || packId === "pack_500k") {
    return PREPAID_PACKS[packId];
  }
  return null;
}

export function stripePriceIdForPack(packId: PrepaidPackId): string | null {
  const raw = Deno.env.get(PREPAID_PACKS[packId].stripePriceEnv)?.trim();
  return raw || null;
}

export function prepaidPackFromStripePriceId(
  priceId: string,
): PrepaidPack | null {
  const normalized = priceId.trim();
  if (!normalized) return null;

  for (const pack of Object.values(PREPAID_PACKS)) {
    const configuredPriceId = Deno.env.get(pack.stripePriceEnv)?.trim();
    if (configuredPriceId && configuredPriceId === normalized) {
      return pack;
    }
  }

  return null;
}

export type CreditOperation =
  | "generate"
  | "design_preview"
  | "clone"
  | "monthly_allocation"
  | "manual_adjustment"
  | "paid_purchase"
  | "paid_reversal";

export type CreditEventKind = "debit" | "refund" | "grant" | "adjustment";

export type CreditApplyEventParams = {
  userId: string;
  eventKind: CreditEventKind;
  operation: CreditOperation;
  amount: number;
  referenceType:
    | "task"
    | "generation"
    | "voice"
    | "profile"
    | "system"
    | "billing";
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
    cost: "First 2 attempts free, then 5,000 credits",
    note: "Flat price after free design trials are used.",
  },
  {
    action: "Voice clone",
    cost: "First 2 attempts free, then 1,000 credits",
    note: "Flat price after free clone trials are used.",
  },
];

export type TrialOperation = "design_preview" | "clone";

export type TrialOrDebitParams = {
  userId: string;
  operation: TrialOperation;
  debitAmount: number;
  referenceType: "task" | "voice";
  referenceId?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

export type TrialOrDebitRow = {
  used_trial: boolean;
  duplicate: boolean;
  insufficient: boolean;
  balance_remaining: number;
  ledger_id: number | null;
  trial_id: number | null;
};

export type TrialRestoreParams = {
  userId: string;
  operation: TrialOperation;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

export type TrialRestoreRow = {
  restored: boolean;
  already_restored: boolean;
  trial_id: number | null;
  trials_remaining: number | null;
};

export function formatInsufficientCreditsDetail(
  needed: number,
  balance: number,
): string {
  return `Insufficient credits: need ${needed.toLocaleString()}, have ${balance.toLocaleString()}. 1 credit = 1 character.`;
}

export function creditsForGenerateText(text: string): number {
  return Math.max(1, text.length);
}

export function creditsForDesignPreview(): number {
  return DESIGN_PREVIEW_FLAT_CREDITS;
}

export function creditsForCloneTranscript(): number {
  return CLONE_FINALIZE_FLAT_CREDITS;
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

function asTrialOrDebitRow(data: unknown): TrialOrDebitRow | null {
  if (Array.isArray(data)) {
    return (data[0] ?? null) as TrialOrDebitRow | null;
  }
  if (data && typeof data === "object") {
    return data as TrialOrDebitRow;
  }
  return null;
}

function asTrialRestoreRow(data: unknown): TrialRestoreRow | null {
  if (Array.isArray(data)) {
    return (data[0] ?? null) as TrialRestoreRow | null;
  }
  if (data && typeof data === "object") {
    return data as TrialRestoreRow;
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

export async function trialOrDebit(
  admin: SupabaseClient,
  params: TrialOrDebitParams,
): Promise<
  { row: TrialOrDebitRow | null; error: { message?: string } | null }
> {
  const { data, error } = await admin.rpc("trial_or_debit", {
    p_user_id: params.userId,
    p_operation: params.operation,
    p_debit_amount: params.debitAmount,
    p_reference_type: params.referenceType,
    p_reference_id: params.referenceId ?? null,
    p_idempotency_key: params.idempotencyKey,
    p_metadata: params.metadata ?? {},
  });

  if (error) {
    return { row: null, error: { message: error.message } };
  }

  return { row: asTrialOrDebitRow(data), error: null };
}

export async function trialRestore(
  admin: SupabaseClient,
  params: TrialRestoreParams,
): Promise<
  { row: TrialRestoreRow | null; error: { message?: string } | null }
> {
  const { data, error } = await admin.rpc("trial_restore", {
    p_user_id: params.userId,
    p_operation: params.operation,
    p_idempotency_key: params.idempotencyKey,
    p_metadata: params.metadata ?? {},
  });

  if (error) {
    return { row: null, error: { message: error.message } };
  }

  return { row: asTrialRestoreRow(data), error: null };
}
