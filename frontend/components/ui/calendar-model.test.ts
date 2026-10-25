import { describe, expect, it } from "vitest";
import { calendarMonth, shiftDay, shiftMonth } from "./calendar-model";
describe("shared calendar dates", () => {
  it("keeps Monday first and includes leap day", () => {
    expect(calendarMonth(2026, 2).slice(0, 7)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      "2026-03-01",
    ]);
    expect(calendarMonth(2028, 1).filter(Boolean).at(-1)).toBe("2028-02-29");
  });
  it("moves between months across years and navigates dates across month edges", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftDay("2028-03-01", -1)).toBe("2028-02-29");
    expect(shiftDay("2026-10-31", 7)).toBe("2026-11-07");
  });
});
