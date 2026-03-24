import { afterEach, describe, expect, it, vi } from "vitest";
import { apiPublicFetch } from "./_helpers/setup.ts";

describe("languages", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /languages returns language list with defaults", async () => {
    const res = await apiPublicFetch("/languages");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.default).toBe("Auto");
    expect(body.provider).toBe("qwen");
    expect(Array.isArray(body.languages)).toBe(true);
    expect(body.languages).toEqual(expect.arrayContaining(["Auto", "English", "Chinese"]));
    expect(body.capabilities.supports_generate).toBe(true);
    expect(body.capabilities.supports_generate_stream).toBe(false);
    expect(body.capabilities.default_generate_mode).toBe("task");
    expect(body.capabilities.allow_generate_mode_toggle).toBe(false);
    expect(typeof body.capabilities.max_text_chars).toBe("number");
  });

  it("GET /languages includes Qwen transcription config", async () => {
    const res = await apiPublicFetch("/languages");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.transcription.provider).toBe("qwen");
    expect(typeof body.transcription.enabled).toBe("boolean");
    expect(typeof body.transcription.model).toBe("string");
  });

  it("GET /languages works without auth", async () => {
    const res = await apiPublicFetch("/languages");
    expect(res.status).toBe(200);
    await res.body?.cancel();
  });
});
