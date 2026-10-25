import { describe, expect, it } from "vitest";
import { capacityUsage } from "./capacity-meter-model";

describe("capacity usage", () => {
  it.each([
    [0, 0, 100, 0, "success"],
    [40, 20, 100, 60, "success"],
    [60, 0.001, 100, 60.001, "warning"],
    [80, 5, 100, 85, "warning"],
    [85, 0.001, 100, 85.001, "danger"],
    [90, 10, 100, 100, "danger"],
    [0.017, 0, 0.02, 85, "warning"],
    [0.012, 0, 0.02, 60, "success"],
    [0.013, 0.004, 0.02, 85, "warning"],
    [0.012, 0.001, 0.02, 65, "warning"],
    [0.017, 0.001, 0.02, 90, "danger"],
  ] as const)(
    "classifies stock %s + reserved %s against limit %s",
    (stock, reserved, limit, percentage, tone) => {
      const usage = capacityUsage(stock, reserved, limit);
      expect(usage.percentage).toBeCloseTo(percentage, 8);
      expect(usage.tone).toBe(tone);
      expect(usage.paused).toBe(false);
    },
  );
  it("keeps a zero limit neutral and paused without invalid arithmetic", () => {
    expect(capacityUsage(0, 0, 0)).toMatchObject({
      percentage: null,
      tone: "neutral",
      paused: true,
    });
  });
  it.each([
    [Number.MAX_VALUE, Number.MAX_VALUE, 100],
    [Number.MAX_VALUE, 0, Number.MIN_VALUE],
  ])(
    "handles arithmetic overflow without an invalid meter",
    (stock, reserved, limit) => {
      const usage = capacityUsage(stock, reserved, limit);
      expect(usage.percentage).toBeNull();
      expect(usage.tone).toBe("neutral");
      expect(Number.isFinite(usage.used)).toBe(true);
    },
  );
  it.each([
    [0, Number.NaN, 10],
    [0, -1, 10],
    [0, 0, Number.POSITIVE_INFINITY],
    [0, 0, -1],
  ])(
    "keeps invalid reservations or limits unavailable",
    (stock, reserved, limit) => {
      expect(capacityUsage(stock, reserved, limit)).toMatchObject({
        percentage: null,
        tone: "neutral",
        paused: false,
      });
    },
  );
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    "does not display an invalid percentage for %s",
    (value) => {
      expect(capacityUsage(value, 0, 100)).toMatchObject({
        percentage: null,
        tone: "neutral",
        paused: false,
      });
    },
  );
});
