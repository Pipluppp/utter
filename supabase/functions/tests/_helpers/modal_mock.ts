/**
 * Mock Modal HTTP server for edge function integration tests.
 *
 * Simulates Modal's 5 endpoints on port 9999:
 *   POST /submit   → returns { job_id }
 *   GET  /status   → returns { status, result_ready, elapsed_seconds }
 *   GET  /result   → returns WAV bytes
 *   POST /cancel   → returns { cancelled: true }
 *   POST /design   → returns WAV bytes (immediate or after redirect polling)
 *
 * Polling behaviour: /status returns "processing" for the first N polls
 * (default 2), then "completed" with result_ready=true.
 */

import { MINIMAL_WAV } from "./fixtures.ts";

export interface ModalMockOptions {
  port?: number;
  /** Number of /status polls before job shows completed (default 2) */
  pollsToComplete?: number;
}

export class ModalMock {
  private server: Deno.HttpServer | null = null;
  private port: number;
  private pollsToComplete: number;

  // Per-job state
  private jobs = new Map<string, { pollCount: number; cancelled: boolean }>();
  private jobCounter = 0;

  // Failure injection
  shouldFailSubmit = false;
  shouldFailDesign = false;
  shouldFailResult = false;

  // Request log for assertions
  requests: { method: string; path: string; body?: unknown }[] = [];

  constructor(opts?: ModalMockOptions) {
    this.port = opts?.port ?? 9999;
    this.pollsToComplete = opts?.pollsToComplete ?? 2;
  }

  /** Start the mock server. Call in test setup. */
  async start(): Promise<void> {
    this.server = Deno.serve(
      { port: this.port, onListen: () => {} },
      (req) => this.handler(req),
    );
  }

  /** Stop the mock server. Call in test teardown. */
  async stop(): Promise<void> {
    if (this.server) {
      await this.server.shutdown();
      this.server = null;
    }
  }

  /** Reset state between tests. */
  reset(): void {
    this.jobs.clear();
    this.jobCounter = 0;
    this.shouldFailSubmit = false;
    this.shouldFailDesign = false;
    this.shouldFailResult = false;
    this.requests = [];
  }

  /** Get the last job_id that was submitted */
  get lastJobId(): string | undefined {
    if (this.jobCounter === 0) return undefined;
    return `mock-job-${this.jobCounter}`;
  }

  private async handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    let body: unknown = undefined;

    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = undefined;
      }
    }

    this.requests.push({ method: req.method, path, body });

    // ---- POST /submit ----
    if (path === "/submit" && req.method === "POST") {
      if (this.shouldFailSubmit) {
        return Response.json(
          { detail: "Mock submit failure" },
          { status: 500 },
        );
      }
      this.jobCounter++;
      const jobId = `mock-job-${this.jobCounter}`;
      this.jobs.set(jobId, { pollCount: 0, cancelled: false });
      return Response.json({ job_id: jobId });
    }

    // ---- GET /status?job_id=... ----
    if (path === "/status" && req.method === "GET") {
      const jobId = url.searchParams.get("job_id");
      if (!jobId || !this.jobs.has(jobId)) {
        return Response.json({ error: "Unknown job" }, { status: 404 });
      }
      const job = this.jobs.get(jobId)!;
      job.pollCount++;

      if (job.cancelled) {
        return Response.json({
          job_id: jobId,
          status: "cancelled",
          result_ready: false,
          elapsed_seconds: job.pollCount,
        });
      }

      const completed = job.pollCount >= this.pollsToComplete;
      return Response.json({
        job_id: jobId,
        status: completed ? "completed" : "processing",
        result_ready: completed,
        elapsed_seconds: job.pollCount,
      });
    }

    // ---- GET /result?job_id=... ----
    if (path === "/result" && req.method === "GET") {
      const jobId = url.searchParams.get("job_id");
      if (!jobId || !this.jobs.has(jobId)) {
        return Response.json({ error: "Unknown job" }, { status: 404 });
      }

      if (this.shouldFailResult) {
        return new Response("Mock result failure", { status: 500 });
      }

      const job = this.jobs.get(jobId)!;
      if (job.pollCount < this.pollsToComplete) {
        return new Response("Still processing", { status: 202 });
      }

      return new Response(MINIMAL_WAV.buffer, {
        status: 200,
        headers: { "Content-Type": "audio/wav" },
      });
    }

    // ---- POST /cancel ----
    if (path === "/cancel" && req.method === "POST") {
      const payload = body as { job_id?: string } | undefined;
      const jobId = payload?.job_id;
      if (jobId && this.jobs.has(jobId)) {
        this.jobs.get(jobId)!.cancelled = true;
      }
      return Response.json({ cancelled: true });
    }

    // ---- POST /design ----
    if (path === "/design" && req.method === "POST") {
      if (this.shouldFailDesign) {
        return Response.json(
          { detail: "Mock design failure" },
          { status: 500 },
        );
      }
      // Return WAV bytes immediately (no redirect simulation needed for tests)
      return new Response(MINIMAL_WAV.buffer, {
        status: 200,
        headers: { "Content-Type": "audio/wav" },
      });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
