import { describe, expect, it } from "vitest";
import { availableBookingSlots, parisDay } from "./booking-availability";
describe("donor booking availability", () => {
  it("shows only future, active, non-full slots for the approved association and Paris day", () => {
    const base = { association_id: "approved", active: true, max_bookings: 1 };
    const slots = [
      { ...base, id: "available", starts_at: "2026-10-28T23:30:00Z" },
      { ...base, id: "full", starts_at: "2026-10-28T23:30:00Z" },
      {
        ...base,
        id: "closed",
        active: false,
        starts_at: "2026-10-28T23:30:00Z",
      },
      { ...base, id: "past", starts_at: "2026-10-28T22:00:00Z" },
      {
        ...base,
        id: "foreign",
        association_id: "other",
        starts_at: "2026-10-28T23:30:00Z",
      },
      { ...base, id: "tomorrow", starts_at: "2026-10-29T23:30:00Z" },
    ];
    expect(
      availableBookingSlots(
        slots,
        [{ slot_id: "full" }],
        "approved",
        "2026-10-29",
        Date.parse("2026-10-28T22:30:00Z"),
      ).map((s) => s.id),
    ).toEqual(["available"]);
    expect(
      availableBookingSlots(slots, [], undefined, "2026-10-29", 0),
    ).toEqual([]);
  });
  it("uses Paris today across UTC midnight and daylight-saving changes", () => {
    expect(parisDay(new Date("2026-10-24T22:30:00Z"))).toBe("2026-10-25");
    expect(parisDay(new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-26");
  });
});
