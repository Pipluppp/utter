/**
 * /tasks endpoint tests.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createUserWithBalance } from "./_helpers/factories.ts";
import { TEST_USER_A, TEST_USER_B } from "./_helpers/fixtures.ts";
import {
    apiFetch,
    deleteTestUser,
    SERVICE_ROLE_KEY,
    SUPABASE_URL,
    type TestUser,
} from "./_helpers/setup.ts";

let userA: TestUser;
let userB: TestUser;

// Admin Supabase client for seeding
function getAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

describe("tasks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    userA = await createUserWithBalance({
      email: TEST_USER_A.email,
      password: TEST_USER_A.password,
      credits: 250000,
      designTrials: 2,
      cloneTrials: 2,
      tier: "pro",
    });
    userB = await createUserWithBalance({
      email: TEST_USER_B.email,
      password: TEST_USER_B.password,
      credits: 250000,
      designTrials: 2,
      cloneTrials: 2,
      tier: "pro",
    });
  });

  afterAll(async () => {
    await deleteTestUser(userA.userId);
    await deleteTestUser(userB.userId);
  });

  // --- task retrieval ---
  describe("task retrieval", () => {
  it("owner can retrieve their own task", async () => {
    const admin = getAdmin();
    const taskId = crypto.randomUUID();

    await admin.from("tasks").insert({
      id: taskId,
      user_id: userA.userId,
      type: "generate",
      status: "completed",
      result: { audio_url: "/test" },
    });

    const res = await apiFetch(`/tasks/${taskId}`, userA.accessToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(taskId);
    expect(body.type).toBe("generate");
    expect(body.status).toBe("completed");

    await admin.from("tasks").delete().eq("id", taskId);
  });

  it("users cannot access another user's tasks", async () => {
    const admin = getAdmin();
    const taskId = crypto.randomUUID();

    await admin.from("tasks").insert({
      id: taskId,
      user_id: userA.userId,
      type: "generate",
      status: "completed",
    });

    const res = await apiFetch(`/tasks/${taskId}`, userB.accessToken);
    expect(res.status).toBe(404);
    await res.body?.cancel();

    await admin.from("tasks").delete().eq("id", taskId);
  });

  it("returns 404 for non-existent task", async () => {
    const res = await apiFetch(
      "/tasks/00000000-0000-0000-0000-000000000099",
      userA.accessToken,
    );
    expect(res.status).toBe(404);
    await res.body?.cancel();
  });

  // --- task retrieval: read-only behavior ---
  it("reading a processing task does not mutate its state", async () => {
    const admin = getAdmin();
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
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(taskId);
    expect(body.type).toBe("generate");
    expect(body.status).toBe("processing");
    expect(body.provider_status).toBe("provider_queued");

    const task = await admin
      .from("tasks")
      .select("status, provider_status, provider_poll_count")
      .eq("id", taskId)
      .single();
    expect(task.error).toBe(null);
    expect(task.data?.status).toBe("processing");
    expect(task.data?.provider_status).toBe("provider_queued");
    expect(task.data?.provider_poll_count).toBe(0);

    await admin.from("tasks").delete().eq("id", taskId);
  });

  it("task feed returns active and recent jobs with display metadata", async () => {
    const admin = getAdmin();
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
      expect(activeRes.status).toBe(200);
      const activeBody = await activeRes.json();
      expect(Array.isArray(activeBody.tasks)).toBe(true);
      expect(activeBody.tasks.length).toBe(1);
      expect(activeBody.tasks[0].id).toBe(generateTaskId);
      expect(activeBody.tasks[0].title).toBe("Generate with Test Voice");
      expect(activeBody.tasks[0].origin_page).toBe("/generate");

      const recentRes = await apiFetch("/tasks?status=terminal&type=design_preview&limit=10", userA.accessToken);
      expect(recentRes.status).toBe(200);
      const recentBody = await recentRes.json();
      expect(Array.isArray(recentBody.tasks)).toBe(true);
      expect(recentBody.tasks.length).toBe(1);
      expect(recentBody.tasks[0].id).toBe(designTaskId);
      expect(recentBody.tasks[0].title).toBe("Design preview: Neon Host");
      expect(recentBody.tasks[0].origin_page).toBe("/design");
    } finally {
      await admin.from("tasks").delete().in("id", [generateTaskId, designTaskId]);
    }
  });
  }); // end task retrieval

  // --- task deletion ---
  describe("task deletion", () => {
  it("owner can delete their own task", async () => {
    const admin = getAdmin();
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
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("users cannot delete another user's tasks", async () => {
    const admin = getAdmin();
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
    expect(res.status).toBe(404);
    await res.body?.cancel();

    await admin.from("tasks").delete().eq("id", taskId);
  });
  }); // end task deletion

  // --- task cancellation ---
  describe("task cancellation", () => {
  it("cancels a processing task", async () => {
    const admin = getAdmin();
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
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cancelled).toBe(true);
    expect(body.task_id).toBe(taskId);

    await admin.from("tasks").delete().eq("id", taskId);
  });

  it("rejects cancellation of already completed task", async () => {
    const admin = getAdmin();
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
    expect(res.status).toBe(400);
    await res.body?.cancel();

    await admin.from("tasks").delete().eq("id", taskId);
  });

  it("users cannot cancel another user's tasks", async () => {
    const admin = getAdmin();
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
    expect(res.status).toBe(404);
    await res.body?.cancel();

    await admin.from("tasks").delete().eq("id", taskId);
  });

  it("cancellation restores consumed design trial exactly once", async () => {
    const admin = getAdmin();
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
    expect(cancelRes.status).toBe(200);
    await cancelRes.body?.cancel();

    const profile = await admin
      .from("profiles")
      .select("design_trials_remaining")
      .eq("id", userA.userId)
      .single();
    expect(profile.error).toBe(null);
    expect(profile.data?.design_trials_remaining).toBe(2);

    const trial = await admin
      .from("trial_consumption")
      .select("status, restored_at")
      .eq("user_id", userA.userId)
      .eq("idempotency_key", trialKey)
      .single();
    expect(trial.error).toBe(null);
    expect(trial.data?.status).toBe("restored");
    expect(typeof trial.data?.restored_at).toBe("string");

    await admin.from("tasks").delete().eq("id", taskId);
    await admin
      .from("trial_consumption")
      .delete()
      .eq("user_id", userA.userId)
      .eq("idempotency_key", trialKey);
  });
  }); // end task cancellation
});
