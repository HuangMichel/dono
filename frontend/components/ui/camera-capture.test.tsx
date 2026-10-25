// @vitest-environment jsdom
import React, { act } from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { CameraCapture } from "./camera-capture";

const getUserMedia = vi.fn();
const stop = vi.fn();
const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
const capture = vi.fn();
const close = vi.fn();
const fallback = vi.fn();
function button(container: HTMLElement, text: string) {
  const result = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === text,
  );
  if (!result) throw Error(`Missing button: ${text}`);
  return result;
}
async function mount() {
  return render(
    <CameraCapture
      label="Item photos"
      description="Show the whole item."
      onCapture={capture}
      onClose={close}
      onChooseFile={fallback}
    />,
  );
}
async function ready(container: HTMLElement) {
  const video = container.querySelector("video")!;
  Object.defineProperties(video, {
    videoWidth: { value: 1920 },
    videoHeight: { value: 1080 },
    readyState: { value: 2 },
  });
  await act(async () => video.dispatchEvent(new Event("loadeddata")));
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  getUserMedia.mockResolvedValue(stream);
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback) => callback(new Blob(["photo"], { type: "image/jpeg" })),
  );
  URL.createObjectURL = vi.fn(() => "blob:review");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());
it("reviews and retakes without sending a file until confirmation", async () => {
  const view = await mount();
  expect(button(view.container, "Take photo").disabled).toBe(true);
  await ready(view.container);
  await act(async () => button(view.container, "Take photo").click());
  expect(capture).not.toHaveBeenCalled();
  expect(stop).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector("img")?.src).toBe("blob:review");
  await act(async () => button(view.container, "Retake").click());
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:review");
  expect(getUserMedia).toHaveBeenCalledTimes(2);
  await ready(view.container);
  await act(async () => button(view.container, "Take photo").click());
  await act(async () => button(view.container, "Use photo").click());
  expect(capture).toHaveBeenCalledOnce();
  expect(capture.mock.calls[0][0]).toBeInstanceOf(File);
  expect(capture.mock.calls[0][0].type).toBe("image/jpeg");
});
it("offers file fallback after permission denial without returning a captured file", async () => {
  getUserMedia.mockRejectedValueOnce(
    new DOMException("Permission denied", "NotAllowedError"),
  );
  const view = await mount();
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
    "Camera access was denied",
  );
  await act(async () => button(view.container, "Choose a photo").click());
  expect(fallback).toHaveBeenCalledOnce();
  expect(capture).not.toHaveBeenCalled();
});
it("stops permission results that arrive after closing and unmounting", async () => {
  let resolve!: (stream: MediaStream) => void;
  getUserMedia.mockImplementationOnce(
    () =>
      new Promise<MediaStream>((done) => {
        resolve = done;
      }),
  );
  const view = await mount();
  await act(async () =>
    view.container
      .querySelector<HTMLButtonElement>('[aria-label="Close camera"]')!
      .click(),
  );
  expect(close).toHaveBeenCalledOnce();
  await view.unmount();
  await act(async () => resolve(stream));
  expect(stop).toHaveBeenCalledOnce();
  expect(capture).not.toHaveBeenCalled();
});
it("discards a capture that finishes after cancellation", async () => {
  let finish!: BlobCallback;
  vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementationOnce(
    (callback) => {
      finish = callback;
    },
  );
  const view = await mount();
  await ready(view.container);
  await act(async () => button(view.container, "Take photo").click());
  await act(async () =>
    view.container
      .querySelector<HTMLButtonElement>('[aria-label="Close camera"]')!
      .click(),
  );
  await view.unmount();
  await act(async () => finish(new Blob(["late"], { type: "image/jpeg" })));
  expect(capture).not.toHaveBeenCalled();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(stop).toHaveBeenCalledOnce();
});
it("releases the stream on Escape and releases a review URL on unmount", async () => {
  const view = await mount();
  await ready(view.container);
  await act(async () => button(view.container, "Take photo").click());
  await act(async () =>
    view.container
      .querySelector("dialog")!
      .dispatchEvent(new Event("cancel", { cancelable: true })),
  );
  expect(close).toHaveBeenCalledOnce();
  await view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:review");
});
it.each(["unsupported", "insecure", "missing device"])(
  "keeps file selection available when camera is %s",
  async (reason) => {
    if (reason === "unsupported")
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: undefined,
      });
    if (reason === "insecure")
      Object.defineProperty(window, "isSecureContext", {
        configurable: true,
        value: false,
      });
    if (reason === "missing device")
      getUserMedia.mockRejectedValueOnce(
        new DOMException("Missing", "NotFoundError"),
      );
    const view = await mount();
    expect(
      view.container.querySelector('[role="alert"]')?.textContent,
    ).toBeTruthy();
    await act(async () => button(view.container, "Choose a photo").click());
    expect(fallback).toHaveBeenCalledOnce();
  },
);
it("releases a live camera on unmount and requests video without audio", async () => {
  const view = await mount();
  expect(getUserMedia).toHaveBeenCalledWith({
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 2560 },
      height: { ideal: 1920 },
    },
  });
  await view.unmount();
  expect(stop).toHaveBeenCalledOnce();
});
it("preserves retry and file fallback if JPEG encoding exceeds the upload limit", async () => {
  vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) =>
    callback(new Blob([new Uint8Array(4_194_305)], { type: "image/jpeg" })),
  );
  const view = await mount();
  await ready(view.container);
  await act(async () => button(view.container, "Take photo").click());
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
    "too large",
  );
  expect(capture).not.toHaveBeenCalled();
  expect(button(view.container, "Take photo").disabled).toBe(false);
  await act(async () => button(view.container, "Choose a photo").click());
  expect(stop).toHaveBeenCalledOnce();
  expect(fallback).toHaveBeenCalledOnce();
});
