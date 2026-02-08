/**
 * /clone endpoint tests.
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
import { TEST_USER_A, VALID_VOICE_PAYLOAD, MINIMAL_WAV } from "./_helpers/fixtures.ts";

let userA: TestUser;

Deno.test({ name: "clone: setup", sanitizeResources: false, sanitizeOps: false, fn: async () => {
  userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
}});

// --- POST /clone/upload-url ---
Deno.test("POST /clone/upload-url returns upload URL + voice_id", async () => {
  const res = await apiFetch("/clone/upload-url", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(VALID_VOICE_PAYLOAD),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertExists(body.voice_id);
  assertExists(body.upload_url);
  assertExists(body.object_key);
});

Deno.test("POST /clone/upload-url rejects missing name", async () => {
  const res = await apiFetch("/clone/upload-url", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language: "English", transcript: "hello" }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /clone/upload-url rejects missing language", async () => {
  const res = await apiFetch("/clone/upload-url", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test", transcript: "hello" }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /clone/upload-url rejects missing transcript", async () => {
  const res = await apiFetch("/clone/upload-url", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test", language: "English" }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /clone/upload-url rejects name > 100 chars", async () => {
  const res = await apiFetch("/clone/upload-url", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "x".repeat(101),
      language: "English",
      transcript: "hello",
    }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

// --- POST /clone/finalize ---
Deno.test("POST /clone/finalize rejects when audio not uploaded", async () => {
  const res = await apiFetch("/clone/finalize", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      voice_id: crypto.randomUUID(),
      name: "Test",
      language: "English",
      transcript: "hello",
    }),
  });
  // Should fail because no audio file was uploaded
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /clone/finalize rejects missing voice_id", async () => {
  const res = await apiFetch("/clone/finalize", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test",
      language: "English",
      transcript: "hello",
    }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

// --- Full clone flow: upload-url → upload → finalize ---
Deno.test("Full clone flow: upload-url → upload WAV → finalize", async () => {
  // Step 1: Get signed upload URL
  const urlRes = await apiFetch("/clone/upload-url", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(VALID_VOICE_PAYLOAD),
  });
  assertEquals(urlRes.status, 200);
  const { voice_id, upload_url } = await urlRes.json();

  // Step 2: Upload WAV to the signed URL
  const uploadRes = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": "audio/wav" },
    body: MINIMAL_WAV,
  });
  assertEquals(uploadRes.status, 200);
  await uploadRes.body?.cancel();

  // Step 3: Finalize the clone
  const finalRes = await apiFetch("/clone/finalize", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      voice_id,
      ...VALID_VOICE_PAYLOAD,
    }),
  });
  assertEquals(finalRes.status, 200);
  const finalBody = await finalRes.json();
  assertEquals(finalBody.id, voice_id);
  assertExists(finalBody.name);
});

Deno.test({ name: "clone: teardown", sanitizeResources: false, sanitizeOps: false, fn: async () => {
  await deleteTestUser(userA.userId);
}});
