import { capacityUsage } from "./capacity-meter-model";
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
  const usage = capacityUsage(Number(inStock), Number(reserved), Number(limit));
  const text = usage.paused
    ? "Paused"
    : usage.percentage === null
      ? "Unavailable"
      : `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(usage.percentage)}%`;
  return (
    <div className={`capacity-meter capacity-meter-${usage.tone}`}>
      <div className="capacity-meter-heading">
        <span>{label}</span>
        <strong>{text}</strong>
      </div>
      {description && (
        <p className="capacity-meter-description">{description}</p>
      )}
      <progress
        value={Math.min(usage.used, usage.limit)}
        max={usage.limit || 1}
        aria-label={`${label} capacity used`}
        aria-valuetext={text}
      />
    </div>
  );
}
