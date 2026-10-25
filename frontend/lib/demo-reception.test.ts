import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState, fixtureId, reduceDemo } from "./demo-store";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-25T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("demo refusal at reception", () => {
  it("refuses all three booked units without stock or quantity changes", () => {
    const state = createInitialState();
    state.role = "assoc_admin";
    const before = state.donations.find((d) => d.id === fixtureId("sweaters"))!;
    const next = reduceDemo(state, {
      type: "refuseReception",
      booking_id: fixtureId("booking-sweaters"),
      reason: "  Item is damp and mouldy.  ",
      confirm_refusal: true,
      expected_revision: before.revision,
    });
    const donation = next.donations.find((d) => d.id === before.id)!;
    expect(donation.status).toBe("refused");
    expect(donation.decision).toBe("refused");
    expect(donation.quantity).toBe("3");
    expect(donation.revision).toBe("2");
    expect(next.bookings).toEqual(state.bookings);
    expect(next.movements).toEqual(state.movements);
  });
});

import {
  getCapacity,
  getNeed,
  getOccupyingBookings,
  normalizeDemoState,
  DEMO_ASSOCIATION_ID,
  DEMO_STAFF_ID,
  type DemoState,
  type DemoCommand,
} from "./demo-store";
import { availableBookingSlots, parisDay } from "./booking-availability";
const bookingId = fixtureId("booking-sweaters");
const donationId = fixtureId("sweaters");
const refuseCommand = {
  type: "refuseReception" as const,
  booking_id: bookingId,
  reason: "  Damp and mouldy  ",
  confirm_refusal: true,
  expected_revision: "1",
};
function staffState() {
  const state = createInitialState();
  state.role = "assoc_admin";
  return state;
}

