/**
 * /generate endpoint tests.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
    MINIMAL_WAV,
    TEST_USER_A,
    TEST_USER_B,
    VALID_GENERATE_PAYLOAD,
} from "./_helpers/fixtures.ts";
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
let userB: TestUser;
let voiceId: string;
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

async function cleanupActiveQueueTaskRows(userId: string): Promise<void> {
  const client = getAdminClient();
  const { data: activeTasks, error: activeTasksError } = await client
    .from("tasks")
    .select("id, generation_id")
    .eq("user_id", userId)
    .in("type", ["generate", "design_preview"])
    .in("status", ["pending", "processing"]);

  if (activeTasksError) {
    throw new Error(
      `Failed to load active queue tasks: ${activeTasksError.message}`,
    );
  }

  const taskIds = (activeTasks ?? [])
    .map((task) => task.id)
    .filter((id): id is string => typeof id === "string");
  const generationIds = (activeTasks ?? [])
    .map((task) => task.generation_id)
    .filter((id): id is string => typeof id === "string");

  if (taskIds.length > 0) {
    const { error: deleteTasksError } = await client.from("tasks").delete().in(
      "id",
      taskIds,
    );
    if (deleteTasksError) {
      throw new Error(
        `Failed to delete active generate tasks: ${deleteTasksError.message}`,
      );
    }
  }

  if (generationIds.length > 0) {
    const { error: deleteGenerationsError } = await client
      .from("generations")
      .delete()
      .eq("user_id", userId)
      .in("id", generationIds);
    if (deleteGenerationsError) {
      throw new Error(
        `Failed to delete queued generations: ${deleteGenerationsError.message}`,
      );
    }
  }
}

async function waitForReferenceSize(
  client: ReturnType<typeof getAdminClient>,
  userId: string,
  voiceId: string,
  minBytes: number,
): Promise<boolean> {
  for (let i = 0; i < 20; i++) {
    const listing = await client.storage.from("references").list(
      `${userId}/${voiceId}`,
      {
        limit: 100,
      },
    );
    if (listing.error) return false;
    const ref = (listing.data ?? []).find((obj) =>
      obj.name === "reference.wav"
    );
    const refWithSize = ref as
      | {
        size?: number | string | null;
        metadata?: {
          size?: number | string | null;
          contentLength?: number | string | null;
        };
      }
      | undefined;
    const value = refWithSize?.metadata?.size ??
      refWithSize?.metadata?.contentLength ??
      refWithSize?.size ?? null;
    const size = value == null ? null : Number(value);
    if (size !== null && Number.isFinite(size) && size >= minBytes) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

describe.skipIf(!HAS_QWEN_KEY)("generate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
    userB = await createTestUser(TEST_USER_B.email, TEST_USER_B.password);

    // Seed a voice with reference audio so /generate can find it
    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    await client
      .from("profiles")
      .upsert(
        {
          id: userA.userId,
          credits_remaining: 250000,
          subscription_tier: "pro",
        },
        { onConflict: "id" },
      );
    await client
      .from("profiles")
      .upsert(
        {
          id: userB.userId,
          credits_remaining: 250000,
          subscription_tier: "pro",
        },
        { onConflict: "id" },
      );

    voiceId = crypto.randomUUID();
    const objectKey = `${userA.userId}/${voiceId}/reference.wav`;

    // Upload reference audio to storage
    await client.storage.from("references").upload(objectKey, MINIMAL_WAV, {
      contentType: "audio/wav",
      upsert: true,
    });

    // Insert voice record
    await client.from("voices").insert({
      id: voiceId,
      user_id: userA.userId,
      name: "Generate Test Voice",
      source: "uploaded",
      language: "English",
      reference_object_key: objectKey,
      reference_transcript: "This is a test reference.",
      tts_provider: "qwen",
      provider_voice_id: "voice_test_qwen_vc",
      provider_target_model: "qwen3-tts-vc-2026-01-22",
      provider_voice_kind: "vc",
    });
  });

  afterAll(async () => {
    // Clean up via admin (cascade will handle tasks/generations)
    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await client.from("voices").delete().eq("id", voiceId);
    await deleteTestUser(userA.userId);
    await deleteTestUser(userB.userId);
  });

  // --- POST /generate ---
  it("POST /generate creates task + generation", async () => {
    try {
      const res = await apiFetch("/generate", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...VALID_GENERATE_PAYLOAD,
          voice_id: voiceId,
        }),
      });
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.task_id).toBeDefined();
      expect(body.generation_id).toBeDefined();
      expect(body.status).toBe("processing");
      expect(body.is_long_running).toBe(true);
    } finally {
      await cleanupActiveQueueTaskRows(userA.userId);
    }
  });

  it("POST /generate rejects missing voice_id", async () => {
    const res = await apiFetch("/generate", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello", language: "English" }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("POST /generate rejects missing text", async () => {
    const res = await apiFetch("/generate", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice_id: voiceId, language: "English" }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("POST /generate rejects invalid voice_id format", async () => {
    const res = await apiFetch("/generate", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice_id: "not-a-uuid", text: "hello" }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("POST /generate rejects non-existent voice_id", async () => {
    const res = await apiFetch("/generate", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voice_id: "00000000-0000-0000-0000-000000000099",
        text: "hello",
      }),
    });
    expect(res.status).toBe(404);
    await res.body?.cancel();
  });

  it("POST /generate denies cross-user voice access", async () => {
    const res = await apiFetch("/generate", userB.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voice_id: voiceId,
        text: "cross-user probe",
        language: "English",
      }),
    });
    expect(res.status).toBe(404);
    await res.body?.cancel();
  });

  it("POST /generate rejects text > 100 chars", async () => {
    const res = await apiFetch("/generate", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voice_id: voiceId,
        text: "x".repeat(101),
      }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("POST /generate returns 402 when credits are insufficient", async () => {
    const admin = getAdminClient();
    await admin
      .from("profiles")
      .update({ credits_remaining: 3 })
      .eq("id", userA.userId);

    try {
      const res = await apiFetch("/generate", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_id: voiceId,
          text: "credits guard should block this request",
          language: "English",
        }),
      });
      expect(res.status).toBe(402);
      const body = await res.json();
      expect(typeof body.detail).toBe("string");
    } finally {
      await admin
        .from("profiles")
        .update({ credits_remaining: 250000 })
        .eq("id", userA.userId);
      await cleanupActiveQueueTaskRows(userA.userId);
    }
  });

  it("POST /generate rejects oversized reference audio before download", async () => {
    const client = getAdminClient();
    const oversizedVoiceId = crypto.randomUUID();
    const objectKey = `${userA.userId}/${oversizedVoiceId}/reference.wav`;
    const oversizedAudio = new Uint8Array(MAX_REFERENCE_BYTES + 1);

    try {
      const upload = await client.storage.from("references").upload(
        objectKey,
        oversizedAudio,
        {
          contentType: "audio/wav",
          upsert: true,
        },
      );

      if (upload.error) {
        expect(typeof upload.error.message).toBe("string");
        return;
      }

      const sizeReady = await waitForReferenceSize(
        client,
        userA.userId,
        oversizedVoiceId,
        oversizedAudio.length,
      );
      if (!sizeReady) {
        throw new Error("Reference metadata size was not available in time.");
      }

      const insertVoice = await client.from("voices").insert({
        id: oversizedVoiceId,
        user_id: userA.userId,
        name: "Oversized Reference Voice",
        source: "uploaded",
        language: "English",
        reference_object_key: objectKey,
        reference_transcript: "This is a valid transcript.",
        tts_provider: "qwen",
        provider_voice_id: "voice_test_qwen_vc_oversized",
        provider_target_model: "qwen3-tts-vc-2026-01-22",
        provider_voice_kind: "vc",
      });
      if (insertVoice.error) throw new Error(insertVoice.error.message);

      const res = await apiFetch("/generate", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...VALID_GENERATE_PAYLOAD,
          voice_id: oversizedVoiceId,
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(typeof body.detail).toBe("string");
    } finally {
      await client.from("voices").delete().eq("id", oversizedVoiceId).eq(
        "user_id",
        userA.userId,
      );
      await client.storage.from("references").remove([objectKey]);
    }
  });

  it("POST /generate succeeds while total active queue-backed jobs stay under the cap", async () => {
    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const seededGenerationIds: string[] = [];
    const seededTaskIds: string[] = [];

    try {
      await cleanupActiveQueueTaskRows(userA.userId);

      for (let i = 0; i < 1; i++) {
        const generationId = crypto.randomUUID();
        const taskId = crypto.randomUUID();
        seededGenerationIds.push(generationId);
        seededTaskIds.push(taskId);

        await client.from("generations").insert({
          id: generationId,
          user_id: userA.userId,
          voice_id: voiceId,
          text: `existing in-flight generation ${i}`,
          language: "English",
          status: "processing",
        });

        await client.from("tasks").insert({
          id: taskId,
          user_id: userA.userId,
          type: "generate",
          status: "processing",
          generation_id: generationId,
          voice_id: voiceId,
        });
      }

      for (let i = 0; i < 1; i++) {
        const taskId = crypto.randomUUID();
        seededTaskIds.push(taskId);
        await client.from("tasks").insert({
          id: taskId,
          user_id: userA.userId,
          type: "design_preview",
          status: "processing",
          provider: "qwen",
        });
      }

      const res = await apiFetch("/generate", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...VALID_GENERATE_PAYLOAD,
          voice_id: voiceId,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(typeof body.task_id).toBe("string");
      expect(typeof body.generation_id).toBe("string");
    } finally {
      await cleanupActiveQueueTaskRows(userA.userId);
      if (seededTaskIds.length > 0) {
        await client.from("tasks").delete().in("id", seededTaskIds);
      }
      if (seededGenerationIds.length > 0) {
        await client.from("generations").delete().in("id", seededGenerationIds);
      }
    }
  });

  it("POST /generate rejects once the active queue-backed cap is exceeded", async () => {
    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const seededGenerationIds: string[] = [];
    const seededTaskIds: string[] = [];

    try {
      await cleanupActiveQueueTaskRows(userA.userId);

      for (let i = 0; i < 2; i++) {
        const generationId = crypto.randomUUID();
        const taskId = crypto.randomUUID();
        seededGenerationIds.push(generationId);
        seededTaskIds.push(taskId);

        await client.from("generations").insert({
          id: generationId,
          user_id: userA.userId,
          voice_id: voiceId,
          text: `cap generation ${i}`,
          language: "English",
          status: "processing",
        });

        await client.from("tasks").insert({
          id: taskId,
          user_id: userA.userId,
          type: "generate",
          status: "processing",
          generation_id: generationId,
          voice_id: voiceId,
        });
      }

      for (let i = 0; i < 2; i++) {
        const taskId = crypto.randomUUID();
        seededTaskIds.push(taskId);
        await client.from("tasks").insert({
          id: taskId,
          user_id: userA.userId,
          type: "design_preview",
          status: "processing",
          provider: "qwen",
        });
      }

      const res = await apiFetch("/generate", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...VALID_GENERATE_PAYLOAD,
          voice_id: voiceId,
        }),
      });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(typeof body.detail).toBe("string");
    } finally {
      await cleanupActiveQueueTaskRows(userA.userId);
      if (seededTaskIds.length > 0) {
        await client.from("tasks").delete().in("id", seededTaskIds);
      }
      if (seededGenerationIds.length > 0) {
        await client.from("generations").delete().in("id", seededGenerationIds);
      }
    }
  });
});
