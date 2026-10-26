// @vitest-environment jsdom
import React, { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { DonationPhotos } from "./donation-photos";
import { DonationSession } from "./donation-session";
import { useSyncExternalStore } from "react";
const { camera } = vi.hoisted(() => ({
  camera: { current: null as null | { onCapture: (file: File) => void } },
}));
vi.mock("@/components/ui/camera-capture", () => ({
  CameraCapture: (props: typeof camera.current) => {
    camera.current = props;
    return <div data-camera />;
  },
}));
const change = vi.fn(),
  kind = vi.fn(),
  error = vi.fn();
function photos(savedCount = 0, locked = false) {
  return (
    <DonationPhotos
      files={[]}
      savedCount={savedCount}
      lockedFiles={[]}
      disabled={locked}
      onChange={change}
      getKind={() => "item"}
      onKind={kind}
      onError={error}
    />
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  camera.current = null;
});
it("adds a camera JPEG as a label close-up through the shared validation path", async () => {
  const view = await render(photos());
  await act(async () =>
    view.container
      .querySelector<HTMLButtonElement>('[aria-label="Take label close-up"]')!
      .click(),
  );
  const file = new File(["jpeg"], "label.jpg", { type: "image/jpeg" });
  await act(async () => camera.current!.onCapture(file));
  expect(change).toHaveBeenCalledWith([file]);
  expect(kind).toHaveBeenCalledWith(file, "label");
  expect(error).toHaveBeenLastCalledWith("");
});
it("rejects camera additions beyond the total saved photo cap", async () => {
  const view = await render(photos(3));
  await act(async () =>
    view.container
      .querySelector<HTMLButtonElement>('[aria-label="Take item photos"]')!
      .click(),
  );
  await act(async () =>
    camera.current!.onCapture(
      new File(["jpeg"], "item.jpg", { type: "image/jpeg" }),
    ),
  );
  expect(change).not.toHaveBeenCalled();
  expect(kind).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledWith(
    "Choose at most three photos, including saved photos.",
  );
});
it("keeps camera actions unavailable when donor editing is locked", async () => {
  const view = await render(photos(0, true));
  const trigger = view.container.querySelector<HTMLButtonElement>(
    '[aria-label="Take item photos"]',
  )!;
  expect(trigger.disabled).toBe(true);
  await act(async () => trigger.click());
  expect(camera.current).toBeNull();
});
it("allows removing a rejected photo after an earlier photo was stored", async () => {
  const stored = new File(["jpeg"], "stored.jpg", { type: "image/jpeg" });
  const rejected = new File(["invalid"], "rejected.jpg", {
    type: "image/jpeg",
  });
  const api = vi
    .fn()
    .mockResolvedValueOnce({
      id: "item",
      revision: "1",
      facts_revision: "1",
      facts: {},
      computed: { active_offer_id: null },
    })
    .mockResolvedValueOnce({ id: "stored" })
    .mockRejectedValueOnce(
      Object.assign(Error("Choose another photo"), { status: 415 }),
    );
  const session = new DonationSession({ api, apiPage: vi.fn() }, "donor");
  await session.start();
  session.setFiles([stored, rejected]);
  await session.run(session.analyse);
  function Photos() {
    const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
    return (
      <DonationPhotos
        files={state.files}
        savedCount={0}
        lockedFiles={state.lockedFiles}
        disabled={state.busy}
        onChange={session.setFiles}
        getKind={session.getPhotoKind}
        onKind={session.setPhotoKind}
        onError={session.setError}
      />
    );
  }
  const view = await render(<Photos />);
  const remove = view.container.querySelector<HTMLButtonElement>(
    '[aria-label="Remove rejected.jpg, photo 2"]',
  )!;
  expect(remove.disabled).toBe(false);
  expect(
    view.container.querySelector<HTMLButtonElement>(
      '[aria-label="Remove stored.jpg, photo 1"]',
    )!.disabled,
  ).toBe(true);
  await act(async () => remove.click());
  expect(session.getSnapshot().files).toEqual([stored]);
  expect(session.getSnapshot().lockedFiles).toEqual([stored]);
  session.stop();
});
