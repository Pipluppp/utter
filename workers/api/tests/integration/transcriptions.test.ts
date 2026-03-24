import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { MINIMAL_WAV, TEST_USER_A } from "./_helpers/fixtures.ts";
import {
    apiFetch,
    apiPublicFetch,
    createTestUser,
    deleteTestUser,
    type TestUser,
} from "./_helpers/setup.ts";

const HAS_QWEN_KEY = !!process.env.DASHSCOPE_API_KEY;

let userA: TestUser;

describe.skipIf(!HAS_QWEN_KEY)("transcriptions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
  });

  afterAll(async () => {
    await deleteTestUser(userA.userId);
  });

  it("POST /transcriptions without auth returns 401", async () => {
    const form = new FormData();
    form.set("audio", new File([MINIMAL_WAV], "sample.wav", { type: "audio/wav" }));
    form.set("language", "English");

    const res = await apiPublicFetch("/transcriptions", { method: "POST", body: form });
    expect(res.status).toBe(401);
    await res.body?.cancel();
  });

  it("POST /transcriptions rejects unsupported file types", async () => {
    const form = new FormData();
    form.set("audio", new File([MINIMAL_WAV], "sample.ogg", { type: "audio/ogg" }));

    const res = await apiFetch("/transcriptions", userA.accessToken, {
      method: "POST",
      body: form,
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(
      body.detail,
    ).toBe("File must be WAV, MP3, or M4A (got .ogg)");
  });

  it("POST /transcriptions rejects files over 10MB", async () => {
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    const form = new FormData();
    form.set(
      "audio",
      new File([oversized], "sample.wav", { type: "audio/wav" }),
    );

    const res = await apiFetch("/transcriptions", userA.accessToken, {
      method: "POST",
      body: form,
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.detail).toBe("File too large (max 10MB)");
  });

  it("POST /transcriptions returns normalized Qwen response or explicit upstream/config error", async () => {
    const form = new FormData();
    form.set("audio", new File([MINIMAL_WAV], "sample.wav", { type: "audio/wav" }));
    form.set("language", "English");

    const res = await apiFetch("/transcriptions", userA.accessToken, {
      method: "POST",
      body: form,
    });

    expect([200, 502, 503].includes(res.status)).toBe(true);
    const body = await res.json();

    if (res.status === 200) {
      expect(typeof body.text).toBe("string");
      expect(typeof body.model).toBe("string");
      expect(
        body.language === null || typeof body.language === "string",
      ).toBe(true);
      return;
    }

    expect(typeof body.detail).toBe("string");
  });
});
