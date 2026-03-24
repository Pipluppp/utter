/**
 * Provider-agnostic billing tests: pack validation, credit usage / trials payload.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createUserWithBalance } from "./_helpers/factories.ts";
import {
    apiFetch,
    deleteTestUser,
    type TestUser,
} from "./_helpers/setup.ts";

let userA: TestUser;

function randomEmail(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}@test.local`;
}

describe("billing – credits", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    userA = await createUserWithBalance({
      email: randomEmail("billing_credits_a"),
      password: "password123",
      credits: 0,
      designTrials: 2,
      cloneTrials: 2,
    });
  });

  afterAll(async () => {
    await deleteTestUser(userA.userId);
  });

  it("POST /billing/checkout rejects invalid pack", async () => {
    const res = await apiFetch("/billing/checkout", userA.accessToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack_id: "pack_invalid" }),
    });

    expect(res.status).toBe(400);
    await res.body?.cancel();
  });

  it("GET /credits/usage includes trials payload", async () => {
    const res = await apiFetch("/credits/usage", userA.accessToken);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(typeof body.trials.design_remaining).toBe("number");
    expect(typeof body.trials.clone_remaining).toBe("number");
  });
});
