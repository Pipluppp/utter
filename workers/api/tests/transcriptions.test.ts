import { assertEquals } from "@std/assert";

import {
  apiFetch,
  apiPublicFetch,
  createTestUser,
  deleteTestUser,
  isLocalSupabaseAvailable,
  type TestUser,
} from "./_helpers/setup.ts";
import { MINIMAL_WAV, TEST_USER_A } from "./_helpers/fixtures.ts";

let userA: TestUser | null = null;
let canRunAuthedFlow = false;

Deno.test({
  name: "transcriptions: setup",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    canRunAuthedFlow = await isLocalSupabaseAvailable();
    if (!canRunAuthedFlow) {
      console.warn(
        "Skipping auth-backed transcription integration checks: local Supabase auth is unreachable.",
      );
      return;
    }

    userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
  },
});

Deno.test({
  name: "POST /transcriptions without auth returns 401",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    if (!canRunAuthedFlow) return;

    const form = new FormData();
    form.set("audio", new File([MINIMAL_WAV], "sample.wav", { type: "audio/wav" }));
    form.set("language", "English");

    const res = await apiPublicFetch("/transcriptions", { method: "POST", body: form });
    assertEquals(res.status, 401);
    await res.body?.cancel();
  },
});

Deno.test({
  name: "POST /transcriptions rejects unsupported file types",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    if (!canRunAuthedFlow || !userA) return;

    const form = new FormData();
    form.set("audio", new File([MINIMAL_WAV], "sample.ogg", { type: "audio/ogg" }));

    const res = await apiFetch("/transcriptions", userA.accessToken, {
      method: "POST",
      body: form,
    });
    assertEquals(res.status, 400);

    const body = await res.json();
    assertEquals(
      body.detail,
      "File must be WAV, MP3, or M4A (got .ogg)",
    );
  },
});

Deno.test({
  name: "POST /transcriptions rejects files over 10MB",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    if (!canRunAuthedFlow || !userA) return;

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
    assertEquals(res.status, 400);

    const body = await res.json();
    assertEquals(body.detail, "File too large (max 10MB)");
  },
});

Deno.test({
  name: "POST /transcriptions returns normalized Qwen response or explicit upstream/config error",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    if (!canRunAuthedFlow || !userA) return;

    const form = new FormData();
    form.set("audio", new File([MINIMAL_WAV], "sample.wav", { type: "audio/wav" }));
    form.set("language", "English");

    const res = await apiFetch("/transcriptions", userA.accessToken, {
      method: "POST",
      body: form,
    });

    assertEquals([200, 502, 503].includes(res.status), true);
    const body = await res.json();

    if (res.status === 200) {
      assertEquals(typeof body.text, "string");
      assertEquals(typeof body.model, "string");
      assertEquals(
        body.language === null || typeof body.language === "string",
        true,
      );
      return;
    }

    assertEquals(typeof body.detail, "string");
  },
});

Deno.test({
  name: "transcriptions: teardown",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    if (!userA) return;
    await deleteTestUser(userA.userId);
  },
});
