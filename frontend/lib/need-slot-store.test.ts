import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NeedInput, SlotInput } from "./contracts";
import {
  createInitialState,
  DEMO_ASSOCIATION_ID,
  DEMO_STAFF_ID,
  fixtureId,
  getNeed,
  getSlot,
  isNeedCriteriaLocked,
  normalizeDemoState,
  reduceDemo,
} from "./demo-store";

const now = "2026-10-25T10:00:00.000Z";
const later = "2026-10-25T11:00:00.000Z";
const needInput: NeedInput = {
  category: "clothes",
  attributes: { product: "Warm coats", size: "M" },
  seasons: null,
  target_quantity: "12",
  unit: "item",
  source_text: "We need twelve coats",
};
const slotInput: SlotInput = {
  starts_at: "2026-11-01T13:00:00Z",
  ends_at: "2026-11-01T14:00:00Z",
  max_bookings: 4,
};
function staffState() {
  const state = createInitialState();
  state.role = "assoc_admin";
  return state;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
});
afterEach(() => vi.useRealTimers());

describe("need input ownership", () => {
  it("creates source facts and owns attribution, timestamps, revision and defaults", () => {
    const id = fixtureId("new-need");
    const state = reduceDemo(staffState(), {
      type: "need",
      id,
      input: needInput,
    });
    const need = state.needs.find((record) => record.id === id)!;
    expect(need).toEqual({
      ...needInput,
      id,
      association_id: DEMO_ASSOCIATION_ID,
      created_by: DEMO_STAFF_ID,
      created_at: now,
      updated_at: now,
      revision: "1",
      active: true,
    });
    expect(getNeed(state, need).computed).toEqual({
      pending_hold: "0",
      fulfilled: "0",
      available: "12",
    });
  });
  it("patches only requested fields and preserves provenance through edits and toggles", () => {
    const id = fixtureId("new-need");
    let state = reduceDemo(staffState(), {
      type: "need",
      id,
      input: needInput,
    });
    vi.setSystemTime(new Date(later));
    state = reduceDemo(state, {
      type: "need",
      id,
      patch: {
        expected_revision: "1",
        attributes: { product: "Latest coat" },
        target_quantity: "20",
      },
    });
    state = reduceDemo(state, {
      type: "need",
      id,
      patch: { expected_revision: "2", active: false },
    });
    expect(state.needs.find((record) => record.id === id)).toEqual({
      ...needInput,
      id,
      association_id: DEMO_ASSOCIATION_ID,
      created_by: DEMO_STAFF_ID,
      created_at: now,
      updated_at: later,
      revision: "3",
      active: false,
      target_quantity: "20",
      attributes: { product: "Latest coat" },
    });
    const before = structuredClone(state);
    expect(() =>
      reduceDemo(state, {
        type: "need",
        id,
        patch: { expected_revision: "2", active: true },
      }),
    ).toThrow("record changed");
    expect(state).toEqual(before);
  });
  it("keeps historical criteria locked while allowing closing and valid target changes", () => {
    let state = reduceDemo(staffState(), {
      type: "refuseReception",
      booking_id: fixtureId("booking-sweaters"),
      reason: "Damp",
      confirm_refusal: true,
      expected_revision: "1",
    });
    for (const donation of state.donations)
      if (donation.id !== fixtureId("sweaters")) donation.need_id = null;
    const id = fixtureId("need-clothes");
    expect(isNeedCriteriaLocked(state, id)).toBe(true);
    expect(
      getNeed(
        state,
        state.needs.find((need) => need.id === id)!,
      ).computed.pending_hold,
    ).toBe("0");
    state = reduceDemo(state, {
      type: "need",
      id,
      patch: { expected_revision: "1", active: false, target_quantity: "1" },
    });
    expect(state.needs.find((need) => need.id === id)?.active).toBe(false);
    expect(() =>
      reduceDemo(state, {
        type: "need",
        id,
        patch: { expected_revision: "2", attributes: { product: "New item" } },
      }),
    ).toThrow("criteria are locked");
  });
});

describe("slot input ownership", () => {
  it("creates editable facts and owns timestamps, revision and default status", () => {
    const id = fixtureId("new-slot");
    const state = reduceDemo(staffState(), {
      type: "slot",
      id,
      input: slotInput,
    });
    const slot = state.slots.find((record) => record.id === id)!;
    expect(slot).toEqual({
      ...slotInput,
      id,
      association_id: DEMO_ASSOCIATION_ID,
      created_at: now,
      updated_at: now,
      revision: "1",
      active: true,
    });
    expect(getSlot(state, slot).computed).toEqual({
      booked_count: 0,
      remaining_places: 4,
    });
  });
  it("patches capacity and status without replacing latest times or creation metadata", () => {
    const id = fixtureId("new-slot");
    let state = reduceDemo(staffState(), {
      type: "slot",
      id,
      input: slotInput,
    });
    vi.setSystemTime(new Date(later));
    state = reduceDemo(state, {
      type: "slot",
      id,
      patch: {
        expected_revision: "1",
        starts_at: "2026-11-01T13:15:00Z",
        max_bookings: 3,
      },
    });
    state = reduceDemo(state, {
      type: "slot",
      id,
      patch: { expected_revision: "2", active: false },
    });
    expect(state.slots.find((record) => record.id === id)).toEqual({
      ...slotInput,
      id,
      association_id: DEMO_ASSOCIATION_ID,
      created_at: now,
      updated_at: later,
      revision: "3",
      active: false,
      starts_at: "2026-11-01T13:15:00Z",
      max_bookings: 3,
    });
    const before = structuredClone(state);
    expect(() =>
      reduceDemo(state, {
        type: "slot",
        id,
        patch: { expected_revision: "2", active: true },
      }),
    ).toThrow("record changed");
    expect(state).toEqual(before);
  });
});

it("preserves legacy browser facts while discarding stale need and slot read totals", () => {
  const state = staffState();
  const legacy = JSON.parse(JSON.stringify(state));
  legacy.needs[0].computed = {
    pending_hold: "999",
    fulfilled: "999",
    available: "999",
  };
  legacy.slots[0].computed = { booked_count: 999, remaining_places: 999 };
  expect(normalizeDemoState(legacy)).toEqual(state);
  expect(getSlot(normalizeDemoState(legacy), state.slots[0]).computed).toEqual({
    booked_count: 1,
    remaining_places: 0,
  });
});
