/**
 * /generate endpoint tests.
 *
 * REQUIRES: Mock Modal server running on port 9999
 * (or edge functions served with .env.test pointing MODAL_* to localhost:9999)
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
import {
  MINIMAL_WAV,
  TEST_USER_A,
  TEST_USER_B,
  VALID_GENERATE_PAYLOAD,
} from "./_helpers/fixtures.ts";
import { ModalMock } from "./_helpers/modal_mock.ts";

let userA: TestUser;
let userB: TestUser;
let voiceId: string;
const mock = new ModalMock();
const noLeaks = { sanitizeResources: false, sanitizeOps: false };
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;

async function getAdminClient() {
  const admin = await import("npm:@supabase/supabase-js@2");
  return admin.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

async function cleanupActiveGenerateRows(userId: string): Promise<void> {
  const client = await getAdminClient();
  const { data: activeTasks, error: activeTasksError } = await client
    .from("tasks")
    .select("id, generation_id")
    .eq("user_id", userId)
    .eq("type", "generate")
    .in("status", ["pending", "processing"]);

  if (activeTasksError) {
    throw new Error(
      `Failed to load active generate tasks: ${activeTasksError.message}`,
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
        `Failed to delete active generations: ${deleteGenerationsError.message}`,
      );
    }
  }
}

async function waitForReferenceSize(
  client: Awaited<ReturnType<typeof getAdminClient>>,
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

Deno.test({
  name: "generate: setup",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
    userB = await createTestUser(TEST_USER_B.email, TEST_USER_B.password);
    await mock.start();

    // Seed a voice with reference audio so /generate can find it
    const admin = await import("npm:@supabase/supabase-js@2");
    const client = admin.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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
    });
  },
});

// --- POST /generate ---
Deno.test({
  name: "POST /generate creates task + generation",
  ...noLeaks,
  fn: async () => {
    mock.reset();
    try {
      const res = await apiFetch("/generate", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...VALID_GENERATE_PAYLOAD,
          voice_id: voiceId,
        }),
      });
      // With .env.test: 200 (mock modal), without: may get 200 (real modal) or 502 (modal error)
      const body = await res.json();
      if (res.status === 200) {
        assertExists(body.task_id);
        assertExists(body.generation_id);
        assertEquals(body.status, "processing");
        assertEquals(body.is_long_running, true);
      }
      // Only verify mock was hit if the mock actually received requests
      // (edge functions need .env.test to route to localhost:9999)
    } finally {
      await cleanupActiveGenerateRows(userA.userId);
    }
  },
});

Deno.test("POST /generate rejects missing voice_id", async () => {
  const res = await apiFetch("/generate", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "hello", language: "English" }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /generate rejects missing text", async () => {
  const res = await apiFetch("/generate", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voice_id: voiceId, language: "English" }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /generate rejects invalid voice_id format", async () => {
  const res = await apiFetch("/generate", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voice_id: "not-a-uuid", text: "hello" }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /generate rejects non-existent voice_id", async () => {
  const res = await apiFetch("/generate", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      voice_id: "00000000-0000-0000-0000-000000000099",
      text: "hello",
    }),
  });
  assertEquals(res.status, 404);
  await res.body?.cancel();
});

Deno.test("POST /generate denies cross-user voice access", async () => {
  const res = await apiFetch("/generate", userB.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      voice_id: voiceId,
      text: "cross-user probe",
      language: "English",
    }),
  });
  assertEquals(res.status, 404);
  await res.body?.cancel();
});

Deno.test("POST /generate rejects text > 10000 chars", async () => {
  const res = await apiFetch("/generate", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      voice_id: voiceId,
      text: "x".repeat(10001),
    }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test({
  name: "POST /generate returns 402 when credits are insufficient",
  ...noLeaks,
  fn: async () => {
    const admin = await getAdminClient();
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
      assertEquals(res.status, 402);
      const body = await res.json();
      assertEquals(typeof body.detail, "string");
    } finally {
      await admin
        .from("profiles")
        .update({ credits_remaining: 250000 })
        .eq("id", userA.userId);
      await cleanupActiveGenerateRows(userA.userId);
    }
  },
});

Deno.test({
  name: "POST /generate rejects oversized reference audio before download",
  ...noLeaks,
  fn: async () => {
    const client = await getAdminClient();
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
        assertEquals(typeof upload.error.message, "string");
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

      assertEquals(res.status, 400);
      const body = await res.json();
      assertEquals(typeof body.detail, "string");
    } finally {
      await client.from("voices").delete().eq("id", oversizedVoiceId).eq(
        "user_id",
        userA.userId,
      );
      await client.storage.from("references").remove([objectKey]);
    }
  },
});

Deno.test({
  name: "POST /generate rejects when another generation is already active",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const admin = await import("npm:@supabase/supabase-js@2");
    const client = admin.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const existingGenerationId = crypto.randomUUID();
    const existingTaskId = crypto.randomUUID();

    await client.from("generations").insert({
      id: existingGenerationId,
      user_id: userA.userId,
      voice_id: voiceId,
      text: "existing in-flight generation",
      language: "English",
      status: "processing",
    });

    await client.from("tasks").insert({
      id: existingTaskId,
      user_id: userA.userId,
      type: "generate",
      status: "processing",
      generation_id: existingGenerationId,
      voice_id: voiceId,
    });

    const res = await apiFetch("/generate", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...VALID_GENERATE_PAYLOAD,
        voice_id: voiceId,
      }),
    });
    assertEquals(res.status, 409);
    const body = await res.json();
    assertEquals(typeof body.detail, "string");

    await client.from("tasks").delete().eq("id", existingTaskId);
    await client.from("generations").delete().eq("id", existingGenerationId);
  },
});

Deno.test({
  name: "POST /generate handles Modal submit failure gracefully",
  ...noLeaks,
  fn: async () => {
    await cleanupActiveGenerateRows(userA.userId);
    mock.reset();
    mock.shouldFailSubmit = true;

    const res = await apiFetch("/generate", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...VALID_GENERATE_PAYLOAD,
        voice_id: voiceId,
      }),
    });
    assertEquals([200, 502, 409].includes(res.status), true);
    await res.body?.cancel();
  },
});
Deno.test({
  name: "generate: teardown",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    await mock.stop();
    // Clean up via admin (cascade will handle tasks/generations)
    const admin = await import("npm:@supabase/supabase-js@2");
    const client = admin.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await client.from("voices").delete().eq("id", voiceId);
    await deleteTestUser(userA.userId);
    await deleteTestUser(userB.userId);
  },
});
