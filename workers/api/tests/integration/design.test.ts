/**
 * /voices/design endpoint tests.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MINIMAL_WAV, TEST_USER_A } from "./_helpers/fixtures.ts";
import {
    apiFetch,
    createTestUser,
    deleteTestUser,
    SERVICE_ROLE_KEY,
    SUPABASE_URL,
    type TestUser,
} from "./_helpers/setup.ts";

const HAS_QWEN_KEY = !!process.env.DASHSCOPE_API_KEY;

let userA: TestUser;

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

describe.skipIf(!HAS_QWEN_KEY)("design", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
    const admin = getAdminClient();
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
  });

  afterAll(async () => {
    await deleteTestUser(userA.userId);
  });

  // --- POST /voices/design/preview ---
  it("POST /voices/design/preview uses trial path before debit path", async () => {
    const admin = getAdminClient();
    await admin
      .from("profiles")
      .update({ credits_remaining: 250000, design_trials_remaining: 2 })
      .eq("id", userA.userId);

    const res = await apiFetch("/voices/design/preview", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Hello, this is a preview.",
        language: "English",
        instruct: "A warm friendly voice",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.task_id).toBeDefined();
    expect(body.status).toBe("pending");

    const task = await admin
      .from("tasks")
      .select("metadata")
      .eq("id", body.task_id as string)
      .single();
    expect(task.error).toBe(null);
    const metadata = (task.data?.metadata ?? {}) as Record<string, unknown>;
    expect(metadata.used_trial).toBe(true);
    expect(metadata.credits_debited).toBe(0);
    expect(typeof metadata.trial_idempotency_key).toBe("string");

    const profile = await admin
      .from("profiles")
      .select("credits_remaining, design_trials_remaining")
      .eq("id", userA.userId)
      .single();
    expect(profile.error).toBe(null);
    expect(profile.data?.credits_remaining).toBe(250000);
    expect(profile.data?.design_trials_remaining).toBe(1);

    await admin.from("tasks").delete().eq("id", body.task_id as string);
  });

  it("POST /voices/design/preview debits 5000 credits after trials are exhausted", async () => {
    const admin = getAdminClient();
    await admin
      .from("profiles")
      .update({ credits_remaining: 6000, design_trials_remaining: 0 })
      .eq("id", userA.userId);

    let taskId = "";
    try {
      const res = await apiFetch("/voices/design/preview", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Debited preview attempt",
          language: "English",
          instruct: "A warm friendly voice",
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      taskId = body.task_id as string;

      const task = await admin
        .from("tasks")
        .select("metadata")
        .eq("id", taskId)
        .single();
      expect(task.error).toBe(null);
      const metadata = (task.data?.metadata ?? {}) as Record<string, unknown>;
      expect(metadata.used_trial).toBe(false);
      expect(metadata.credits_debited).toBe(5000);

      const profile = await admin
        .from("profiles")
        .select("credits_remaining")
        .eq("id", userA.userId)
        .single();
      expect(profile.error).toBe(null);
      expect(profile.data?.credits_remaining).toBe(1000);
    } finally {
      if (taskId) {
        await admin.from("tasks").delete().eq("id", taskId);
      }
      await admin
        .from("profiles")
        .update({ credits_remaining: 250000, design_trials_remaining: 2 })
        .eq("id", userA.userId);
    }
  });

  it("POST /voices/design/preview rejects missing text", async () => {
    const res = await apiFetch("/voices/design/preview", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "English", instruct: "warm" }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("POST /voices/design/preview rejects missing instruct", async () => {
    const res = await apiFetch("/voices/design/preview", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello", language: "English" }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("POST /voices/design/preview rejects missing language", async () => {
    const res = await apiFetch("/voices/design/preview", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello", instruct: "warm" }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("POST /voices/design/preview rejects text > 500 chars", async () => {
    const res = await apiFetch("/voices/design/preview", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "x".repeat(501),
        language: "English",
        instruct: "warm",
      }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("POST /voices/design/preview rejects instruct > 500 chars", async () => {
    const res = await apiFetch("/voices/design/preview", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "hello",
        language: "English",
        instruct: "x".repeat(501),
      }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("POST /voices/design/preview returns 402 when credits are insufficient", async () => {
    const admin = getAdminClient();
    await admin
      .from("profiles")
      .update({ credits_remaining: 1, design_trials_remaining: 0 })
      .eq("id", userA.userId);

    try {
      const res = await apiFetch("/voices/design/preview", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Hello, this is a preview.",
          language: "English",
          instruct: "A warm friendly voice",
        }),
      });
      expect(res.status).toBe(402);
      const body = await res.json();
      expect(typeof body.detail).toBe("string");
    } finally {
      await admin
        .from("profiles")
        .update({ credits_remaining: 250000, design_trials_remaining: 2 })
        .eq("id", userA.userId);
    }
  });

  // --- POST /voices/design ---
  it("POST /voices/design creates voice from completed qwen preview task", async () => {
    const admin = getAdminClient();
    const taskId = crypto.randomUUID();
    const objectKey = `${userA.userId}/preview_${taskId}.wav`;

    const upload = await admin.storage.from("references").upload(objectKey, MINIMAL_WAV, {
      contentType: "audio/wav",
      upsert: true,
    });
    expect(upload.error).toBe(null);

    const taskInsert = await admin.from("tasks").insert({
      id: taskId,
      user_id: userA.userId,
      type: "design_preview",
      status: "completed",
      provider: "qwen",
      result: {
        object_key: objectKey,
        provider_voice_id: "voice_design_test",
        provider_target_model: "qwen3-tts-vd-2026-01-26",
        provider_voice_kind: "vd",
      },
    });
    expect(taskInsert.error).toBe(null);

    const formData = new FormData();
    formData.append("name", "Designed Voice");
    formData.append("text", "Hello preview text");
    formData.append("language", "English");
    formData.append("instruct", "A warm friendly voice");
    formData.append("task_id", taskId);

    try {
      const res = await apiFetch("/voices/design", userA.accessToken, {
        method: "POST",
        body: formData,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.name).toBe("Designed Voice");
      expect(body.source).toBe("designed");
      expect(body.preview_url).toBeDefined();
      await admin.from("voices").delete().eq("id", body.id as string);
    } finally {
      await admin.from("tasks").delete().eq("id", taskId);
      await admin.storage.from("references").remove([objectKey]);
    }
  });

  it("POST /voices/design/preview rejects once the shared active-job cap is exceeded", async () => {
    const admin = getAdminClient();
    const taskIds: string[] = [];
    const generationIds: string[] = [];

    try {
      await admin
        .from("tasks")
        .delete()
        .eq("user_id", userA.userId)
        .in("type", ["generate", "design_preview"])
        .in("status", ["pending", "processing"]);

      for (let i = 0; i < 2; i++) {
        const generationId = crypto.randomUUID();
        const taskId = crypto.randomUUID();
        generationIds.push(generationId);
        taskIds.push(taskId);

        const generationInsert = await admin.from("generations").insert({
          id: generationId,
          user_id: userA.userId,
          voice_id: null,
          text: `cap check generation ${i}`,
          language: "English",
          status: "processing",
        });
        expect(generationInsert.error).toBe(null);

        const taskInsert = await admin.from("tasks").insert({
          id: taskId,
          user_id: userA.userId,
          type: "generate",
          status: "processing",
          provider: "qwen",
          generation_id: generationId,
        });
        expect(taskInsert.error).toBe(null);
      }

      for (let i = 0; i < 2; i++) {
        const taskId = crypto.randomUUID();
        taskIds.push(taskId);
        await admin.from("tasks").insert({
          id: taskId,
          user_id: userA.userId,
          type: "design_preview",
          status: "processing",
          provider: "qwen",
        });
      }

      const res = await apiFetch("/voices/design/preview", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Cap check preview",
          language: "English",
          instruct: "A warm friendly voice",
        }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(typeof body.detail).toBe("string");
    } finally {
      if (taskIds.length > 0) {
        await admin.from("tasks").delete().in("id", taskIds);
      }
      if (generationIds.length > 0) {
        await admin.from("generations").delete().in("id", generationIds);
      }
    }
  });

  it("POST /voices/design rejects missing task_id", async () => {
    const formData = new FormData();
    formData.append("name", "No Task");
    formData.append("text", "Hello");
    formData.append("language", "English");
    formData.append("instruct", "warm");

    const res = await apiFetch("/voices/design", userA.accessToken, {
      method: "POST",
      body: formData,
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("POST /voices/design rejects preview task that is not completed", async () => {
    const admin = getAdminClient();
    const taskId = crypto.randomUUID();
    const taskInsert = await admin.from("tasks").insert({
      id: taskId,
      user_id: userA.userId,
      type: "design_preview",
      status: "pending",
      provider: "qwen",
    });
    expect(taskInsert.error).toBe(null);

    const formData = new FormData();
    formData.append("name", "Pending Task Voice");
    formData.append("text", "Hello");
    formData.append("language", "English");
    formData.append("instruct", "warm");
    formData.append("task_id", taskId);

    try {
      const res = await apiFetch("/voices/design", userA.accessToken, {
        method: "POST",
        body: formData,
      });
      expect(res.status).toBe(409);
      await res.body?.cancel();
    } finally {
      await admin.from("tasks").delete().eq("id", taskId);
    }
  });

  it("POST /voices/design rejects missing name", async () => {
    const formData = new FormData();
    formData.append("text", "Hello");
    formData.append("language", "English");
    formData.append("instruct", "warm");

    const res = await apiFetch("/voices/design", userA.accessToken, {
      method: "POST",
      body: formData,
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });
});
