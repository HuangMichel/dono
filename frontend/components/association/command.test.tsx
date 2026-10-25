// @vitest-environment jsdom
import React, { act, useState } from "react";
import { expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { NotificationProvider } from "@/components/ui/notifications";
import { CommandForm } from "./command";

it("reports success after refresh unmounts the form and blocks overlapping submissions", async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const save = vi.fn(async () => pending);
  function Journey() {
    const [show, setShow] = useState(true);
    return (
      <NotificationProvider>
        {show && (
          <CommandForm
            submit="Save"
            onSubmit={async () => {
              await save();
              setShow(false);
            }}
          >
            Settings
          </CommandForm>
        )}
      </NotificationProvider>
    );
  }
  const view = await render(<Journey />);
  const form = view.container.querySelector("form")!;
  await act(async () => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  expect(view.container.querySelector("form")).toBeNull();
  expect(view.container.querySelector('[role="status"]')?.textContent).toBe(
    "Saved.",
  );
});

it("preserves input and shows an actionable persistent error when saving fails", async () => {
  const view = await render(
    <NotificationProvider>
      <CommandForm
        submit="Save"
        onSubmit={async () => {
          throw new Error("Capacity changed. Refresh and retry.");
        }}
      >
        <input name="quantity" defaultValue="6" />
      </CommandForm>
    </NotificationProvider>,
  );
  await act(async () => {
    view.container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(
    view.container.querySelector('[role="alert"]')?.closest(".notifications"),
  ).not.toBeNull();
  expect(view.container.querySelector<HTMLInputElement>("input")?.value).toBe(
    "6",
  );
  expect(
    view.container.querySelector<HTMLButtonElement>('button[type="submit"]')
      ?.disabled,
  ).toBe(false);
});

it("does not announce an obsolete request result", async () => {
  const view = await render(
    <NotificationProvider>
      <CommandForm submit="Verify" onSubmit={async () => false}>
        QR
      </CommandForm>
    </NotificationProvider>,
  );
  await act(async () => {
    view.container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(view.container.querySelector('[role="status"]')).toBeNull();
});
