// @vitest-environment jsdom
import { act } from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { QrScanner } from "./qr-scanner";
const decode = vi.hoisted(() => vi.fn());
vi.mock("jsqr", () => ({ default: decode }));
const getUserMedia = vi.fn();
const stop = vi.fn();
const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
const onScan = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  decode.mockReturnValue(null);
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  getUserMedia.mockResolvedValue(stream);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
    getImageData: () => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    }),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function mount() {
  const view = await render(<QrScanner onScan={onScan} onStart={() => {}} />);
  Object.defineProperties(view.container.querySelector("video")!, {
    videoWidth: { value: 640 },
    videoHeight: { value: 480 },
    readyState: { value: 2 },
  });
  return view;
}
it("keeps scanning live frames until detection, then stops and emits once", async () => {
  vi.useFakeTimers();
  const view = await mount();
  await act(async () => view.container.querySelector("button")!.click());
  expect(onScan).not.toHaveBeenCalled();
  decode.mockReturnValue({ data: "signed-payload" });
  await act(async () => vi.advanceTimersByTime(100));
  expect(onScan).toHaveBeenCalledExactlyOnceWith("signed-payload");
  expect(stop).toHaveBeenCalled();
  expect(view.container.querySelector("video")!.srcObject).toBeNull();
  await act(async () => vi.advanceTimersByTime(1000));
  expect(onScan).toHaveBeenCalledTimes(1);
  expect(view.container.textContent).toContain("Scan another QR code");
});
it("shows manual entry guidance after permission denial", async () => {
  getUserMedia.mockRejectedValueOnce(
    new DOMException("Denied", "NotAllowedError"),
  );
  const view = await mount();
  await act(async () => view.container.querySelector("button")!.click());
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
    "Camera access was denied",
  );
  expect(onScan).not.toHaveBeenCalled();
});
it("releases a camera granted after unmounting", async () => {
  let grant!: (value: MediaStream) => void;
  getUserMedia.mockReturnValueOnce(
    new Promise((resolve) => {
      grant = resolve;
    }),
  );
  const view = await mount();
  await act(async () => view.container.querySelector("button")!.click());
  await view.unmount();
  await act(async () => grant(stream));
  expect(stop).toHaveBeenCalled();
  expect(onScan).not.toHaveBeenCalled();
});
it("stops tracks and frame polling when staff stop the camera", async () => {
  vi.useFakeTimers();
  const view = await mount();
  await act(async () => view.container.querySelector("button")!.click());
  await act(async () => view.container.querySelector("button")!.click());
  const calls = decode.mock.calls.length;
  await act(async () => vi.advanceTimersByTime(1000));
  expect(decode).toHaveBeenCalledTimes(calls);
  expect(stop).toHaveBeenCalled();
});
