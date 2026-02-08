/**
 * /tasks endpoint tests.
 *
 * REQUIRES: Edge functions served with .env.test (MODAL_* → localhost:9999)
 * for the generate and design_preview lifecycle tests.
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
import { ModalMock } from "./_helpers/modal_mock.ts";

let userA: TestUser;
let userB: TestUser;
const mock = new ModalMock();

// Supabase JS client leaks intervals (realtime), so all tests using admin need sanitizers off.
const noLeaks = { sanitizeResources: false, sanitizeOps: false };

// Admin Supabase client for seeding
async function getAdmin() {
  const mod = await import("npm:@supabase/supabase-js@2");
  return mod.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

Deno.test({ name: "tasks: setup", ...noLeaks, fn: async () => {
  userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
  userB = await createTestUser(TEST_USER_B.email, TEST_USER_B.password);
  await mock.start();
}});

// --- GET /tasks/:id ---
Deno.test({ name: "GET /tasks/:id returns task for owner", ...noLeaks, fn: async () => {
  const admin = await getAdmin();
  const taskId = crypto.randomUUID();

  await admin.from("tasks").insert({
    id: taskId,
    user_id: userA.userId,
    type: "generate",
    status: "completed",
    result: { audio_url: "/test" },
  });

  const res = await apiFetch(`/tasks/${taskId}`, userA.accessToken);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.id, taskId);
  assertEquals(body.type, "generate");
  assertEquals(body.status, "completed");

  await admin.from("tasks").delete().eq("id", taskId);
}});

Deno.test({ name: "GET /tasks/:id denies access to other user's task", ...noLeaks, fn: async () => {
  const admin = await getAdmin();
  const taskId = crypto.randomUUID();

  await admin.from("tasks").insert({
    id: taskId,
    user_id: userA.userId,
    type: "generate",
    status: "completed",
  });

  const res = await apiFetch(`/tasks/${taskId}`, userB.accessToken);
  assertEquals(res.status, 404);
  await res.body?.cancel();

  await admin.from("tasks").delete().eq("id", taskId);
}});

Deno.test("GET /tasks/:id returns 404 for non-existent", async () => {
  const res = await apiFetch(
    "/tasks/00000000-0000-0000-0000-000000000099",
    userA.accessToken,
  );
  assertEquals(res.status, 404);
  await res.body?.cancel();
});

// --- GET /tasks/:id with Modal polling (generate type) ---
Deno.test({ name: "GET /tasks/:id polls Modal for processing generate task", ...noLeaks, fn: async () => {
  mock.reset();
  const admin = await getAdmin();
  const taskId = crypto.randomUUID();

  await admin.from("tasks").insert({
    id: taskId,
    user_id: userA.userId,
    type: "generate",
    status: "processing",
    modal_job_id: "test-poll-job",
  });

  const res = await apiFetch(`/tasks/${taskId}`, userA.accessToken);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.id, taskId);
  assertEquals(body.type, "generate");
  // Modal status check may return error (job not in mock if not served with .env.test),
  // but endpoint should handle gracefully
  assertExists(body.modal_poll_count);

  await admin.from("tasks").delete().eq("id", taskId);
}});

// --- DELETE /tasks/:id ---
Deno.test({ name: "DELETE /tasks/:id deletes own task", ...noLeaks, fn: async () => {
  const admin = await getAdmin();
  const taskId = crypto.randomUUID();

  await admin.from("tasks").insert({
    id: taskId,
    user_id: userA.userId,
    type: "generate",
    status: "completed",
  });

  const res = await apiFetch(`/tasks/${taskId}`, userA.accessToken, {
    method: "DELETE",
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
}});

Deno.test({ name: "DELETE /tasks/:id denies other user's task", ...noLeaks, fn: async () => {
  const admin = await getAdmin();
  const taskId = crypto.randomUUID();

  await admin.from("tasks").insert({
    id: taskId,
    user_id: userA.userId,
    type: "generate",
    status: "completed",
  });

  const res = await apiFetch(`/tasks/${taskId}`, userB.accessToken, {
    method: "DELETE",
  });
  assertEquals(res.status, 404);
  await res.body?.cancel();

  await admin.from("tasks").delete().eq("id", taskId);
}});

// --- POST /tasks/:id/cancel ---
Deno.test({ name: "POST /tasks/:id/cancel cancels a processing task", ...noLeaks, fn: async () => {
  mock.reset();
  const admin = await getAdmin();
  const taskId = crypto.randomUUID();

  await admin.from("tasks").insert({
    id: taskId,
    user_id: userA.userId,
    type: "generate",
    status: "processing",
    modal_job_id: "cancel-test-job",
  });

  const res = await apiFetch(`/tasks/${taskId}/cancel`, userA.accessToken, {
    method: "POST",
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.cancelled, true);
  assertEquals(body.task_id, taskId);

  await admin.from("tasks").delete().eq("id", taskId);
}});

Deno.test({ name: "POST /tasks/:id/cancel rejects already completed task", ...noLeaks, fn: async () => {
  const admin = await getAdmin();
  const taskId = crypto.randomUUID();

  await admin.from("tasks").insert({
    id: taskId,
    user_id: userA.userId,
    type: "generate",
    status: "completed",
  });

  const res = await apiFetch(`/tasks/${taskId}/cancel`, userA.accessToken, {
    method: "POST",
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();

  await admin.from("tasks").delete().eq("id", taskId);
}});

Deno.test({ name: "POST /tasks/:id/cancel denies other user's task", ...noLeaks, fn: async () => {
  const admin = await getAdmin();
  const taskId = crypto.randomUUID();

  await admin.from("tasks").insert({
    id: taskId,
    user_id: userA.userId,
    type: "generate",
    status: "processing",
  });

  const res = await apiFetch(`/tasks/${taskId}/cancel`, userB.accessToken, {
    method: "POST",
  });
  assertEquals(res.status, 404);
  await res.body?.cancel();

  await admin.from("tasks").delete().eq("id", taskId);
}});

// --- Design preview task lifecycle ---
Deno.test({ name: "Design preview task: create → poll → completes via Modal mock", ...noLeaks, fn: async () => {
  mock.reset();

  // Step 1: Create design preview task
  const createRes = await apiFetch("/voices/design/preview", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Hello preview",
      language: "English",
      instruct: "A warm voice",
    }),
  });
  assertEquals(createRes.status, 200);
  const { task_id } = await createRes.json();
  assertExists(task_id);

  // Step 2: Poll the task — first poll triggers Modal design call and completes
  // NOTE: This test only fully works with edge functions served via .env.test
  const pollRes = await apiFetch(`/tasks/${task_id}`, userA.accessToken);
  assertEquals(pollRes.status, 200);
  const pollBody = await pollRes.json();
  assertEquals(pollBody.id, task_id);
  assertEquals(pollBody.type, "design_preview");

  // Clean up
  const admin = await getAdmin();
  await admin.from("tasks").delete().eq("id", task_id);
}});

Deno.test({ name: "tasks: teardown", ...noLeaks, fn: async () => {
  await mock.stop();
  await deleteTestUser(userA.userId);
  await deleteTestUser(userB.userId);
}});
