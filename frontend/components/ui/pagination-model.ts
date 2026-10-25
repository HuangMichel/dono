/** Normalize list pagination without mutating the source collection. */
export function paginationRange(
  totalItems: number,
  requestedPage: number,
  pageSize: number,
) {
  const size = Number.isFinite(pageSize)
    ? Math.max(1, Math.floor(pageSize))
    : 10;
  const total = Number.isFinite(totalItems)
    ? Math.max(0, Math.floor(totalItems))
    : 0;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const page = Math.min(
    pageCount,
    Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1),
  );
  return {
    page,
    pageCount,
    totalItems: total,
    start: total ? (page - 1) * size + 1 : 0,
    end: Math.min(page * size, total),
  };
}

export function paginateItems<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize: number,
) {
  const range = paginationRange(items.length, requestedPage, pageSize);
  return {
    items: items.slice(Math.max(0, range.start - 1), range.end),
    ...range,
  };
}
