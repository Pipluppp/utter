/**
 * /me and /profile endpoint tests.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TEST_USER_A } from "./_helpers/fixtures.ts";
import {
    apiFetch,
    apiPublicFetch,
    createTestUser,
    deleteTestUser,
    SERVICE_ROLE_KEY,
    SUPABASE_URL,
    type TestUser,
} from "./_helpers/setup.ts";

let userA: TestUser;

describe("me", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    await admin
      .from("profiles")
      .update({ credits_remaining: 0 })
      .eq("id", userA.userId);
  });

  afterAll(async () => {
    if (userA) await deleteTestUser(userA.userId);
  });

  // --- authentication ---
  describe("authentication", () => {
  it("authenticated user sees their profile", async () => {
    const res = await apiFetch("/me", userA.accessToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signed_in).toBe(true);
    expect(body.user).toBeDefined();
    expect(body.profile).toBeDefined();
    expect(body.profile.id).toBe(userA.userId);
    expect(body.profile.subscription_tier).toBe("free");
    expect(body.profile.credits_remaining).toBe(0);
  });

  it("unauthenticated request returns signed_in false", async () => {
    const res = await apiPublicFetch("/me");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signed_in).toBe(false);
    expect(body.profile).toBe(null);
  });
  }); // end authentication

  // --- profile updates ---
  describe("profile updates", () => {
  it("can update display name", async () => {
    const res = await apiFetch("/profile", userA.accessToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "Test User A" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.display_name).toBe("Test User A");
  });

  it("ignores server-owned fields like credits and subscription tier", async () => {
    const res = await apiFetch("/profile", userA.accessToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: "Safe Update",
        subscription_tier: "pro",
        credits_remaining: 999999,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.display_name).toBe("Safe Update");
    expect(body.profile.subscription_tier).toBe("free");
    expect(body.profile.credits_remaining).toBe(0);
  });

  it("can update handle", async () => {
    const handle = `test_${Date.now()}`;
    const res = await apiFetch("/profile", userA.accessToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.handle).toBe(handle);
  });
  }); // end profile updates

  // --- profile validation ---
  describe("profile validation", () => {
  it("rejects handle shorter than minimum length", async () => {
    const res = await apiFetch("/profile", userA.accessToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "ab" }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("rejects handle with special characters", async () => {
    const res = await apiFetch("/profile", userA.accessToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: "test@user" }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("rejects empty update body", async () => {
    const res = await apiFetch("/profile", userA.accessToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("rejects invalid avatar URL format", async () => {
    const res = await apiFetch("/profile", userA.accessToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_url: "not-a-url" }),
    });
    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("accepts null avatar URL to clear it", async () => {
    const res = await apiFetch("/profile", userA.accessToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatar_url: null }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.avatar_url).toBe(null);
  });
  }); // end profile validation
});
