import { Hono } from "npm:hono@4";

import { requireUser } from "../../_shared/auth.ts";
import {
  applyCreditEvent,
  prepaidPackFromId,
  prepaidPackFromStripePriceId,
  stripePriceIdForPack,
} from "../../_shared/credits.ts";
import { createAdminClient } from "../../_shared/supabase.ts";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

type StripeEvent = {
  id?: unknown;
  type?: unknown;
  data?: {
    object?: unknown;
  };
};

type BillingEventRow = {
  status: string;
};

function jsonDetail(detail: string, status: number) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(value);
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "23505";
}

function readRequiredEnv(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value || null;
}

function resolveRequestOrigin(req: Request): string {
  const requestOrigin = req.headers.get("origin")?.trim();
  if (requestOrigin) {
    try {
      return new URL(requestOrigin).origin;
    } catch {
      // Fall back to forwarded/request URL derivation below.
    }
  }

  const proto = req.headers.get("x-forwarded-proto") ??
    new URL(req.url).protocol.replace(":", "");
  const forwardedHost = req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    new URL(req.url).host;
  const forwardedPort = req.headers.get("x-forwarded-port");
  const host = !forwardedHost.includes(":") && forwardedPort
    ? `${forwardedHost}:${forwardedPort}`
    : forwardedHost;
  return `${proto}://${host}`;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function secureCompareHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function parseStripeSignature(headerValue: string): {
  timestamp: number;
  signatures: string[];
} | null {
  const parts = headerValue.split(",");
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, rawValue] = part.split("=", 2);
    if (!key || !rawValue) continue;
    const value = rawValue.trim();
    if (key.trim() === "t") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        timestamp = Math.floor(parsed);
      }
      continue;
    }
    if (key.trim() === "v1" && value) signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

async function computeStripeHmac(
  secret: string,
  payload: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return toHex(signature);
}

async function verifyStripeSignature(params: {
  payload: string;
  signatureHeader: string;
  webhookSecret: string;
}): Promise<boolean> {
  const parsed = parseStripeSignature(params.signatureHeader);
  if (!parsed) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    Math.abs(nowSeconds - parsed.timestamp) >
      STRIPE_SIGNATURE_TOLERANCE_SECONDS
  ) {
    return false;
  }

  const signedPayload = `${parsed.timestamp}.${params.payload}`;
  const expected = await computeStripeHmac(params.webhookSecret, signedPayload);
  return parsed.signatures.some((candidate) =>
    secureCompareHex(candidate, expected)
  );
}

