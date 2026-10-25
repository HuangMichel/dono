import { describe, expect, it } from "vitest";
import { NEED_SAMPLE_TEXT, prepareNeedSample } from "./need-draft-sample";
describe("sample need draft", () => {
  it("returns only a reviewable draft, retaining its actual sample source", () => {
    const source = `  ${NEED_SAMPLE_TEXT}  `;
    const result = prepareNeedSample(source);
    expect(result).toMatchObject({
      source_text: source,
      draft: {
        category: "clothes",
        attributes: { product: "Winter coats", size: "M–XL" },
        target_quantity: "30",
        unit: "item",
        seasons: ["winter"],
      },
    });
    expect(result?.draft.active).toBeUndefined();
    expect(result?.warnings.length).toBeGreaterThan(0);
  });
  it("accepts the same sample words without speech punctuation, preserving the transcript", () => {
    const transcript = "we need 30 winter coats adult sizes m to xl for winter";
    expect(prepareNeedSample(transcript)?.source_text).toBe(transcript);
  });
  it("does not invent a target or source provenance for an arbitrary transcript", () => {
    expect(
      prepareNeedSample(
        "We need 300 winter coats, adult sizes M to XL, for winter.",
      ),
    ).toBeNull();
    expect(
      prepareNeedSample(
        "We need 3.0 winter coats, adult sizes M to XL, for winter.",
      ),
    ).toBeNull();
    expect(
      prepareNeedSample(
        "We need 3,0 winter coats, adult sizes M to XL, for winter.",
      ),
    ).toBeNull();
    expect(prepareNeedSample("We need shoes")).toBeNull();
    expect(prepareNeedSample("")).toBeNull();
  });
});
