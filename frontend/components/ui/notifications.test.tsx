// @vitest-environment jsdom
import React, { act, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { NotificationProvider, useNotifications } from "./notifications";

function Trigger() {
  const { notify } = useNotifications();
  return <button onClick={() => notify({ message: "Saved." })}>Save</button>;
}
function Journey() {
  const [shown, setShown] = useState(true);
  return (
    <NotificationProvider>
      {shown && <Trigger />}
      <button onClick={() => setShown(false)}>Navigate</button>
    </NotificationProvider>
  );
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("preserves the remaining reading time while the tab is hidden, including new notifications", async () => {
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, "visibilityState", "get");
  visibility.mockReturnValue("visible");
  const view = await render(
    <NotificationProvider>
      <Trigger />
    </NotificationProvider>,
  );
  const save = view.container.querySelector<HTMLButtonElement>("button")!;
  await act(async () => save.click());
  await act(async () => {
    vi.advanceTimersByTime(2000);
  });
  await act(async () => {
    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await act(async () => save.click());
  await act(async () => {
    vi.advanceTimersByTime(10000);
  });
  expect(view.container.querySelectorAll('[role="status"]')).toHaveLength(2);
  await act(async () => {
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await act(async () => {
    vi.advanceTimersByTime(3999);
  });
  expect(view.container.querySelectorAll('[role="status"]')).toHaveLength(2);
  await act(async () => {
    vi.advanceTimersByTime(1);
  });
  expect(view.container.querySelectorAll('[role="status"]')).toHaveLength(1);
  await act(async () => {
    vi.advanceTimersByTime(2000);
  });
  expect(view.container.querySelectorAll('[role="status"]')).toHaveLength(0);
});
it("keeps notifications after the originating screen unmounts and dismisses repeated results separately", async () => {
  const view = await render(<Journey />);
  const buttons = () =>
    Array.from(view.container.querySelectorAll<HTMLButtonElement>("button"));
  await act(async () =>
    buttons()
      .find((b) => b.textContent === "Save")!
      .click(),
  );
  await act(async () =>
    buttons()
      .find((b) => b.textContent === "Save")!
      .click(),
  );
  await act(async () =>
    buttons()
      .find((b) => b.textContent === "Navigate")!
      .click(),
  );
  expect(view.container.querySelectorAll('[role="status"]')).toHaveLength(2);
  await act(async () =>
    buttons()
      .find(
        (b) => b.getAttribute("aria-label") === "Dismiss notification: Saved.",
      )!
      .click(),
  );
  expect(view.container.querySelectorAll('[role="status"]')).toHaveLength(1);
});

it("closes success after six seconds, pauses while focused or hovered, and keeps errors", async () => {
  vi.useFakeTimers();
  function Actions() {
    const { notify } = useNotifications();
    return (
      <>
        <button onClick={() => notify({ message: "Saved." })}>Save</button>
        <button
          onClick={() => notify({ message: "Retry saving.", tone: "error" })}
        >
          Fail
        </button>
      </>
    );
  }
  const view = await render(
    <NotificationProvider>
      <Actions />
    </NotificationProvider>,
  );
  const action = (label: string) =>
    Array.from(
      view.container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((b) => b.textContent === label)!;
  await act(async () => {
    action("Save").click();
    action("Fail").click();
  });
  await act(async () => {
    vi.advanceTimersByTime(2000);
  });
  const popup = view.container.querySelector<HTMLElement>('[role="status"]')!;
  const close = popup.querySelector<HTMLButtonElement>("button")!;
  await act(async () => close.focus());
  await act(async () => {
    vi.advanceTimersByTime(10000);
  });
  expect(view.container.querySelector('[role="status"]')).not.toBeNull();
  await act(async () => {
    popup.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    close.blur();
  });
  await act(async () => {
    vi.advanceTimersByTime(10000);
  });
  expect(view.container.querySelector('[role="status"]')).not.toBeNull();
  await act(async () => {
    popup.dispatchEvent(
      new MouseEvent("mouseout", {
        bubbles: true,
        relatedTarget: document.body,
      }),
    );
  });
  await act(async () => {
    vi.advanceTimersByTime(3999);
  });
  expect(view.container.querySelector('[role="status"]')).not.toBeNull();
  await act(async () => {
    vi.advanceTimersByTime(1);
  });
  expect(view.container.querySelector('[role="status"]')).toBeNull();
  expect(view.container.querySelector('[role="alert"]')?.textContent).toBe(
    "Retry saving.",
  );
});

it("caps the visible stack at three and does not move focus", async () => {
  const view = await render(
    <NotificationProvider>
      <Trigger />
    </NotificationProvider>,
  );
  const save = view.container.querySelector<HTMLButtonElement>("button")!;
  save.focus();
  await act(async () => {
    for (let i = 0; i < 4; i++) save.click();
  });
  expect(view.container.querySelectorAll('[role="status"]')).toHaveLength(3);
  expect(document.activeElement).toBe(save);
});
