import { describe, expect, it } from "vitest";
import { STATUS_LABELS } from "./demo-store";
import { factLabel, formatCount, indicatorLabel } from "./ui-text";

describe("donation status wording", () => {
  it("uses the agreed review and distribution terms", () => {
    expect(STATUS_LABELS.offered).toBe("Waiting for review");
    expect(STATUS_LABELS.distributed).toBe("Given out");
  });
});

describe("visible fact and quantity wording", () => {
  it("uses singular nouns for one, including contract decimal strings", () => {
    expect(formatCount("1", "unit")).toBe("1 unit");
    expect(formatCount("1.000")).toBe("1 item");
    expect(formatCount(1, "sample need")).toBe("1 sample need");
    expect(formatCount(0)).toBe("0 items");
    expect(formatCount("2", "month")).toBe("2 months");
    expect(formatCount(null)).toBe("Quantity not provided");
  });
  it("gives evidence keys readable labels without changing their meaning", () => {
    expect(indicatorLabel("looks_like_medicine")).toBe("Medicine concern");
    expect(indicatorLabel("packaging_open")).toBe("Open packaging");
    expect(indicatorLabel("worn_soles")).toBe("Worn soles");
    expect(factLabel("pao_months")).toBe("Months after opening");
    expect(factLabel("other_fact")).toBe("Other fact");
  });
});
