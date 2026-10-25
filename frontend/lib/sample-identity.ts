import type { Category } from "./contracts";

export function sampleIdentity(scenario: Category | "medicine" | "cold"): {
  category: Category;
  product: string;
} {
  const category =
    scenario === "medicine" ? "para" : scenario === "cold" ? "food" : scenario;
  const product =
    category === "food"
      ? "Sealed pasta, 500 g"
      : category === "clothes"
        ? "Winter coat"
        : "Demo item";
  return { category, product };
}
