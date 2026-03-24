// Billing provider: Stripe. Expected to migrate to Polar.sh.
// Only this file + the billing adapter need changes when switching providers.

/**
 * Stripe-specific billing tests: webhook signature, idempotency, checkout auth guard.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createUserWithBalance } from "./_helpers/factories.ts";
import {
    apiPublicFetch,
    deleteTestUser,
    SERVICE_ROLE_KEY,
    SUPABASE_URL,
    type TestUser,
} from "./_helpers/setup.ts";

const STRIPE_WEBHOOK_SECRET = "whsec_test_utter_local";
const STRIPE_TEST_PRICE_PACK_30K = "price_test_pack_30k";

let userA: TestUser;

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

function randomEmail(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}@test.local`;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function stripeSignatureHeader(payload: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(STRIPE_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload),
  );

  return `t=${timestamp},v1=${toHex(signature)}`;
}

describe("billing – Stripe provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    userA = await createUserWithBalance({
      email: randomEmail("billing_stripe_a"),
      password: "password123",
      credits: 0,
      designTrials: 2,
      cloneTrials: 2,
    });
  });

  afterAll(async () => {
    await deleteTestUser(userA.userId);
  });

  it("POST /billing/checkout requires auth", async () => {
    const res = await apiPublicFetch("/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack_id: "pack_30k" }),
    });

    expect(res.status).toBe(401);
    await res.body?.cancel();
  });

  it("POST /webhooks/stripe rejects invalid signature", async () => {
    const payload = JSON.stringify({
      id: `evt_${crypto.randomUUID().replaceAll("-", "")}`,
      type: "checkout.session.completed",
    });

    const res = await apiPublicFetch("/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "t=1,v1=bad",
      },
      body: payload,
    });

    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("POST /webhooks/stripe is idempotent on duplicate event delivery", async () => {
    const eventId = `evt_${crypto.randomUUID().replaceAll("-", "")}`;
    const payload = JSON.stringify({
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_${crypto.randomUUID().replaceAll("-", "")}`,
          metadata: {
            user_id: userA.userId,
            pack_id: "pack_30k",
          },
          line_items: {
            data: [
              {
                price: {
                  id: STRIPE_TEST_PRICE_PACK_30K,
                },
              },
            ],
          },
        },
      },
    });

    const signatureHeader = await stripeSignatureHeader(payload);

    const first = await apiPublicFetch("/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signatureHeader,
      },
      body: payload,
    });
    expect(first.status).toBe(200);
    await first.body?.cancel();

    const second = await apiPublicFetch("/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signatureHeader,
      },
      body: payload,
    });
    expect(second.status).toBe(200);
    await second.body?.cancel();

    const admin = getAdminClient();
    const profile = await admin
      .from("profiles")
      .select("credits_remaining")
      .eq("id", userA.userId)
      .single();

    expect(profile.error).toBe(null);
    expect(profile.data?.credits_remaining).toBe(30000);

    const ledger = await admin
      .from("credit_ledger")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userA.userId)
      .eq("operation", "paid_purchase");

    expect(ledger.error).toBe(null);
    expect(ledger.count).toBe(1);
  });
});
