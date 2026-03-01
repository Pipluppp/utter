import type { SupabaseClient } from "@supabase/supabase-js";

import { envBinding, envGet } from "./runtime_env.ts";
import { resolveStorageUrl } from "./urls.ts";

export type StorageBucketName = "references" | "generations";
export type StorageProviderMode = "supabase" | "hybrid" | "r2";

type StorageError = { message: string };

type SignedUrlResult = {
  data: { signedUrl: string } | null;
  error: StorageError | null;
};

type StorageListObject = {
  name: string;
  size?: number | string | null;
  metadata?: {
    size?: number | string | null;
    contentLength?: number | string | null;
  };
};

type StorageListResult = {
  data: StorageListObject[] | null;
  error: StorageError | null;
};

type StorageUploadResult = {
  error: StorageError | null;
};

type StorageDownloadResult = {
  data: Blob | null;
  error: StorageError | null;
};

type StorageRemoveResult = {
  error: StorageError | null;
};

type SignedStorageAction = "upload" | "download";

type SignedStorageTokenPayload = {
  v: 1;
  action: SignedStorageAction;
  bucket: StorageBucketName;
  key: string;
  exp: number;
};

type CreateStorageProviderParams = {
  admin: SupabaseClient;
  req: Request;
};

function toStorageError(error: unknown): StorageError {
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return { message };
    }
  }
  return { message: "Storage operation failed." };
}

function resolveStorageProviderMode(): StorageProviderMode {
  const raw = (envGet("STORAGE_PROVIDER") ?? "supabase").trim().toLowerCase();
  if (raw === "supabase" || raw === "hybrid" || raw === "r2") {
    return raw;
  }
  return "supabase";
}

function getR2BucketBinding(bucket: StorageBucketName): R2Bucket | null {
  if (bucket === "references") {
    return envBinding<R2Bucket>("R2_REFERENCES") ?? null;
  }
  if (bucket === "generations") {
    return envBinding<R2Bucket>("R2_GENERATIONS") ?? null;
  }
  return null;
}

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  return trimmed ? `${trimmed}/` : "";
}

function resolveRequestOrigin(req: Request): string {
  const requestUrl = new URL(req.url);

  // Service-binding requests arrive on the synthetic api.internal host.
  // In that path, use forwarded host/proto emitted by the frontend Worker.
  if (requestUrl.hostname === "api.internal") {
    const proto = req.headers.get("x-forwarded-proto") ??
      requestUrl.protocol.replace(":", "");
    const forwardedHost = req.headers.get("x-forwarded-host") ??
      req.headers.get("host") ??
      requestUrl.host;
    const forwardedPort = req.headers.get("x-forwarded-port");
    const host = !forwardedHost.includes(":") && forwardedPort
      ? `${forwardedHost}:${forwardedPort}`
      : forwardedHost;

    return `${proto}://${host}`;
  }

  // For direct requests to this API Worker, derive origin from request URL.
  return requestUrl.origin;
}

function toBase64Url(input: string): string {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return atob(padded);
  } catch {
    return null;
  }
}

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function signPayload(secret: string, payloadBase64: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadBase64),
  );

  let binary = "";
  for (const byte of new Uint8Array(signature)) {
    binary += String.fromCharCode(byte);
  }

  return toBase64Url(binary);
}

