/**
 * /tasks endpoint tests.
 */
import { assertEquals } from "@std/assert";
import {
  apiFetch,
  createTestUser,
  deleteTestUser,
  SERVICE_ROLE_KEY,
  SUPABASE_URL,
  type TestUser,
} from "./_helpers/setup.ts";
import { TEST_USER_A, TEST_USER_B } from "./_helpers/fixtures.ts";

let userA: TestUser;
let userB: TestUser;

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

// --- GET /tasks/:id read-only behavior ---
Deno.test({
  name: "GET /tasks/:id does not mutate an in-flight task",
  ...noLeaks,
  fn: async () => {
    const admin = await getAdmin();
    const taskId = crypto.randomUUID();

    await admin.from("tasks").insert({
      id: taskId,
      user_id: userA.userId,
      type: "generate",
      status: "processing",
      provider: "qwen",
      provider_status: "provider_queued",
      provider_poll_count: 0,
    });

    const res = await apiFetch(`/tasks/${taskId}`, userA.accessToken);
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.id, taskId);
    assertEquals(body.type, "generate");
    assertEquals(body.status, "processing");
    assertEquals(body.provider_status, "provider_queued");

    const task = await admin
      .from("tasks")
      .select("status, provider_status, provider_poll_count")
      .eq("id", taskId)
      .single();
    assertEquals(task.error, null);
    assertEquals(task.data?.status, "processing");
    assertEquals(task.data?.provider_status, "provider_queued");
    assertEquals(task.data?.provider_poll_count, 0);

    await admin.from("tasks").delete().eq("id", taskId);
  },
});

Deno.test({
  name: "GET /tasks returns active and recent queue-backed jobs with display metadata",
  ...noLeaks,
  fn: async () => {
    const admin = await getAdmin();
    const generateTaskId = crypto.randomUUID();
    const designTaskId = crypto.randomUUID();

    await admin.from("tasks").insert([
      {
        id: generateTaskId,
        user_id: userA.userId,
        type: "generate",
        status: "processing",
        provider: "qwen",
        provider_status: "provider_queued",
        metadata: {
          voice_name: "Test Voice",
          text_preview: "hello from task feed",
          language: "English",
          estimated_duration_minutes: 0.4,
        },
      },
      {
        id: designTaskId,
        user_id: userA.userId,
        type: "design_preview",
        status: "completed",
        provider: "qwen",
        completed_at: new Date().toISOString(),
        metadata: {
          name: "Neon Host",
          instruct: "bright, clipped, energetic",
          text: "preview line",
          language: "English",
        },
      },
    ]);

    try {
      const activeRes = await apiFetch("/tasks?status=active&type=all&limit=10", userA.accessToken);
      assertEquals(activeRes.status, 200);
      const activeBody = await activeRes.json();
      assertEquals(Array.isArray(activeBody.tasks), true);
      assertEquals(activeBody.tasks.length, 1);
      assertEquals(activeBody.tasks[0].id, generateTaskId);
      assertEquals(activeBody.tasks[0].title, "Generate with Test Voice");
      assertEquals(activeBody.tasks[0].origin_page, "/generate");

      const recentRes = await apiFetch("/tasks?status=terminal&type=design_preview&limit=10", userA.accessToken);
      assertEquals(recentRes.status, 200);
      const recentBody = await recentRes.json();
      assertEquals(Array.isArray(recentBody.tasks), true);
      assertEquals(recentBody.tasks.length, 1);
      assertEquals(recentBody.tasks[0].id, designTaskId);
      assertEquals(recentBody.tasks[0].title, "Design preview: Neon Host");
      assertEquals(recentBody.tasks[0].origin_page, "/design");
    } finally {
      await admin.from("tasks").delete().in("id", [generateTaskId, designTaskId]);
    }
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
    const admin = await getAdmin();
    const taskId = crypto.randomUUID();

    await admin.from("tasks").insert({
      id: taskId,
      user_id: userA.userId,
      type: "generate",
      status: "processing",
      provider: "qwen",
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
    await deleteTestUser(userA.userId);
    await deleteTestUser(userB.userId);
  },
});
