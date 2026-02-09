/**
 * /clone endpoint tests.
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
import { TEST_USER_A, VALID_VOICE_PAYLOAD, MINIMAL_WAV } from "./_helpers/fixtures.ts";

let userA: TestUser;
const noLeaks = { sanitizeResources: false, sanitizeOps: false };
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;

async function getAdminClient() {
  const admin = await import("npm:@supabase/supabase-js@2");
  return admin.createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

async function waitForReferenceSize(
  admin: Awaited<ReturnType<typeof getAdminClient>>,
  userId: string,
  voiceId: string,
  minBytes: number,
): Promise<boolean> {
  for (let i = 0; i < 20; i++) {
    const listing = await admin.storage.from("references").list(`${userId}/${voiceId}`, {
      limit: 100,
    });
    if (listing.error) return false;
    const ref = (listing.data ?? []).find((obj) => obj.name === "reference.wav");
    const refWithSize = ref as
      | { size?: number | string | null; metadata?: { size?: number | string | null; contentLength?: number | string | null } }
      | undefined;
    const value = refWithSize?.metadata?.size ?? refWithSize?.metadata?.contentLength ?? refWithSize?.size ?? null;
    const size = value == null ? null : Number(value);
    if (size !== null && Number.isFinite(size) && size >= minBytes) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

Deno.test({ name: "clone: setup", sanitizeResources: false, sanitizeOps: false, fn: async () => {
  userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
}});

// --- POST /clone/upload-url ---
Deno.test("POST /clone/upload-url returns upload URL + voice_id", async () => {
  const res = await apiFetch("/clone/upload-url", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(VALID_VOICE_PAYLOAD),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertExists(body.voice_id);
  assertExists(body.upload_url);
  assertExists(body.object_key);
});

Deno.test("POST /clone/upload-url rejects missing name", async () => {
  const res = await apiFetch("/clone/upload-url", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language: "English", transcript: "hello" }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /clone/upload-url rejects missing language", async () => {
  const res = await apiFetch("/clone/upload-url", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test", transcript: "hello" }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /clone/upload-url rejects missing transcript", async () => {
  const res = await apiFetch("/clone/upload-url", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test", language: "English" }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /clone/upload-url rejects name > 100 chars", async () => {
  const res = await apiFetch("/clone/upload-url", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "x".repeat(101),
      language: "English",
      transcript: "hello",
    }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

// --- POST /clone/finalize ---
Deno.test("POST /clone/finalize rejects when audio not uploaded", async () => {
  const res = await apiFetch("/clone/finalize", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      voice_id: crypto.randomUUID(),
      name: "Test",
      language: "English",
      transcript: "hello",
    }),
  });
  // Should fail because no audio file was uploaded
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test("POST /clone/finalize rejects missing voice_id", async () => {
  const res = await apiFetch("/clone/finalize", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test",
      language: "English",
      transcript: "hello",
    }),
  });
  assertEquals(res.status, 400);
  await res.body?.cancel();
});

Deno.test({
  name: "POST /clone/finalize rejects oversized reference audio",
  ...noLeaks,
  fn: async () => {
    const admin = await getAdminClient();
    const voiceId = crypto.randomUUID();
    const objectKey = `${userA.userId}/${voiceId}/reference.wav`;
    const oversizedAudio = new Uint8Array(MAX_REFERENCE_BYTES + 1);

    try {
      const upload = await admin.storage.from("references").upload(objectKey, oversizedAudio, {
        contentType: "audio/wav",
        upsert: true,
      });

      if (upload.error) {
        assertEquals(typeof upload.error.message, "string");
        return;
      }

      const sizeReady = await waitForReferenceSize(admin, userA.userId, voiceId, oversizedAudio.length);
      if (!sizeReady) {
        throw new Error("Reference metadata size was not available in time.");
      }

      const res = await apiFetch("/clone/finalize", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_id: voiceId,
          ...VALID_VOICE_PAYLOAD,
        }),
      });

      assertEquals(res.status, 400);
      const body = await res.json();
      assertEquals(typeof body.detail, "string");
    } finally {
      await admin.storage.from("references").remove([objectKey]);
      await admin.from("voices").delete().eq("id", voiceId).eq("user_id", userA.userId);
    }
  },
});

Deno.test({
  name: "POST /clone/finalize cleans orphaned upload when voice insert fails",
  ...noLeaks,
  fn: async () => {
    const admin = await getAdminClient();
    const voiceId = crypto.randomUUID();
    const objectKey = `${userA.userId}/${voiceId}/reference.wav`;

    try {
      const upload = await admin.storage.from("references").upload(objectKey, MINIMAL_WAV, {
        contentType: "audio/wav",
        upsert: true,
      });
      if (upload.error) throw new Error(upload.error.message);

      const seed = await admin.from("voices").insert({
        id: voiceId,
        user_id: userA.userId,
        name: "Existing Voice",
        source: "uploaded",
        language: "English",
        reference_object_key: objectKey,
        reference_transcript: "seed",
      });
      if (seed.error) throw new Error(seed.error.message);

      const res = await apiFetch("/clone/finalize", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_id: voiceId,
          ...VALID_VOICE_PAYLOAD,
        }),
      });
      assertEquals(res.status, 500);
      await res.body?.cancel();

      const listing = await admin.storage.from("references").list(`${userA.userId}/${voiceId}`, {
        limit: 100,
      });
      if (listing.error) throw new Error(listing.error.message);
      const hasReference = (listing.data ?? []).some((obj) => obj.name === "reference.wav");
      assertEquals(hasReference, false);
    } finally {
      await admin.from("voices").delete().eq("id", voiceId).eq("user_id", userA.userId);
      await admin.storage.from("references").remove([objectKey]);
    }
  },
});

// --- Full clone flow: upload-url → upload → finalize ---
Deno.test("Full clone flow: upload-url → upload WAV → finalize", async () => {
  // Step 1: Get signed upload URL
  const urlRes = await apiFetch("/clone/upload-url", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(VALID_VOICE_PAYLOAD),
  });
  assertEquals(urlRes.status, 200);
  const { voice_id, upload_url } = await urlRes.json();

  // Step 2: Upload WAV to the signed URL
  const uploadRes = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": "audio/wav" },
    body: MINIMAL_WAV,
  });
  assertEquals(uploadRes.status, 200);
  await uploadRes.body?.cancel();

  // Step 3: Finalize the clone
  const finalRes = await apiFetch("/clone/finalize", userA.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      voice_id,
      ...VALID_VOICE_PAYLOAD,
    }),
  });
  assertEquals(finalRes.status, 200);
  const finalBody = await finalRes.json();
  assertEquals(finalBody.id, voice_id);
  assertExists(finalBody.name);
});

Deno.test({ name: "clone: teardown", sanitizeResources: false, sanitizeOps: false, fn: async () => {
  await deleteTestUser(userA.userId);
}});
