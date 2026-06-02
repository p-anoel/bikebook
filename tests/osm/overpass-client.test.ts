import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOverpassUserError,
  fetchOverpassElements,
  OVERPASS_ENDPOINTS,
  OVERPASS_FETCH_TIMEOUT_MS,
  OVERPASS_QL_TIMEOUT_S,
  OVERPASS_USER_AGENT,
  OVERPASS_USER_FACING_HINT,
  parseOverpassErrorBody,
} from "@/lib/osm/overpass-client";

describe("parseOverpassErrorBody", () => {
  it("extracts Overpass HTML runtime errors", () => {
    const html =
      '<p><strong style="color:#FF0000">Error</strong>: runtime error: dispatcher busy</p>';
    expect(parseOverpassErrorBody(html)).toBe("runtime error: dispatcher busy");
  });
});

describe("buildOverpassUserError", () => {
  it("includes a retry hint and technical details", () => {
    const error = buildOverpassUserError(["Overpass test → HTTP 504"]);
    expect(error.message).toContain(OVERPASS_USER_FACING_HINT);
    expect(error.message).toContain("HTTP 504");
  });
});

describe("fetchOverpassElements", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends User-Agent and form-encoded data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchOverpassElements(`[out:json][timeout:${OVERPASS_QL_TIMEOUT_S}];node(48,2,49,3);out;`);

    expect(fetchMock).toHaveBeenCalledWith(
      OVERPASS_ENDPOINTS[0],
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "User-Agent": OVERPASS_USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded",
        }),
      }),
    );
  });

  it("retries the same endpoint on HTTP 504 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("Gateway Timeout", { status: 504 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ elements: [{ type: "node", id: 1, lat: 1, lon: 2 }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const promise = fetchOverpassElements("[out:json];node(1,2,3,4);out;");
    await vi.advanceTimersByTimeAsync(5_000);
    const elements = await promise;

    vi.useRealTimers();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(OVERPASS_ENDPOINTS[0]);
    expect(fetchMock.mock.calls[1][0]).toBe(OVERPASS_ENDPOINTS[0]);
    expect(elements).toHaveLength(1);
  });

  it("tries every endpoint then throws a user-facing error", async () => {
    vi.useRealTimers();
    let calls = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      calls += 1;
      return new Response(`Not Acceptable (${url})`, { status: 406 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchOverpassElements("[out:json];node(1,2,3,4);out;")).rejects.toThrow(
      OVERPASS_USER_FACING_HINT,
    );

    expect(calls).toBe(OVERPASS_ENDPOINTS.length);
    expect(new Set(fetchMock.mock.calls.map((call) => call[0]))).toEqual(
      new Set(OVERPASS_ENDPOINTS),
    );
  });

  it("uses a fetch timeout above the QL timeout", () => {
    expect(OVERPASS_FETCH_TIMEOUT_MS).toBeGreaterThan(OVERPASS_QL_TIMEOUT_S * 1000);
  });
});
