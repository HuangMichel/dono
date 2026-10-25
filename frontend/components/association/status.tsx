import type { ExpiryBucket, ExpiryView } from "@/lib/api-contracts";
import { STATUS_LABELS } from "@/lib/labels";
import { Chip } from "@/components/ui";
const EXPIRY_LABELS: Record<ExpiryBucket, string> = {
  expired: "Expired",
  today: "Expires today",
  lt_7: "Under 7 days",
  lt_30: "Under 30 days",
  lt_90: "Under 90 days",
  at_90: "90 days",
  gt_90: "Over 90 days",
  unknown: "Date unknown",
  not_applicable: "Expiry not applicable",
};
export function expiryLabel(bucket: ExpiryBucket) {
  return EXPIRY_LABELS[bucket];
}
export function ExpiryChip({
  expiry,
}: {
  expiry: Pick<ExpiryView, "bucket" | "days_left">;
}) {
  const variant =
    expiry.bucket === "expired"
      ? "danger"
      : ["today", "lt_7", "lt_30"].includes(expiry.bucket)
        ? "warning"
        : ["lt_90", "at_90", "unknown"].includes(expiry.bucket)
          ? "caution"
          : expiry.bucket === "gt_90"
            ? "success"
            : "neutral";
  const label =
    expiry.days_left !== null && expiry.days_left > 0
      ? `${expiry.days_left} ${expiry.days_left === 1 ? "day" : "days"} left`
      : expiryLabel(expiry.bucket);
  return <Chip variant={variant}>{label}</Chip>;
}
export function StateChip({ state }: { state: string }) {
  const variant = [
    "approved",
    "booked",
    "received",
    "fulfilled",
    "in_stock",
    "distributed",
  ].includes(state)
    ? "success"
    : ["refused", "expired"].includes(state)
      ? "danger"
      : ["pending_review", "pending"].includes(state)
        ? "caution"
        : "neutral";
  return (
    <Chip variant={variant}>
      {STATUS_LABELS[state] ?? state.replaceAll("_", " ")}
    </Chip>
  );
}
