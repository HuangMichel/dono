// @vitest-environment jsdom
import React, { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { FileUpload } from "./file-upload";
const { captureProps } = vi.hoisted(() => ({
  captureProps: {
    current: null as null | {
      onCapture: (file: File) => void;
      onChooseFile: () => void;
      onClose: () => void;
    },
  },
}));
vi.mock("./camera-capture", () => ({
  CameraCapture: (props: typeof captureProps.current) => {
    captureProps.current = props;
    return <div data-camera />;
  },
}));
const add = vi.fn(),
  replace = vi.fn(),
  remove = vi.fn();
const photo = { id: "existing", name: "old.jpg", src: "", loading: false };
function upload(photos = [] as (typeof photo)[], disabled = false) {
  return (
    <FileUpload
      id="item"
      label="Item photos"
      description="Show item"
      photos={photos}
      multiple
      disabled={disabled}
      onFilesChange={add}
      onReplace={replace}
      onRemove={remove}
    />
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  captureProps.current = null;
});
it("appends a confirmed camera photo through the existing file callback", async () => {
  const view = await render(upload());
  const camera = view.container.querySelector<HTMLButtonElement>(
    '[aria-label="Take item photos"]',
  );
  expect(camera).not.toBeNull();
  await act(async () => camera!.click());
  expect(add).not.toHaveBeenCalled();
  const file = new File(["photo"], "camera.jpg", { type: "image/jpeg" });
  await act(async () => captureProps.current!.onCapture(file));
  expect(add).toHaveBeenCalledWith([file]);
  expect(view.container.querySelector("[data-camera]")).toBeNull();
});
it("replaces a selected photo with a camera photo and disables capture when locked", async () => {
  const view = await render(upload([photo]));
  await act(async () =>
    view.container
      .querySelector<HTMLButtonElement>(
        '[aria-label="Retake old.jpg, photo 1"]',
      )!
      .click(),
  );
  const file = new File(["new"], "new.jpg", { type: "image/jpeg" });
  await act(async () => captureProps.current!.onCapture(file));
  expect(replace).toHaveBeenCalledWith("existing", file);
  expect(add).not.toHaveBeenCalled();
  await act(async () =>
    view.container
      .querySelector<HTMLButtonElement>('[aria-label="Take item photos"]')!
      .click(),
  );
  const pendingCapture = captureProps.current!;
  await view.rerender(upload([photo], true));
  await act(async () => pendingCapture.onCapture(file));
  expect(add).not.toHaveBeenCalled();
  expect(view.container.querySelector("[data-camera]")).toBeNull();
});
it("falls back to the correct file picker for camera replacement", async () => {
  const view = await render(upload([photo]));
  const picker = view.container.querySelector<HTMLInputElement>(
    '[aria-label="Replace item photos"]',
  )!;
  const open = vi.spyOn(picker, "click");
  await act(async () =>
    view.container
      .querySelector<HTMLButtonElement>(
        '[aria-label="Retake old.jpg, photo 1"]',
      )!
      .click(),
  );
  await act(async () => captureProps.current!.onChooseFile());
  expect(open).toHaveBeenCalledOnce();
  const file = new File(["replacement"], "replacement.jpg", {
    type: "image/jpeg",
  });
  Object.defineProperty(picker, "files", { configurable: true, value: [file] });
  await act(async () =>
    picker.dispatchEvent(new Event("change", { bubbles: true })),
  );
  expect(replace).toHaveBeenCalledWith("existing", file);
  expect(add).not.toHaveBeenCalled();
});
