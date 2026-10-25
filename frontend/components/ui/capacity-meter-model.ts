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
  const used = stock + reserved;
  const percentage = limit > 0 ? (used / limit) * 100 : null;
  if (
    ![stock, reserved, limit, used].every(
      (value) => Number.isFinite(value) && value >= 0,
    ) ||
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
  if (limit === 0)
    return { used, limit, percentage: null, tone: "neutral", paused: true };
  return {
    used,
    limit,
    percentage,
    tone:
      percentage !== null && percentage > 85
        ? "danger"
        : percentage !== null && percentage > 60
          ? "warning"
          : "success",
    paused: false,
  };
}
