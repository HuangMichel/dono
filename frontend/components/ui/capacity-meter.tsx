import { useId } from "react";
import { capacityUsage, CAPACITY_THRESHOLDS } from "./capacity-meter-model";
import "./capacity-meter.css";

export function CapacityMeter({
  label,
  inStock,
  reserved,
  limit,
  description,
}: {
  label: string;
  inStock: string;
  reserved: string;
  limit: string;
  description?: string;
}) {
  const descriptionId = useId();
  const thresholdsId = useId();
  const usage = capacityUsage(Number(inStock), Number(reserved), Number(limit));
  const text = usage.paused
    ? "Paused"
    : usage.percentage === null
      ? "Unavailable"
      : `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(usage.percentage)}%`;
  const ranges = usage.paused
    ? "Paused. No intake capacity."
    : `Green through ${CAPACITY_THRESHOLDS.warning}%; orange above ${CAPACITY_THRESHOLDS.warning}% through ${CAPACITY_THRESHOLDS.danger}%; red above ${CAPACITY_THRESHOLDS.danger}%.`;
  return (
    <div className={`capacity-meter capacity-meter-${usage.tone}`}>
      <div className="capacity-meter-heading">
        <span>{label}</span>
        <strong>{text}</strong>
      </div>
      {description && (
        <p id={descriptionId} className="capacity-meter-description">
          {description}
        </p>
      )}
      <div className="capacity-meter-bar">
        <progress
          value={Math.min(usage.used, usage.limit)}
          max={usage.limit || 1}
          aria-label={`${label} capacity used`}
          aria-valuetext={usage.paused ? "Paused, no intake capacity" : text}
          aria-describedby={[description ? descriptionId : null, thresholdsId]
            .filter(Boolean)
            .join(" ")}
        />
        <div className="capacity-meter-thresholds" aria-hidden="true">
          {Object.values(CAPACITY_THRESHOLDS).map((threshold) => (
            <span
              className="capacity-meter-tick"
              key={threshold}
              style={{ left: `${threshold}%` }}
            >
              <span>{threshold}%</span>
            </span>
          ))}
        </div>
      </div>
      <p id={thresholdsId} className="capacity-meter-ranges">
        {ranges}
      </p>
    </div>
  );
}
