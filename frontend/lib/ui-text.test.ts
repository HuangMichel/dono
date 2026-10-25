import { describe, expect, it } from "vitest";
import { statusLabel } from "@/components/donor/api-donation";
import {
  daysLeftText,
  expiryTone,
  factLabel,
  formatCount,
  indicatorLabel,
  indicatorTone,
  rankIndicators,
  safetyWarnings,
} from "./ui-text";

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

describe("indicator and expiry tones", () => {
  it("colours every analysis-v1 concern key by who speaks, never as approval", () => {
    for (const key of [
      "wear_visible",
      "stains_visible",
      "holes_visible",
      "pilling_visible",
      "pair_incomplete",
      "sole_damage",
      "upper_damage",
      "heavy_wear",
      "packaging_damaged",
      "seal_broken",
      "spoilage_visible",
      "structural_damage",
      "surface_damage",
      "visible_mould",
    ]) {
      expect(indicatorTone(key, "medium")).toBe("warning");
      expect(indicatorTone(key, "high")).toBe("warning");
      expect(indicatorTone(key, "low")).toBe("neutral");
    }
    expect(indicatorTone("looks_like_medicine", "medium")).toBe("danger");
    expect(indicatorTone("chilled_or_frozen", "high")).toBe("danger");
    expect(indicatorTone("label_unreadable", "high")).toBe("caution");
    expect(indicatorTone("looks_like_medicine", "low")).toBe("neutral");
  });
  it("keeps unassessed and positive observations neutral", () => {
    expect(indicatorTone("stains_visible")).toBe("neutral");
    expect(indicatorTone("looks_like_medicine")).toBe("neutral");
    expect(indicatorTone("sealed", "high")).toBe("neutral");
  });
  it("orders product-rule warnings first, then concerns by probability", () => {
    const ranked = rankIndicators([
      { key: "label_unreadable", probability: 0.1, level: "low" as const },
      { key: "stains_visible", probability: 0.61, level: "medium" as const },
      { key: "visible_mould", probability: 0.9, level: "high" as const },
      {
        key: "looks_like_medicine",
        probability: 0.55,
        level: "medium" as const,
      },
      { key: "seal_broken" },
    ]);
    expect(ranked.map((i) => i.key)).toEqual([
      "looks_like_medicine",
      "visible_mould",
      "stains_visible",
      "label_unreadable",
      "seal_broken",
    ]);
  });
  it("keeps one medium or high warning per medicine and cold-food key", () => {
    const warnings = safetyWarnings([
      { key: "chilled_or_frozen", probability: 0.94, level: "high" as const },
      { key: "looks_like_medicine", probability: 0.2, level: "low" as const },
      { key: "chilled_or_frozen", probability: 0.6, level: "medium" as const },
      { key: "visible_mould", probability: 0.9, level: "high" as const },
    ]);
    expect(warnings.map((i) => [i.key, i.probability])).toEqual([
      ["chilled_or_frozen", 0.94],
    ]);
  });
  it("words days left without negative or singular mistakes", () => {
    expect(daysLeftText(-2)).toBe("date passed");
    expect(daysLeftText(0)).toBe("expires today");
    expect(daysLeftText(1)).toBe("1 day left");
    expect(daysLeftText(25)).toBe("25 days left");
  });
  it("maps computed expiry buckets to the shared status tones", () => {
    expect(expiryTone("expired")).toBe("danger");
    expect(expiryTone("lt_30")).toBe("warning");
    expect(expiryTone("lt_90")).toBe("caution");
    expect(expiryTone("unknown")).toBe("caution");
    expect(expiryTone("gt_90")).toBe("success");
    expect(expiryTone("not_applicable")).toBe("neutral");
  });
});
