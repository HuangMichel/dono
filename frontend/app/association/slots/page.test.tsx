// @vitest-environment jsdom
import React, { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { Slot } from "@/lib/api-contracts";
const { paths, incomplete, scenario, command, refreshHalf, loadHalf } =
  vi.hoisted(() => ({
    paths: [] as string[],
    incomplete: { value: false },
    scenario: {
      admin: false,
      error: null as string | null,
      slots: [] as Slot[],
    },
    command: vi.fn().mockResolvedValue({}),
    refreshHalf: [
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
    ],
    loadHalf: [
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
    ],
  }));
beforeEach(() => {
  paths.length = 0;
  incomplete.value = false;
  scenario.admin = false;
  scenario.error = null;
  scenario.slots = [];
  vi.clearAllMocks();
});
vi.mock("@/components/association/shell", async (original) => ({
  ...(await original<typeof import("@/components/association/shell")>()),
  ConsoleTitle: () => null,
  useAssociation: () => ({
    id: "association",
    membership: { role: scenario.admin ? "assoc_admin" : "assoc_staff" },
    association: { timezone: "Europe/Paris", opening_hours: [], revision: "1" },
    refresh: vi.fn(),
  }),
}));
vi.mock("@/components/association/command", async (original) => ({
  ...(await original<typeof import("@/components/association/command")>()),
  useCommand: () => command,
}));
vi.mock("@/components/ui/notifications", () => ({
  useNotifications: () => ({ notify: vi.fn() }),
}));
vi.mock("@/components/ui/calendar", async (original) => ({
  ...(await original<typeof import("@/components/ui/calendar")>()),
  useParisClock: () => ({
    now: Date.parse("2026-10-26T12:00:00Z"),
    today: "2026-10-26",
  }),
}));
vi.mock("@/lib/api-hooks", () => ({
  useApiPage: (path: string | null) => {
    if (path) paths.push(path);
    const isSlots = !!path?.includes("/slots?");
    const half =
      isSlots &&
      new URL(path!, "https://test.local").searchParams.get("from") ===
        "2026-09-30T22:00:00.000Z"
        ? 0
        : 1;
    return {
      data: isSlots && half === 1 ? scenario.slots : [],
      loading: false,
      error: isSlots && half === 0 ? scenario.error : null,
      hasMore: isSlots && incomplete.value,
      refresh: isSlots ? refreshHalf[half] : vi.fn(),
      loadMore: isSlots ? loadHalf[half] : vi.fn(),
    };
  },
}));
import Slots from "./page";
function slotWindows() {
  return [...new Set(paths.filter((path) => path.includes("/slots?")))].map(
    (path) => new URL(path, "https://test.local").searchParams,
  );
}
it("loads the complete Paris month in API-valid windows and follows calendar navigation", async () => {
  paths.length = 0;
  const view = await render(<Slots />);
  const october = slotWindows();
  expect(
    october.every(
      (query) =>
        Date.parse(query.get("to")!) - Date.parse(query.get("from")!) <=
        31 * 86400000,
    ),
  ).toBe(true);
  expect(october[0].get("from")).toBe("2026-09-30T22:00:00.000Z");
  expect(october.at(-1)!.get("to")).toBe("2026-10-31T22:59:59.999Z");
  paths.length = 0;
  await act(async () =>
    view.container
      .querySelector<HTMLButtonElement>('[aria-label="Next month"]')!
      .click(),
  );
  const november = slotWindows();
  expect(november[0].get("from")).toBe("2026-10-31T23:00:00.000Z");
  expect(november.at(-1)!.get("to")).toBe("2026-11-30T22:59:59.999Z");
  expect(paths.some((path) => path.includes("arrivals?date=2026-11-01"))).toBe(
    true,
  );
});

it("does not describe unloaded dates as empty when appointment results are paginated", async () => {
  incomplete.value = true;
  try {
    const view = await render(<Slots />);
    expect(view.container.textContent).toContain(
      "Appointment availability is incomplete",
    );
    expect(
      view.container
        .querySelector('[data-day="2026-10-26"]')!
        .getAttribute("aria-label"),
    ).toContain("Appointment availability incomplete");
    expect(view.container.textContent).not.toContain(
      "No appointment times on this date.",
    );
  } finally {
    incomplete.value = false;
  }
});
it("keeps valid Paris boundaries through spring DST, leap February, and keyboard month navigation", async () => {
  const view = await render(<Slots />);
  for (let step = 0; step < 7; step++) {
    await act(async () =>
      view.container
        .querySelector<HTMLButtonElement>('[aria-label="Previous month"]')!
        .click(),
    );
  }
  // March 2026 has a shorter elapsed day when Paris enters summer time.
  const march = slotWindows().slice(-2);
  expect(march[0].get("from")).toBe("2026-02-28T23:00:00.000Z");
  expect(march.at(-1)!.get("to")).toBe("2026-03-31T21:59:59.999Z");
  paths.length = 0;
  await act(async () =>
    view.container
      .querySelector<HTMLButtonElement>('[data-day="2026-03-01"]')!
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      ),
  );
  expect(slotWindows()[0].get("from")).toBe("2026-01-31T23:00:00.000Z");
  expect(slotWindows().at(-1)!.get("to")).toBe("2026-02-28T22:59:59.999Z");
  for (let step = 0; step < 24; step++) {
    await act(async () =>
      view.container
        .querySelector<HTMLButtonElement>('[aria-label="Next month"]')!
        .click(),
    );
  }
  paths.length = 0;
  await act(async () =>
    view.container
      .querySelector<HTMLButtonElement>('[data-day="2028-02-29"]')!
      .click(),
  );
  expect(slotWindows().at(-1)!.get("to")).toBe("2028-02-29T22:59:59.999Z");
});

