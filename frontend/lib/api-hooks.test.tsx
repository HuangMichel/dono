// @vitest-environment jsdom
import React, { act, useLayoutEffect } from "react";
import { render as mount } from "@/test/render";
import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  auth: { user: { id: "a" }, loading: false },
  api: vi.fn(),
  page: vi.fn(),
}));
vi.mock("./auth-context", () => ({ useAuth: () => mock.auth }));
vi.mock("./api", () => ({ api: mock.api, apiPage: mock.page }));
import { useApiPage, useApiResource } from "./api-hooks";
let mounted: Awaited<ReturnType<typeof mount>> | null;
let resource: ReturnType<typeof useApiResource<string>>;
let page: ReturnType<typeof useApiPage<string>>;
function Probe({ path, paged = false }: { path: string; paged?: boolean }) {
  const currentResource = useApiResource<string>(paged ? null : path);
  const currentPage = useApiPage<string>(paged ? path : null);
  useLayoutEffect(() => {
    resource = currentResource;
    page = currentPage;
  });
  return (
    <span>{paged ? currentPage.data.join(",") : currentResource.data}</span>
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const result = (data: string[], cursor: string | null = null) => ({
  data,
  page: { has_more: !!cursor, next_cursor: cursor },
});
async function render(path: string, paged = false) {
  if (mounted) await mounted.rerender(<Probe path={path} paged={paged} />);
  else mounted = await mount(<Probe path={path} paged={paged} />);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth = { user: { id: "a" }, loading: false };
  mounted = null;
});
it("aborts obsolete records and hides data across paths/accounts and unmount", async () => {
  const old = deferred<string>();
  const next = deferred<string>();
  const last = deferred<string>();
  mock.api
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(next.promise)
    .mockReturnValueOnce(last.promise);
  await render("/old");
  const firstSignal = mock.api.mock.calls[0][1].signal as AbortSignal;
  await render("/next");
  expect(firstSignal.aborted).toBe(true);
  await act(async () => old.resolve("obsolete"));
  expect(resource.data).toBeNull();
  expect(resource.error).toBeNull();
  await act(async () => next.resolve("current"));
  expect(resource.data).toBe("current");
  mock.auth.user = { id: "b" };
  await render("/next");
  expect(resource.data).toBeNull();
  const finalSignal = mock.api.mock.calls[2][1].signal as AbortSignal;
  await mounted!.unmount();
  expect(finalSignal.aborted).toBe(true);
  await act(async () => last.reject(new DOMException("Aborted", "AbortError")));
  expect(resource.error).toBeNull();
});
it("keeps page order, recovers append failures and prevents load-more from overwriting refresh", async () => {
  mock.page.mockResolvedValueOnce(result(["one"], "second"));
  await render("/items", true);
  mock.page.mockRejectedValueOnce(new Error("Temporary"));
  await act(async () => page.loadMore());
  expect(page.data).toEqual(["one"]);
  expect(page.error).toBe("Temporary");
  expect(page.hasMore).toBe(true);
  mock.page.mockResolvedValueOnce(result(["two"], "third"));
  await act(async () => page.loadMore());
  expect(page.data).toEqual(["one", "two"]);
  const old = deferred<ReturnType<typeof result>>();
  mock.page.mockReturnValueOnce(old.promise);
  let append!: Promise<void>;
  await act(async () => {
    append = page.loadMore();
  });
  const signal = mock.page.mock.calls.at(-1)![1].signal as AbortSignal;
  mock.page.mockResolvedValueOnce(result(["fresh"]));
  await act(async () => page.refresh());
  expect(signal.aborted).toBe(true);
  await act(async () => {
    old.resolve(result(["obsolete"]));
    await append;
  });
  expect(page.data).toEqual(["fresh"]);
  expect(page.error).toBeNull();
  expect(page.loading).toBe(false);
});
it("aborts page reads when the account changes and never appends an old account's results", async () => {
  mock.page.mockResolvedValueOnce(result(["old account"], "next"));
  await render("/items", true);
  const old = deferred<ReturnType<typeof result>>();
  mock.page.mockReturnValueOnce(old.promise);
  let append!: Promise<void>;
  await act(async () => {
    append = page.loadMore();
  });
  const signal = mock.page.mock.calls.at(-1)![1].signal as AbortSignal;
  const next = deferred<ReturnType<typeof result>>();
  mock.page.mockReturnValueOnce(next.promise);
  mock.auth.user = { id: "b" };
  await render("/items", true);
  expect(signal.aborted).toBe(true);
  expect(page.data).toEqual([]);
  expect(page.hasMore).toBe(false);
  await act(async () => {
    old.resolve(result(["late old account"]));
    await append;
  });
  expect(page.data).toEqual([]);
  await act(async () => next.resolve(result(["new account"])));
  expect(page.data).toEqual(["new account"]);
});
