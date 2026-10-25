export const indicatorLabels: Record<string, string> = {
  looks_like_medicine: "Looks like medicine",
  cold_food: "Chilled or frozen food",
  chilled_or_frozen: "Chilled or frozen food",
  label_unreadable: "Unreadable label",
  wear_visible: "Visible wear",
  stains_visible: "Visible stains",
  holes_visible: "Visible holes",
  pilling_visible: "Fabric pilling",
  pair_incomplete: "Incomplete pair",
  sole_damage: "Damaged soles",
  upper_damage: "Damage to the top of the shoe",
  heavy_wear: "Heavy wear",
  packaging_damaged: "Damaged packaging",
  seal_broken: "Broken seal",
  spoilage_visible: "Visible signs of spoilage",
  structural_damage: "Structural damage",
  surface_damage: "Surface damage",
  visible_mould: "Visible mould",
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

const concernIndicatorKeys = [
  "looks_like_medicine",
  "cold_food",
  "stains",
  "packaging_open",
  "damaged_packaging",
  "sole_wear",
  "worn_soles",
  "damage",
];

/** Who speaks: concern indicators are orange, medicine warnings red, the rest neutral. */
export function indicatorTone(
  key: string,
  level?: "low" | "medium" | "high",
): "neutral" | "warning" | "danger" {
  if (!concernIndicatorKeys.includes(key) || level === "low") return "neutral";
  return key === "looks_like_medicine" ? "danger" : "warning";
}

const factLabels: Record<string, string> = {
  expiry_date: "Printed date",
  date_type: "Date type",
  pao_months: "Months after opening",
  date_precision: "Detail shown on the label",
  raw_label: "Date as printed",
  readability: "Date readability",
  product: "Product",
  type: "Item type",
  size: "Size",
  audience: "Age group",
  pair_complete: "Complete pair",
  storage_condition: "Storage instructions",
  non_perishable: "Non-perishable",
  packaging_state: "Packaging condition",
  product_kind: "Product type",
  opening_state: "Opened or unopened",
  seal_state: "Seal condition",
  size_class: "Furniture size",
  printed_dimensions: "Dimensions on the label",
  opened_on: "Date opened",
  seasons: "Seasons",
};

export function factLabel(key: string): string {
  return factLabels[key] ?? readableKey(key);
}

const enumLabels: Record<string, string> = {
  tshirt: "T-shirt",
  sneakers: "Trainers",
  formal: "Formal shoes",
  adult: "Adults",
  child: "Children",
  baby: "Babies",
  true: "Yes",
  false: "No",
  room_temperature: "Room temperature",
  medical_device: "Medical device",
  not_present: "No seal",
  DLC: "Use by",
  DDM: "Best before",
  expiry: "Expiry date",
  PAO: "Period after opening",
  day: "Full date",
  month: "Month and year",
  year: "Year only",
  unknown: "Not known",
  not_applicable: "Not applicable",
  unreadable: "Cannot read the date",
  lt_7: "Fewer than 7 days left",
  lt_30: "7 to 29 days left",
  lt_90: "30 to 89 days left",
  at_90: "90 days left",
  gt_90: "More than 90 days left",
  date_passed: "Use-by or expiry date has passed",
  opened_food: "Food packaging is open",
  date_clarification_required: "Date needs checking",
  intake_date_restriction: "The item's date prevents this action",
  category_date_conflict: "The date does not match the item category",
  conflicting_dates: "Labels show conflicting dates",
  unreadable_date: "The printed date cannot be read",
  ambiguous_date: "The printed date is unclear",
  date_type_unknown: "Date type not known",
  missing_date: "No printed date recorded",
  incomplete_strict_date: "A complete date is required",
  opening_state_unknown: "Opening status not known",
  opening_date_missing: "Opening date not recorded",
  invalid_opening_date: "Opening date is in the future",
  pao_duration_missing: "Period after opening not recorded",
  date_review_ack: "Date check required",
  ddm_passed_ack: "Best-before date has passed",
  invalid_transition: "This action is not available at the current status",
  outside_reception_window: "Outside the appointment's drop-off window",
};

export function enumLabel(value: string): string {
  return Object.hasOwn(enumLabels, value)
    ? enumLabels[value]
    : readableKey(value);
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

/** Short relative age for queue rows, computed in code, never by a model. */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${formatCount(hours, "hour")} ago`;
  const days = Math.floor(hours / 24);
  return `${formatCount(days, "day")} ago`;
}
