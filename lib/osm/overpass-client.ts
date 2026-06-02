/** Required by public Overpass instances (missing User-Agent → HTTP 406). */
export const OVERPASS_USER_AGENT = "BikeBook/1.0 (+https://bikebook.app)";

export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

/** Overpass QL `[timeout:…]` — server-side limit for each query. */
export const OVERPASS_QL_TIMEOUT_S = 90;

/** Client abort timeout per HTTP attempt (slightly above QL timeout). */
export const OVERPASS_FETCH_TIMEOUT_MS = 95_000;

export const OVERPASS_USER_FACING_HINT =
  "Les serveurs OpenStreetMap (Overpass) sont surchargés. Réessayez dans quelques minutes.";

const RETRYABLE_HTTP_STATUS = new Set([429, 502, 503, 504]);
const MAX_RETRIES_PER_ENDPOINT = 2;
const RETRY_BACKOFF_MS = [1_000, 2_000, 4_000] as const;

export interface OverpassElement {
  type: "node" | "way";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function overpassRequestBody(query: string): string {
  return new URLSearchParams({ data: query }).toString();
}

function overpassRequestHeaders(): HeadersInit {
  return {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
    "User-Agent": OVERPASS_USER_AGENT,
  };
}

/** Extract a short human-readable message from Overpass HTML or JSON error bodies. */
export function parseOverpassErrorBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return null;

  try {
    const json = JSON.parse(trimmed) as { remark?: string; error?: string };
    const message = json.remark ?? json.error;
    if (typeof message === "string" && message.trim()) return message.trim();
  } catch {
    // not JSON
  }

  const htmlMatch = trimmed.match(/<strong[^>]*>Error<\/strong>:\s*([^<]+)/i);
  if (htmlMatch?.[1]) return htmlMatch[1].trim();

  const plain = trimmed.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return plain.length > 0 && plain.length <= 300 ? plain : null;
}

async function readOverpassFailure(response: Response, endpoint: string): Promise<string> {
  const body = await response.text();
  const detail = parseOverpassErrorBody(body);
  const statusHint =
    response.status === 406
      ? " (vérifiez User-Agent et Content-Type)"
      : response.status === 429
        ? " (trop de requêtes)"
        : response.status >= 500
          ? " (serveur saturé ou indisponible)"
          : "";
  const suffix = detail ? `: ${detail}` : body ? `: ${body.slice(0, 160)}` : "";
  return `Overpass ${endpoint} → HTTP ${response.status}${statusHint}${suffix}`;
}

function shouldTryNextOverpassEndpoint(status: number): boolean {
  return status === 406 || RETRYABLE_HTTP_STATUS.has(status);
}

function isRetryableAttempt(status: number | "timeout" | "network"): boolean {
  return status === "timeout" || status === "network" || RETRYABLE_HTTP_STATUS.has(status);
}

export function buildOverpassUserError(technicalDetails: string[]): Error {
  const technical =
    technicalDetails.length > 0 ? technicalDetails.join(" ; ") : "aucun détail";
  return new Error(`${OVERPASS_USER_FACING_HINT} (${technical})`);
}

type FetchAttemptResult =
  | { ok: true; elements: OverpassElement[] }
  | { ok: false; status: number | "timeout" | "network"; message: string };

async function fetchOverpassOnce(endpoint: string, body: string): Promise<FetchAttemptResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OVERPASS_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: overpassRequestHeaders(),
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await readOverpassFailure(response, endpoint);
      return { ok: false, status: response.status, message };
    }

    const data = (await response.json()) as { elements?: OverpassElement[] };
    return { ok: true, elements: data.elements ?? [] };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      const seconds = Math.round(OVERPASS_FETCH_TIMEOUT_MS / 1000);
      return {
        ok: false,
        status: "timeout",
        message: `Overpass ${endpoint} → délai dépassé (${seconds}s)`,
      };
    }
    if (error instanceof Error) {
      return { ok: false, status: "network", message: `Overpass ${endpoint} → ${error.message}` };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** POST an Overpass QL query to public interpreters with retries and endpoint fallback. */
export async function fetchOverpassElements(query: string): Promise<OverpassElement[]> {
  const body = overpassRequestBody(query);
  const errors: string[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    let attempt = 0;

    while (attempt <= MAX_RETRIES_PER_ENDPOINT) {
      if (attempt > 0) {
        const backoff = RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)];
        await sleep(backoff);
      }

      const result = await fetchOverpassOnce(endpoint, body);

      if (result.ok) {
        return result.elements;
      }

      errors.push(result.message);

      if (
        isRetryableAttempt(result.status) &&
        attempt < MAX_RETRIES_PER_ENDPOINT
      ) {
        attempt += 1;
        continue;
      }

      if (typeof result.status === "number" && !shouldTryNextOverpassEndpoint(result.status)) {
        throw buildOverpassUserError(errors);
      }

      break;
    }
  }

  throw buildOverpassUserError(errors);
}

/** Pause between sequential chunk queries to avoid hammering Overpass. */
export async function delayBetweenOverpassChunks(): Promise<void> {
  await sleep(400);
}