it("exposes failed window recovery and pagination without claiming dates are empty", async () => {
  scenario.error = "Appointments could not load.";
  const view = await render(<Slots />);
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
    scenario.error,
  );
  expect(view.container.textContent).not.toContain(
    "No appointment times on this date.",
  );
  await act(async () => {
    Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent === "Retry")!
      .click();
  });
  expect(refreshHalf[0]).toHaveBeenCalledOnce();
  expect(refreshHalf[1]).not.toHaveBeenCalled();

  scenario.error = null;
  incomplete.value = true;
  await view.rerender(<Slots />);
  await act(async () => {
    Array.from(view.container.querySelectorAll("button"))
      .find((button) => button.textContent === "Load more")!
      .click();
  });
  expect(loadHalf[0]).toHaveBeenCalledOnce();
  expect(loadHalf[1]).toHaveBeenCalledOnce();
  incomplete.value = false;
  await view.rerender(<Slots />);
  expect(view.container.textContent).toContain(
    "No appointment times on this date.",
  );
  expect(view.container.textContent).not.toContain(
    "Appointment availability is incomplete",
  );
});

it("refreshes both month windows after creating and editing an appointment", async () => {
  scenario.admin = true;
  scenario.slots = [
    {
      id: "slot",
      association_id: "association",
      starts_at: "2026-10-26T09:00:00Z",
      ends_at: "2026-10-26T10:00:00Z",
      max_bookings: 2,
      active: true,
      revision: "1",
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
      computed: { booked_count: 0, received_count: 0, remaining_places: 2 },
    },
  ];
  const view = await render(<Slots />);
  const create = Array.from(view.container.querySelectorAll("form")).find(
    (form) => form.textContent?.includes("Create appointment time"),
  )!;
  create.querySelector<HTMLInputElement>('[name="start"]')!.value =
    "2026-10-26T11:00";
  create.querySelector<HTMLInputElement>('[name="end"]')!.value =
    "2026-10-26T12:00";
  create.querySelector<HTMLInputElement>('[name="places"]')!.value = "3";
  await act(async () => {
    create.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  expect(command).toHaveBeenCalledWith("/associations/association/slots", {
    starts_at: "2026-10-26T10:00:00.000Z",
    ends_at: "2026-10-26T11:00:00.000Z",
    max_bookings: 3,
  });
  expect(refreshHalf[0]).toHaveBeenCalledOnce();
  expect(refreshHalf[1]).toHaveBeenCalledOnce();

  const edit = Array.from(view.container.querySelectorAll("form")).find(
    (form) => form.textContent?.includes("Update appointment time"),
  )!;
  edit.querySelector<HTMLInputElement>('[name="places"]')!.value = "4";
  await act(async () => {
    edit.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  expect(command).toHaveBeenCalledWith(
    "/associations/association/slots/slot",
    {
      expected_revision: "1",
      max_bookings: 4,
      active: true,
    },
    "PATCH",
  );
  expect(refreshHalf[0]).toHaveBeenCalledTimes(2);
  expect(refreshHalf[1]).toHaveBeenCalledTimes(2);
});
