import type { CloneResponse } from "../../../lib/types";

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Simulates the 3-step clone flow with realistic timing. */
export async function mockCloneSubmit(name: string): Promise<CloneResponse> {
  // Step 1: upload-url (~200ms)
  await delay(200);
  const voiceId = crypto.randomUUID();
  // Step 2: file upload (~400ms)
  await delay(400);
  // Step 3: finalize + provider clone (~1.5s)
  await delay(1500);
  console.info("[mock] clone complete", { id: voiceId, name: name.trim() });
  return { id: voiceId, name: name.trim() };
}