async function createSignedStorageToken(
  action: SignedStorageAction,
  bucket: StorageBucketName,
  key: string,
  expiresInSeconds: number,
): Promise<string | null> {
  const secret = envGet("STORAGE_SIGNING_SECRET")?.trim();
  if (!secret) return null;

  const payload: SignedStorageTokenPayload = {
    v: 1,
    action,
    bucket,
    key,
    exp: Math.floor(Date.now() / 1000) + Math.max(1, Math.floor(expiresInSeconds)),
  };

  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const signature = await signPayload(secret, payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export async function verifySignedStorageToken(
  token: string,
  expectedAction: SignedStorageAction,
): Promise<SignedStorageTokenPayload | null> {
  const secret = envGet("STORAGE_SIGNING_SECRET")?.trim();
  if (!secret) return null;

  const [payloadPart, signaturePart] = token.split(".", 2);
  if (!payloadPart || !signaturePart) return null;

  const expected = await signPayload(secret, payloadPart);
  if (!secureCompare(expected, signaturePart)) return null;

  const decoded = fromBase64Url(payloadPart);
  if (!decoded) return null;

  let payload: SignedStorageTokenPayload;
  try {
    payload = JSON.parse(decoded) as SignedStorageTokenPayload;
  } catch {
    return null;
  }

  if (
    payload.v !== 1 ||
    (payload.action !== "upload" && payload.action !== "download") ||
    payload.action !== expectedAction ||
    (payload.bucket !== "references" && payload.bucket !== "generations") ||
    typeof payload.key !== "string" ||
    !payload.key.trim() ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function createStorageProvider(params: CreateStorageProviderParams) {
  const mode = resolveStorageProviderMode();
  const { admin, req } = params;

  async function supabaseCreateSignedUploadUrl(
    bucket: StorageBucketName,
    key: string,
  ): Promise<SignedUrlResult> {
    const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(key);
    if (error || !data?.signedUrl) {
      return {
        data: null,
        error: { message: error?.message ?? "Failed to create signed upload URL." },
      };
    }

    return {
      data: { signedUrl: resolveStorageUrl(req, data.signedUrl) },
      error: null,
    };
  }

  async function supabaseCreateSignedDownloadUrl(
    bucket: StorageBucketName,
    key: string,
    expiresInSeconds: number,
  ): Promise<SignedUrlResult> {
    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUrl(key, expiresInSeconds);

    if (error || !data?.signedUrl) {
      return {
        data: null,
        error: { message: error?.message ?? "Failed to create signed URL." },
      };
    }

    return {
      data: { signedUrl: resolveStorageUrl(req, data.signedUrl) },
      error: null,
    };
  }

  async function supabaseUpload(
    bucket: StorageBucketName,
    key: string,
    value: Uint8Array | Blob,
    options?: { contentType?: string; upsert?: boolean },
  ): Promise<StorageUploadResult> {
    const { error } = await admin.storage.from(bucket).upload(key, value, {
      contentType: options?.contentType,
      upsert: options?.upsert,
    });

    return { error: error ? { message: error.message } : null };
  }

  async function supabaseDownload(
    bucket: StorageBucketName,
    key: string,
  ): Promise<StorageDownloadResult> {
    const { data, error } = await admin.storage.from(bucket).download(key);
    return { data: data ?? null, error: error ? { message: error.message } : null };
  }

  async function supabaseList(
    bucket: StorageBucketName,
    prefix: string,
    options?: { limit?: number },
  ): Promise<StorageListResult> {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: options?.limit ?? 100 });

    return {
      data: data ?? [],
      error: error ? { message: error.message } : null,
    };
  }

  async function supabaseRemove(
    bucket: StorageBucketName,
    keys: string[],
  ): Promise<StorageRemoveResult> {
    const { error } = await admin.storage.from(bucket).remove(keys);
    return { error: error ? { message: error.message } : null };
  }

  async function r2CreateSignedUrl(
    action: SignedStorageAction,
    bucket: StorageBucketName,
    key: string,
    expiresInSeconds: number,
  ): Promise<SignedUrlResult> {
    const token = await createSignedStorageToken(action, bucket, key, expiresInSeconds);
    if (!token) {
      return {
        data: null,
        error: { message: "Missing env var: STORAGE_SIGNING_SECRET" },
      };
    }

    const origin = resolveRequestOrigin(req);
    const path = action === "upload" ? "/api/storage/upload" : "/api/storage/download";

    return {
      data: {
        signedUrl: `${origin}${path}?token=${encodeURIComponent(token)}`,
      },
      error: null,
    };
  }

  async function r2Upload(
    bucket: StorageBucketName,
    key: string,
    value: Uint8Array | Blob,
    options?: { contentType?: string; upsert?: boolean },
  ): Promise<StorageUploadResult> {
    const target = getR2BucketBinding(bucket);
    if (!target) {
      return {
        error: {
          message: `Missing R2 binding for ${bucket}. Configure R2_REFERENCES/R2_GENERATIONS.`,
        },
      };
    }

    try {
      if (options?.upsert === false) {
        const existing = await target.head(key);
        if (existing) {
          return { error: { message: "Object already exists." } };
        }
      }

      await target.put(key, value, {
        httpMetadata: {
          contentType: options?.contentType,
        },
      });
      return { error: null };
    } catch (error) {
      return { error: toStorageError(error) };
    }
  }

  async function r2Download(
    bucket: StorageBucketName,
    key: string,
  ): Promise<StorageDownloadResult> {
    const target = getR2BucketBinding(bucket);
    if (!target) {
      return {
        data: null,
        error: {
          message: `Missing R2 binding for ${bucket}. Configure R2_REFERENCES/R2_GENERATIONS.`,
        },
      };
    }

    try {
      const object = await target.get(key);
      if (!object) return { data: null, error: null };

      const contentType = object.httpMetadata?.contentType ?? "application/octet-stream";
      const blob = new Blob([await object.arrayBuffer()], { type: contentType });
      return { data: blob, error: null };
    } catch (error) {
      return { data: null, error: toStorageError(error) };
    }
  }

  async function r2List(
    bucket: StorageBucketName,
    prefix: string,
    options?: { limit?: number },
  ): Promise<StorageListResult> {
    const target = getR2BucketBinding(bucket);
    if (!target) {
      return {
        data: null,
        error: {
          message: `Missing R2 binding for ${bucket}. Configure R2_REFERENCES/R2_GENERATIONS.`,
        },
      };
    }

    try {
      const normalizedPrefix = normalizePrefix(prefix);
      const listed = await target.list({
        prefix: normalizedPrefix || undefined,
        limit: options?.limit ?? 100,
      });

      const data = listed.objects.map((object) => {
        const name = normalizedPrefix && object.key.startsWith(normalizedPrefix)
          ? object.key.slice(normalizedPrefix.length)
          : object.key;

        return {
          name,
          size: object.size,
          metadata: {
            size: object.size,
            contentLength: object.size,
          },
        } as StorageListObject;
      });

      return { data, error: null };
    } catch (error) {
      return { data: null, error: toStorageError(error) };
    }
  }

  async function r2Remove(
    bucket: StorageBucketName,
    keys: string[],
  ): Promise<StorageRemoveResult> {
    const target = getR2BucketBinding(bucket);
    if (!target) {
      return {
        error: {
          message: `Missing R2 binding for ${bucket}. Configure R2_REFERENCES/R2_GENERATIONS.`,
        },
      };
    }

    try {
      await target.delete(keys);
      return { error: null };
    } catch (error) {
      return { error: toStorageError(error) };
    }
  }

  return {
    mode,
    async createSignedUploadUrl(
      bucket: StorageBucketName,
      key: string,
    ): Promise<SignedUrlResult> {
      if (mode === "supabase") {
        return supabaseCreateSignedUploadUrl(bucket, key);
      }

      // hybrid + r2 use signed worker URL for uploads (writes to R2).
      return r2CreateSignedUrl("upload", bucket, key, 900);
    },

    async createSignedUrl(
      bucket: StorageBucketName,
      key: string,
      expiresInSeconds: number,
    ): Promise<SignedUrlResult> {
      if (mode === "supabase") {
        return supabaseCreateSignedDownloadUrl(bucket, key, expiresInSeconds);
      }

      if (mode === "hybrid") {
        const target = getR2BucketBinding(bucket);
        if (target) {
          const exists = await target.head(key).catch(() => null);
          if (exists) return r2CreateSignedUrl("download", bucket, key, expiresInSeconds);
        }
        return supabaseCreateSignedDownloadUrl(bucket, key, expiresInSeconds);
      }

      return r2CreateSignedUrl("download", bucket, key, expiresInSeconds);
    },

    async upload(
      bucket: StorageBucketName,
      key: string,
      value: Uint8Array | Blob,
      options?: { contentType?: string; upsert?: boolean },
    ): Promise<StorageUploadResult> {
      if (mode === "supabase") return supabaseUpload(bucket, key, value, options);
      return r2Upload(bucket, key, value, options);
    },

    async download(
      bucket: StorageBucketName,
      key: string,
    ): Promise<StorageDownloadResult> {
      if (mode === "supabase") return supabaseDownload(bucket, key);

      if (mode === "hybrid") {
        const r2 = await r2Download(bucket, key);
        if (r2.error) return r2;
        if (r2.data) return r2;
        return supabaseDownload(bucket, key);
      }

      return r2Download(bucket, key);
    },

    async list(
      bucket: StorageBucketName,
      prefix: string,
      options?: { limit?: number },
    ): Promise<StorageListResult> {
      if (mode === "supabase") return supabaseList(bucket, prefix, options);
      return r2List(bucket, prefix, options);
    },

    async remove(
      bucket: StorageBucketName,
      keys: string[],
    ): Promise<StorageRemoveResult> {
      if (mode === "supabase") return supabaseRemove(bucket, keys);

      if (mode === "hybrid") {
        const r2 = await r2Remove(bucket, keys);
        if (r2.error) return r2;

        // Best-effort cleanup for legacy objects in hybrid mode.
        await supabaseRemove(bucket, keys).catch(() => null);
        return { error: null };
      }

      return r2Remove(bucket, keys);
    },
  };
}
