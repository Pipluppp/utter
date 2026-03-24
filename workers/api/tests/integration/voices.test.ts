/**
 * /voices endpoint tests.
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

describe("voices", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
    userB = await createTestUser(TEST_USER_B.email, TEST_USER_B.password);

    // Seed a voice for User A via admin (bypasses edge function to isolate tests)
    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await client.from("voices").insert({
      id: "aaaaaaaa-0000-0000-0000-000000000001",
      user_id: userA.userId,
      name: "Seeded Voice A",
      source: "uploaded",
      language: "English",
      reference_transcript: "hello world",
    });
  });

  afterAll(async () => {
    await deleteTestUser(userA.userId);
    await deleteTestUser(userB.userId);
  });

  // --- voice listing ---
  describe("voice listing", () => {
  it("returns paginated voice list for authenticated user", async () => {
    const res = await apiFetch("/voices", userA.accessToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.voices).toBeDefined();
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.voices.length >= 1).toBe(true);
  });

  it("users cannot see another user's voices", async () => {
    const res = await apiFetch("/voices", userB.accessToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.voices.length).toBe(0);
  });

  it("supports search filter by voice name", async () => {
    const res = await apiFetch("/voices?search=Seeded", userA.accessToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.voices.length >= 1).toBe(true);
    expect(body.voices[0].name.includes("Seeded")).toBe(true);
  });

  it("supports source filter (uploaded vs designed)", async () => {
    const res = await apiFetch("/voices?source=designed", userA.accessToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Seeded voice is 'uploaded', so filtering for 'designed' should exclude it
    expect(
      body.voices.every((v: { source: string }) => v.source === "designed"),
    ).toBe(true);
  });

  it("supports pagination parameters", async () => {
    const res = await apiFetch("/voices?page=1&per_page=1", userA.accessToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pagination.per_page).toBe(1);
    expect(body.voices.length <= 1).toBe(true);
  });
  }); // end voice listing

  // --- voice deletion ---
  describe("voice deletion", () => {
  it("owner can delete their own voice", async () => {
    const res = await apiFetch("/voices/aaaaaaaa-0000-0000-0000-000000000001", userA.accessToken, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verify it's gone
    const listRes = await apiFetch("/voices", userA.accessToken);
    const listBody = await listRes.json();
    const found = listBody.voices.find(
      (v: { id: string }) => v.id === "aaaaaaaa-0000-0000-0000-000000000001",
    );
    expect(found).toBe(undefined);
  });

  it("returns 404 for non-existent voice", async () => {
    const res = await apiFetch("/voices/00000000-0000-0000-0000-000000000099", userA.accessToken, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
    await res.body?.cancel();
  });
  }); // end voice deletion

  // --- voice security ---
  describe("voice security", () => {
  it("rejects storage key outside user prefix as path traversal", async () => {
    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const maliciousVoiceId = crypto.randomUUID();

    try {
      const insertRes = await client.from("voices").insert({
        id: maliciousVoiceId,
        user_id: userA.userId,
        name: "Bad Key Voice",
        source: "uploaded",
        language: "English",
        reference_transcript: "hello world",
        reference_object_key: `${userB.userId}/foreign/reference.wav`,
      });
      expect(insertRes.error).toBe(null);

      const res = await apiFetch(`/voices/${maliciousVoiceId}/preview`, userA.accessToken);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.detail).toBe("Invalid storage object key.");
    } finally {
      await client.from("voices").delete().eq("id", maliciousVoiceId);
    }
  });
  }); // end voice security
});
