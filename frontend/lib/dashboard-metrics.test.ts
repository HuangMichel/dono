import { describe, expect, it } from "vitest";
import { createInitialState, DEMO_ASSOCIATION_ID } from "./demo-store";
import { dashboardMetrics } from "./dashboard-metrics";

const now = new Date("2026-10-25T12:00:00Z");
function emptyState() {
  const state = createInitialState();
  state.donations = [];
  state.movements = [];
  state.needs = [];
  state.bookings = [];
  state.slots = [];
  state.reception_refusals = {};
  return state;
}

describe("association dashboard read-time metrics", () => {
  it("uses actual receipts and distributions instead of offered quantity or current status", () => {
    const source = createInitialState();
    const state = emptyState();
    const donation = {
      ...source.donations[0],
      id: "donation",
      association_id: DEMO_ASSOCIATION_ID,
      category: "food" as const,
      quantity: "10",
      status: "distributed" as const,
      need_id: "need",
    };
    state.donations = [donation];
    state.needs = [
      {
        ...source.needs[0],
        id: "need",
        category: "food",
        target_quantity: "10",
        active: true,
      },
    ];
    state.movements = [
      {
        ...source.movements[0],
        id: "receipt",
        donation_id: donation.id,
        movement_type: "receipt",
        quantity: "6",
        created_at: "2026-10-24T10:00:00Z",
      },
      {
        ...source.movements[0],
        id: "distribution",
        donation_id: donation.id,
        movement_type: "distribution",
        quantity: "2",
        created_at: "2026-10-24T11:00:00Z",
      },
    ];
    const result = dashboardMetrics(state, DEMO_ASSOCIATION_ID, now);
    expect(result.week.received).toBe(6);
    expect(result.week.givenOut).toBe(2);
    expect(result.capacities.find((c) => c.category === "food")?.inStock).toBe(
      4,
    );
    expect(result.needs[0]).toMatchObject({
      received: 6,
      reserved: 0,
      stillNeeded: 4,
      receivedPercentage: 60,
    });
  });
});

