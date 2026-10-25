import { describe, expect, it } from "vitest";
import { statusLabel } from "@/components/donor/api-donation";
import { factLabel, formatCount, indicatorLabel } from "./ui-text";

describe("donation status wording", () => {
  it("uses the agreed review and distribution terms", () => {
    expect(statusLabel("pending_review")).toBe("Waiting for review");
    expect(statusLabel("distributed")).toBe("Given out");
  });
  it("keeps donor wording distinct from staff inventory terms", () => {
    expect(statusLabel("in_stock")).toBe("Received");
    expect(statusLabel("transferred")).toBe("Received by association");
    expect(statusLabel("no_show")).toBe("Not received");
    expect(statusLabel("future_status")).toBe("Future status");
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
    expect(indicatorLabel("looks_like_medicine")).toBe("Looks like medicine");
    expect(indicatorLabel("packaging_open")).toBe("Open packaging");
    expect(indicatorLabel("worn_soles")).toBe("Worn soles");
    expect(factLabel("pao_months")).toBe("Months after opening");
    expect(factLabel("other_fact")).toBe("Other fact");
  });
});
