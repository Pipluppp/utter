/** R2 test helpers — interact with local R2 via the API Worker's admin storage endpoints */

import { API_URL, SERVICE_ROLE_KEY } from "./setup.ts";

export interface R2ListEntry {
  key: string;
  size: number;
}

export interface R2HeadResult {
  size: number;
}

const adminHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
});

/** Upload bytes to local R2 via the API Worker admin endpoint. */
export async function r2Upload(
  bucket: string,
  key: string,
  data: Uint8Array,
  contentType: string,
): Promise<void> {
  const url = `${API_URL}/storage/admin/upload?bucket=${bucket}&key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...adminHeaders(), "Content-Type": contentType },
    body: data as unknown as BodyInit,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`r2Upload failed (${res.status}): ${body}`);
  }
}

/** Remove one or more objects from local R2. */
export async function r2Remove(
  bucket: string,
  keys: string[],
): Promise<void> {
  const url = `${API_URL}/storage/admin/remove?bucket=${bucket}&keys=${keys.map(encodeURIComponent).join(",")}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: adminHeaders(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`r2Remove failed (${res.status}): ${body}`);
  }
}

/** List objects under a prefix in local R2. */
export async function r2List(
  bucket: string,
  prefix: string,
): Promise<R2ListEntry[]> {
  const url = `${API_URL}/storage/admin/list?bucket=${bucket}&prefix=${encodeURIComponent(prefix)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: adminHeaders(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`r2List failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as { objects: R2ListEntry[] };
  return json.objects;
}

/** Get object metadata (size) from local R2. Returns null on 404. */
export async function r2Head(
  bucket: string,
  key: string,
): Promise<R2HeadResult | null> {
  const url = `${API_URL}/storage/admin/head?bucket=${bucket}&key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: adminHeaders(),
  });
  if (res.status === 404) {
    await res.body?.cancel();
    return null;
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`r2Head failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as { size: number };
  return { size: json.size };
}

/** Poll r2Head until the object exists and meets a minimum size threshold. */
export async function waitForR2ObjectSize(
  bucket: string,
  key: string,
  minBytes: number,
  maxAttempts = 20,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const head = await r2Head(bucket, key);
    if (head && head.size >= minBytes) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}
