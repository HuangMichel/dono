import type { Category } from "./api-contracts";
export const categoryFields: Record<
  Category,
  Record<string, readonly string[] | null>
> = {
  clothes: {
    type: ["tshirt", "shirt", "trousers", "dress", "coat", "knitwear", "other"],
    size: null,
    audience: ["adult", "child", "baby"],
  },
  shoes: {
    type: ["sneakers", "boots", "sandals", "formal", "other"],
    size: null,
    pair_complete: ["true", "false"],
  },
  food: {
    product: null,
    brand: null,
    storage_condition: ["room_temperature", "chilled", "frozen"],
    non_perishable: ["true", "false"],
    packaging_state: ["sealed", "opened"],
  },
  para: {
    product: null,
    brand: null,
    product_kind: ["hygiene", "cosmetic", "medical_device", "other"],
    opening_state: ["unopened", "opened"],
    seal_state: ["intact", "broken", "not_present"],
  },
  furniture: {
    type: ["chair", "table", "cabinet", "shelving", "other"],
    size_class: ["small", "medium", "large"],
    printed_dimensions: null,
  },
};

/** Only the schema's boolean attributes coerce text to booleans. */
export function parseAttributeInput(
  key: string,
  value: string,
): string | boolean | null {
  if (!value) return null;
  if (key === "pair_complete" || key === "non_perishable")
    return value === "true";
  return value;
}
export function fieldsForCategory(category: string) {
  return categoryFields[category as Category] ?? {};
}
