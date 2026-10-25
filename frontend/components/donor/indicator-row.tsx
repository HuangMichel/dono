import type { Indicator } from "@/lib/api-contracts";
import { indicatorLabel, indicatorTone } from "@/lib/ui-text";
import "./donation-flow.css";

export function IndicatorRow({
  indicator,
}: {
  indicator: Pick<Indicator, "key" | "value" | "probability" | "level">;
}) {
  const label = indicatorLabel(indicator.key);
  const percent =
    indicator.probability == null
      ? null
      : Math.round(indicator.probability * 100);
  const likely = indicator.level === "medium" || indicator.level === "high";
  return (
    <div className="donation-indicator">
      <div className="row between">
        <span>{label}</span>
        <strong>
          {percent === null
            ? (indicator.value ?? "Not assessed")
            : `${likely ? "Likely" : "Unlikely"}, ${percent}%`}
        </strong>
      </div>
      {percent !== null && (
        <span
          className={`donation-indicator-track ${indicatorTone(indicator.key, indicator.level)}`}
          role="progressbar"
          aria-label={`${label} probability`}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${percent}%` }} />
        </span>
      )}
    </div>
  );
}
