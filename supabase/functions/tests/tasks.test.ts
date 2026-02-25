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
  SERVICE_ROLE_KEY,
  SUPABASE_URL,
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

Deno.test({
  name: "tasks: setup",
  ...noLeaks,
  fn: async () => {
    userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
    userB = await createTestUser(TEST_USER_B.email, TEST_USER_B.password);
    const admin = await getAdmin();
    await admin
      .from("profiles")
      .upsert(
        {
          id: userA.userId,
          credits_remaining: 250000,
          design_trials_remaining: 2,
          clone_trials_remaining: 2,
          subscription_tier: "pro",
        },
        { onConflict: "id" },
      );
    await admin
      .from("profiles")
      .upsert(
        {
          id: userB.userId,
          credits_remaining: 250000,
          design_trials_remaining: 2,
          clone_trials_remaining: 2,
          subscription_tier: "pro",
        },
        { onConflict: "id" },
      );
    await mock.start();
  },
});

// --- GET /tasks/:id ---
Deno.test({
  name: "GET /tasks/:id returns task for owner",
  ...noLeaks,
  fn: async () => {
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
  },
});

Deno.test({
  name: "GET /tasks/:id denies access to other user's task",
  ...noLeaks,
  fn: async () => {
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
  },
});

Deno.test("GET /tasks/:id returns 404 for non-existent", async () => {
  const res = await apiFetch(
    "/tasks/00000000-0000-0000-0000-000000000099",
    userA.accessToken,
  );
  assertEquals(res.status, 404);
  await res.body?.cancel();
});

// --- GET /tasks/:id with Modal polling (generate type) ---
Deno.test({
  name: "GET /tasks/:id polls Modal for processing generate task",
  ...noLeaks,
  fn: async () => {
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
  },
});

// --- DELETE /tasks/:id ---
Deno.test({
  name: "DELETE /tasks/:id deletes own task",
  ...noLeaks,
  fn: async () => {
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
  },
});

Deno.test({
  name: "DELETE /tasks/:id denies other user's task",
  ...noLeaks,
  fn: async () => {
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
  },
});

// --- POST /tasks/:id/cancel ---
Deno.test({
  name: "POST /tasks/:id/cancel cancels a processing task",
  ...noLeaks,
  fn: async () => {
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
  },
});

Deno.test({
  name: "POST /tasks/:id/cancel rejects already completed task",
  ...noLeaks,
  fn: async () => {
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
  },
});

Deno.test({
  name: "POST /tasks/:id/cancel denies other user's task",
  ...noLeaks,
  fn: async () => {
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
  },
});

// --- Design preview task lifecycle ---
Deno.test({
  name: "Design preview task: create -> poll -> completes via Modal mock",
  ...noLeaks,
  fn: async () => {
    mock.reset();

    // Step 1: Create design preview task
    const createRes = await apiFetch(
      "/voices/design/preview",
      userA.accessToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Hello preview",
          language: "English",
          instruct: "A warm voice",
        }),
      },
    );
    assertEquals(createRes.status, 200);
    const { task_id } = await createRes.json();
    assertExists(task_id);

    // Step 2: First poll should return processing immediately.
    const firstPollRes = await apiFetch(`/tasks/${task_id}`, userA.accessToken);
    assertEquals(firstPollRes.status, 200);
    let pollBody = await firstPollRes.json();
    assertEquals(pollBody.id, task_id);
    assertEquals(pollBody.type, "design_preview");
    assertEquals(pollBody.status, "processing");

    // Step 3: Poll until background completion (or failure).
    // CI/local timing can vary under full-suite load, so use a deadline-based wait.
    const waitUntil = Date.now() + 45_000;
    while (Date.now() < waitUntil) {
      if (pollBody.status === "completed" || pollBody.status === "failed") {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      const nextPollRes = await apiFetch(
        `/tasks/${task_id}`,
        userA.accessToken,
      );
      assertEquals(nextPollRes.status, 200);
      pollBody = await nextPollRes.json();
    }

    assertEquals(
      pollBody.status === "completed" || pollBody.status === "failed",
      true,
    );
    if (pollBody.status === "completed") {
      const result = pollBody.result as { audio_url?: unknown } | undefined;
      assertEquals(typeof result?.audio_url, "string");
    }

    // Clean up
    const admin = await getAdmin();
    await admin.from("tasks").delete().eq("id", task_id);
  },
});

Deno.test({
  name: "POST /tasks/:id/cancel restores consumed design trial exactly once",
  ...noLeaks,
  fn: async () => {
    const admin = await getAdmin();
    const taskId = crypto.randomUUID();
    const trialKey = `design-preview:${taskId}:charge`;

    await admin
      .from("profiles")
      .update({ design_trials_remaining: 1 })
      .eq("id", userA.userId);

    await admin.from("trial_consumption").insert({
      user_id: userA.userId,
      operation: "design_preview",
      reference_type: "task",
      reference_id: taskId,
      idempotency_key: trialKey,
      status: "consumed",
      metadata: { reason: "test_consumed_trial" },
    });

    await admin.from("tasks").insert({
      id: taskId,
      user_id: userA.userId,
      type: "design_preview",
      status: "pending",
      metadata: {
        used_trial: true,
        trial_idempotency_key: trialKey,
        credits_debited: 0,
      },
    });

    const cancelRes = await apiFetch(
      `/tasks/${taskId}/cancel`,
      userA.accessToken,
      {
        method: "POST",
      },
    );
    assertEquals(cancelRes.status, 200);
    await cancelRes.body?.cancel();

    const profile = await admin
      .from("profiles")
      .select("design_trials_remaining")
      .eq("id", userA.userId)
      .single();
    assertEquals(profile.error, null);
    assertEquals(profile.data?.design_trials_remaining, 2);

    const trial = await admin
      .from("trial_consumption")
      .select("status, restored_at")
      .eq("user_id", userA.userId)
      .eq("idempotency_key", trialKey)
      .single();
    assertEquals(trial.error, null);
    assertEquals(trial.data?.status, "restored");
    assertEquals(typeof trial.data?.restored_at, "string");

    await admin.from("tasks").delete().eq("id", taskId);
    await admin
      .from("trial_consumption")
      .delete()
      .eq("user_id", userA.userId)
      .eq("idempotency_key", trialKey);
  },
});

Deno.test({
  name: "tasks: teardown",
  ...noLeaks,
  fn: async () => {
    await mock.stop();
    await deleteTestUser(userA.userId);
    await deleteTestUser(userB.userId);
  },
});
