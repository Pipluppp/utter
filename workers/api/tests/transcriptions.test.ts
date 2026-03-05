import { assertEquals } from "@std/assert"

import {
  apiFetch,
  apiPublicFetch,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./_helpers/setup.ts"
import { MINIMAL_WAV, TEST_USER_A } from "./_helpers/fixtures.ts"

let userA: TestUser

Deno.test({
  name: "transcriptions: setup",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password)
  },
})

Deno.test({
  name: "POST /transcriptions without auth returns 401",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const form = new FormData()
    form.set("audio", new File([MINIMAL_WAV], "sample.wav", { type: "audio/wav" }))
    form.set("language", "English")

    const res = await apiPublicFetch("/transcriptions", { method: "POST", body: form })
    assertEquals(res.status, 401)
    await res.body?.cancel()
  },
})

Deno.test({
  name: "POST /transcriptions handles enabled/disabled environments",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const form = new FormData()
    form.set("audio", new File([MINIMAL_WAV], "sample.wav", { type: "audio/wav" }))
    form.set("language", "English")

    const res = await apiFetch("/transcriptions", userA.accessToken, {
      method: "POST",
      body: form,
    })
    // Local env may have transcription disabled (503) or enabled (200 with valid Mistral key).
    assertEquals(res.status === 503 || res.status === 200, true)
    await res.body?.cancel()
  },
})

Deno.test({
  name: "transcriptions: teardown",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    await deleteTestUser(userA.userId)
  },
})
