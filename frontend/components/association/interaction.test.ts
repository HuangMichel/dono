import { describe, expect, it } from "vitest";
import {
  calendarMonth,
  parisInputToInstant,
  validQuantity,
} from "./interaction";

describe("association inputs", () => {
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
