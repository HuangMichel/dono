// Quantity DTOs have at most three decimal places. Normalize arithmetic at
// each boundary so binary floating-point residue cannot create uncovered needs.
export function preciseQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}
export function addQuantity(left: number, right: number): number {
  return preciseQuantity(left + right);
}
export function parseQuantity(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? preciseQuantity(parsed) : 0;
}
