import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase/client", () => ({
  getAccessToken: vi.fn(async () => "session-token"),
}));
import { getAccessToken } from "./supabase/client";
import { api, apiBlob, apiPage, publicNeedsPage } from "./api";

beforeEach(() => {
  vi.mocked(getAccessToken).mockResolvedValue("session-token");
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.dono.test/api/v1");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("authenticated API boundary", () => {
  it("sends the bearer token and a reusable idempotency key, preserving exact quantities", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ data: { id: "item" }, meta: {} }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(
      await api("/donations", {
        method: "POST",
        body: { quantity: "123.000" },
        idempotencyKey: "request-key",
      }),
    ).toEqual({ id: "item" });
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.dono.test/api/v1/donations");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer session-token",
    );
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe(
      "request-key",
    );
    expect(init.body).toBe('{"quantity":"123.000"}');
    expect(init.cache).toBe("no-store");
  });
  it("surfaces conflicts without retrying a mutation", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        {
          error: {
            code: "stale_revision",
            message: "Stale revision.",
            request_id: "trace",
          },
        },
        { status: 409 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      api("/offers/id/decision", { method: "POST", body: {} }),
    ).rejects.toMatchObject({
      status: 409,
      code: "stale_revision",
      requestId: "trace",
      message: "These details changed. Refresh them before trying again.",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("keeps failure metadata without displaying unknown server messages or retrying", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        {
          error: {
            code: "new_server_failure",
            message: "Internal SQL command failed",
            request_id: "trace",
          },
        },
        { status: 500 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      api("/donations", { method: "POST", body: {} }),
    ).rejects.toMatchObject({
      status: 500,
      code: "new_server_failure",
      requestId: "trace",
      message:
        "Dono could not complete this request. Check the current status before trying again.",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("retains pagination and authenticates relative photo content without allowing foreign URLs", async () => {
    const page = {
      data: [],
      page: { has_more: true, next_cursor: "next" },
      meta: {},
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(page)),
    );
    expect(await apiPage("/donations")).toEqual(page);
    const controller = new AbortController();
    await apiBlob("/api/v1/photos/id/content", { signal: controller.signal });
    expect(fetch).toHaveBeenLastCalledWith(
      "https://api.dono.test/api/v1/photos/id/content",
      expect.objectContaining({
        headers: expect.any(Headers),
        signal: controller.signal,
      }),
    );
    await expect(apiBlob("https://foreign.test/photo")).rejects.toThrow(
      "Invalid API path",
    );
  });
  it("lets the browser set multipart boundaries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: { id: "photo" } })),
    );
    const body = new FormData();
    body.append("kind", "item");
    await api("/donations/id/photos", { method: "POST", body });
    const init = vi.mocked(fetch).mock.calls[0][1]!;
    expect(new Headers(init.headers).has("Content-Type")).toBe(false);
    expect(init.body).toBe(body);
  });
});

it("loads public needs without consulting Auth and leaves protected requests blocked", async () => {
  vi.mocked(getAccessToken)
    .mockClear()
    .mockRejectedValue(new Error("Auth not configured"));
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json({ data: [], page: { has_more: false, next_cursor: null } }),
  );
  vi.stubGlobal("fetch", fetcher);
  await publicNeedsPage("limit=10");
  expect(getAccessToken).not.toHaveBeenCalled();
  expect(
    new Headers(fetcher.mock.calls[0][1]?.headers).has("Authorization"),
  ).toBe(false);
  vi.mocked(getAccessToken).mockResolvedValue(null);
  await expect(api("/donations")).rejects.toMatchObject({ status: 401 });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("explains invalid location input from the public geocoder", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        { error: { code: "invalid_location", message: "Invalid location." } },
        { status: 422 },
      ),
    ),
  );
  await expect(publicNeedsPage("location=68")).rejects.toMatchObject({
    code: "invalid_location",
    status: 422,
    message:
      "Enter an address or town with at least 3 characters, or a full 5-digit postcode, such as 68100. Start with a letter or number.",
  });
});
