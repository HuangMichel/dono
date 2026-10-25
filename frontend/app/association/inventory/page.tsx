"use client";
import { useState } from "react";
import { useApiPage, useApiResource } from "@/lib/api-hooks";
import type { StockLot, ExpiryBucket, Offer } from "@/lib/api-contracts";
import { DataTable } from "@/components/ui/data-table";
import { SelectField } from "@/components/ui";
import {
  ConsoleTitle,
  CategorySelect,
  useAssociation,
  ResourceStatus,
  More,
} from "@/components/association/shell";
import { CommandForm, useCommand } from "@/components/association/command";
import { Evidence, itemName } from "@/components/association/evidence";
import { DateChecks, dateCommand } from "@/components/association/date-checks";
import {
  ExpiryChip,
  StateChip,
  expiryLabel,
} from "@/components/association/status";
import { formatCount } from "@/lib/ui-text";
import { CATEGORY_LABELS } from "@/lib/labels";
import "@/components/association/reception-stock.css";
export default function Inventory() {
  const { id } = useAssociation();
  const [category, setCategory] = useState("");
  const [view, setView] = useState("distribute_first");
  const filter = category ? `&category=${category}` : "";
  const resource = useApiPage<StockLot>(
    view === "distributed"
      ? `/associations/${id}/inventory?inventory_state=distributed${filter}`
      : `/associations/${id}/expiry?view=${view}${filter}`,
  );
  const counts = useApiResource<{
    buckets: { key: ExpiryBucket; count: number }[];
    reference_date: string;
    timezone: string;
  }>(
    `/associations/${id}/expiry-counts${category ? `?category=${category}` : ""}`,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const command = useCommand();
  function details(lot: StockLot) {
    if (lot.receipt.id !== selected) return null;
    return (
      <section
        key={lot.receipt.id}
        className="stock-lot-detail console-stack"
        aria-label={`Distribution for ${itemName(lot.offer)}`}
      >
        <div className="console-status-line">
          <h2>{itemName(lot.offer)}</h2>
          <StateChip state={lot.inventory_state} />
        </div>
        <p>
          {formatCount(lot.remaining_quantity)} remaining,{" "}
          {formatCount(lot.receipt.quantity)} received
        </p>
        <StockEvidence offer={lot.offer} />
        {lot.inventory_state === "in_stock" && (
          <CommandForm
            submit={`Record all items given out (${formatCount(lot.remaining_quantity)})`}
            successMessage="Full quantity recorded as given out."
            onSubmit={async (data) => {
              await command(`/inventory/${lot.receipt.id}/distributions`, {
                confirm_full_distribution: true,
                ...dateCommand(data),
              });
              setSelected(null);
              await Promise.all([resource.refresh(), counts.refresh()]);
            }}
          >
            <DateChecks expiry={lot.expiry} />
            <label className="check">
              <input type="checkbox" required /> I confirm that the full
              received quantity is being given out.
            </label>
          </CommandForm>
        )}
      </section>
    );
  }
  return (
    <>
      <ConsoleTitle title="Stock" />
      <section className="stock-expiry-summary" aria-label="Expiry counts">
        <div className="console-status-line">
          <h2>Expiry overview</h2>
          {counts.data && (
            <span className="console-meta">
              As of {counts.data.reference_date}, {counts.data.timezone}
            </span>
          )}
        </div>
        <ResourceStatus {...counts} />
        {counts.data && (
          <ul className="stock-expiry-counts">
            {counts.data.buckets.map((bucket) => (
              <li key={bucket.key}>
                <ExpiryChip expiry={{ bucket: bucket.key, days_left: null }} />
                <strong>{formatCount(bucket.count, "donation")}</strong>
                <span className="sr-only">{expiryLabel(bucket.key)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="stock-controls">
        <CategorySelect
          value={category}
          onChange={(value) => {
            setSelected(null);
            setCategory(value);
          }}
          all
        />
        <SelectField
          label="View"
          value={view}
          onChange={(e) => {
            setSelected(null);
            setView(e.target.value);
          }}
        >
          <option value="distribute_first">Distribute first</option>
          <option value="buckets">Date groups</option>
          <option value="distributed">Given-out history</option>
        </SelectField>
        {view === "distribute_first" && (
          <p className="console-meta">
            Earliest dates first, then unknown dates and items with no expiry
            date. Items with date restrictions appear last.
          </p>
        )}
      </div>
      <ResourceStatus {...resource} />
      {!resource.loading && !resource.error && !resource.data.length && (
        <p className="stock-empty">
          {view === "distributed"
            ? "No donations have been given out in this view."
            : "No stock found."}
        </p>
      )}
      {resource.data.length > 0 && (
        <div className="stock-table">
          <DataTable
            rows={resource.data}
            pageSize={25}
            getRowId={(lot) => lot.receipt.id}
            getRowLabel={(lot) => itemName(lot.offer)}
            searchText={(lot) =>
              `${itemName(lot.offer)} ${CATEGORY_LABELS[lot.offer.category]}`
            }
            searchLabel="Search loaded stock"
            selectedRowId={selected}
            onSelectionChange={setSelected}
            columns={[
              {
                id: "item",
                label: "Item",
                cell: (lot) => (
                  <>
                    <strong>{itemName(lot.offer)}</strong>
                    <p className="console-meta">
                      {CATEGORY_LABELS[lot.offer.category]}
                    </p>
                  </>
                ),
              },
              {
                id: "remaining",
                label: "Remaining items",
                cell: (lot) => lot.remaining_quantity,
              },
              {
                id: "received",
                label: "Received items",
                cell: (lot) => lot.receipt.quantity,
              },
              {
                id: "expiry",
                label: "Expiry",
                cell: (lot) => <ExpiryChip expiry={lot.expiry} />,
              },
              {
                id: "state",
                label: "Status",
                cell: (lot) => <StateChip state={lot.inventory_state} />,
              },
            ]}
            renderDetails={details}
            renderMobileRow={(lot) => (
              <div className="stock-mobile-row">
                <strong>{itemName(lot.offer)}</strong>
                <p className="console-meta">
                  {formatCount(lot.remaining_quantity)} remaining
                </p>
                <div className="stock-mobile-chips">
                  <ExpiryChip expiry={lot.expiry} />
                  <StateChip state={lot.inventory_state} />
                </div>
                {details(lot)}
              </div>
            )}
            emptyMessage="No stock matches your search."
          />
        </div>
      )}
      <More {...resource} />
    </>
  );
}

function StockEvidence({ offer }: { offer: Offer }) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Item details, photos and AI indicators</summary>
      {open && <Evidence offer={offer} />}
    </details>
  );
}
