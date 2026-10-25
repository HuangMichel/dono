// @vitest-environment jsdom
import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";

const NOW = Date.parse("2026-10-25T14:30:00Z");
type Page = { data: unknown[]; error?: string; hasMore?: boolean };
const state = vi.hoisted(() => ({
  pages: {} as Record<string, Page>,
  counts: null as unknown,
  countsError: null as string | null,
  evidence: {} as Record<string, unknown>,
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/association/shell", () => ({
  useAssociation: () => ({ id: "association" }),
  ResourceStatus: ({ error }: { error: string | null }) =>
    error ? <p role="alert">{error}</p> : null,
}));
vi.mock("@/components/ui/calendar", () => ({
  useParisClock: () => ({ now: NOW, today: "2026-10-25" }),
}));
vi.mock("@/components/association/evidence", () => ({
  itemName: (offer: { facts_snapshot: { attributes: { product: string } } }) =>
    offer.facts_snapshot.attributes.product,
  instant: (value: string) => value,
}));
vi.mock("@/lib/api", () => ({
  api: (path: string) => {
    const offerId = path.split("/")[2];
    return Promise.resolve(
      state.evidence[offerId] ?? { analyses: [{ indicators: [] }] },
    );
  },
}));
vi.mock("@/lib/api-hooks", () => {
  const page = (path: string | null) => {
    const key = Object.keys(state.pages).find((part) => path?.includes(part));
    const value = key ? state.pages[key] : { data: [] };
    return {
      data: value.data,
      loading: false,
      error: value.error ?? null,
      hasMore: value.hasMore ?? false,
      refresh: vi.fn(async () => {}),
    };
  };
  return {
    useApiPage: page,
    useApiResource: () => ({
      data: state.counts,
      loading: false,
      error: state.countsError,
      refresh: vi.fn(async () => {}),
    }),
  };
});
import Dashboard from "./page";

const offer = (id: string, product: string, extra: Record<string, unknown> = {}) => ({
  id,
  category: "food",
  quantity: "2",
  created_at: "2026-10-23T08:00:00Z",
  review_deadline: "2026-10-27T08:00:00Z",
  facts_snapshot: { attributes: { product } },
  computed: { effective_state: "pending_review", manual_review_required: false },
  ...extra,
});
const arrival = (id: string, state: string, startsAt: string) => ({
  booking: {
    id,
    computed: {
      effective_state: state,
      starts_at: startsAt,
      ends_at: new Date(Date.parse(startsAt) + 20 * 60000).toISOString(),
    },
  },
  offer: offer(`offer-${id}`, `Item ${id}`),
});
const counts = (entries: Record<string, number>) => ({
  buckets: Object.entries(entries).map(([key, count]) => ({ key, count })),
});
function countCell(container: HTMLElement, href: string) {
  return container.querySelector(`.dashboard-status a[href="${href}"]`)!;
}

beforeEach(() => {
  state.pages = {};
  state.counts = counts({});
  state.countsError = null;
  state.evidence = {};
});

it("never shows a zero for a count that failed to load", async () => {
  state.pages["/offers"] = { data: [], error: "Cannot reach Dono." };
  const screen = await render(<Dashboard />);
  const reviewCount = countCell(screen.container, "/association/review");
  expect(reviewCount.textContent).toContain("Couldn’t load");
  expect(reviewCount.textContent).not.toContain("0");
  expect(screen.container.textContent).toContain(
    "Some data couldn’t load, so counts and lists may be incomplete.",
  );
  expect(screen.container.textContent).not.toContain(
    "Nothing needs attention right now.",
  );
});

it("keeps the calm line when only a list outside the attention checks fails", async () => {
  state.pages["/arrivals"] = { data: [], error: "Cannot reach Dono." };
  const screen = await render(<Dashboard />);
  expect(screen.container.textContent).toContain(
    "Nothing needs attention right now.",
  );
  expect(screen.container.textContent).toContain("Some data couldn’t load");
  expect(
    screen.container.querySelector(".dashboard-failed")!.textContent,
  ).toContain("Couldn’t load today’s drop-offs.");
});

