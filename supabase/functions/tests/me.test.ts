/**
 * /me and /profile endpoint tests.
 */
import { assertEquals, assertExists } from "@std/assert";
import {
  apiFetch,
  apiPublicFetch,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./_helpers/setup.ts";
import { TEST_USER_A } from "./_helpers/fixtures.ts";

let userA: TestUser;

// --- Setup / Teardown ---
async function setup() {
  userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
}

async function teardown() {
  if (userA) await deleteTestUser(userA.userId);
}

Deno.test({ name: "me: setup", fn: setup, sanitizeResources: false, sanitizeOps: false });

// --- GET /me ---
Deno.test("GET /me with valid auth returns signed_in: true + profile", async () => {
  const res = await apiFetch("/me", userA.accessToken);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.signed_in, true);
  assertExists(body.user);
  assertExists(body.profile);
  assertEquals(body.profile.id, userA.userId);
  assertEquals(body.profile.subscription_tier, "free");
  assertEquals(body.profile.credits_remaining, 100);
});

Deno.test("GET /me without auth returns signed_in: false", async () => {
  const res = await apiPublicFetch("/me");
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.signed_in, false);
  assertEquals(body.profile, null);
});

// --- PATCH /profile ---
Deno.test("PATCH /profile updates display_name", async () => {
  const res = await apiFetch("/profile", userA.accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: "Test User A" }),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.profile.display_name, "Test User A");
});

Deno.test("PATCH /profile ignores server-owned fields in body", async () => {
  const res = await apiFetch("/profile", userA.accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      display_name: "Safe Update",
      subscription_tier: "pro",
      credits_remaining: 999999,
    }),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.profile.display_name, "Safe Update");
  assertEquals(body.profile.subscription_tier, "free");
  assertEquals(body.profile.credits_remaining, 100);
});

Deno.test("PATCH /profile updates handle", async () => {
  const handle = `test_${Date.now()}`;
  const res = await apiFetch("/profile", userA.accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle }),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.profile.handle, handle);
});

Deno.test("PATCH /profile rejects invalid handle (too short)", async () => {
  const res = await apiFetch("/profile", userA.accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle: "ab" }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("PATCH /profile rejects invalid handle (special chars)", async () => {
  const res = await apiFetch("/profile", userA.accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle: "test@user" }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("PATCH /profile rejects empty body", async () => {
  const res = await apiFetch("/profile", userA.accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("PATCH /profile rejects invalid avatar_url", async () => {
  const res = await apiFetch("/profile", userA.accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ avatar_url: "not-a-url" }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("PATCH /profile accepts null avatar_url (clear)", async () => {
  const res = await apiFetch("/profile", userA.accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ avatar_url: null }),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.profile.avatar_url, null);
});

Deno.test({ name: "me: teardown", fn: teardown, sanitizeResources: false, sanitizeOps: false });