describe("dashboard boundaries", () => {
  it("keeps received and reserved quantities separate and releases refused holds", () => {
    const source = createInitialState();
    const state = emptyState();
    state.needs = [
      { ...source.needs[0], id: "need", target_quantity: "10", active: true },
    ];
    state.donations = [
      {
        ...source.donations[0],
        id: "received",
        status: "distributed",
        quantity: "4",
        need_id: "need",
      },
      {
        ...source.donations[0],
        id: "hold",
        status: "approved",
        quantity: "6",
        need_id: "need",
      },
      {
        ...source.donations[0],
        id: "refused",
        status: "refused",
        quantity: "20",
        need_id: "need",
      },
    ];
    state.movements = [
      {
        ...source.movements[0],
        donation_id: "received",
        movement_type: "receipt",
        quantity: "4",
        created_at: "2026-10-23T10:00:00Z",
      },
    ];
    const result = dashboardMetrics(state, DEMO_ASSOCIATION_ID, now);
    expect(result.needs[0]).toMatchObject({
      received: 4,
      reserved: 6,
      stillNeeded: 0,
      receivedPercentage: 40,
    });
    expect(result.uncoveredNeedCount).toBe(0);
  });
  it("excludes all foreign records, including movements with a local donation ID", () => {
    const state = createInitialState();
    const expected = dashboardMetrics(state, DEMO_ASSOCIATION_ID, now);
    const foreign = "foreign";
    state.donations.push({
      ...state.donations[0],
      id: foreign,
      association_id: foreign,
    });
    state.needs.push({
      ...state.needs[0],
      id: foreign,
      association_id: foreign,
    });
    state.capacities.push({
      ...state.capacities[0],
      association_id: foreign,
      limit_quantity: "1",
    });
    state.slots.push({
      ...state.slots[0],
      id: foreign,
      association_id: foreign,
    });
    state.bookings.push({
      ...state.bookings[0],
      id: foreign,
      association_id: foreign,
      slot_id: foreign,
    });
    state.movements.push({
      ...state.movements[0],
      id: foreign,
      association_id: foreign,
      quantity: "999",
    });
    state.reception_refusals[foreign] = {
      booking_id: foreign,
      donation_id: state.donations[0].id,
      reason: "Foreign",
      original_quantity: "1",
      original_approval: {
        decision: "approved",
        decided_by: foreign,
        decided_at: now.toISOString(),
      },
      refused_by: foreign,
      refused_at: now.toISOString(),
    };
    expect(dashboardMetrics(state, DEMO_ASSOCIATION_ID, now)).toEqual(expected);
  });
  it("counts bookings once, excludes terminal outcomes and requires a local slot", () => {
    const source = createInitialState();
    const state = emptyState();
    state.slots = [
      { ...source.slots[0], id: "slot", starts_at: "2026-10-25T15:00:00Z" },
    ];
    for (const status of [
      "booked",
      "received",
      "distributed",
      "refused",
    ] as const) {
      state.donations.push({
        ...source.donations[0],
        id: status,
        status,
        quantity: "20",
      });
      state.bookings.push({
        ...source.bookings[0],
        id: status,
        donation_id: status,
        slot_id: "slot",
      });
    }
    const result = dashboardMetrics(state, DEMO_ASSOCIATION_ID, now);
    expect(result.expectedToday.map((entry) => entry.donation.id)).toEqual([
      "booked",
    ]);
  });
  it("excludes paused limits and uses strictly above 85 percent", () => {
    const source = createInitialState();
    const state = emptyState();
    state.capacities = [
      { ...source.capacities[0], category: "food", limit_quantity: "100" },
      { ...source.capacities[0], category: "clothes", limit_quantity: "0" },
    ];
    state.donations = [
      {
        ...source.donations[0],
        category: "food",
        quantity: "85",
        status: "approved",
      },
    ];
    expect(
      dashboardMetrics(state, DEMO_ASSOCIATION_ID, now).nearCapacityCount,
    ).toBe(0);
    state.donations[0].quantity = "86";
    expect(
      dashboardMetrics(state, DEMO_ASSOCIATION_ID, now).nearCapacityCount,
    ).toBe(1);
  });
  it("does not infer offer ages from creation or invalid and future timestamps", () => {
    const source = createInitialState();
    const state = emptyState();
    state.donations = [
      null,
      "invalid",
      "2026-10-26T12:00:00Z",
      "2026-10-25T10:00:00Z",
    ].map((offered_at, i) => ({
      ...source.donations[0],
      id: String(i),
      status: "offered",
      offered_at,
    }));
    expect(dashboardMetrics(state, DEMO_ASSOCIATION_ID, now)).toMatchObject({
      oldestWaitingHours: 2,
      unknownOfferAgeCount: 3,
    });
  });
  it.each([
    ["2026-03-29T21:59:59Z", "2026-03-23", "2026-03-29"],
    ["2026-03-29T22:00:00Z", "2026-03-30", "2026-03-30"],
    ["2026-10-25T22:59:59Z", "2026-10-19", "2026-10-25"],
    ["2026-10-25T23:00:00Z", "2026-10-26", "2026-10-26"],
  ])("uses the Paris day and Monday boundary at %s", (instant, week, today) => {
    const result = dashboardMetrics(
      emptyState(),
      DEMO_ASSOCIATION_ID,
      new Date(instant),
    );
    expect(result.today).toBe(today);
    expect(result.week.startDay).toBe(week);
  });
  it("includes the Paris week boundary and excludes prior, future and undated movements", () => {
    const source = createInitialState();
    const state = emptyState();
    state.donations = [source.donations[0]];
    state.movements = [
      "2026-03-29T21:59:59Z",
      "2026-03-29T22:00:00Z",
      "2026-03-30T10:00:01Z",
      "invalid",
    ].map((created_at, i) => ({
      ...source.movements[0],
      id: String(i),
      donation_id: state.donations[0].id,
      movement_type: "receipt",
      quantity: "1",
      created_at,
    }));
    const result = dashboardMetrics(
      state,
      DEMO_ASSOCIATION_ID,
      new Date("2026-03-30T10:00:00Z"),
    );
    expect(result.week.received).toBe(1);
    expect(result.week.unknownMovementTimeCount).toBe(1);
  });
});

describe("weekly event records", () => {
  it("counts a movement only once when repeated in the input", () => {
    const source = createInitialState();
    const state = emptyState();
    state.donations = [source.donations[0]];
    const movement = {
      ...source.movements[0],
      donation_id: state.donations[0].id,
      movement_type: "receipt" as const,
      quantity: "6",
      created_at: "2026-10-23T10:00:00Z",
    };
    state.movements = [movement, { ...movement }];
    expect(
      dashboardMetrics(state, DEMO_ASSOCIATION_ID, now).week.received,
    ).toBe(6);
  });
  it("retains only this week's scoped reception refusals and their recorded reasons", () => {
    const source = createInitialState();
    const state = emptyState();
    state.donations = [source.donations[0]];
    for (const [id, refused_at] of [
      ["current", "2026-10-25T10:00:00Z"],
      ["previous", "2026-10-18T10:00:00Z"],
      ["future", "2026-10-25T13:00:00Z"],
      ["invalid", "invalid"],
    ]) {
      state.bookings.push({
        ...source.bookings[0],
        id,
        donation_id: state.donations[0].id,
      });
      state.reception_refusals[id] = {
        booking_id: id,
        donation_id: state.donations[0].id,
        reason: "Damaged packaging",
        original_quantity: "1",
        original_approval: {
          decision: "approved",
          decided_by: "staff",
          decided_at: "2026-10-17T10:00:00Z",
        },
        refused_by: "staff",
        refused_at,
      };
    }
    expect(
      dashboardMetrics(state, DEMO_ASSOCIATION_ID, now).week.refusals.map(
        (refusal) => [refusal.booking_id, refusal.reason],
      ),
    ).toEqual([["current", "Damaged packaging"]]);
    expect(
      dashboardMetrics(state, DEMO_ASSOCIATION_ID, now).week.received,
    ).toBe(0);
  });
});

