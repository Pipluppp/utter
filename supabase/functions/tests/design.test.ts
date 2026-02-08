/**
 * /voices/design endpoint tests.
 */
import { assertEquals, assertExists } from "@std/assert";
import {
  apiFetch,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./_helpers/setup.ts";
import { TEST_USER_A, MINIMAL_WAV } from "./_helpers/fixtures.ts";

let userA: TestUser;

Deno.test({ name: "design: setup", sanitizeResources: false, sanitizeOps: false, fn: async () => {
  userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
}});

// --- POST /voices/design/preview ---
Deno.test("POST /voices/design/preview creates a pending task", async () => {
  const res = await apiFetch("/voices/design/preview", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Hello, this is a preview.",
      language: "English",
      instruct: "A warm friendly voice",
    }),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertExists(body.task_id);
  assertEquals(body.status, "pending");
});

Deno.test("POST /voices/design/preview rejects missing text", async () => {
  const res = await apiFetch("/voices/design/preview", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language: "English", instruct: "warm" }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /voices/design/preview rejects missing instruct", async () => {
  const res = await apiFetch("/voices/design/preview", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "hello", language: "English" }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /voices/design/preview rejects missing language", async () => {
  const res = await apiFetch("/voices/design/preview", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "hello", instruct: "warm" }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /voices/design/preview rejects text > 500 chars", async () => {
  const res = await apiFetch("/voices/design/preview", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "x".repeat(501),
      language: "English",
      instruct: "warm",
    }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /voices/design/preview rejects instruct > 500 chars", async () => {
  const res = await apiFetch("/voices/design/preview", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "hello",
      language: "English",
      instruct: "x".repeat(501),
    }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

// --- POST /voices/design ---
Deno.test("POST /voices/design creates voice with audio file", async () => {
  const formData = new FormData();
  formData.append("name", "Designed Voice");
  formData.append("text", "Hello preview text");
  formData.append("language", "English");
  formData.append("instruct", "A warm friendly voice");
  formData.append(
    "audio",
    new File([MINIMAL_WAV], "preview.wav", { type: "audio/wav" }),
  );

  const res = await apiFetch("/voices/design", userA.accessToken, {
    method: "POST",
    body: formData,
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertExists(body.id);
  assertEquals(body.name, "Designed Voice");
  assertEquals(body.source, "designed");
  assertExists(body.preview_url);
});

Deno.test("POST /voices/design rejects missing audio", async () => {
  const formData = new FormData();
  formData.append("name", "No Audio Voice");
  formData.append("text", "Hello");
  formData.append("language", "English");
  formData.append("instruct", "warm");

  const res = await apiFetch("/voices/design", userA.accessToken, {
    method: "POST",
    body: formData,
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /voices/design rejects missing name", async () => {
  const formData = new FormData();
  formData.append("text", "Hello");
  formData.append("language", "English");
  formData.append("instruct", "warm");
  formData.append(
    "audio",
    new File([MINIMAL_WAV], "preview.wav", { type: "audio/wav" }),
  );

  const res = await apiFetch("/voices/design", userA.accessToken, {
    method: "POST",
    body: formData,
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test({ name: "design: teardown", sanitizeResources: false, sanitizeOps: false, fn: async () => {
  await deleteTestUser(userA.userId);
}});
