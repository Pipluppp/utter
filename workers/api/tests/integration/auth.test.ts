/**
 * Auth guard tests — verifies requireUser rejects unauthenticated / bad-token requests.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiPublicFetch } from "./_helpers/setup.ts";

describe("auth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /me without auth returns signed_in: false (not 401)", async () => {
    // /me is special — it gracefully returns unsigned state
    const res = await apiPublicFetch("/me");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signed_in).toBe(false);
  });

  it("GET /voices without auth returns 401", async () => {
    const res = await apiPublicFetch("/voices");
    expect(res.status).toBe(401);
    await res.body?.cancel();
  });

  it("GET /generations without auth returns 401", async () => {
    const res = await apiPublicFetch("/generations");
    expect(res.status).toBe(401);
    await res.body?.cancel();
  });

  it("POST /generate without auth returns 401", async () => {
    const res = await apiPublicFetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello" }),
    });
    expect(res.status).toBe(401);
    await res.body?.cancel();
  });

  it("POST /clone/upload-url without auth returns 401", async () => {
    const res = await apiPublicFetch("/clone/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    });
    expect(res.status).toBe(401);
    await res.body?.cancel();
  });

  it("POST /clone/finalize without auth returns 401", async () => {
    const res = await apiPublicFetch("/clone/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice_id: crypto.randomUUID() }),
    });
    expect(res.status).toBe(401);
    await res.body?.cancel();
  });

  it("GET /voices with invalid token returns 401", async () => {
    const res = await apiFetch("/voices", "bad-token-value");
    expect(res.status).toBe(401);
    await res.body?.cancel();
  });

  it("PATCH /profile without auth returns 401", async () => {
    const res = await apiPublicFetch("/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "test" }),
    });
    expect(res.status).toBe(401);
    await res.body?.cancel();
  });

  it("POST /voices/design/preview without auth returns 403 (feature disabled)", async () => {
    const res = await apiPublicFetch("/voices/design/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hi", instruct: "warm", language: "English" }),
    });
    expect(res.status).toBe(403);
    await res.body?.cancel();
  });

  it("POST /voices/design without auth returns 403 (feature disabled)", async () => {
    const form = new FormData();
    form.set("name", "test");
    form.set("text", "hello");
    form.set("language", "English");
    form.set("instruct", "warm");

    const res = await apiPublicFetch("/voices/design", {
      method: "POST",
      body: form,
    });
    expect(res.status).toBe(403);
    await res.body?.cancel();
  });

  it("GET /tasks/:id without auth returns 401", async () => {
    const res = await apiPublicFetch("/tasks/00000000-0000-0000-0000-000000000001");
    expect(res.status).toBe(401);
    await res.body?.cancel();
  });

  it("DELETE /tasks/:id without auth returns 401", async () => {
    const res = await apiPublicFetch("/tasks/00000000-0000-0000-0000-000000000001", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
    await res.body?.cancel();
  });

  it("POST /tasks/:id/cancel without auth returns 401", async () => {
    const res = await apiPublicFetch("/tasks/00000000-0000-0000-0000-000000000001/cancel", {
      method: "POST",
    });
    expect(res.status).toBe(401);
    await res.body?.cancel();
  });
});
