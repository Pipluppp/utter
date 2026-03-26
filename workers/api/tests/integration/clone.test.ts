/**
 * /clone endpoint tests.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createUserWithBalance } from "./_helpers/factories.ts";
import {
    MINIMAL_WAV,
    TEST_USER_A,
    VALID_VOICE_PAYLOAD,
} from "./_helpers/fixtures.ts";
import { r2List, r2Remove, r2Upload, waitForR2ObjectSize } from "./_helpers/r2.ts";
import {
    apiFetch,
    deleteTestUser,
    SERVICE_ROLE_KEY,
    SUPABASE_URL,
    type TestUser,
} from "./_helpers/setup.ts";

let userA: TestUser;
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}



describe("clone", () => {
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
  });

  afterAll(async () => {
    await deleteTestUser(userA.userId);
  });

  // --- clone upload ---
  describe("clone upload", () => {
  it("returns signed upload URL and voice ID", async () => {
    const res = await apiFetch("/clone/upload-url", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_VOICE_PAYLOAD),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.voice_id).toBeDefined();
    expect(body.upload_url).toBeDefined();
    expect(body.object_key).toBeDefined();
  });

  it("rejects missing voice name", async () => {
    const res = await apiFetch("/clone/upload-url", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "English", transcript: "hello" }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("rejects missing language", async () => {
    const res = await apiFetch("/clone/upload-url", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", transcript: "hello" }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("rejects missing transcript", async () => {
    const res = await apiFetch("/clone/upload-url", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", language: "English" }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("rejects voice name exceeding 100 characters", async () => {
    const res = await apiFetch("/clone/upload-url", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "x".repeat(101),
        language: "English",
        transcript: "hello",
      }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });
  }); // end clone upload

  // --- clone finalize ---
  describe("clone finalize", () => {
  it("rejects finalize when no audio was uploaded", async () => {
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
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("rejects finalize without voice ID", async () => {
    const res = await apiFetch("/clone/finalize", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test",
        language: "English",
        transcript: "hello",
      }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("uses trial balance before debiting credits", async () => {
    const admin = getAdminClient();
    await admin
      .from("profiles")
      .update({ credits_remaining: 400, clone_trials_remaining: 2 })
      .eq("id", userA.userId);

    let voiceId = "";
    let objectKey = "";
    try {
      const urlRes = await apiFetch("/clone/upload-url", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_VOICE_PAYLOAD),
      });
      expect(urlRes.status).toBe(200);
      const uploadPayload = await urlRes.json();
      voiceId = uploadPayload.voice_id as string;
      objectKey = uploadPayload.object_key as string;

      const uploadRes = await fetch(uploadPayload.upload_url as string, {
        method: "PUT",
        headers: { "Content-Type": "audio/wav" },
        body: MINIMAL_WAV,
      });
      expect(uploadRes.status).toBe(200);
      await uploadRes.body?.cancel();

      const finalizeRes = await apiFetch("/clone/finalize", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_id: voiceId,
          ...VALID_VOICE_PAYLOAD,
        }),
      });
      expect(finalizeRes.status).toBe(200);
      await finalizeRes.body?.cancel();

      const profile = await admin
        .from("profiles")
        .select("credits_remaining, clone_trials_remaining")
        .eq("id", userA.userId)
        .single();
      expect(profile.error).toBe(null);
      expect(profile.data?.credits_remaining).toBe(400);
      expect(profile.data?.clone_trials_remaining).toBe(1);
    } finally {
      if (voiceId) {
        await admin.from("voices").delete().eq("id", voiceId).eq(
          "user_id",
          userA.userId,
        );
      }
      if (objectKey) {
        await r2Remove("references", [objectKey]);
      }
      await admin
        .from("profiles")
        .update({ credits_remaining: 250000, clone_trials_remaining: 2 })
        .eq("id", userA.userId);
    }
  });

  it("duplicate finalize is idempotent and does not double-consume trial", async () => {
    const admin = getAdminClient();
    await admin
      .from("profiles")
      .update({ credits_remaining: 250000, clone_trials_remaining: 2 })
      .eq("id", userA.userId);

    let voiceId = "";
    let objectKey = "";
    try {
      const urlRes = await apiFetch("/clone/upload-url", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_VOICE_PAYLOAD),
      });
      expect(urlRes.status).toBe(200);
      const uploadPayload = await urlRes.json();
      voiceId = uploadPayload.voice_id as string;
      objectKey = uploadPayload.object_key as string;

      const uploadRes = await fetch(uploadPayload.upload_url as string, {
        method: "PUT",
        headers: { "Content-Type": "audio/wav" },
        body: MINIMAL_WAV,
      });
      expect(uploadRes.status).toBe(200);
      await uploadRes.body?.cancel();

      const finalizePayload = {
        voice_id: voiceId,
        ...VALID_VOICE_PAYLOAD,
      };

      const finalizeFirst = await apiFetch("/clone/finalize", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalizePayload),
      });
      expect(finalizeFirst.status).toBe(200);
      const firstBody = await finalizeFirst.json();
      expect(firstBody.id).toBe(voiceId);

      const firstProfile = await admin
        .from("profiles")
        .select("clone_trials_remaining")
        .eq("id", userA.userId)
        .single();
      expect(firstProfile.error).toBe(null);
      expect(firstProfile.data?.clone_trials_remaining).toBe(1);

      const finalizeSecond = await apiFetch(
        "/clone/finalize",
        userA.accessToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalizePayload),
        },
      );
      expect(finalizeSecond.status).toBe(200);
      const secondBody = await finalizeSecond.json();
      expect(secondBody.id).toBe(voiceId);

      const secondProfile = await admin
        .from("profiles")
        .select("clone_trials_remaining")
        .eq("id", userA.userId)
        .single();
      expect(secondProfile.error).toBe(null);
      expect(secondProfile.data?.clone_trials_remaining).toBe(1);
    } finally {
      if (voiceId) {
        await admin.from("voices").delete().eq("id", voiceId).eq(
          "user_id",
          userA.userId,
        );
      }
      if (objectKey) {
        await r2Remove("references", [objectKey]);
      }
      await admin
        .from("profiles")
        .update({ credits_remaining: 250000, clone_trials_remaining: 2 })
        .eq("id", userA.userId);
    }
  });

  it("debits 200 credits when clone trials are exhausted", async () => {
    const admin = getAdminClient();
    await admin
      .from("profiles")
      .update({ credits_remaining: 1500, clone_trials_remaining: 0 })
      .eq("id", userA.userId);

    let voiceId = "";
    let objectKey = "";
    try {
      const urlRes = await apiFetch("/clone/upload-url", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_VOICE_PAYLOAD),
      });
      expect(urlRes.status).toBe(200);
      const uploadPayload = await urlRes.json();
      voiceId = uploadPayload.voice_id as string;
      objectKey = uploadPayload.object_key as string;

      const uploadRes = await fetch(uploadPayload.upload_url as string, {
        method: "PUT",
        headers: { "Content-Type": "audio/wav" },
        body: MINIMAL_WAV,
      });
      expect(uploadRes.status).toBe(200);
      await uploadRes.body?.cancel();

      const finalizeRes = await apiFetch("/clone/finalize", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_id: voiceId,
          ...VALID_VOICE_PAYLOAD,
        }),
      });
      expect(finalizeRes.status).toBe(200);
      await finalizeRes.body?.cancel();

      const profile = await admin
        .from("profiles")
        .select("credits_remaining, clone_trials_remaining")
        .eq("id", userA.userId)
        .single();
      expect(profile.error).toBe(null);
      expect(profile.data?.credits_remaining).toBe(1300);
      expect(profile.data?.clone_trials_remaining).toBe(0);
    } finally {
      if (voiceId) {
        await admin.from("voices").delete().eq("id", voiceId).eq(
          "user_id",
          userA.userId,
        );
      }
      if (objectKey) {
        await r2Remove("references", [objectKey]);
      }
      await admin
        .from("profiles")
        .update({ credits_remaining: 250000, clone_trials_remaining: 2 })
        .eq("id", userA.userId);
    }
  });

  it("returns 402 when credits insufficient and no trials remain", async () => {
    const admin = getAdminClient();
    await admin
      .from("profiles")
      .update({ credits_remaining: 2, clone_trials_remaining: 0 })
      .eq("id", userA.userId);

    let voiceId = "";
    let objectKey = "";

    try {
      const urlRes = await apiFetch("/clone/upload-url", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_VOICE_PAYLOAD),
      });
      expect(urlRes.status).toBe(200);
      const uploadPayload = await urlRes.json();
      voiceId = uploadPayload.voice_id as string;
      objectKey = uploadPayload.object_key as string;

      const uploadRes = await fetch(uploadPayload.upload_url as string, {
        method: "PUT",
        headers: { "Content-Type": "audio/wav" },
        body: MINIMAL_WAV,
      });
      expect(uploadRes.status).toBe(200);
      await uploadRes.body?.cancel();

      const finalizeRes = await apiFetch("/clone/finalize", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_id: voiceId,
          ...VALID_VOICE_PAYLOAD,
        }),
      });
      expect(finalizeRes.status).toBe(402);
      const body = await finalizeRes.json();
      expect(typeof body.detail).toBe("string");
    } finally {
      await admin
        .from("profiles")
        .update({ credits_remaining: 250000, clone_trials_remaining: 2 })
        .eq("id", userA.userId);
      if (voiceId) {
        await admin.from("voices").delete().eq("id", voiceId).eq(
          "user_id",
          userA.userId,
        );
      }
      if (objectKey) {
        await r2Remove("references", [objectKey]);
      }
    }
  });

  it("rejects reference audio exceeding size limit", async () => {
    const admin = getAdminClient();
    const voiceId = crypto.randomUUID();
    const objectKey = `${userA.userId}/${voiceId}/reference.wav`;
    const oversizedAudio = new Uint8Array(MAX_REFERENCE_BYTES + 1);

    try {
      await r2Upload("references", objectKey, oversizedAudio, "audio/wav");

      const sizeReady = await waitForR2ObjectSize(
        "references",
        objectKey,
        oversizedAudio.length,
      );
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

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(typeof body.detail).toBe("string");
    } finally {
      await r2Remove("references", [objectKey]);
      await admin.from("voices").delete().eq("id", voiceId).eq(
        "user_id",
        userA.userId,
      );
    }
  });

  it("cleans up orphaned storage when voice insert fails", async () => {
    const admin = getAdminClient();
    let voiceId = "";
    let objectKey = "";

    try {
      const urlRes = await apiFetch("/clone/upload-url", userA.accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_VOICE_PAYLOAD),
      });
      expect(urlRes.status).toBe(200);
      const uploadPayload = await urlRes.json();
      voiceId = uploadPayload.voice_id as string;
      objectKey = uploadPayload.object_key as string;

      const uploadRes = await fetch(uploadPayload.upload_url as string, {
        method: "PUT",
        headers: { "Content-Type": "audio/wav" },
        body: MINIMAL_WAV,
      });
      expect(uploadRes.status).toBe(200);
      await uploadRes.body?.cancel();

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
      expect(res.status).toBe(500);
      await res.body?.cancel();

      const listing = await r2List("references", `${userA.userId}/${voiceId}`);
      const hasReference = listing.some((obj) =>
        obj.key.endsWith("reference.wav")
      );
      expect(hasReference).toBe(false);
    } finally {
      await admin.from("voices").delete().eq("id", voiceId).eq(
        "user_id",
        userA.userId,
      );
      await r2Remove("references", [objectKey]);
    }
  });
  }); // end clone finalize

  // --- clone flow ---
  describe("clone flow", () => {
  it("full clone flow: upload → finalize creates voice", async () => {
    // Step 1: Get signed upload URL
    const urlRes = await apiFetch("/clone/upload-url", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_VOICE_PAYLOAD),
    });
    expect(urlRes.status).toBe(200);
    const { voice_id, upload_url } = await urlRes.json();

    // Step 2: Upload WAV to the signed URL
    const uploadRes = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": "audio/wav" },
      body: MINIMAL_WAV,
    });
    expect(uploadRes.status).toBe(200);
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
    expect(finalRes.status).toBe(200);
    const finalBody = await finalRes.json();
    expect(finalBody.id).toBe(voice_id);
    expect(finalBody.name).toBeDefined();
  });
  }); // end clone flow
});
