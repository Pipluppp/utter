import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useAuthState } from "../../app/auth/AuthStateProvider";
import { getCreditPackById } from "../../content/plans";
import { apiJson } from "../../lib/api";
import { getAuthSession, signOut as signOutRequest } from "../../lib/auth";
import type {
  CreditLedgerEvent,
  CreditsUsageResponse,
  MeResponse,
  ProfileRecord,
} from "../../lib/types";
import { accountQueries } from "./queries";

const creditsFormat = new Intl.NumberFormat();
const usdFormat = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export type AccountActivityCategory = "purchase" | "usage";

export type AccountActivity = {
  amountLabel: string;
  balanceLabel: string;
  category: AccountActivityCategory;
  createdAt: string;
  createdLabel: string;
  detail: string;
  id: number;
  raw: CreditLedgerEvent;
  title: string;
};

export type AccountData = {
  activity: AccountActivity[];
  authEmail: string;
  credits: CreditsUsageResponse | null;
  error: string | null;
  identities: Array<{ provider: string }>;
  loading: boolean;
  me: MeResponse | null;
  profile: ProfileRecord | null;
  refresh: (options?: { background?: boolean }) => Promise<void>;
  refreshing: boolean;
  signOut: () => Promise<void>;
};

async function loadAuthSessionInfo() {
  const session = await getAuthSession();
  return {
    email: session.user?.email ?? "",
    identities: session.identities ?? [],
  };
}

export async function loadAccountSnapshot() {
  const [me, credits, authSession] = await Promise.all([
    apiJson<MeResponse>("/api/me"),
    apiJson<CreditsUsageResponse>("/api/credits/usage?window_days=90"),
    loadAuthSessionInfo(),
  ]);

  return { me, credits, authEmail: authSession.email, identities: authSession.identities };
}

function packFromEvent(event: CreditLedgerEvent) {
  const packId = typeof event.metadata.pack_id === "string" ? event.metadata.pack_id : null;
  return packId ? getCreditPackById(packId) : null;
}

function categoryForEvent(event: CreditLedgerEvent): AccountActivityCategory {
  if (event.operation === "paid_purchase" || event.operation === "paid_reversal") {
    return "purchase";
  }

  return "usage";
}

function eventTitle(event: CreditLedgerEvent) {
  const pack = packFromEvent(event);

  switch (event.operation) {
    case "generate":
      return "Generated speech";
    case "design_preview":
      return "Used design preview";
    case "clone":
      return "Finalized voice clone";
    case "monthly_allocation":
      return "Received starting credits";
    case "manual_adjustment":
      return event.signed_amount >= 0 ? "Credits added" : "Credits removed";
    case "paid_purchase":
      return pack ? `Bought ${pack.name}` : "Bought credits";
    case "paid_reversal":
      return "Purchase reversed";
    default:
      return "Balance updated";
  }
}

function signedCreditsLabel(event: CreditLedgerEvent) {
  if (event.signed_amount === 0) {
    return "0 credits";
  }

  const prefix = event.signed_amount > 0 ? "+" : "-";
  return `${prefix}${creditsFormat.format(Math.abs(event.signed_amount))} credits`;
}

function eventDetail(event: CreditLedgerEvent) {
  const pack = packFromEvent(event);
  const credits = `${creditsFormat.format(event.amount)} credits`;

  switch (event.operation) {
    case "generate":
      return `${credits} used from submitted text length.`;
    case "design_preview":
      return `${credits} used for voice design preview.`;
    case "clone":
      return `${credits} used to finalize a voice clone.`;
    case "monthly_allocation":
      return `${credits} added to your starting balance.`;
    case "manual_adjustment":
      return event.signed_amount >= 0
        ? `${credits} added after a manual adjustment.`
        : `${credits} removed after a manual adjustment.`;
    case "paid_purchase":
      return pack
        ? `${usdFormat.format(pack.priceUsd)} prepaid pack with ${credits}.`
        : `${credits} added from a prepaid purchase.`;
    case "paid_reversal":
      return `${credits} removed from a reversed purchase.`;
    default:
      return `Balance changed by ${signedCreditsLabel(event)}.`;
  }
}

export function formatCredits(value: number) {
  return creditsFormat.format(value);
}

export function formatUsd(value: number) {
  return usdFormat.format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Unavailable";
  return dateFormat.format(new Date(value));
}

export function formatDateTime(value: string) {
  return dateTimeFormat.format(new Date(value));
}

export function buildAccountActivity(event: CreditLedgerEvent): AccountActivity {
  return {
    amountLabel: signedCreditsLabel(event),
    balanceLabel: `${formatCredits(event.balance_after)} credits left`,
    category: categoryForEvent(event),
    createdAt: event.created_at,
    createdLabel: formatDateTime(event.created_at),
    detail: eventDetail(event),
    id: event.id,
    raw: event,
    title: eventTitle(event),
  };
}

export function useAccountData(): AccountData {
  const authState = useAuthState();
  const queryClient = useQueryClient();
  const query = useQuery(accountQueries.snapshot());

  const activity = useMemo(
    () => (query.data?.credits?.events ?? []).map(buildAccountActivity),
    [query.data],
  );

  const signOut = useCallback(async () => {
    await signOutRequest();
    queryClient.removeQueries({ queryKey: accountQueries.all() });
    await authState.refresh();
  }, [authState, queryClient]);

  return {
    activity,
    authEmail: query.data?.authEmail ?? "",
    credits: query.data?.credits ?? null,
    error: query.error instanceof Error ? query.error.message : null,
    identities: query.data?.identities ?? [],
    loading: query.isPending,
    me: query.data?.me ?? null,
    profile: query.data?.me?.profile ?? null,
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: accountQueries.all() });
    },
    refreshing: query.isFetching && !query.isPending,
    signOut,
  };
}
