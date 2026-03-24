export interface FrontendEnv {
  ASSETS: Fetcher;
  API?: Fetcher;
}

const LOCAL_API_ORIGIN = "http://127.0.0.1:8787";

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".localhost")
  );
}

function isSpaRouteRequest(request: Request, url: URL): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (url.pathname === "/") return true;
  return !url.pathname.includes(".");
}

function withNoStore(response: Response): Response {
  const headers = new Headers();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      headers.append(key, value);
    }
  });
  const setCookieHeaders = (
    response.headers as Headers & {
      getAll?: (name: string) => string[];
      getSetCookie?: () => string[];
    }
  ).getSetCookie?.() ??
    (
      response.headers as Headers & {
        getAll?: (name: string) => string[];
      }
    ).getAll?.("Set-Cookie") ??
    [];
  for (const cookie of setCookieHeaders) {
    headers.append("Set-Cookie", cookie);
  }
  if (setCookieHeaders.length === 0) {
    const combinedSetCookie = response.headers.get("set-cookie");
    if (combinedSetCookie) {
      headers.append("Set-Cookie", combinedSetCookie);
    }
  }
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function proxyRequestUrl(request: Request, apiOrigin: string): URL {
  const incoming = new URL(request.url);
  const target = new URL(apiOrigin);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  return target;
}

function buildProxyRequest(request: Request, targetUrl: URL): Request {
  const headers = new Headers(request.headers);
  // Host must be derived from the target origin for cross-worker proxying.
  headers.delete("host");
  const incoming = new URL(request.url);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));
  headers.set("x-forwarded-host", incoming.host);
  if (incoming.port) headers.set("x-forwarded-port", incoming.port);

  if (request.method === "GET" || request.method === "HEAD") {
    return new Request(targetUrl.toString(), {
      method: request.method,
      headers,
      // Preserve upstream redirects (e.g. signed media URLs) for the browser.
      redirect: "manual",
    });
  }

  return new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: "manual",
  });
}

function buildServiceBindingRequest(request: Request, pathname: string, search: string): Request {
  const headers = new Headers(request.headers);
  headers.delete("host");
  const incoming = new URL(request.url);
  headers.set("x-forwarded-proto", incoming.protocol.replace(":", ""));
  headers.set("x-forwarded-host", incoming.host);
  if (incoming.port) headers.set("x-forwarded-port", incoming.port);

  const target = `https://api.internal${pathname}${search}`;
  if (request.method === "GET" || request.method === "HEAD") {
    return new Request(target, {
      method: request.method,
      headers,
      // Preserve upstream redirects (e.g. signed media URLs) for the browser.
      redirect: "manual",
    });
  }

  return new Request(target, {
    method: request.method,
    headers,
    body: request.body,
    redirect: "manual",
  });
}

async function serveSpaAsset(request: Request, env: FrontendEnv): Promise<Response> {
  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) return assetResponse;

  const fallbackUrl = new URL(request.url);
  fallbackUrl.pathname = "/";
  fallbackUrl.search = "";
  return env.ASSETS.fetch(new Request(fallbackUrl.toString(), request));
}

function missingApiBindingResponse(): Response {
  return withNoStore(
    new Response(
      "Frontend Worker misconfiguration: missing API service binding for hosted /api/* requests.",
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    ),
  );
}

function withSecurityHeaders(response: Response, isHtml: boolean): Response {
  const headers = new Headers(response.headers);
  headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  headers.set("X-Content-Type-Options", "nosniff");
  if (isHtml) {
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' https://challenges.cloudflare.com https://jgmivviwockcwjkvpqra.supabase.co; frame-src https://challenges.cloudflare.com",
    );
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("X-Frame-Options", "DENY");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: FrontendEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      if (env.API) {
        const proxied = await env.API.fetch(buildServiceBindingRequest(request, url.pathname, url.search));
        return withSecurityHeaders(withNoStore(proxied), false);
      }

      if (!isLocalHostname(url.hostname)) return withSecurityHeaders(missingApiBindingResponse(), false);

      const proxied = await fetch(buildProxyRequest(request, proxyRequestUrl(request, LOCAL_API_ORIGIN)));
      return withSecurityHeaders(withNoStore(proxied), false);
    }

    if (url.pathname === "/robots.txt") {
      return withSecurityHeaders(
        new Response(
          "User-agent: *\nAllow: /\n\nSitemap: https://uttervoice.com/sitemap.xml\n",
          { headers: { "Content-Type": "text/plain; charset=utf-8" } },
        ),
        false,
      );
    }

    if (isSpaRouteRequest(request, url)) {
      const fallbackUrl = new URL(request.url);
      fallbackUrl.pathname = "/";
      fallbackUrl.search = "";
      const spaResponse = await env.ASSETS.fetch(new Request(fallbackUrl.toString(), request));
      return withSecurityHeaders(spaResponse, true);
    }

    return withSecurityHeaders(await serveSpaAsset(request, env), false);
  },
};
