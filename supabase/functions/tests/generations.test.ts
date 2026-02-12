/**
 * /generations endpoint tests.
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
import { TEST_USER_A, TEST_USER_B } from "./_helpers/fixtures.ts";

let userA: TestUser;
let userB: TestUser;
const GEN_ID = "aaaaaaaa-0000-0000-0000-000000000010";

Deno.test({ name: "generations: setup", sanitizeResources: false, sanitizeOps: false, fn: async () => {
  userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
  userB = await createTestUser(TEST_USER_B.email, TEST_USER_B.password);

  // Seed a generation via admin
  const admin = await import("npm:@supabase/supabase-js@2");
  const client = admin.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Need a voice for FK
  await client.from("voices").insert({
    id: "aaaaaaaa-0000-0000-0000-000000000011",
    user_id: userA.userId,
    name: "Gen Test Voice",
    source: "uploaded",
    language: "English",
    reference_transcript: "test",
  });

  await client.from("generations").insert({
    id: GEN_ID,
    user_id: userA.userId,
    voice_id: "aaaaaaaa-0000-0000-0000-000000000011",
    text: "Hello from test generation",
    language: "English",
    status: "completed",
  });
}});

// --- GET /generations ---
Deno.test("GET /generations returns paginated list", async () => {
  const res = await apiFetch("/generations", userA.accessToken);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertExists(body.generations);
  assertExists(body.pagination);
  assertEquals(body.generations.length >= 1, true);
});

Deno.test("GET /generations for User B returns empty (no cross-user)", async () => {
  const res = await apiFetch("/generations", userB.accessToken);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.generations.length, 0);
});

Deno.test("GET /generations supports search filter", async () => {
  const res = await apiFetch(
    "/generations?search=Hello%20from%20test",
    userA.accessToken,
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.generations.length >= 1, true);
});

Deno.test("GET /generations supports status filter", async () => {
  const res = await apiFetch(
    "/generations?status=completed",
    userA.accessToken,
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(
    body.generations.every((g: { status: string }) => g.status === "completed"),
    true,
  );
});

Deno.test("GET /generations includes voice_name join", async () => {
  const res = await apiFetch("/generations", userA.accessToken);
  const body = await res.json();
  const gen = body.generations.find((g: { id: string }) => g.id === GEN_ID);
  assertExists(gen);
  assertEquals(gen.voice_name, "Gen Test Voice");
});

Deno.test("GET /generations includes audio_path", async () => {
  const res = await apiFetch("/generations", userA.accessToken);
  const body = await res.json();
  const gen = body.generations.find((g: { id: string }) => g.id === GEN_ID);
  assertExists(gen);
  assertEquals(gen.audio_path, `/api/generations/${GEN_ID}/audio`);
});

// --- POST /generations/:id/regenerate ---
Deno.test("POST /regenerate returns redirect info", async () => {
  const res = await apiFetch(`/generations/${GEN_ID}/regenerate`, userA.accessToken, {
    method: "POST",
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertExists(body.voice_id);
  assertExists(body.text);
  assertExists(body.redirect_url);
});

Deno.test("POST /regenerate for non-existent returns 404", async () => {
  const res = await apiFetch(
    "/generations/00000000-0000-0000-0000-000000000099/regenerate",
    userA.accessToken,
    { method: "POST" },
  );
  assertEquals(res.status, 404);
  await res.body?.cancel();
});

// --- DELETE /generations/:id ---
Deno.test("DELETE /generations/:id deletes own generation", async () => {
  const res = await apiFetch(`/generations/${GEN_ID}`, userA.accessToken, {
    method: "DELETE",
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
});

Deno.test("DELETE /generations/:id returns 404 for non-existent", async () => {
  const res = await apiFetch(
    "/generations/00000000-0000-0000-0000-000000000099",
    userA.accessToken,
    { method: "DELETE" },
  );
  assertEquals(res.status, 404);
  await res.body?.cancel();
});

Deno.test({
  name: "GET /generations/:id/audio rejects storage key outside user prefix",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const admin = await import("npm:@supabase/supabase-js@2");
    const client = admin.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const maliciousGenerationId = crypto.randomUUID();

    try {
      const insertRes = await client.from("generations").insert({
        id: maliciousGenerationId,
        user_id: userA.userId,
        text: "malicious audio key test",
        language: "English",
        status: "completed",
        audio_object_key: `${userB.userId}/foreign.wav`,
      });
      assertEquals(insertRes.error, null);

      const res = await apiFetch(`/generations/${maliciousGenerationId}/audio`, userA.accessToken);
      assertEquals(res.status, 403);
      const body = await res.json();
      assertEquals(body.detail, "Invalid storage object key.");
    } finally {
      await client.from("generations").delete().eq("id", maliciousGenerationId);
    }
  },
});

Deno.test({ name: "generations: teardown", sanitizeResources: false, sanitizeOps: false, fn: async () => {
  // Clean up voice
  const admin = await import("npm:@supabase/supabase-js@2");
  const client = admin.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  await client.from("voices").delete().eq("id", "aaaaaaaa-0000-0000-0000-000000000011");

  await deleteTestUser(userA.userId);
  await deleteTestUser(userB.userId);
}});
