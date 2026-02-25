import { assertEquals } from "@std/assert";

import {
  apiFetch,
  apiPublicFetch,
  createTestUser,
  deleteTestUser,
  SERVICE_ROLE_KEY,
  SUPABASE_URL,
  type TestUser,
} from "./_helpers/setup.ts";

const STRIPE_WEBHOOK_SECRET = "whsec_test_utter_local";
const STRIPE_TEST_PRICE_PACK_150K = "price_test_pack_150k";

let userA: TestUser;
const noLeaks = { sanitizeResources: false, sanitizeOps: false };

async function getAdminClient() {
  const admin = await import("npm:@supabase/supabase-js@2");
  return admin.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
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

Deno.test({
  name: "billing: setup",
  ...noLeaks,
  fn: async () => {
    userA = await createTestUser(randomEmail("billing_user_a"), "password123");
    const admin = await getAdminClient();
    await admin
      .from("profiles")
      .update({
        credits_remaining: 0,
        design_trials_remaining: 2,
        clone_trials_remaining: 2,
      })
      .eq("id", userA.userId);
  },
});

Deno.test("POST /billing/checkout requires auth", async () => {
  const res = await apiPublicFetch("/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pack_id: "pack_150k" }),
  });

  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test("POST /billing/checkout rejects invalid pack", async () => {
  const res = await apiFetch("/billing/checkout", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pack_id: "pack_invalid" }),
  });

  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /webhooks/stripe rejects invalid signature", async () => {
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

  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test({
  name: "POST /webhooks/stripe is idempotent on duplicate event delivery",
  ...noLeaks,
  fn: async () => {
    const eventId = `evt_${crypto.randomUUID().replaceAll("-", "")}`;
    const payload = JSON.stringify({
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_${crypto.randomUUID().replaceAll("-", "")}`,
          metadata: {
            user_id: userA.userId,
            pack_id: "pack_150k",
          },
          line_items: {
            data: [
              {
                price: {
                  id: STRIPE_TEST_PRICE_PACK_150K,
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
    assertEquals(first.status, 200);
    await first.body?.cancel();

    const second = await apiPublicFetch("/webhooks/stripe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signatureHeader,
      },
      body: payload,
    });
    assertEquals(second.status, 200);
    await second.body?.cancel();

    const admin = await getAdminClient();
    const profile = await admin
      .from("profiles")
      .select("credits_remaining")
      .eq("id", userA.userId)
      .single();

    assertEquals(profile.error, null);
    assertEquals(profile.data?.credits_remaining, 150000);

    const ledger = await admin
      .from("credit_ledger")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userA.userId)
      .eq("operation", "paid_purchase");

    assertEquals(ledger.error, null);
    assertEquals(ledger.count, 1);
  },
});

Deno.test("GET /credits/usage includes trials payload", async () => {
  const res = await apiFetch("/credits/usage", userA.accessToken);
  assertEquals(res.status, 200);

  const body = await res.json();
  assertEquals(typeof body.trials.design_remaining, "number");
  assertEquals(typeof body.trials.clone_remaining, "number");
});

Deno.test({
  name: "billing: teardown",
  ...noLeaks,
  fn: async () => {
    await deleteTestUser(userA.userId);
  },
});
