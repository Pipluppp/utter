/**
 * Auth guard tests — verifies requireUser rejects unauthenticated / bad-token requests.
 */
import { assertEquals } from "@std/assert";
import { apiFetch, apiPublicFetch } from "./_helpers/setup.ts";

Deno.test("GET /me without auth returns signed_in: false (not 401)", async () => {
  // /me is special — it gracefully returns unsigned state
  const res = await apiPublicFetch("/me");
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.signed_in, false);
});

Deno.test("GET /voices without auth returns 401", async () => {
  const res = await apiPublicFetch("/voices");
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test("GET /generations without auth returns 401", async () => {
  const res = await apiPublicFetch("/generations");
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test("POST /generate without auth returns 401", async () => {
  const res = await apiPublicFetch("/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "hello" }),
  });
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test("POST /clone/upload-url without auth returns 401", async () => {
  const res = await apiPublicFetch("/clone/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "test" }),
  });
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test("POST /clone/finalize without auth returns 401", async () => {
  const res = await apiPublicFetch("/clone/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voice_id: crypto.randomUUID() }),
  });
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test("GET /voices with invalid token returns 401", async () => {
  const res = await apiFetch("/voices", "bad-token-value");
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test("PATCH /profile without auth returns 401", async () => {
  const res = await apiPublicFetch("/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: "test" }),
  });
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test("POST /voices/design/preview without auth returns 401", async () => {
  const res = await apiPublicFetch("/voices/design/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "hi", instruct: "warm", language: "English" }),
  });
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test("POST /voices/design without auth returns 401", async () => {
  const form = new FormData();
  form.set("name", "test");
  form.set("text", "hello");
  form.set("language", "English");
  form.set("instruct", "warm");

  const res = await apiPublicFetch("/voices/design", {
    method: "POST",
    body: form,
  });
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test("GET /tasks/:id without auth returns 401", async () => {
  const res = await apiPublicFetch("/tasks/00000000-0000-0000-0000-000000000001");
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test("DELETE /tasks/:id without auth returns 401", async () => {
  const res = await apiPublicFetch("/tasks/00000000-0000-0000-0000-000000000001", {
    method: "DELETE",
  });
  assertEquals(res.status, 401);
  await res.body?.cancel();
});

Deno.test("POST /tasks/:id/cancel without auth returns 401", async () => {
  const res = await apiPublicFetch("/tasks/00000000-0000-0000-0000-000000000001/cancel", {
    method: "POST",
  });
  assertEquals(res.status, 401);
  await res.body?.cancel();
});
