import { assertEquals } from "@std/assert";

import {
  apiFetch,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./_helpers/setup.ts";

let userA: TestUser;
let userB: TestUser;

function randomEmail(prefix: string): string {
  const id = crypto.randomUUID().slice(0, 8);
  return `${prefix}_${id}@test.local`;
}

async function postCloneUploadUrl(token: string, name: string): Promise<Response> {
  return await apiFetch("/clone/upload-url", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      language: "English",
      transcript: "rate limit probe transcript",
    }),
  });
}

Deno.test({
  name: "rate-limits: setup",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    userA = await createTestUser(randomEmail("rate_user_a"), "password123");
    userB = await createTestUser(randomEmail("rate_user_b"), "password123");
  },
});

Deno.test({
  name: "Tier1 route returns 429 with retry_after_seconds at threshold",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    let saw429 = false;
    let seenRetryAfter = 0;

    for (let i = 1; i <= 30; i++) {
      const res = await postCloneUploadUrl(userA.accessToken, `Rate Probe ${i}`);
      if (res.status === 429) {
        const body = await res.json();
        saw429 = true;
        seenRetryAfter = Number(body.retry_after_seconds ?? 0);
        break;
      }
      if (res.status !== 200) {
        const body = await res.text();
        throw new Error(`Expected 200/429, got ${res.status}: ${body.slice(0, 200)}`);
      }
      await res.body?.cancel();
    }

    assertEquals(saw429, true);
    assertEquals(seenRetryAfter > 0, true);
  },
});

Deno.test({
  name: "Tier1 user counters are independent between accounts",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const res = await postCloneUploadUrl(userB.accessToken, "Independent Counter");
    assertEquals(res.status, 200);
    await res.body?.cancel();
  },
});

Deno.test({
  name: "rate-limits: teardown",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    await deleteTestUser(userA.userId);
    await deleteTestUser(userB.userId);
  },
});
