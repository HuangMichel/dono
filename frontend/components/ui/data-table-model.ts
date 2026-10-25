export type SortDirection = "ascending" | "descending";
export type SortValue = string | number | null;

export function filterAndSortRows<T>(
  rows: T[],
  query: string,
  searchText: (row: T) => string,
  sortValue?: (row: T) => SortValue,
  direction: SortDirection = "ascending",
): T[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filtered = rows.filter((row) =>
    words.every((word) => searchText(row).toLocaleLowerCase().includes(word)),
  );
  if (!sortValue) return filtered;
  return filtered.sort((a, b) => {
    const left = sortValue(a),
      right = sortValue(b);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    const compared =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), "en", {
            numeric: true,
            sensitivity: "base",
          });
    return direction === "ascending" ? compared : -compared;
  });
}
export function toggleRowSelection(
  selected: string | null,
  id: string,
): string | null {
  return selected === id ? null : id;
}
