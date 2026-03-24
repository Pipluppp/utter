import { afterEach, describe, expect, it, vi } from "vitest";
import { apiPublicFetch } from "./_helpers/setup.ts";

describe("health", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /health returns { ok: true }", async () => {
    const res = await apiPublicFetch("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("GET /health works without auth", async () => {
    const res = await apiPublicFetch("/health");
    expect(res.status).toBe(200);
    await res.body?.cancel();
  });
});
