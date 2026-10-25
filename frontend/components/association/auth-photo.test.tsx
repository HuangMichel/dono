// @vitest-environment jsdom
import React, { act } from "react";
import { render as mount } from "@/test/render";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Photo } from "@/lib/api-contracts";
const { binary, auth } = vi.hoisted(() => ({
  binary: vi.fn(),
  auth: { user: { id: "one" } },
}));
vi.mock("@/lib/api", () => ({ apiBlob: binary }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const imageProps = { ...props };
    delete imageProps.unoptimized;
    return React.createElement("img", imageProps);
  },
}));
import { AuthPhoto } from "./auth-photo";
const photo = {
  id: "photo",
  content_url: "/api/v1/photos/photo/content",
} as Photo;
let intersect: (entries: { isIntersecting: boolean }[]) => void;
const originalCreateURL = Object.getOwnPropertyDescriptor(
  URL,
  "createObjectURL",
);
const originalRevokeURL = Object.getOwnPropertyDescriptor(
  URL,
  "revokeObjectURL",
);
const views: Awaited<ReturnType<typeof mount>>[] = [];
async function render(element: React.ReactNode) {
  const view = await mount(element);
  views.push(view);
  return view;
}
afterEach(async () => {
  // Release mounted photos while their mocked URL methods still exist.
  for (const view of views.splice(0)) await view.unmount();
  for (const [key, descriptor] of [
    ["createObjectURL", originalCreateURL],
    ["revokeObjectURL", originalRevokeURL],
  ] as const) {
    if (descriptor) Object.defineProperty(URL, key, descriptor);
    else Reflect.deleteProperty(URL, key);
  }
  vi.unstubAllGlobals();
});
beforeEach(() => {
  binary.mockReset();
  auth.user = { id: "one" };
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof intersect) {
        intersect = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  URL.createObjectURL = vi.fn(() => "blob:photo");
  URL.revokeObjectURL = vi.fn();
});
it("loads only near the viewport, retains a loaded photo, and releases its URL", async () => {
  binary.mockResolvedValue(new Blob(["image"]));
  const view = await render(<AuthPhoto photo={photo} alt="Donated item" />);
  const host = view.container;
  expect(binary).not.toHaveBeenCalled();
  await act(async () => intersect([{ isIntersecting: true }]));
  expect(binary).toHaveBeenCalledTimes(1);
  expect(host.querySelector("a")?.href).toBe("blob:photo");
  await act(async () => {
    intersect([{ isIntersecting: false }]);
    intersect([{ isIntersecting: true }]);
  });
  expect(binary).toHaveBeenCalledTimes(1);
  await view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo");
});
it("aborts obsolete fetches and ignores completion after an account changes", async () => {
  let finish!: (blob: Blob) => void;
  binary.mockImplementation(
    () =>
      new Promise<Blob>((resolve) => {
        finish = resolve;
      }),
  );
  const view = await render(<AuthPhoto photo={photo} alt="Donated item" />);
  const host = view.container;
  await act(async () => intersect([{ isIntersecting: true }]));
  const signal = binary.mock.calls[0][1].signal as AbortSignal;
  await act(async () => intersect([{ isIntersecting: false }]));
  expect(signal.aborted).toBe(true);
  auth.user = { id: "two" };
  await view.rerender(<AuthPhoto photo={photo} alt="Donated item" />);
  await act(async () => finish(new Blob(["private image"])));
  expect(host.querySelector("a")).toBeNull();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  await view.unmount();
});
it("offers manual loading when viewport observation is unavailable", async () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  binary.mockResolvedValue(new Blob(["image"]));
  const view = await render(<AuthPhoto photo={photo} alt="Donated item" />);
  expect(binary).not.toHaveBeenCalled();
  await act(async () => view.container.querySelector("button")!.click());
  expect(binary).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector("img")?.alt).toBe("Donated item");
});
it("keeps errors recoverable and aborts a pending retry on unmount", async () => {
  binary.mockRejectedValueOnce(Error("Network unavailable"));
  const view = await render(<AuthPhoto photo={photo} alt="Donated item" />);
  await act(async () => intersect([{ isIntersecting: true }]));
  expect(view.container.querySelector('[role="alert"]')?.textContent).toBe(
    "Photo unavailable.",
  );
  binary.mockImplementation(() => new Promise(() => {}));
  await act(async () => view.container.querySelector("button")!.click());
  const signal = binary.mock.calls[1][1].signal as AbortSignal;
  await view.unmount();
  expect(signal.aborted).toBe(true);
});

it("loads a compact frozen photo directly through the authenticated binary endpoint", async () => {
  binary.mockResolvedValue(new Blob(["image"]));
  const view = await render(
    <AuthPhoto
      photo={{ content_url: "/api/v1/photos/frozen/content" }}
      alt="Frozen item"
      size={40}
    />,
  );
  await act(async () => intersect([{ isIntersecting: true }]));
  expect(binary.mock.calls[0][0]).toBe("/photos/frozen/content");
  expect(view.container.querySelector("img")?.getAttribute("width")).toBe("40");
  expect(view.container.querySelector("img")?.getAttribute("height")).toBe(
    "40",
  );
});
