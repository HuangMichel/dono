export const indicatorLabels: Record<string, string> = {
  looks_like_medicine: "Medicine concern",
  cold_food: "Chilled food concern",
  stains: "Stains",
  sealed: "Sealed packaging",
  packaged_unopened: "Unopened packaging",
  packaging_open: "Open packaging",
  damaged_packaging: "Damaged packaging",
  date_readable: "Date readable",
  sole_wear: "Sole wear",
  worn_soles: "Worn soles",
  pairs_complete: "Complete pairs",
  damage: "Damage",
};

function readableKey(key: string): string {
  const words = key.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function indicatorLabel(key: string): string {
  return indicatorLabels[key] ?? readableKey(key);
}

const factLabels: Record<string, string> = {
  expiry_date: "Printed date",
  date_type: "Date type",
  pao_months: "Months after opening",
  date_precision: "Date precision",
  raw_label: "Printed label",
  readability: "Date readability",
  product: "Product",
  type: "Item type",
  size: "Size",
};

export function factLabel(key: string): string {
  return factLabels[key] ?? readableKey(key);
}

export function enumLabel(value: string): string {
  return readableKey(value);
}

export function formatCount(
  value: number | string | null | undefined,
  singular = "item",
  plural = `${singular}s`,
): string {
  if (value === null || value === undefined || value === "")
    return "Quantity not provided";
  const quantity = Number(value);
  const text = Number.isFinite(quantity)
    ? new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 }).format(
        quantity,
      )
    : String(value);
  return `${text} ${quantity === 1 ? singular : plural}`;
}
