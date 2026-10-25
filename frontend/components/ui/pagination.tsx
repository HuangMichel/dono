"use client";

import { Button, Icon } from "@/components/ui";
import { formatCount } from "@/lib/ui-text";
import { paginationRange } from "./pagination-model";
import "./pagination.css";

export function Pagination({
  page,
  totalItems,
  pageSize,
  onPageChange,
  label = "Results pagination",
}: {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  const range = paginationRange(totalItems, page, pageSize);
  return (
    <nav className="pagination" aria-label={label}>
      <p
        className="meta muted pagination-range"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {range.start}–{range.end} of {formatCount(range.totalItems, "result")}
      </p>
      <div className="pagination-controls">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Previous page"
          disabled={range.page === 1}
          onClick={() => onPageChange(range.page - 1)}
        >
          <Icon name="arrow-left" size={16} /> Previous
        </Button>
        <span className="meta pagination-page" aria-current="page">
          Page {range.page} of {range.pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Next page"
          disabled={range.page === range.pageCount}
          onClick={() => onPageChange(range.page + 1)}
        >
          Next <Icon name="arrow-right" size={16} />
        </Button>
      </div>
    </nav>
  );
}
