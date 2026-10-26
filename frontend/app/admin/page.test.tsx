// @vitest-environment jsdom
import React, { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
const state = vi.hoisted(() => ({ command: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/api-hooks", () => ({
  useApiPage: () => ({
    data: [
      {
        id: "one",
        name: "First association",
        approval_status: "pending",
        created_at: "2026-10-01T12:00:00Z",
        revision: "1",
        timezone: "Europe/Paris",
      },
    ],
    loading: false,
    error: null,
    hasMore: false,
    refresh: state.refresh,
  }),
}));
vi.mock("@/components/association/shell", () => ({
  ConsoleTitle: () => <h1>Approvals</h1>,
  ResourceStatus: () => null,
  More: () => null,
}));
vi.mock("@/components/association/command", () => ({
  useCommand: () => state.command,
  text: () => "",
  CommandForm: ({ submit }: { submit: string }) => (
    <form>
      <button>{submit}</button>
    </form>
  ),
}));
import Approvals from "./page";
beforeEach(() => vi.clearAllMocks());
function approval(container: HTMLElement) {
  return [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Approve association",
  );
}
async function select(container: HTMLElement) {
  await act(async () =>
    container
      .querySelector("tbody tr")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
}
it("requires explicit selection and clears the action target with the row selection", async () => {
  const { container } = await render(<Approvals />);
  expect(approval(container)).toBeUndefined();
  await select(container);
  expect(approval(container)).toBeDefined();
  await act(async () =>
    [...container.querySelectorAll("button")]
      .find((b) => b.textContent === "Clear selection")!
      .click(),
  );
  expect(approval(container)).toBeUndefined();
});
it("removes an approval target when the search excludes its selected row", async () => {
  const { container } = await render(<Approvals />);
  await select(container);
  const search = container.querySelector(
    'input[type="search"]',
  ) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(search, "No match");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(approval(container)).toBeUndefined();
});

it("clears the target when changing the approval-status filter", async () => {
  const { container } = await render(<Approvals />);
  await select(container);
  expect(approval(container)).toBeDefined();
  await act(async () =>
    [...container.querySelectorAll("button")]
      .find((b) => b.textContent === "Approved")!
      .click(),
  );
  expect(approval(container)).toBeUndefined();
});
