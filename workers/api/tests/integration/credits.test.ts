/**
 * /credits endpoint tests.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TEST_USER_A } from "./_helpers/fixtures.ts";
import {
    apiFetch,
    apiPublicFetch,
    createTestUser,
    deleteTestUser,
    type TestUser,
} from "./_helpers/setup.ts";

let userA: TestUser;

describe("credits", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    userA = await createTestUser(TEST_USER_A.email, TEST_USER_A.password);
  });

  afterAll(async () => {
    await deleteTestUser(userA.userId);
  });

  it("GET /credits/usage returns usage summary payload", async () => {
    const res = await apiFetch("/credits/usage", userA.accessToken);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.credit_unit).toBe("1 credit = 1 character");
    expect(typeof body.window_days).toBe("number");
    expect(body.plan).toBeDefined();
    expect(typeof body.plan.tier).toBe("string");
    expect(body.plan.monthly_credits).toBe(undefined);
    expect(typeof body.balance).toBe("number");
    expect(typeof body.trials.design_remaining).toBe("number");
    expect(typeof body.trials.clone_remaining).toBe("number");
    expect(typeof body.usage.debited).toBe("number");
    expect(typeof body.usage.credited).toBe("number");
    expect(typeof body.usage.net).toBe("number");
    expect(Array.isArray(body.rate_card)).toBe(true);
    expect(Array.isArray(body.events)).toBe(true);
  });

  it("GET /credits/usage requires auth", async () => {
    const res = await apiPublicFetch("/credits/usage");
    expect(res.status).toBe(401);
    await res.body?.cancel();
  });
});
