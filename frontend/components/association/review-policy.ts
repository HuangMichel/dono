export const CHECK_LABELS: Record<string, string> = {
  not_medicine: "I checked that this item is not a medicine.",
  eligible_individual_food:
    "Food is unopened, non-perishable and stored at room temperature.",
  analysis_unavailable_ack:
    "I reviewed the item manually because the AI analysis is incomplete or uncertain.",
  date_review_ack: "I checked the date and its uncertainty against the label.",
  ddm_passed_ack:
    "I checked the item despite its passed best-before date (DDM).",
  date_label_correction_confirmed:
    "I verified that the AI read the use-by or expiry label incorrectly.",
};
export function requiredReviewChecks(offer: {
  category: string;
  computed: {
    manual_review_required: boolean;
    expiry: { required_date_checks: string[] };
  };
}) {
  return [
    "not_medicine",
    ...(offer.category === "food" ? ["eligible_individual_food"] : []),
    ...(offer.computed.manual_review_required
      ? ["analysis_unavailable_ack"]
      : []),
    ...offer.computed.expiry.required_date_checks,
  ];
}
export function reviewChecks(
  checks: Record<string, boolean>,
): Record<string, true> {
  return Object.fromEntries(
    Object.entries(checks)
      .filter(([, checked]) => checked)
      .map(([key]) => [key, true]),
  );
}
