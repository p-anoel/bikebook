const MIN_REQUEST_INTERVAL_MS = 350;
const MAX_RETRIES = 4;

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForRequestSlot(): Promise<void> {
  const now = Date.now();
  const waitMs = Math.max(0, lastRequestAt + MIN_REQUEST_INTERVAL_MS - now);
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  lastRequestAt = Date.now();
}

export async function retryAfterRateLimit<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES,
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      await waitForRequestSlot();
      return await operation();
    } catch (error) {
      const isRateLimit =
        error instanceof Error && error.message.includes("Open-Meteo error: 429");

      if (!isRateLimit || attempt >= retries) {
        throw error;
      }

      const backoffMs = MIN_REQUEST_INTERVAL_MS * 2 ** (attempt + 1);
      await sleep(backoffMs);
      attempt += 1;
    }
  }
}
