import type { DonationCreate } from "../../lib/contracts";
export const SAMPLE_DESCRIPTION = "6 packs of pasta and a winter coat, size M";
// This fixed fixture is a demo choice, not free-text extraction.
export function sampleDescriptionDrafts(
  description: string,
): DonationCreate[] | null {
  if (description.trim() !== SAMPLE_DESCRIPTION) return null;
  return [
    {
      category: "food",
      quantity: "6",
      unit: "item",
      attributes: { product: "Pasta, 500 g" },
    },
    {
      category: "clothes",
      quantity: "1",
      unit: "item",
      attributes: { product: "Winter coat", size: "M" },
    },
  ];
}