describe("current recorded balances", () => {
  it("uses recorded movements for balances independently of their activity timestamps", () => {
    const source = createInitialState();
    const state = emptyState();
    state.donations = [
      {
        ...source.donations[0],
        id: "recorded",
        category: "food",
        status: "received",
        quantity: "10",
        need_id: "need",
      },
    ];
    state.needs = [
      { ...source.needs[0], id: "need", target_quantity: "10", active: true },
    ];
    state.movements = [
      {
        ...source.movements[0],
        id: "future",
        donation_id: "recorded",
        movement_type: "receipt",
        quantity: "6",
        created_at: "2026-10-26T12:00:00Z",
      },
      {
        ...source.movements[0],
        id: "undated",
        donation_id: "recorded",
        movement_type: "receipt",
        quantity: "4",
        created_at: "invalid",
      },
      {
        ...source.movements[0],
        id: "given",
        donation_id: "recorded",
        movement_type: "distribution",
        quantity: "2",
        created_at: "2026-10-26T13:00:00Z",
      },
    ];
    const result = dashboardMetrics(state, DEMO_ASSOCIATION_ID, now);
    expect(
      result.capacities.find((capacity) => capacity.category === "food")
        ?.inStock,
    ).toBe(8);
    expect(result.needs[0]).toMatchObject({
      received: 10,
      stillNeeded: 0,
      receivedPercentage: 100,
    });
    expect(result.week).toMatchObject({
      received: 0,
      givenOut: 0,
      unknownMovementTimeCount: 1,
    });
  });
});

describe("three-decimal quantity precision", () => {
  it("does not report a covered fractional need as uncovered and totals decimal movements exactly", () => {
    const source = createInitialState();
    const state = emptyState();
    state.needs = [
      { ...source.needs[0], id: "need", target_quantity: "0.8", active: true },
    ];
    state.donations = [
      {
        ...source.donations[0],
        id: "received",
        need_id: "need",
        category: "food",
        status: "received",
      },
      {
        ...source.donations[0],
        id: "reserved",
        need_id: "need",
        category: "food",
        status: "booked",
        quantity: "0.5",
      },
    ];
    state.movements = ["0.1", "0.2"].map((quantity, index) => ({
      ...source.movements[0],
      id: String(index),
      donation_id: "received",
      movement_type: "receipt",
      quantity,
      created_at: "2026-10-24T10:00:00Z",
    }));
    const result = dashboardMetrics(state, DEMO_ASSOCIATION_ID, now);
    expect(result.needs[0]).toMatchObject({
      received: 0.3,
      reserved: 0.5,
      stillNeeded: 0,
    });
    expect(result.uncoveredNeedCount).toBe(0);
    expect(result.week.received).toBe(0.3);
    expect(
      result.week.byCategory.find((category) => category.category === "food")
        ?.received,
    ).toBe(0.3);
    expect(
      result.week.days.find((day) => day.date === "2026-10-24")?.received,
    ).toBe(0.3);
    expect(
      result.capacities.find((capacity) => capacity.category === "food")
        ?.inStock,
    ).toBe(0.3);
    state.movements = [state.movements[0]];
    state.donations[1].quantity = "0.7";
    const exactlyCovered = dashboardMetrics(state, DEMO_ASSOCIATION_ID, now);
    expect(exactlyCovered.needs[0].stillNeeded).toBe(0);
    expect(exactlyCovered.uncoveredNeedCount).toBe(0);
  });
  it("treats a fractional limit at exactly85 percent as below the warning boundary", () => {
    const source = createInitialState();
    const state = emptyState();
    state.capacities = [
      { ...source.capacities[0], category: "food", limit_quantity: "0.4" },
    ];
    state.donations = [
      {
        ...source.donations[0],
        category: "food",
        status: "approved",
        quantity: "0.34",
      },
    ];
    expect(
      dashboardMetrics(state, DEMO_ASSOCIATION_ID, now).nearCapacityCount,
    ).toBe(0);
    state.donations[0].quantity = "0.341";
    expect(
      dashboardMetrics(state, DEMO_ASSOCIATION_ID, now).nearCapacityCount,
    ).toBe(1);
  });
});
