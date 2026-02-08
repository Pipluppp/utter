/**
 * /voices endpoint tests.
 */
import { assertEquals, assertExists } from "@std/assert";
import {
  apiFetch,
  createTestUser,
  deleteTestUser,
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  type TestUser,
} from "./_helpers/setup.ts";
import { TEST_USER_A, TEST_USER_B, MINIMAL_WAV } from "./_helpers/fixtures.ts";

let userA: TestUser;
let userB: TestUser;

Deno.test({ name: "voices: setup", sanitizeResources: false, sanitizeOps: false, fn: async () => {
  userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
  userB = await createTestUser(TEST_USER_B.email, TEST_USER_B.password);

  // Seed a voice for User A via admin (bypasses edge function to isolate tests)
  const admin = await import("npm:@supabase/supabase-js@2");
  const client = admin.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  await client.from("voices").insert({
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    user_id: userA.userId,
    name: "Seeded Voice A",
    source: "uploaded",
    language: "English",
    reference_transcript: "hello world",
  });
}});

// --- GET /voices ---
Deno.test("GET /voices returns paginated list for authed user", async () => {
  const res = await apiFetch("/voices", userA.accessToken);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertExists(body.voices);
  assertExists(body.pagination);
  assertEquals(body.pagination.page, 1);
  assertEquals(body.voices.length >= 1, true);
});

Deno.test("GET /voices for User B returns empty (no cross-user leaking)", async () => {
  const res = await apiFetch("/voices", userB.accessToken);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.voices.length, 0);
});

Deno.test("GET /voices supports search filter", async () => {
  const res = await apiFetch("/voices?search=Seeded", userA.accessToken);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.voices.length >= 1, true);
  assertEquals(body.voices[0].name.includes("Seeded"), true);
});

Deno.test("GET /voices supports source filter", async () => {
  const res = await apiFetch("/voices?source=designed", userA.accessToken);
  assertEquals(res.status, 200);
  const body = await res.json();
  // Seeded voice is 'uploaded', so filtering for 'designed' should exclude it
  assertEquals(
    body.voices.every((v: { source: string }) => v.source === "designed"),
    true,
  );
});

Deno.test("GET /voices supports pagination params", async () => {
  const res = await apiFetch("/voices?page=1&per_page=1", userA.accessToken);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.pagination.per_page, 1);
  assertEquals(body.voices.length <= 1, true);
});

// --- DELETE /voices/:id ---
Deno.test("DELETE /voices/:id deletes own voice", async () => {
  const res = await apiFetch("/voices/aaaaaaaa-0000-0000-0000-000000000001", userA.accessToken, {
    method: "DELETE",
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);

  // Verify it's gone
  const listRes = await apiFetch("/voices", userA.accessToken);
  const listBody = await listRes.json();
  const found = listBody.voices.find(
    (v: { id: string }) => v.id === "aaaaaaaa-0000-0000-0000-000000000001",
  );
  assertEquals(found, undefined);
});

Deno.test("DELETE /voices/:id returns 404 for non-existent", async () => {
  const res = await apiFetch("/voices/00000000-0000-0000-0000-000000000099", userA.accessToken, {
    method: "DELETE",
  });
  assertEquals(res.status, 404);
  await res.body?.cancel();
});

Deno.test({ name: "voices: teardown", sanitizeResources: false, sanitizeOps: false, fn: async () => {
  await deleteTestUser(userA.userId);
  await deleteTestUser(userB.userId);
}});
