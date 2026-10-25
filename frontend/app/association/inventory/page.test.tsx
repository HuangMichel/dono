// @vitest-environment jsdom
import { NotificationProvider } from "@/components/ui/notifications";
import { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
const state = vi.hoisted(() => ({
  api: vi.fn(),
  refresh: vi.fn(),
  countsRefresh: vi.fn(),
}));
vi.mock("@/components/association/shell", () => ({
  ConsoleTitle: () => null,
  CategorySelect: () => null,
  useAssociation: () => ({ id: "association-real" }),
  ResourceStatus: () => null,
  More: () => null,
  Feedback: () => null,
}));
vi.mock("@/lib/api", () => ({ api: state.api }));
vi.mock("@/components/association/evidence", () => ({
  Evidence: () => <p>Frozen item evidence</p>,
  itemName: () => "Rice",
}));
vi.mock("@/components/association/date-checks", () => ({
  DateChecks: () => <p>Date checks</p>,
  dateCommand: () => ({}),
}));
vi.mock("@/lib/api-hooks", () => ({
  useApiResource: () => ({
    data: {
      buckets: [{ key: "lt_30", count: 2 }],
      reference_date: "2026-10-25",
      timezone: "Europe/Paris",
    },
    refresh: state.countsRefresh,
  }),
  useApiPage: () => ({
    data: [
      {
        receipt: { id: "receipt-real", quantity: "2.000" },
        offer: { category: "food" },
        remaining_quantity: "2.000",
        inventory_state: "in_stock",
        expiry: { bucket: "lt_30", days_left: 15 },
      },
    ],
    refresh: state.refresh,
  }),
}));
import Inventory from "./page";
beforeEach(() => {
  state.api.mockReset().mockResolvedValue({});
  state.refresh.mockReset().mockResolvedValue(undefined);
  state.countsRefresh.mockReset().mockResolvedValue(undefined);
});
it("shows real expiry counts without requiring a disclosure", async () => {
  const screen = await render(
    <NotificationProvider>
      <Inventory />
    </NotificationProvider>,
  );
  const summary = screen.container.querySelector(
    '[aria-label="Expiry counts"]',
  )!;
  expect(summary.textContent).toContain("2 donations");
  expect(summary.closest("details")).toBeNull();
});
it("keeps distribution beside the selected row and clears confirmation after distribution", async () => {
  const screen = await render(
    <NotificationProvider>
      <Inventory />
    </NotificationProvider>,
  );
  await act(async () =>
    screen.container
      .querySelector('tr[tabindex="0"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
  const row = screen.container.querySelector("tr[data-selected]")!;
  expect(row.nextElementSibling?.textContent).toContain(
    "Record all items given out (2 items)",
  );
  const form = row.nextElementSibling!.querySelector("form")!;
  await act(async () =>
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    ),
  );
  expect(state.api).toHaveBeenCalledWith(
    "/inventory/receipt-real/distributions",
    expect.objectContaining({ body: { confirm_full_distribution: true } }),
  );
  expect(state.refresh).toHaveBeenCalledOnce();
  expect(state.countsRefresh).toHaveBeenCalledOnce();
  expect(screen.container.querySelector("tr[data-selected]")).toBeNull();
  expect(screen.container.textContent).not.toContain(
    "Record all items given out",
  );
});
it("removes selected commands when the view changes", async () => {
  const screen = await render(
    <NotificationProvider>
      <Inventory />
    </NotificationProvider>,
  );
  await act(async () =>
    screen.container
      .querySelector('tr[tabindex="0"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
  const view = screen.container.querySelector("select")!;
  await act(async () => {
    view.value = "distributed";
    view.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(screen.container.textContent).not.toContain(
    "Record all items given out",
  );
});
it("loads evidence only for the disclosure that staff open", async () => {
  const screen = await render(
    <NotificationProvider>
      <Inventory />
    </NotificationProvider>,
  );
  await act(async () =>
    screen.container
      .querySelector('tr[tabindex="0"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
  expect(screen.container.textContent).not.toContain("Frozen item evidence");
  const disclosure = screen.container.querySelector<HTMLDetailsElement>(
    ".data-table-detail details",
  )!;
  await act(async () => {
    disclosure.open = true;
    disclosure.dispatchEvent(new Event("toggle", { bubbles: false }));
  });
  expect(
    screen.container.textContent?.match(/Frozen item evidence/g),
  ).toHaveLength(1);
  await act(async () => {
    disclosure.open = false;
    disclosure.dispatchEvent(new Event("toggle", { bubbles: false }));
  });
  expect(screen.container.textContent).not.toContain("Frozen item evidence");
});
