import { enumLabel } from "@/lib/ui-text";
import type { ExpiryView } from "@/lib/api-contracts";
import { Field } from "@/components/ui";
import { ExpiryChip } from "./status";
import { CHECK_LABELS } from "./review-policy";
export function DateChecks({ expiry }: { expiry: ExpiryView }) {
  return (
    <>
      {(expiry.bucket !== "not_applicable" ||
        expiry.distribution_restriction) && (
        <p className="row wrap">
          <span>Date status:</span>
          <ExpiryChip expiry={expiry} />
          {expiry.distribution_restriction && (
            <span>{enumLabel(expiry.distribution_restriction)}</span>
          )}
        </p>
      )}
      {expiry.required_date_checks.map((key) => (
        <label key={key} className="check">
          <input type="checkbox" name={key} required /> {CHECK_LABELS[key]}
        </label>
      ))}
      <label className="check">
        <input type="checkbox" name="date_label_correction_confirmed" />{" "}
        {CHECK_LABELS.date_label_correction_confirmed}
      </label>
      <Field
        label="Reason (required for date checks or label correction)"
        name="reason"
        maxLength={240}
      />
    </>
  );
}
export function dateCommand(data: FormData) {
  const keys = [
    "date_review_ack",
    "ddm_passed_ack",
    "date_label_correction_confirmed",
  ];
  return {
    date_checks: Object.fromEntries(
      keys.filter((key) => data.get(key) === "on").map((key) => [key, true]),
    ),
    ...(data.get("reason")
      ? { reason: String(data.get("reason")).trim() }
      : {}),
  };
}