async function stripeRequestJson<T>(params: {
  stripeSecretKey: string;
  method: "GET" | "POST";
  path: string;
  body?: URLSearchParams;
  query?: URLSearchParams;
}): Promise<T> {
  const url = new URL(`${STRIPE_API_BASE}${params.path}`);
  if (params.query) url.search = params.query.toString();

  const res = await fetch(url.toString(), {
    method: params.method,
    headers: {
      Authorization: `Bearer ${params.stripeSecretKey}`,
      ...(params.method === "POST"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: params.method === "POST" ? params.body?.toString() : undefined,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Stripe API ${params.path} failed (${res.status}): ${detail}`,
    );
  }

  return await res.json() as T;
}

function extractStripePriceIdFromSession(
  sessionObject: unknown,
): string | null {
  if (!sessionObject || typeof sessionObject !== "object") return null;
  const record = sessionObject as Record<string, unknown>;
  const lineItems = record.line_items;
  if (!lineItems || typeof lineItems !== "object") return null;

  const data = (lineItems as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) return null;

  const first = data[0];
  if (!first || typeof first !== "object") return null;
  const price = (first as Record<string, unknown>).price;

  if (typeof price === "string") {
    return normalizeString(price);
  }

  if (price && typeof price === "object") {
    return normalizeString((price as { id?: unknown }).id);
  }

  return null;
}

async function loadCheckoutPriceId(params: {
  stripeSecretKey: string;
  sessionObject: unknown;
}): Promise<string | null> {
  const fromEvent = extractStripePriceIdFromSession(params.sessionObject);
  if (fromEvent) return fromEvent;

  if (!params.sessionObject || typeof params.sessionObject !== "object") {
    return null;
  }

  const sessionId = normalizeString(
    (params.sessionObject as { id?: unknown }).id,
  );
  if (!sessionId) return null;

  const response = await stripeRequestJson<{
    data?: Array<{ price?: string | { id?: string } }>;
  }>({
    stripeSecretKey: params.stripeSecretKey,
    method: "GET",
    path: `/checkout/sessions/${sessionId}/line_items`,
    query: new URLSearchParams({
      limit: "1",
      "expand[]": "data.price",
    }),
  });

  const first = response.data?.[0];
  if (!first) return null;

  if (typeof first.price === "string") {
    return normalizeString(first.price);
  }

  if (first.price && typeof first.price === "object") {
    return normalizeString((first.price as { id?: unknown }).id);
  }

  return null;
}

export const billingRoutes = new Hono();

billingRoutes.post("/billing/checkout", async (c) => {
  let userId: string;
  try {
    const { user } = await requireUser(c.req.raw);
    userId = user.id;
  } catch (e) {
    if (e instanceof Response) return e;
    return jsonDetail("Unauthorized", 401);
  }

  const body = (await c.req.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!body) return jsonDetail("Invalid JSON body", 400);

  const packId = normalizeString(body.pack_id);
  if (!packId) return jsonDetail("pack_id is required.", 400);

  const pack = prepaidPackFromId(packId);
  if (!pack) return jsonDetail("Invalid pack_id.", 400);

  const stripeSecretKey = readRequiredEnv("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) return jsonDetail("Billing is not configured.", 500);

  const priceId = stripePriceIdForPack(pack.id);
  if (!priceId) {
    return jsonDetail("Billing pack pricing is not configured.", 500);
  }

  const origin = resolveRequestOrigin(c.req.raw);
  const form = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/account/billing?checkout=success`,
    cancel_url: `${origin}/account/billing?checkout=cancel`,
    client_reference_id: userId,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    "metadata[user_id]": userId,
    "metadata[pack_id]": pack.id,
  });

  let session;
  try {
    session = await stripeRequestJson<{ url?: string }>({
      stripeSecretKey,
      method: "POST",
      path: "/checkout/sessions",
      body: form,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe checkout failed.";
    return jsonDetail(message, 502);
  }

  if (!session.url) {
    return jsonDetail("Stripe checkout URL missing from response.", 502);
  }

  return c.json({ url: session.url });
});

billingRoutes.post("/webhooks/stripe", async (c) => {
  const stripeSecretKey = readRequiredEnv("STRIPE_SECRET_KEY");
  const webhookSecret = readRequiredEnv("STRIPE_WEBHOOK_SECRET");
  if (!stripeSecretKey || !webhookSecret) {
    return jsonDetail("Billing webhook is not configured.", 500);
  }

  const signature = c.req.raw.headers.get("stripe-signature")?.trim() ?? "";
  if (!signature) return jsonDetail("Missing Stripe signature.", 400);

  const payload = await c.req.raw.text();
  const validSignature = await verifyStripeSignature({
    payload,
    signatureHeader: signature,
    webhookSecret,
  });

  if (!validSignature) {
    return jsonDetail("Invalid Stripe signature.", 400);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return jsonDetail("Invalid Stripe event payload.", 400);
  }
  const providerEventId = normalizeString(event.id);
  const eventType = normalizeString(event.type);

  if (!providerEventId || !eventType) {
    return jsonDetail("Invalid Stripe event payload.", 400);
  }

  const admin = createAdminClient();

  const metadata = event.data?.object && typeof event.data.object === "object"
    ? (event.data.object as { metadata?: unknown }).metadata
    : null;
  const eventMetadata = metadata && typeof metadata === "object"
    ? metadata as Record<string, unknown>
    : {};
  const eventUserIdCandidate = normalizeString(eventMetadata.user_id);
  const eventUserId = eventUserIdCandidate && isUuid(eventUserIdCandidate)
    ? eventUserIdCandidate
    : null;

  const insertReceived = await admin
    .from("billing_events")
    .insert({
      provider: "stripe",
      provider_event_id: providerEventId,
      event_type: eventType,
      user_id: eventUserId,
      status: "received",
      payload: event as unknown as Record<string, unknown>,
    })
    .select("id, status, ledger_id")
    .single();

  if (insertReceived.error) {
    if (!isUniqueViolation(insertReceived.error)) {
      return jsonDetail("Failed to persist billing event.", 500);
    }

    const existing = await admin
      .from("billing_events")
      .select("id, status, ledger_id")
      .eq("provider_event_id", providerEventId)
      .maybeSingle();

    if (existing.error || !existing.data) {
      return jsonDetail("Failed to load existing billing event.", 500);
    }

    const billingEvent = existing.data as BillingEventRow;

    if (
      billingEvent.status === "processed" ||
      billingEvent.status === "ignored"
    ) {
      return c.json({ received: true, duplicate: true });
    }
  }

  if (eventType !== "checkout.session.completed") {
    const ignored = await admin
      .from("billing_events")
      .update({
        status: "ignored",
        processed_at: new Date().toISOString(),
        error_detail: null,
      })
      .eq("provider_event_id", providerEventId);

    if (ignored.error) {
      return jsonDetail("Failed to mark billing event ignored.", 500);
    }

    return c.json({ received: true, ignored: true });
  }

  try {
    const sessionObject = event.data?.object;
    const priceId = await loadCheckoutPriceId({
      stripeSecretKey,
      sessionObject,
    });

    if (!priceId) {
      throw new Error(
        "Unable to resolve Stripe price_id from checkout session.",
      );
    }

    const pack = prepaidPackFromStripePriceId(priceId);
    if (!pack) {
      throw new Error(`Unmapped Stripe price_id: ${priceId}`);
    }

    if (!eventUserId) {
      throw new Error(
        "Missing or invalid metadata.user_id in checkout session.",
      );
    }

    const sessionId = sessionObject && typeof sessionObject === "object"
      ? normalizeString((sessionObject as { id?: unknown }).id)
      : null;

    const grant = await applyCreditEvent(admin, {
      userId: eventUserId,
      eventKind: "grant",
      operation: "paid_purchase",
      amount: pack.credits,
      referenceType: "billing",
      referenceId: null,
      idempotencyKey: `stripe:event:${providerEventId}:grant`,
      metadata: {
        provider: "stripe",
        provider_event_id: providerEventId,
        checkout_session_id: sessionId,
        price_id: priceId,
        pack_id: pack.id,
        pack_credits: pack.credits,
      },
    });

    if (grant.error || !grant.row) {
      throw new Error("Failed to grant credits from webhook event.");
    }

    const processed = await admin
      .from("billing_events")
      .update({
        user_id: eventUserId,
        status: "processed",
        credits_granted: pack.credits,
        ledger_id: grant.row.ledger_id,
        error_detail: null,
        processed_at: new Date().toISOString(),
      })
      .eq("provider_event_id", providerEventId);

    if (processed.error) {
      throw new Error("Failed to mark billing event processed.");
    }

    return c.json({ received: true, processed: true });
  } catch (e) {
    const message = e instanceof Error
      ? e.message
      : "Webhook processing failed.";
    await admin
      .from("billing_events")
      .update({
        status: "failed",
        error_detail: message,
        processed_at: new Date().toISOString(),
      })
      .eq("provider_event_id", providerEventId);

    return jsonDetail(message, 500);
  }
});
