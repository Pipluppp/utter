/**
 * /generations endpoint tests.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TEST_USER_A, TEST_USER_B } from "./_helpers/fixtures.ts";
import {
    apiFetch,
    createTestUser,
    deleteTestUser,
    SERVICE_ROLE_KEY,
    SUPABASE_URL,
    type TestUser,
} from "./_helpers/setup.ts";

let userA: TestUser;
let userB: TestUser;
const GEN_ID = "aaaaaaaa-0000-0000-0000-000000000010";

describe("generations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
    userB = await createTestUser(TEST_USER_B.email, TEST_USER_B.password);

    // Seed a generation via admin
    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Need a voice for FK
    await client.from("voices").insert({
      id: "aaaaaaaa-0000-0000-0000-000000000011",
      user_id: userA.userId,
      name: "Gen Test Voice",
      source: "uploaded",
      language: "English",
      reference_transcript: "test",
    });

    await client.from("generations").insert({
      id: GEN_ID,
      user_id: userA.userId,
      voice_id: "aaaaaaaa-0000-0000-0000-000000000011",
      text: "Hello from test generation",
      language: "English",
      status: "completed",
    });
  });

  afterAll(async () => {
    // Clean up voice
    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await client.from("voices").delete().eq("id", "aaaaaaaa-0000-0000-0000-000000000011");

    await deleteTestUser(userA.userId);
    await deleteTestUser(userB.userId);
  });

  // --- generation listing ---
  describe("generation listing", () => {
  it("returns paginated generation list", async () => {
    const res = await apiFetch("/generations", userA.accessToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.generations).toBeDefined();
    expect(body.pagination).toBeDefined();
    expect(body.generations.length >= 1).toBe(true);
  });

  it("users cannot see another user's generations", async () => {
    const res = await apiFetch("/generations", userB.accessToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.generations.length).toBe(0);
  });

  it("supports search filter by text content", async () => {
    const res = await apiFetch(
      "/generations?search=Hello%20from%20test",
      userA.accessToken,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.generations.length >= 1).toBe(true);
  });

  it("supports status filter", async () => {
    const res = await apiFetch(
      "/generations?status=completed",
      userA.accessToken,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(
      body.generations.every((g: { status: string }) => g.status === "completed"),
    ).toBe(true);
  });

  it("includes voice name from joined voice record", async () => {
    const res = await apiFetch("/generations", userA.accessToken);
    const body = await res.json();
    const gen = body.generations.find((g: { id: string }) => g.id === GEN_ID);
    expect(gen).toBeDefined();
    expect(gen.voice_name).toBe("Gen Test Voice");
  });

  it("includes audio download path", async () => {
    const res = await apiFetch("/generations", userA.accessToken);
    const body = await res.json();
    const gen = body.generations.find((g: { id: string }) => g.id === GEN_ID);
    expect(gen).toBeDefined();
    expect(gen.audio_path).toBe(`/api/generations/${GEN_ID}/audio`);
  });
  }); // end generation listing

  // --- generation actions ---
  describe("generation actions", () => {
  it("regenerate returns voice and text for re-generation", async () => {
    const res = await apiFetch(`/generations/${GEN_ID}/regenerate`, userA.accessToken, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.voice_id).toBeDefined();
    expect(body.text).toBeDefined();
    expect(body.redirect_url).toBeDefined();
  });

  it("regenerate returns 404 for non-existent generation", async () => {
    const res = await apiFetch(
      "/generations/00000000-0000-0000-0000-000000000099/regenerate",
      userA.accessToken,
      { method: "POST" },
    );
    expect(res.status).toBe(404);
    await res.body?.cancel();
  });

  it("owner can delete their own generation", async () => {
    const res = await apiFetch(`/generations/${GEN_ID}`, userA.accessToken, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 404 for non-existent generation", async () => {
    const res = await apiFetch(
      "/generations/00000000-0000-0000-0000-000000000099",
      userA.accessToken,
      { method: "DELETE" },
    );
    expect(res.status).toBe(404);
    await res.body?.cancel();
  });
  }); // end generation actions

  // --- generation security ---
  describe("generation security", () => {
  it("rejects audio storage key outside user prefix as path traversal", async () => {
    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const maliciousGenerationId = crypto.randomUUID();

    try {
      const insertRes = await client.from("generations").insert({
        id: maliciousGenerationId,
        user_id: userA.userId,
        text: "malicious audio key test",
        language: "English",
        status: "completed",
        audio_object_key: `${userB.userId}/foreign.wav`,
      });
      expect(insertRes.error).toBe(null);

      const res = await apiFetch(`/generations/${maliciousGenerationId}/audio`, userA.accessToken);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.detail).toBe("Invalid storage object key.");
    } finally {
      await client.from("generations").delete().eq("id", maliciousGenerationId);
    }
  });
  }); // end generation security
});
