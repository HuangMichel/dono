import type { Category } from "./api-contracts";
export const CATEGORY_LABELS: Record<Category, string> = {
  clothes: "Clothes",
  shoes: "Shoes",
  food: "Food",
  para: "Hygiene & care",
  furniture: "Small furniture",
};
export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready: "Ready to offer",
  withdrawn: "Withdrawn",
  transferred: "Received by association",
  pending_review: "Waiting for review",
  approved: "Approved by staff",
  refused: "Refused by staff",
  cancelled: "Cancelled",
  expired: "Offer expired",
  fulfilled: "Received",
  booked: "Drop-off booked",
  no_show: "Not received",
  received: "Received",
  in_stock: "In stock",
  distributed: "Given out",
};
// Donors follow their item's journey; staff use the separate inventory terms.
const DONOR_STATUS_OVERRIDES: Record<string, string> = {
  in_stock: "Received",
};
export function donorStatusLabel(status: string): string {
  return (
    DONOR_STATUS_OVERRIDES[status] ??
    STATUS_LABELS[status] ??
    status.charAt(0).toUpperCase() + status.slice(1).replaceAll("_", " ")
  );
}
