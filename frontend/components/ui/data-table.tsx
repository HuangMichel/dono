"use client";

import {
  Fragment,
  useId,
  useMemo,
  useState,
  type ReactNode,
  type MouseEvent,
  type KeyboardEvent,
} from "react";
import { Button, Icon } from "@/components/ui";
import {
  filterAndSortRows,
  toggleRowSelection,
  type SortDirection,
  type SortValue,
} from "./data-table-model";
import { paginateItems } from "./pagination-model";
import { Pagination } from "./pagination";
import "./data-table.css";

export type DataColumn<T> = {
  id: string;
  label: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => SortValue;
  width?: string;
};
export function DataTable<T>({
  rows,
  columns,
  getRowId,
  getRowLabel,
  searchText,
  searchLabel,
  filters,
  emptyMessage = "No results match your search.",
  renderDetails,
  renderMobileRow,
  rowClassName,
  selectedRowId,
  onSelectionChange,
  pageSize = 10,
}: {
  rows: T[];
  columns: DataColumn<T>[];
  getRowId: (row: T) => string;
  getRowLabel: (row: T) => string;
  searchText: (row: T) => string;
  searchLabel: string;
  filters?: ReactNode;
  emptyMessage?: string;
  renderDetails?: (row: T) => ReactNode;
  renderMobileRow?: (row: T) => ReactNode;
  rowClassName?: (row: T) => string;
  selectedRowId?: string | null;
  onSelectionChange?: (id: string | null) => void;
  pageSize?: number;
}) {
  const [requestedPage, setRequestedPage] = useState(1);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{
    id: string;
    direction: SortDirection;
  } | null>(null);
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const selected =
    selectedRowId !== undefined ? selectedRowId : internalSelected;
  const sortValue = columns.find((column) => column.id === sort?.id)?.sortValue;
  const sortDirection = sort?.direction;
  const filtered = useMemo(
    () => filterAndSortRows(rows, query, searchText, sortValue, sortDirection),
    [rows, query, searchText, sortValue, sortDirection],
  );
  const pagination = paginateItems(filtered, requestedPage, pageSize);
  // Retain the last valid page when records disappear, including after refresh.
  if (requestedPage !== pagination.page) setRequestedPage(pagination.page);
  const visible = pagination.items;
  const selectionHintId = useId();
  // Keep the selected ID while filtering or sorting; removed rows do not count.
  const currentSelection = rows.some((row) => getRowId(row) === selected)
    ? selected
    : null;
  function changeSelection(id: string | null) {
    if (selectedRowId === undefined) setInternalSelected(id);
    onSelectionChange?.(id);
  }
  function toggle(id: string) {
    changeSelection(toggleRowSelection(selected, id));
  }
  function selectFromPointer(event: MouseEvent<HTMLElement>, id: string) {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(
        "button, a, input, select, textarea, label, summary, [role='button'], [contenteditable='true']",
      )
    )
      return;
    toggle(id);
  }
  function selectFromKeyboard(event: KeyboardEvent<HTMLElement>, id: string) {
    if (
      event.target !== event.currentTarget ||
      (event.key !== "Enter" && event.key !== " ")
    )
      return;
    event.preventDefault();
    toggle(id);
  }
  function changeSort(id: string) {
    setRequestedPage(1);
    setSort((previous) => ({
      id,
      direction:
        previous?.id === id && previous.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
  }
  return (
    <div
      className={`data-table ${renderMobileRow ? "data-table-responsive-list" : ""} ${renderDetails ? "data-table-with-details" : ""}`}
    >
      <div className={filters ? "data-table-search-controls" : undefined}>
        {filters && <div className="data-table-filters">{filters}</div>}
        <label className="field-label data-table-search">
          <span className={filters ? "sr-only" : undefined}>{searchLabel}</span>
          <span className="data-table-search-field">
            <Icon name="search" size={18} />
            <input
              className="field"
              type="search"
              placeholder={searchLabel}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setRequestedPage(1);
              }}
            />
          </span>
        </label>
      </div>
      <p id={selectionHintId} className="sr-only">
        Select a row by clicking its background or pressing Enter or Space while
        the row has focus. Item details and actions work separately.
      </p>
      <div className="data-table-toolbar">
        <div className="data-table-selection">
          <span className="meta muted" role="status">
            {currentSelection ? 1 : 0} selected
          </span>
          {currentSelection !== null && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => changeSelection(null)}
            >
              Clear selection
            </Button>
          )}
        </div>
      </div>
      {renderMobileRow && (
        <div className="data-table-mobile-controls">
          <label className="field-label">
            Sort by
            <select
              className="field"
              value={sort ? `${sort.id}:${sort.direction}` : ""}
              onChange={(event) => {
                setRequestedPage(1);
                const [id, direction] = event.target.value.split(":");
                setSort(
                  id ? { id, direction: direction as SortDirection } : null,
                );
              }}
            >
              <option value="">Default order</option>
              {columns
                .filter((column) => column.sortValue)
                .flatMap((column) =>
                  (["ascending", "descending"] as const).map((direction) => (
                    <option
                      key={`${column.id}:${direction}`}
                      value={`${column.id}:${direction}`}
                    >
                      {column.label}, {direction}
                    </option>
                  )),
                )}
            </select>
          </label>
        </div>
      )}
      <div
        className="data-table-scroll"
        role="region"
        aria-label={searchLabel.replace(/^Search /, "") + " table"}
        tabIndex={0}
      >
        <table>
          <caption className="sr-only">
            {searchLabel.replace(/^Search /, "")}
          </caption>
          {columns.some((column) => column.width) && (
            <colgroup>
              {columns.map((column) => (
                <col
                  key={column.id}
                  style={column.width ? { width: column.width } : undefined}
                />
              ))}
            </colgroup>
          )}
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={
                    column.sortValue
                      ? sort?.id === column.id
                        ? sort.direction
                        : "none"
                      : undefined
                  }
                >
                  {column.sortValue ? (
                    <button
                      className="data-table-sort"
                      type="button"
                      onClick={() => changeSort(column.id)}
                    >
                      {column.label}
                      <span aria-hidden="true">
                        {sort?.id === column.id
                          ? sort.direction === "ascending"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!visible.length && (
              <tr>
                <td colSpan={columns.length}>
                  <div
                    className="data-table-empty-state"
                    role="status"
                    aria-label={emptyMessage}
                  >
                    <Icon name="blocked" size={28} />
                    <p>{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            )}
            {visible.map((row) => {
              const id = getRowId(row);
              const details = renderDetails?.(row);
              return (
                <Fragment key={id}>
                  <tr
                    className={rowClassName?.(row)}
                    data-selected={currentSelection === id || undefined}
                    aria-selected={currentSelection === id}
                    aria-label={getRowLabel(row)}
                    aria-describedby={selectionHintId}
                    tabIndex={0}
                    onClick={(event) => selectFromPointer(event, id)}
                    onKeyDown={(event) => selectFromKeyboard(event, id)}
                  >
                    {columns.map((column, index) => (
                      <td key={column.id}>
                        {index === 0 ? (
                          <div className="data-table-primary-cell">
                            <span
                              className="data-table-selected-mark"
                              aria-hidden="true"
                            >
                              {currentSelection === id && (
                                <Icon name="check" size={16} />
                              )}
                            </span>
                            <div className="data-table-primary-content">
                              {column.cell(row)}
                            </div>
                          </div>
                        ) : (
                          column.cell(row)
                        )}
                      </td>
                    ))}
                  </tr>
                  {details && (
                    <tr className="data-table-detail-row">
                      <td colSpan={columns.length}>
                        <div className="data-table-detail">{details}</div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {renderMobileRow && (
        <ul
          className="data-table-mobile-list"
          role="table"
          aria-label={searchLabel.replace(/^Search /, "")}
        >
          {visible.map((row) => (
            <li
              key={getRowId(row)}
              role="row"
              data-selected={currentSelection === getRowId(row) || undefined}
              aria-selected={currentSelection === getRowId(row)}
              aria-label={getRowLabel(row)}
              aria-describedby={selectionHintId}
              tabIndex={0}
              onClick={(event) => selectFromPointer(event, getRowId(row))}
              onKeyDown={(event) => selectFromKeyboard(event, getRowId(row))}
            >
              <div role="cell">
                <div className="data-table-primary-cell">
                  <span className="data-table-selected-mark" aria-hidden="true">
                    {currentSelection === getRowId(row) && (
                      <Icon name="check" size={16} />
                    )}
                  </span>
                  <div className="data-table-primary-content">
                    {renderMobileRow(row)}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={pagination.page}
        totalItems={pagination.totalItems}
        pageSize={pageSize}
        onPageChange={setRequestedPage}
        label={`${searchLabel.replace(/^Search /, "")} pagination`}
      />
      {!visible.length && renderMobileRow && (
        <div className="console-empty data-table-empty">
          <div className="data-table-empty-state" role="status">
            <Icon name="blocked" size={28} />
            <p>{emptyMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
