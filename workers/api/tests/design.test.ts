/**
 * /voices/design endpoint tests.
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
import { MINIMAL_WAV, TEST_USER_A } from "./_helpers/fixtures.ts";

let userA: TestUser;
const noLeaks = { sanitizeResources: false, sanitizeOps: false };

async function getAdminClient() {
  const admin = await import("npm:@supabase/supabase-js@2");
  return admin.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

Deno.test({
  name: "design: setup",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
    const admin = await getAdminClient();
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
  },
});

// --- POST /voices/design/preview ---
Deno.test({
  name: "POST /voices/design/preview uses trial path before debit path",
  ...noLeaks,
  fn: async () => {
    const admin = await getAdminClient();
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
    assertEquals(res.status, 200);
    const body = await res.json();
    assertExists(body.task_id);
    assertEquals(body.status, "pending");

    const task = await admin
      .from("tasks")
      .select("metadata")
      .eq("id", body.task_id as string)
      .single();
    assertEquals(task.error, null);
    const metadata = (task.data?.metadata ?? {}) as Record<string, unknown>;
    assertEquals(metadata.used_trial, true);
    assertEquals(metadata.credits_debited, 0);
    assertEquals(typeof metadata.trial_idempotency_key, "string");

    const profile = await admin
      .from("profiles")
      .select("credits_remaining, design_trials_remaining")
      .eq("id", userA.userId)
      .single();
    assertEquals(profile.error, null);
    assertEquals(profile.data?.credits_remaining, 250000);
    assertEquals(profile.data?.design_trials_remaining, 1);

    await admin.from("tasks").delete().eq("id", body.task_id as string);
  },
});

Deno.test({
  name:
    "POST /voices/design/preview debits 5000 credits after trials are exhausted",
  ...noLeaks,
  fn: async () => {
    const admin = await getAdminClient();
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
      assertEquals(res.status, 200);
      const body = await res.json();
      taskId = body.task_id as string;

      const task = await admin
        .from("tasks")
        .select("metadata")
        .eq("id", taskId)
        .single();
      assertEquals(task.error, null);
      const metadata = (task.data?.metadata ?? {}) as Record<string, unknown>;
      assertEquals(metadata.used_trial, false);
      assertEquals(metadata.credits_debited, 5000);

      const profile = await admin
        .from("profiles")
        .select("credits_remaining")
        .eq("id", userA.userId)
        .single();
      assertEquals(profile.error, null);
      assertEquals(profile.data?.credits_remaining, 1000);
    } finally {
      if (taskId) {
        await admin.from("tasks").delete().eq("id", taskId);
      }
      await admin
        .from("profiles")
        .update({ credits_remaining: 250000, design_trials_remaining: 2 })
        .eq("id", userA.userId);
    }
  },
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

Deno.test({
  name: "POST /voices/design/preview returns 402 when credits are insufficient",
  ...noLeaks,
  fn: async () => {
    const admin = await getAdminClient();
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
      assertEquals(res.status, 402);
      const body = await res.json();
      assertEquals(typeof body.detail, "string");
    } finally {
      await admin
        .from("profiles")
        .update({ credits_remaining: 250000, design_trials_remaining: 2 })
        .eq("id", userA.userId);
    }
  },
});

// --- POST /voices/design ---
Deno.test({
  name: "POST /voices/design creates voice from completed qwen preview task",
  ...noLeaks,
  fn: async () => {
  const admin = await getAdminClient();
  const taskId = crypto.randomUUID();
  const objectKey = `${userA.userId}/preview_${taskId}.wav`;

  const upload = await admin.storage.from("references").upload(objectKey, MINIMAL_WAV, {
    contentType: "audio/wav",
    upsert: true,
  });
  assertEquals(upload.error, null);

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
  assertEquals(taskInsert.error, null);

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
    assertEquals(res.status, 200);
    const body = await res.json();
    assertExists(body.id);
    assertEquals(body.name, "Designed Voice");
    assertEquals(body.source, "designed");
    assertExists(body.preview_url);
    await admin.from("voices").delete().eq("id", body.id as string);
  } finally {
    await admin.from("tasks").delete().eq("id", taskId);
    await admin.storage.from("references").remove([objectKey]);
  }
  },
});

Deno.test({
  name: "POST /voices/design/preview rejects once the shared active-job cap is exceeded",
  ...noLeaks,
  fn: async () => {
    const admin = await getAdminClient();
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
        assertEquals(generationInsert.error, null);

        const taskInsert = await admin.from("tasks").insert({
          id: taskId,
          user_id: userA.userId,
          type: "generate",
          status: "processing",
          provider: "qwen",
          generation_id: generationId,
        });
        assertEquals(taskInsert.error, null);
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

      assertEquals(res.status, 409);
      const body = await res.json();
      assertEquals(typeof body.detail, "string");
    } finally {
      if (taskIds.length > 0) {
        await admin.from("tasks").delete().in("id", taskIds);
      }
      if (generationIds.length > 0) {
        await admin.from("generations").delete().in("id", generationIds);
      }
    }
  },
});

Deno.test("POST /voices/design rejects missing task_id", async () => {
  const formData = new FormData();
  formData.append("name", "No Task");
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

Deno.test({
  name: "POST /voices/design rejects preview task that is not completed",
  ...noLeaks,
  fn: async () => {
  const admin = await getAdminClient();
  const taskId = crypto.randomUUID();
  const taskInsert = await admin.from("tasks").insert({
    id: taskId,
    user_id: userA.userId,
    type: "design_preview",
    status: "pending",
    provider: "qwen",
  });
  assertEquals(taskInsert.error, null);

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
    assertEquals(res.status, 409);
    await res.body?.cancel();
  } finally {
    await admin.from("tasks").delete().eq("id", taskId);
  }
  },
});

Deno.test("POST /voices/design rejects missing name", async () => {
  const formData = new FormData();
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

Deno.test({
  name: "design: teardown",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    await deleteTestUser(userA.userId);
  },
});
