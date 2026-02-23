/** Test utilities: user creation, auth, API fetch helpers */

// Local Supabase development keys (standard across all local installs)
export const SUPABASE_URL = "http://127.0.0.1:54321";
export const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
export const API_URL = `${SUPABASE_URL}/functions/v1/api`;

export interface TestUser {
  accessToken: string;
  userId: string;
}

/**
 * Create or sign-in a test user. Returns access token + user ID.
 * Tries sign-in first (user may exist from previous runs), falls back to sign-up.
 */
export async function createTestUser(
  email: string,
  password: string,
): Promise<TestUser> {
  // Try sign-in first
  const signInRes = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ email, password }),
    },
  );
  if (signInRes.ok) {
    const data = await signInRes.json();
    return { accessToken: data.access_token, userId: data.user.id };
  }
  await signInRes.body?.cancel();

  // Fall back to sign-up
  const signUpRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!signUpRes.ok) {
    const err = await signUpRes.text();
    throw new Error(`Failed to create test user ${email}: ${err}`);
  }
  const data = await signUpRes.json();
  return { accessToken: data.access_token, userId: data.user.id };
}

/**
 * Delete a test user via the Auth admin API (service_role).
 */
export async function deleteTestUser(userId: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
  });
}

/**
 * Authenticated fetch helper — calls edge function API with auth headers.
 */
export function apiFetch(
  path: string,
  token: string | null,
  init?: RequestInit,
): Promise<Response> {
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    ...(init?.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
}

/**
 * Unauthenticated fetch — calls edge function API without auth.
 */
export function apiPublicFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return apiFetch(path, null, init);
}