describe("refusal evidence and terminal state", () => {
  it("preserves original approval and analysis, records trimmed reason and latest staff attribution", () => {
    const state = staffState(),
      original = state.donations.find((d) => d.id === donationId)!;
    const next = reduceDemo(state, refuseCommand),
      refusal = next.reception_refusals[bookingId],
      donation = next.donations.find((d) => d.id === donationId)!;
    expect(refusal.reason).toBe("Damp and mouldy");
    expect(refusal.original_quantity).toBe("3");
    expect(refusal.original_approval).toEqual({
      decision: "approved",
      decided_by: original.decided_by,
      decided_at: original.decided_at,
    });
    expect(refusal.refused_by).toBe(DEMO_STAFF_ID);
    expect(donation.decided_by).toBe(DEMO_STAFF_ID);
    expect(donation.decided_at).toBe(refusal.refused_at);
    expect(next.analyses).toEqual(state.analyses);
    expect(next.photos).toEqual(state.photos);
    expect(next.receipt_originals).toEqual(state.receipt_originals);
    expect(state.donations.find((d) => d.id === donationId)?.status).toBe(
      "booked",
    );
  });
  it.each([
    ["blank reason", { reason: " \n " }],
    ["missing confirmation", { confirm_refusal: false }],
    ["stale revision", { expected_revision: "999" }],
    ["unknown booking", { booking_id: fixtureId("foreign") }],
  ])("rejects %s without mutating state", (_label, patch) => {
    const state = staffState(),
      before = structuredClone(state);
    expect(() => reduceDemo(state, { ...refuseCommand, ...patch })).toThrow();
    expect(state).toEqual(before);
  });
  it.each(["donor", "platform_admin", null] as const)(
    "rejects unauthorized role %s",
    (role) => {
      const state = staffState();
      state.role = role;
      expect(() => reduceDemo(state, refuseCommand)).toThrow();
      expect(state.reception_refusals).toEqual({});
    },
  );
  it("rejects a foreign association even when its booking and donation agree", () => {
    const state = staffState();
    state.bookings.find((b) => b.id === bookingId)!.association_id = fixtureId(
      "foreign-association",
    );
    state.donations.find((d) => d.id === donationId)!.association_id =
      fixtureId("foreign-association");
    expect(() => reduceDemo(state, refuseCommand)).toThrow("this association");
    expect(state.reception_refusals).toEqual({});
  });
  it.each([
    "draft",
    "offered",
    "approved",
    "refused",
    "received",
    "distributed",
  ] as const)("rejects non-booked status %s", (status) => {
    const state = staffState();
    state.donations.find((d) => d.id === donationId)!.status = status;
    expect(() => reduceDemo(state, refuseCommand)).toThrow(
      "booked, unreceived",
    );
    expect(state.reception_refusals).toEqual({});
  });
  it("refuses independently of an invalid quantity left in a reception form", () => {
    const next = reduceDemo(staffState(), {
      ...refuseCommand,
      quantity: "0",
    } as DemoCommand);
    expect(next.donations.find((d) => d.id === donationId)?.quantity).toBe("3");
  });
  it("does not receive, approve, book or distribute a refused donation, or record a second refusal", () => {
    const state = reduceDemo(staffState(), refuseCommand);
    expect(() =>
      reduceDemo(state, {
        type: "receive",
        booking_id: bookingId,
        quantity: "3",
        expected_revision: "2",
      }),
    ).toThrow();
    expect(() =>
      reduceDemo(state, {
        type: "decision",
        id: donationId,
        decision: "approved",
        checks: {
          not_medicine: true,
          packaged_unopened: null,
          food_nonperishable_room_temperature: null,
        },
        expected_revision: "2",
      }),
    ).toThrow();
    expect(() =>
      reduceDemo(state, {
        type: "distribute",
        id: donationId,
        quantity: "1",
        expected_revision: "2",
      }),
    ).toThrow();
    expect(() =>
      reduceDemo(state, { ...refuseCommand, expected_revision: "2" }),
    ).toThrow();
    state.role = "donor";
    expect(() =>
      reduceDemo(state, {
        type: "book",
        id: donationId,
        slot_id: fixtureId("slot-1"),
        expected_revision: "2",
      }),
    ).toThrow();
    expect(Object.keys(state.reception_refusals)).toHaveLength(1);
  });
  it("does not refuse after receiving", () => {
    const state = reduceDemo(staffState(), {
      type: "receive",
      booking_id: bookingId,
      quantity: "2",
      expected_revision: "1",
    });
    expect(() =>
      reduceDemo(state, { ...refuseCommand, expected_revision: "2" }),
    ).toThrow();
    expect(
      state.movements.filter((m) => m.donation_id === donationId),
    ).toHaveLength(1);
  });
});

