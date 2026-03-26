import { Hono } from "hono";

import { envBinding, envGet } from "../_shared/runtime_env.ts";
import {
    type StorageBucketName,
    createStorageProvider,
    verifySignedStorageToken,
} from "../_shared/storage.ts";
import { createAdminClient } from "../_shared/supabase.ts";

function jsonDetail(detail: string, status: number) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getTokenFromUrl(req: Request): string | null {
  const token = new URL(req.url).searchParams.get("token")?.trim();
  return token && token.length > 0 ? token : null;
}

async function handleSignedUpload(req: Request): Promise<Response> {
  const token = getTokenFromUrl(req);
  if (!token) return jsonDetail("Missing storage token.", 400);

  const claims = await verifySignedStorageToken(token, "upload");
  if (!claims) return jsonDetail("Invalid or expired storage token.", 403);

  const body = await req.arrayBuffer();
  if (body.byteLength < 1) return jsonDetail("Request body is empty.", 400);

  const admin = createAdminClient();
  const storage = createStorageProvider({ admin, req });
  const upload = await storage.upload(
    claims.bucket,
    claims.key,
    new Uint8Array(body),
    {
      contentType: req.headers.get("content-type") || "application/octet-stream",
      upsert: true,
    },
  );

  if (upload.error) {
    return jsonDetail("Failed to upload object.", 500);
  }

  return new Response(null, { status: 200 });
}

export const storageRoutes = new Hono();

storageRoutes.put("/storage/upload", async (c) => {
  return await handleSignedUpload(c.req.raw);
});

storageRoutes.post("/storage/upload", async (c) => {
  return await handleSignedUpload(c.req.raw);
});

storageRoutes.get("/storage/download", async (c) => {
  const token = getTokenFromUrl(c.req.raw);
  if (!token) return jsonDetail("Missing storage token.", 400);

  const claims = await verifySignedStorageToken(token, "download");
  if (!claims) return jsonDetail("Invalid or expired storage token.", 403);

  const admin = createAdminClient();
  const storage = createStorageProvider({ admin, req: c.req.raw });
  const download = await storage.download(claims.bucket, claims.key);
  if (download.error) return jsonDetail("Failed to download object.", 500);
  if (!download.data) return jsonDetail("Object not found.", 404);

  const contentType = download.data.type || "application/octet-stream";
  return new Response(download.data, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
});

// ---------------------------------------------------------------------------
// Admin storage routes — gated by SUPABASE_SERVICE_ROLE_KEY
// ---------------------------------------------------------------------------

const VALID_BUCKETS = new Set<StorageBucketName>(["references", "generations"]);

function requireServiceRole(req: Request): Response | null {
  const header = req.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return jsonDetail("Missing or malformed Authorization header.", 403);
  }
  const token = header.slice("Bearer ".length).trim();
  const serviceRoleKey = envGet("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey || token !== serviceRoleKey) {
    return jsonDetail("Invalid service-role key.", 403);
  }
  return null;
}

function parseBucket(raw: string | null): StorageBucketName | null {
  if (raw && VALID_BUCKETS.has(raw as StorageBucketName)) {
    return raw as StorageBucketName;
  }
  return null;
}

function getR2Bucket(bucket: StorageBucketName): R2Bucket {
  const bindingName = bucket === "references" ? "R2_REFERENCES" : "R2_GENERATIONS";
  const binding = envBinding<R2Bucket>(bindingName);
  if (!binding) {
    throw new Error(`Missing R2 binding: ${bindingName}`);
  }
  return binding;
}

storageRoutes.put("/storage/admin/upload", async (c) => {
  const authErr = requireServiceRole(c.req.raw);
  if (authErr) return authErr;

  const url = new URL(c.req.raw.url);
  const bucketRaw = url.searchParams.get("bucket");
  const key = url.searchParams.get("key")?.trim();

  if (!bucketRaw || !key) {
    return jsonDetail("Missing required query params: bucket, key.", 400);
  }

  const bucket = parseBucket(bucketRaw);
  if (!bucket) {
    return jsonDetail(`Invalid bucket: ${bucketRaw}. Must be references or generations.`, 400);
  }

  const admin = createAdminClient();
  const storage = createStorageProvider({ admin, req: c.req.raw });
  const body = await c.req.raw.arrayBuffer();
  const result = await storage.upload(bucket, key, new Uint8Array(body), {
    contentType: c.req.raw.headers.get("content-type") || "application/octet-stream",
    upsert: true,
  });

  if (result.error) {
    return jsonDetail(`R2 upload failed: ${result.error.message}`, 500);
  }

  return new Response(null, { status: 200 });
});

storageRoutes.get("/storage/admin/list", async (c) => {
  const authErr = requireServiceRole(c.req.raw);
  if (authErr) return authErr;

  const url = new URL(c.req.raw.url);
  const bucketRaw = url.searchParams.get("bucket");
  const prefix = url.searchParams.get("prefix");

  if (!bucketRaw || prefix === null || prefix === undefined) {
    return jsonDetail("Missing required query params: bucket, prefix.", 400);
  }

  const bucket = parseBucket(bucketRaw);
  if (!bucket) {
    return jsonDetail(`Invalid bucket: ${bucketRaw}. Must be references or generations.`, 400);
  }

  const admin = createAdminClient();
  const storage = createStorageProvider({ admin, req: c.req.raw });
  const result = await storage.list(bucket, prefix);

  if (result.error) {
    return jsonDetail(`R2 list failed: ${result.error.message}`, 500);
  }

  const objects = (result.data ?? []).map((obj) => ({
    key: obj.name,
    size: typeof obj.size === "number" ? obj.size : 0,
  }));

  return c.json({ objects }, 200);
});

storageRoutes.get("/storage/admin/head", async (c) => {
  const authErr = requireServiceRole(c.req.raw);
  if (authErr) return authErr;

  const url = new URL(c.req.raw.url);
  const bucketRaw = url.searchParams.get("bucket");
  const key = url.searchParams.get("key")?.trim();

  if (!bucketRaw || !key) {
    return jsonDetail("Missing required query params: bucket, key.", 400);
  }

  const bucket = parseBucket(bucketRaw);
  if (!bucket) {
    return jsonDetail(`Invalid bucket: ${bucketRaw}. Must be references or generations.`, 400);
  }

  let r2: R2Bucket;
  try {
    r2 = getR2Bucket(bucket);
  } catch (err) {
    return jsonDetail((err as Error).message, 500);
  }

  const head = await r2.head(key);
  if (!head) {
    return jsonDetail("Object not found.", 404);
  }

  return c.json({ size: head.size }, 200);
});

storageRoutes.delete("/storage/admin/remove", async (c) => {
  const authErr = requireServiceRole(c.req.raw);
  if (authErr) return authErr;

  const url = new URL(c.req.raw.url);
  const bucketRaw = url.searchParams.get("bucket");
  const keysRaw = url.searchParams.get("keys");

  if (!bucketRaw || !keysRaw) {
    return jsonDetail("Missing required query params: bucket, keys.", 400);
  }

  const bucket = parseBucket(bucketRaw);
  if (!bucket) {
    return jsonDetail(`Invalid bucket: ${bucketRaw}. Must be references or generations.`, 400);
  }

  const keys = keysRaw.split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) {
    return jsonDetail("No valid keys provided.", 400);
  }

  const admin = createAdminClient();
  const storage = createStorageProvider({ admin, req: c.req.raw });
  const result = await storage.remove(bucket, keys);

  if (result.error) {
    return jsonDetail(`R2 remove failed: ${result.error.message}`, 500);
  }

  return new Response(null, { status: 200 });
});
