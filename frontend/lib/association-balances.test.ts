import { describe, expect, it } from "vitest";
import {
  createInitialState,
  DEMO_ASSOCIATION_ID,
  getCapacity,
  getInventory,
  getMatches,
  getNeed,
  getNeeds,
} from "./demo-store";
import { dashboardMetrics } from "./dashboard-metrics";

function balanceState() {
  const state = createInitialState();
  state.donations = [
    {
      ...state.donations[0],
      id: "received",
      category: "food",
      status: "received",
      quantity: "10",
      need_id: "need",
    },
    {
      ...state.donations[0],
      id: "hold",
      category: "food",
      status: "approved",
      quantity: "0.5",
      need_id: "need",
    },
  ];
  state.needs = [
    {
      ...state.needs[0],
      id: "need",
      category: "food",
      target_quantity: "0.8",
      active: true,
    },
  ];
  const movement = state.movements[0];
  state.movements = [
    {
      ...movement,
      id: "receipt-1",
      donation_id: "received",
      association_id: "foreign",
      movement_type: "receipt",
      quantity: "99",
      created_at: "invalid",
    },
    {
      ...movement,
      id: "receipt-1",
      donation_id: "received",
      movement_type: "receipt",
      quantity: "0.1",
      created_at: "invalid",
    },
    {
      ...movement,
      id: "receipt-1",
      donation_id: "received",
      movement_type: "receipt",
      quantity: "99",
      created_at: "invalid",
    },
    {
      ...movement,
      id: "receipt-2",
      donation_id: "received",
      movement_type: "receipt",
      quantity: "0.2",
      created_at: "2099-01-01T00:00:00Z",
    },
    {
      ...movement,
      id: "given",
      donation_id: "received",
      movement_type: "distribution",
      quantity: "0.1",
      created_at: "2099-01-01T00:00:00Z",
    },
  ];
  return state;
}

describe("shared recorded association balances", () => {
  it("keeps dashboard, Stock, Capacity and Needs consistent across duplicates, tenant boundaries and decimals", () => {
    const state = balanceState();
    const inventory = getInventory(state).find(
      (item) => item.donation.id === "received",
    )!;
    expect(inventory).toMatchObject({
      received_quantity: "0.3",
      distributed_quantity: "0.1",
      remaining_quantity: "0.2",
    });
    const capacity = getCapacity(state, "food");
    const need = getNeed(state, state.needs[0]);
    expect(capacity.computed).toMatchObject({
      in_stock: "0.2",
      reserved: "0.5",
    });
    expect(need.computed).toEqual({
      fulfilled: "0.3",
      pending_hold: "0.5",
      available: "0",
    });
    const dashboard = dashboardMetrics(
      state,
      DEMO_ASSOCIATION_ID,
      new Date("2026-10-25T12:00:00Z"),
    );
    expect(
      dashboard.capacities.find((item) => item.category === "food"),
    ).toMatchObject({
      inStock: Number(capacity.computed.in_stock),
      reserved: Number(capacity.computed.reserved),
    });
    expect(dashboard.needs[0]).toMatchObject({
      received: Number(need.computed.fulfilled),
      reserved: Number(need.computed.pending_hold),
      stillNeeded: 0,
    });
    expect(dashboard.week.received).toBe(0);
  });
});

describe("shared balance lifecycle and tenancy", () => {
  it("uses actual receipt6 and distribution2 rather than the original offer10", () => {
    const state = balanceState();
    state.donations = [state.donations[0]];
    state.needs[0].target_quantity = "10";
    state.movements = [
      { ...state.movements[1], id: "received", quantity: "6" },
      { ...state.movements[4], quantity: "2" },
    ];
    expect(getInventory(state)[0]).toMatchObject({
      received_quantity: "6",
      distributed_quantity: "2",
      remaining_quantity: "4",
    });
    expect(getCapacity(state, "food").computed).toMatchObject({
      in_stock: "4",
      reserved: "0",
    });
    expect(getNeed(state, state.needs[0]).computed).toEqual({
      fulfilled: "6",
      pending_hold: "0",
      available: "4",
    });
    const dashboard = dashboardMetrics(
      state,
      DEMO_ASSOCIATION_ID,
      new Date("2026-10-25T12:00:00Z"),
    );
    expect(
      dashboard.capacities.find((capacity) => capacity.category === "food"),
    ).toMatchObject({ inStock: 4, reserved: 0 });
    expect(dashboard.needs[0]).toMatchObject({
      received: 6,
      reserved: 0,
      stillNeeded: 4,
    });
  });
  it("isolates both tenant balances while Inventory can list each association's own stock", () => {
    const state = balanceState();
    state.donations.push({
      ...state.donations[0],
      id: "foreign-donation",
      association_id: "foreign",
      quantity: "99",
    });
    state.capacities.push({
      ...state.capacities.find((capacity) => capacity.category === "food")!,
      association_id: "foreign",
      limit_quantity: "100",
    });
    state.movements.unshift({
      ...state.movements[0],
      id: "foreign-receipt",
      donation_id: "foreign-donation",
      association_id: "foreign",
      quantity: "99",
    });
    expect(getCapacity(state, "food").computed).toMatchObject({
      in_stock: "0.2",
      reserved: "0.5",
    });
    expect(getNeed(state, state.needs[0]).computed.fulfilled).toBe("0.3");
    expect(getCapacity(state, "food", "foreign").computed).toEqual({
      in_stock: "99",
      reserved: "0",
      available: "1",
    });
    expect(
      getInventory(state).find(
        (item) => item.donation.id === "foreign-donation",
      )?.remaining_quantity,
    ).toBe("99");
  });
  it("keeps all normal fixture balances equal across page selectors and dashboard", () => {
    const state = createInitialState();
    const dashboard = dashboardMetrics(
      state,
      DEMO_ASSOCIATION_ID,
      new Date("2026-10-25T12:00:00Z"),
    );
    for (const capacity of dashboard.capacities) {
      expect(getCapacity(state, capacity.category).computed).toEqual({
        in_stock: String(capacity.inStock),
        reserved: String(capacity.reserved),
        available: String(capacity.available),
      });
    }
    for (const need of dashboard.needs) {
      expect(getNeed(state, need.need).computed).toEqual({
        fulfilled: String(need.received),
        pending_hold: String(need.reserved),
        available: String(need.stillNeeded),
      });
    }
  });
});