describe("refusal releases provisional holds while retaining history", () => {
  it("releases capacity, demand and a slot place consistently, retaining the immutable appointment", () => {
    const state = staffState(),
      slot = state.slots.find((s) => s.id === fixtureId("slot-0"))!,
      need = state.needs.find((n) => n.id === fixtureId("need-clothes"))!;
    const capacityBefore = Number(
        getCapacity(state, "clothes").computed.available,
      ),
      demandBefore = Number(getNeed(state, need).computed.available);
    const next = reduceDemo(state, refuseCommand);
    expect(Number(getCapacity(next, "clothes").computed.available)).toBe(
      capacityBefore + 3,
    );
    expect(Number(getNeed(next, need).computed.available)).toBe(
      demandBefore + 3,
    );
    expect(getOccupyingBookings(next).some((b) => b.id === bookingId)).toBe(
      false,
    );
    expect(next.slots).toEqual(state.slots);
    expect(next.bookings).toEqual(state.bookings);
    const now = Date.parse(slot.starts_at) - 1000,
      day = parisDay(new Date(slot.starts_at));
    expect(
      availableBookingSlots(
        state.slots,
        getOccupyingBookings(state),
        DEMO_ASSOCIATION_ID,
        day,
        now,
      ).some((s) => s.id === slot.id),
    ).toBe(false);
    expect(
      availableBookingSlots(
        next.slots,
        getOccupyingBookings(next),
        DEMO_ASSOCIATION_ID,
        day,
        now,
      ).some((s) => s.id === slot.id),
    ).toBe(true);
    expect(
      availableBookingSlots(
        next.slots,
        getOccupyingBookings(next),
        DEMO_ASSOCIATION_ID,
        day,
        Date.parse(slot.starts_at) + 1000,
      ).some((s) => s.id === slot.id),
    ).toBe(false);
    const edited = {
      ...slot,
      starts_at: new Date(Date.parse(slot.starts_at) + 60000).toISOString(),
    };
    expect(() =>
      reduceDemo(next, {
        type: "slot",
        id: slot.id,
        patch: {
          starts_at: edited.starts_at,
          expected_revision: slot.revision,
        },
      }),
    ).toThrow("times cannot change");
  });
  it("allows a different approved donation to book the released last place", () => {
    let state = reduceDemo(staffState(), refuseCommand);
    state = reduceDemo(state, {
      type: "decision",
      id: fixtureId("coat"),
      decision: "approved",
      checks: {
        not_medicine: true,
        food_nonperishable_room_temperature: null,
        packaged_unopened: null,
      },
      expected_revision: "1",
    });
    state.role = "donor";
    state = reduceDemo(state, {
      type: "book",
      id: fixtureId("coat"),
      slot_id: fixtureId("slot-0"),
      expected_revision: "2",
    });
    expect(
      state.bookings.filter((b) => b.slot_id === fixtureId("slot-0")),
    ).toHaveLength(2);
    expect(
      getOccupyingBookings(state).filter(
        (b) => b.slot_id === fixtureId("slot-0"),
      ),
    ).toHaveLength(1);
  });
  it("uses occupying bookings for capacity edits while keeping historical slot times locked", () => {
    let state = staffState();
    const slot = state.slots.find((s) => s.id === fixtureId("slot-1"))!;
    const historic = {
      ...state.bookings[0],
      id: fixtureId("extra-history"),
      slot_id: slot.id,
    };
    state.bookings.push(historic);
    state.bookings.find((b) => b.id === bookingId)!.slot_id = slot.id;
    state = reduceDemo(state, refuseCommand);
    expect(() =>
      reduceDemo(state, {
        type: "slot",
        id: slot.id,
        patch: { max_bookings: 1, expected_revision: "1" },
      }),
    ).not.toThrow();
  });
});

describe("browser-local state normalization", () => {
  it("initializes refusal records in an older saved state and preserves them on reload", () => {
    const old = staffState() as Partial<DemoState>;
    delete old.reception_refusals;
    const normalized = normalizeDemoState(JSON.parse(JSON.stringify(old)));
    expect(normalized.reception_refusals).toEqual({});
    const refused = reduceDemo(normalized, refuseCommand);
    const reloaded = normalizeDemoState(JSON.parse(JSON.stringify(refused)));
    expect(reloaded.reception_refusals[bookingId].reason).toBe(
      "Damp and mouldy",
    );
    expect(reloaded.donations.find((d) => d.id === donationId)?.status).toBe(
      "refused",
    );
  });
});

describe("approval history after refusal", () => {
  it("keeps need criteria locked after releasing a reception-refused commitment", () => {
    const state = reduceDemo(staffState(), refuseCommand);
    // Remove other donation references so this verifies the refused commitment.
    const need = state.needs.find((n) => n.id === fixtureId("need-clothes"))!;
    for (const donation of state.donations)
      if (donation.id !== donationId) donation.need_id = null;
    expect(() =>
      reduceDemo(state, {
        type: "need",
        id: need.id,
        patch: {
          attributes: { product: "Different item" },
          expected_revision: need.revision,
        },
      }),
    ).toThrow("criteria are locked");
  });
  it("does not offer a past slot even after its refusal releases a place", () => {
    const state = reduceDemo(staffState(), refuseCommand);
    state.role = "donor";
    const slot = state.slots.find((s) => s.id === fixtureId("slot-0"))!;
    slot.starts_at = "2000-01-01T13:00:00Z";
    const approved = state.donations.find((d) => d.id === fixtureId("pasta"))!;
    expect(() =>
      reduceDemo(state, {
        type: "book",
        id: approved.id,
        slot_id: slot.id,
        expected_revision: approved.revision,
      }),
    ).toThrow("unavailable");
  });
});
