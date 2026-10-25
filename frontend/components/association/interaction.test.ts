import { describe, expect, it } from "vitest";
import {
  calendarMonth,
  parisInputToInstant,
  resolveDemoBookingReference,
  resolveDemoArrival,
  validQuantity,
} from "./interaction";

describe("association inputs", () => {
  it("reveals a looked-up booking on its Paris arrival date even when another date was selected", () => {
    const bookings = [
      { id: "booking-oct28", slot_id: "slot-oct28" },
      { id: "booking-oct29", slot_id: "slot-oct29" },
    ];
    const slots = [
      { id: "slot-oct28", starts_at: "2026-10-28T13:00:00Z" },
      { id: "slot-oct29", starts_at: "2026-10-28T23:30:00Z" },
    ];
    const match = resolveDemoArrival(
      "DEMO-ONLY:booking-oct29",
      bookings,
      slots,
    );
    expect(match).toEqual({ booking: bookings[1], arrival_date: "2026-10-29" });
    expect(
      resolveDemoArrival("DEMO-ONLY:foreign-booking", bookings, slots),
    ).toBeUndefined();
    expect(
      resolveDemoArrival("DEMO-ONLY:booking-oct29", bookings, []),
    ).toBeUndefined();
  });
  it("places a Sunday month start in the last column of a Monday-first calendar", () => {
    const days = calendarMonth(2026, 2);
    expect(days.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(days[6]).toBe("2026-03-01");
    expect(days.filter(Boolean)).toHaveLength(31);
  });
  it("includes leap day without including a day from another month", () => {
    const days = calendarMonth(2028, 1);
    expect(days.filter(Boolean).at(-1)).toBe("2028-02-29");
    expect(days.filter(Boolean)).toHaveLength(29);
  });
  it("resolves the donor's displayed demo pass and manual fixture references", () => {
    const bookings = [{ id: "70000000-0000-4000-8000-000000000001" }];
    expect(
      resolveDemoBookingReference(
        "DEMO-ONLY:70000000-0000-4000-8000-000000000001",
        bookings,
      ),
    ).toBe(bookings[0]);
    expect(
      resolveDemoBookingReference(
        " 70000000-0000-4000-8000-000000000001 ",
        bookings,
      ),
    ).toBe(bookings[0]);
    expect(
      resolveDemoBookingReference(
        "DEMO:70000000-0000-4000-8000-000000000001",
        bookings,
      ),
    ).toBe(bookings[0]);
    expect(
      resolveDemoBookingReference("DEMO-ONLY:foreign-booking", bookings),
    ).toBeUndefined();
  });
  it("converts Paris appointment times without using the browser timezone", () => {
    expect(parisInputToInstant("2026-10-28T15:00")).toBe(
      "2026-10-28T14:00:00.000Z",
    );
    expect(parisInputToInstant("2027-06-15T15:00")).toBe(
      "2027-06-15T13:00:00.000Z",
    );
  });
  it("rejects nonexistent and ambiguous local appointment times", () => {
    expect(() => parisInputToInstant("2027-03-28T02:30")).toThrow();
    expect(() => parisInputToInstant("2026-10-25T02:30")).toThrow();
  });
  it("limits reception and distribution to positive whole available units", () => {
    expect(validQuantity("2", "3")).toBe(true);
    expect(validQuantity("4", "3")).toBe(false);
    expect(validQuantity("0", "3")).toBe(false);
    expect(validQuantity("1.5", "3")).toBe(false);
    expect(validQuantity("-1", "3")).toBe(false);
  });
});
