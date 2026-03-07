import { Hono } from "hono";

import {
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
