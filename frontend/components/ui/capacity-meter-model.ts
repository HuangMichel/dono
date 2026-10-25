import { addQuantity, preciseQuantity } from "../../lib/quantity";

export const CAPACITY_THRESHOLDS = { warning: 60, danger: 85 } as const;

type CapacityUsage = {
  used: number;
  limit: number;
  percentage: number | null;
  tone: "success" | "warning" | "danger" | "neutral";
  paused: boolean;
};

export function capacityUsage(
  stock: number,
  reserved: number,
  limit: number,
): CapacityUsage {
  const used = addQuantity(stock, reserved);
  const normalizedLimit = preciseQuantity(limit);
  // The quantity contract has three decimal places. Compare integer
  // thousandths so exact thresholds do not inherit binary division residue.
  const usedThousandths = Math.round(used * 1000);
  const limitThousandths = Math.round(normalizedLimit * 1000);
  const percentage =
    normalizedLimit > 0 ? (usedThousandths * 100) / limitThousandths : null;
  if (
    ![
      stock,
      reserved,
      limit,
      used,
      normalizedLimit,
      usedThousandths,
      limitThousandths,
    ].every((value) => Number.isFinite(value) && value >= 0) ||
    (percentage !== null && !Number.isFinite(percentage))
  ) {
    return {
      used: 0,
      limit: 0,
      percentage: null,
      tone: "neutral",
      paused: false,
    };
  }
  if (normalizedLimit === 0)
    return {
      used,
      limit: normalizedLimit,
      percentage: null,
      tone: "neutral",
      paused: true,
    };
  return {
    used,
    limit: normalizedLimit,
    percentage,
    tone:
      usedThousandths * 100 > limitThousandths * CAPACITY_THRESHOLDS.danger
        ? "danger"
        : usedThousandths * 100 > limitThousandths * CAPACITY_THRESHOLDS.warning
          ? "warning"
          : "success",
    paused: false,
  };
}
