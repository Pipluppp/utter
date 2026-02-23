import { Hono } from "npm:hono@4";

import { requireUser } from "../../_shared/auth.ts";
import {
  CREDIT_RATE_CARD,
  CREDIT_UNIT_LABEL,
  monthlyCreditsForTier,
} from "../../_shared/credits.ts";
import { createAdminClient } from "../../_shared/supabase.ts";

type UsageTotalsRow = {
  total_debited: number;
  total_credited: number;
  net_signed: number;
};

function jsonDetail(detail: string, status: number) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseWindowDays(value: string | null): number {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return 30;
  const normalized = Math.floor(parsed);
  if (normalized < 1) return 1;
  if (normalized > 365) return 365;
  return normalized;
}

function asUsageTotalsRow(data: unknown): UsageTotalsRow | null {
  if (Array.isArray(data)) return (data[0] ?? null) as UsageTotalsRow | null;
  return (data ?? null) as UsageTotalsRow | null;
}

export const creditsRoutes = new Hono();

creditsRoutes.get("/credits/usage", async (c) => {
  let userId: string;
  try {
    const { user } = await requireUser(c.req.raw);
    userId = user.id;
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonDetail("Unauthorized", 401);
  }

  const windowDays = parseWindowDays(c.req.query("window_days") ?? null);
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
    .toISOString();

  const admin = createAdminClient();

  const [profileRes, totalsRes, eventsRes] = await Promise.all([
    admin
      .from("profiles")
      .select("subscription_tier, credits_remaining")
      .eq("id", userId)
      .single(),
    admin.rpc("credit_usage_window_totals", {
      p_user_id: userId,
      p_since: since,
    }),
    admin
      .from("credit_ledger")
      .select(
        "id, event_kind, operation, amount, signed_amount, balance_after, reference_type, reference_id, metadata, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(20),
  ]);

  let profile = profileRes.data as
    | { subscription_tier: string; credits_remaining: number }
    | null;
  if (profileRes.error || !profile) {
    const fallback = await admin
      .from("profiles")
      .upsert({ id: userId }, { onConflict: "id" })
      .select("subscription_tier, credits_remaining")
      .single();
    if (fallback.error || !fallback.data) {
      return jsonDetail("Failed to load profile credits.", 500);
    }
    profile = fallback.data as {
      subscription_tier: string;
      credits_remaining: number;
    };
  }

  if (totalsRes.error) {
    return jsonDetail("Failed to load credit usage totals.", 500);
  }

  if (eventsRes.error) {
    return jsonDetail("Failed to load credit events.", 500);
  }

  const tier = profile.subscription_tier;
  const totals = asUsageTotalsRow(totalsRes.data) ?? {
    total_debited: 0,
    total_credited: 0,
    net_signed: 0,
  };

  const events = (eventsRes.data ?? []).map((row) => ({
    id: Number((row as { id: number }).id),
    event_kind: (row as { event_kind: string }).event_kind,
    operation: (row as { operation: string }).operation,
    amount: Number((row as { amount: number }).amount),
    signed_amount: Number((row as { signed_amount: number }).signed_amount),
    balance_after: Number((row as { balance_after: number }).balance_after),
    reference_type: (row as { reference_type: string }).reference_type,
    reference_id: (row as { reference_id: string | null }).reference_id,
    metadata: (row as { metadata: Record<string, unknown> | null }).metadata ??
      {},
    created_at: (row as { created_at: string }).created_at,
  }));

  return c.json({
    credit_unit: CREDIT_UNIT_LABEL,
    window_days: windowDays,
    plan: {
      tier,
      monthly_credits: monthlyCreditsForTier(tier),
    },
    balance: Number(profile.credits_remaining),
    usage: {
      debited: Number(totals.total_debited ?? 0),
      credited: Number(totals.total_credited ?? 0),
      net: Number(totals.net_signed ?? 0),
    },
    rate_card: CREDIT_RATE_CARD,
    events,
  });
});
