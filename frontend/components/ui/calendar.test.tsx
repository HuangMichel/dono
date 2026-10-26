// @vitest-environment jsdom
import React, { act } from "react";
import { expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { Calendar } from "./calendar";

it("preserves standalone booking-calendar navigation without changing the selected day", async () => {
  const select = vi.fn();
  const view = await render(
    <Calendar selected="2026-10-26" today="2026-10-26" onSelect={select} />,
  );
  await act(async () =>
    view.container
      .querySelector<HTMLButtonElement>('[aria-label="Next month"]')!
      .click(),
  );
  expect(view.container.querySelector("h2")!.textContent).toBe("November 2026");
  expect(select).not.toHaveBeenCalled();
  await act(async () =>
    view.container
      .querySelector<HTMLButtonElement>('[data-day="2026-11-02"]')!
      .click(),
  );
  expect(select).toHaveBeenLastCalledWith("2026-11-02");
  await act(async () =>
    [...view.container.querySelectorAll("button")]
      .find((button) => button.textContent === "Today")!
      .click(),
  );
  expect(view.container.querySelector("h2")!.textContent).toBe("October 2026");
  expect(select).toHaveBeenLastCalledWith("2026-10-26");
});
