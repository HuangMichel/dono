// @vitest-environment jsdom
import React, { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { NotificationProvider } from "@/components/ui/notifications";
const state = vi.hoisted(() => ({
  role: "assoc_admin",
  loading: false,
  error: null as string | null,
  hours: [
    { weekday: 1, start_local: "09:00", end_local: "12:00" },
    { weekday: 1, start_local: "14:00", end_local: "17:00" },
  ],
  storage: [] as unknown[],
  quotas: [] as unknown[],
  refresh: vi.fn(),
  command: vi.fn(),
  page: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api: state.command }));
vi.mock("@/lib/api-hooks", () => ({
  useApiPage: (path: string | null) => {
    state.page(path);
    return {
      data: path?.includes("intake-quotas") ? state.quotas : state.storage,
      loading: state.loading,
      error: state.error,
      refresh: state.refresh,
      hasMore: false,
      loadMore: vi.fn(),
    };
  },
}));
vi.mock("@/components/association/shell", () => ({
  ConsoleTitle: ({ title }: { title: string }) => <h1>{title}</h1>,
  useAssociation: () => ({
    id: "assoc",
    membership: { role: state.role },
    association: { opening_hours: state.hours },
  }),
  NumberInput: () => null,
  ResourceStatus: ({
    loading,
    error,
    refresh,
  }: {
    loading: boolean;
    error: string | null;
    refresh: () => void;
  }) => (
    <>
      {loading && <p role="status">Loading…</p>}
      {error && (
        <div role="alert">
          {error}
          <button onClick={refresh}>Retry</button>
        </div>
      )}
    </>
  ),
  More: () => null,
}));
import CapacityPage from "./page";
beforeEach(() => {
  state.loading = false;
  state.error = null;
  state.hours = [
    { weekday: 1, start_local: "09:00", end_local: "12:00" },
    { weekday: 1, start_local: "14:00", end_local: "17:00" },
  ];
  state.role = "assoc_admin";
  state.storage = [
    {
      category: "clothes",
      revision: "7",
      limit_storage_units: 100,
      computed: {
        occupied_storage_units: 25,
        reserved_storage_units: 10,
        available_storage_units: 65,
      },
    },
  ];
  state.quotas = [
    {
      category: "food",
      revision: "8",
      limit_quantity: "50",
      computed: {
        booked_quantity: "10",
        received_quantity: "5",
        available_quantity: "35",
      },
    },
  ];
  state.command.mockReset();
  state.command.mockResolvedValue({});
  state.refresh.mockClear();
});
it("opens a category limit editor and saves its exact revision and storage units", async () => {
  const view = await render(
    <NotificationProvider>
      <CapacityPage />
    </NotificationProvider>,
  );
  expect(view.container.querySelector("h1")?.textContent).toBe("Capacity");
  expect(view.container.querySelector('input[type="number"]')).toBeNull();
  const edit = Array.from(view.container.querySelectorAll("button")).find(
    (button) => button.textContent === "Edit limit",
  )!;
  await act(async () => edit.click());
  const input = view.container.querySelector<HTMLInputElement>(
    'input[type="number"]',
  )!;
  input.value = "120";
  await act(async () =>
    view.container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(state.command.mock.calls[0][0]).toBe(
    "/associations/assoc/capacity/clothes",
  );
  expect(state.command.mock.calls[0][1]).toMatchObject({
    method: "PUT",
    body: {
      expected_revision: "7",
      storage_unit: "item_slot",
      limit_storage_units: 120,
    },
  });
  expect(state.refresh).toHaveBeenCalledOnce();
});
it("keeps staff read-only and shows real split opening hours", async () => {
  state.role = "assoc_staff";
  const view = await render(
    <NotificationProvider>
      <CapacityPage />
    </NotificationProvider>,
  );
  expect(view.container.textContent).not.toContain("Edit limit");
  expect(view.container.textContent).not.toContain("Edit opening hours");
  expect(view.container.textContent).toContain("09:00 to 12:00");
  expect(view.container.textContent).toContain("14:00 to 17:00");
  expect(view.container.textContent).toContain("Closed");
  expect(view.container.textContent).toContain("65 of 100 places available");
  expect(view.container.querySelector('input[type="date"]')).toBeNull();
});
it("switches to a dated daily intake budget and preserves its item-unit PUT", async () => {
  const view = await render(
    <NotificationProvider>
      <CapacityPage />
    </NotificationProvider>,
  );
  const intake = Array.from(view.container.querySelectorAll("button")).find(
    (button) => button.textContent === "Daily intake",
  )!;
  await act(async () => intake.click());
  const date =
    view.container.querySelector<HTMLInputElement>('input[type="date"]')!;
  expect(date).not.toBeNull();
  expect(
    state.page.mock.calls.some((call) =>
      call[0]?.includes(`from=${date.value}&to=${date.value}`),
    ),
  ).toBe(true);
  expect(view.container.textContent).toContain("35 of 50 items available");
  const edit = Array.from(view.container.querySelectorAll("button")).find(
    (button) => button.textContent === "Edit limit",
  )!;
  await act(async () => edit.click());
  view.container.querySelector<HTMLInputElement>(
    'input[type="number"]',
  )!.value = "60";
  await act(async () =>
    view.container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(state.command.mock.calls[0][0]).toBe(
    `/associations/assoc/intake-quotas/food/${date.value}`,
  );
  expect(state.command.mock.calls[0][1]).toMatchObject({
    method: "PUT",
    body: { expected_revision: "8", unit: "item", limit_quantity: "60" },
  });
  expect(state.refresh).toHaveBeenCalledOnce();
});
it("shows empty limits and unconfigured hours without invented rows", async () => {
  state.storage = [];
  state.hours = [];
  const view = await render(
    <NotificationProvider>
      <CapacityPage />
    </NotificationProvider>,
  );
  expect(view.container.textContent).toContain("No storage limits configured.");
  expect(view.container.textContent).toContain(
    "Opening hours are not configured.",
  );
  expect(
    view.container.querySelectorAll(".capacity-category-row"),
  ).toHaveLength(0);
  expect(
    view.container.querySelector('a[href="/association/slots"]'),
  ).not.toBeNull();
});
it("shows loading and resource errors with retry", async () => {
  state.storage = [];
  state.loading = true;
  const view = await render(
    <NotificationProvider>
      <CapacityPage />
    </NotificationProvider>,
  );
  expect(view.container.querySelector('[role="status"]')).not.toBeNull();
  expect(view.container.textContent).not.toContain("No storage limits");
  state.loading = false;
  state.error = "Cannot load capacity.";
  await view.rerender(
    <NotificationProvider>
      <CapacityPage />
    </NotificationProvider>,
  );
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
    "Cannot load capacity.",
  );
  await act(async () =>
    Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent === "Retry")!
      .click(),
  );
  expect(state.refresh).toHaveBeenCalledOnce();
});
it("preserves the edited limit and refreshes balances after a failed command", async () => {
  state.command.mockRejectedValueOnce(
    Error("Current bookings exceed that limit."),
  );
  const view = await render(
    <NotificationProvider>
      <CapacityPage />
    </NotificationProvider>,
  );
  await act(async () =>
    Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent === "Edit limit")!
      .click(),
  );
  view.container.querySelector<HTMLInputElement>(
    'input[type="number"]',
  )!.value = "30";
  await act(async () =>
    view.container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(
    view.container.querySelector<HTMLInputElement>('input[type="number"]')
      ?.value,
  ).toBe("30");
  expect(view.container.textContent).toContain(
    "Current bookings exceed that limit.",
  );
  expect(state.refresh).toHaveBeenCalledOnce();
});
it("locks date, budget switching and row controls until a pending save and refresh finish", async () => {
  let finish!: () => void;
  state.command.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const view = await render(
    <NotificationProvider>
      <CapacityPage />
    </NotificationProvider>,
  );
  await act(async () =>
    Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent === "Daily intake")!
      .click(),
  );
  await act(async () =>
    Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent === "Edit limit")!
      .click(),
  );
  view.container.querySelector<HTMLInputElement>(
    'input[type="number"]',
  )!.value = "60";
  await act(async () =>
    view.container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(
    view.container.querySelector<HTMLInputElement>('input[type="date"]')!
      .disabled,
  ).toBe(true);
  const storage = Array.from(view.container.querySelectorAll("button")).find(
    (button) => button.textContent === "Storage",
  )!;
  expect(storage.disabled).toBe(true);
  expect(
    Array.from(view.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Close editor",
    )!.disabled,
  ).toBe(true);
  await act(async () => storage.click());
  expect(
    view.container.querySelector<HTMLInputElement>('input[type="date"]'),
  ).not.toBeNull();
  await act(async () => finish());
  expect(
    view.container.querySelector<HTMLInputElement>('input[type="date"]')!
      .disabled,
  ).toBe(false);
  expect(storage.disabled).toBe(false);
});
it("restores a failed draft after refreshing temporarily removes the category rows", async () => {
  state.command.mockRejectedValueOnce(Error("These balances changed."));
  const view = await render(
    <NotificationProvider>
      <CapacityPage />
    </NotificationProvider>,
  );
  const records = state.storage;
  state.refresh.mockImplementationOnce(async () => {
    state.storage = [];
    state.loading = true;
    await view.rerender(
      <NotificationProvider>
        <CapacityPage />
      </NotificationProvider>,
    );
    state.storage = records;
    state.loading = false;
    await view.rerender(
      <NotificationProvider>
        <CapacityPage />
      </NotificationProvider>,
    );
  });
  await act(async () =>
    Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent === "Edit limit")!
      .click(),
  );
  view.container.querySelector<HTMLInputElement>(
    'input[type="number"]',
  )!.value = "30";
  await act(async () =>
    view.container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(
    view.container.querySelector<HTMLInputElement>('input[type="number"]')
      ?.value,
  ).toBe("30");
  expect(view.container.textContent).toContain("These balances changed.");
});
