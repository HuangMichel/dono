import type { NeedDraft } from "../../lib/contracts";
export const NEED_SAMPLE_TEXT =
  "We need 30 winter coats, adult sizes M to XL, for winter.";
// Matching the fixed fixture is not free-text or AI extraction.
export function prepareNeedSample(source: string): NeedDraft | null {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[,.](?=\s|$)/g, "")
      .trim()
      .replace(/\s+/g, " ");
  if (normalize(source) !== normalize(NEED_SAMPLE_TEXT)) return null;
  return {
    source_text: source,
    draft: {
      category: "clothes",
      attributes: { product: "Winter coats", size: "M–XL" },
      target_quantity: "30",
      unit: "item",
      seasons: ["winter"],
    },
    warnings: [{ path: "draft", code: "sample_fixture" }],
  };
}