describe("matching capacity scope", () => {
  it("skips an association without its own capacity and never borrows another limit", () => {
    const state = balanceState();
    const candidate = {
      ...state.donations[0],
      id: "candidate",
      association_id: null,
      need_id: null,
      quantity: "1",
      attributes: {},
    };
    state.analyses = [];
    state.needs = [
      {
        ...state.needs[0],
        association_id: "foreign",
        attributes: {},
        seasons: null,
        target_quantity: "10",
      },
    ];
    state.associations.push({ ...state.associations[0], id: "foreign" });
    expect(getMatches(state, candidate)).toEqual([]);
    const capacity = {
      ...state.capacities.find((record) => record.category === "food")!,
      association_id: "foreign",
      limit_quantity: "0",
    };
    state.capacities.push(capacity);
    expect(getMatches(state, candidate)).toEqual([]);
    capacity.limit_quantity = "2";
    state.capacities.find(
      (record) =>
        record.category === "food" &&
        record.association_id === DEMO_ASSOCIATION_ID,
    )!.limit_quantity = "0";
    expect(
      getMatches(state, candidate).map((match) => match.association.id),
    ).toEqual(["foreign"]);
  });
});

describe("batch need reads", () => {
  it("preserves scoped need order and reads current balances on every call", () => {
    const state = balanceState();
    state.needs.push(
      { ...state.needs[0], id: "foreign", association_id: "foreign" },
      { ...state.needs[0], id: "second", active: false },
    );
    expect(getNeeds(state).map((need) => [need.id, need.computed])).toEqual([
      ["need", { fulfilled: "0.3", pending_hold: "0.5", available: "0" }],
      ["second", { fulfilled: "0", pending_hold: "0", available: "0.8" }],
    ]);
    state.donations[1].status = "refused";
    expect(getNeeds(state)[0].computed.available).toBe("0.5");
    expect(getNeeds(state, "foreign").map((need) => need.id)).toEqual([
      "foreign",
    ]);
  });
});

describe("matching snapshot reuse", () => {
  it("preserves need order, eligibility and first-capacity semantics across associations", () => {
    const state = balanceState();
    const candidate = {
      ...state.donations[0],
      id: "candidate",
      association_id: null,
      need_id: null,
      quantity: "0.5",
      attributes: { product: "Rice" },
    };
    state.analyses = [];
    state.associations.push({ ...state.associations[0], id: "foreign" });
    const base = {
      ...state.needs[0],
      seasons: null,
      target_quantity: "2",
      attributes: { product: "Rice" },
    };
    state.needs = [
      { ...base, id: "first" },
      { ...base, id: "paused", active: false },
      { ...base, id: "seasonal", seasons: ["winter"] },
      { ...base, id: "wrong-item", attributes: { product: "Pasta" } },
      { ...base, id: "full", target_quantity: "0" },
      { ...base, id: "foreign", association_id: "foreign" },
      { ...base, id: "last" },
    ];
    const capacity = state.capacities.find(
      (record) => record.category === "food",
    )!;
    capacity.limit_quantity = "2";
    state.capacities.push(
      { ...capacity, association_id: "foreign", limit_quantity: "0" },
      { ...capacity, association_id: "foreign", limit_quantity: "99" },
    );
    expect(getMatches(state, candidate).map((match) => match.need_id)).toEqual([
      "first",
      "last",
    ]);
    state.capacities.find(
      (record) => record.association_id === "foreign",
    )!.limit_quantity = "1";
    expect(getMatches(state, candidate).map((match) => match.need_id)).toEqual([
      "first",
      "foreign",
      "last",
    ]);
    capacity.limit_quantity = "0.7";
    expect(getMatches(state, candidate).map((match) => match.need_id)).toEqual([
      "foreign",
    ]);
  });
});