it("counts only booked appointments as expected drop-offs", async () => {
  state.pages["/arrivals"] = {
    data: [
      arrival("a", "booked", "2026-10-25T15:00:00Z"),
      arrival("b", "booked", "2026-10-25T15:20:00Z"),
      arrival("c", "received", "2026-10-25T09:30:00Z"),
      arrival("d", "cancelled", "2026-10-25T10:00:00Z"),
    ],
  };
  const screen = await render(<Dashboard />);
  const dropOffs = countCell(screen.container, "/association/reception");
  expect(dropOffs.querySelector(".dashboard-count-value")!.textContent).toBe("2");
  expect(dropOffs.textContent).toContain("Next at 16:00, 4 appointments today");
});

it("uses the expiry buckets for the 30-day count and the singular", async () => {
  state.counts = counts({ lt_7: 1, lt_30: 0, gt_90: 4 });
  const screen = await render(<Dashboard />);
  const expiring = countCell(screen.container, "/association/inventory");
  expect(expiring.querySelector(".dashboard-count-value")!.textContent).toBe("1");
  expect(expiring.textContent).toContain("donation expiring within 30 days");
  expect(expiring.textContent).not.toContain("donations");
  expect(expiring.textContent).toContain("1 under 7 days");
});

it("shows one calm line when nothing crosses a threshold", async () => {
  state.pages["/offers"] = { data: [offer("o1", "Rice")] };
  state.pages["/capacity"] = {
    data: [
      {
        category: "food",
        limit_storage_units: 100,
        computed: { occupied_storage_units: 40, reserved_storage_units: 5 },
      },
    ],
  };
  const screen = await render(<Dashboard />);
  expect(screen.container.textContent).toContain(
    "Nothing needs attention right now.",
  );
});

it("orders the attention list from medicine to storage, stock and review deadlines", async () => {
  state.pages["/offers"] = {
    data: [
      offer("closing", "Pasta", { review_deadline: "2026-10-26T00:30:00Z" }),
      offer("medicine", "Vitamin C tablets"),
    ],
  };
  state.evidence.medicine = {
    analyses: [
      { indicators: [{ key: "looks_like_medicine", probability: 0.72, level: "high" }] },
    ],
  };
  state.pages["/capacity"] = {
    data: [
      {
        category: "clothes",
        limit_storage_units: 120,
        computed: { occupied_storage_units: 96, reserved_storage_units: 14 },
      },
    ],
  };
  state.pages["/expiry"] = {
    data: [
      {
        receipt: { id: "lot" },
        offer: offer("lot-offer", "Canned tuna"),
        remaining_quantity: "4",
        expiry: { bucket: "lt_7", days_left: 5, distribution_restriction: null },
      },
    ],
  };
  state.counts = counts({ lt_7: 1 });
  const screen = await render(<Dashboard />);
  const rows = [
    ...screen.container.querySelectorAll(".dashboard-attention .dashboard-row"),
  ].map((row) => row.textContent);
  expect(rows).toHaveLength(4);
  expect(rows[0]).toContain("Medicine 72%");
  expect(rows[1]).toContain("Storage 92%");
  expect(rows[1]).toContain("110 of 120 storage places used");
  expect(rows[2]).toContain("5 days left");
  expect(rows[3]).toContain("Review closes in 10 h");
});

it("puts expired stock first and counts overflow rows by item", async () => {
  state.pages["/expiry"] = {
    data: [
      {
        receipt: { id: "lot" },
        offer: offer("lot-offer", "Canned tuna"),
        remaining_quantity: "4",
        expiry: { bucket: "lt_7", days_left: 5, distribution_restriction: null },
      },
    ],
  };
  state.counts = counts({ expired: 1, lt_7: 3 });
  const screen = await render(<Dashboard />);
  const rows = [
    ...screen.container.querySelectorAll(".dashboard-attention .dashboard-row"),
  ].map((row) => row.textContent);
  expect(rows[0]).toContain("Expired");
  expect(rows[0]).toContain("1 expired donation");
  expect(rows[1]).toContain("5 days left");
  expect(rows[2]).toContain("2 more donations");
  expect(
    screen.container.querySelector(".dashboard-attention .dashboard-panel-title")!
      .textContent,
  ).toContain("4");
});
