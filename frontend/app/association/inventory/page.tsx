"use client";
import { formatCount } from "@/lib/ui-text";
import { DataTable } from "@/components/ui/data-table";

import { Button, Field } from "@/components/ui";

import { useState, type FormEvent } from "react";
import type { InventoryItem } from "@/lib/contracts";
import { useDemo } from "@/lib/demo-context";
import {
  CATEGORY_LABELS,
  DEMO_ASSOCIATION_ID,
  getInventory,
} from "@/lib/demo-store";
import { ConsoleTitle, Feedback } from "@/components/association/shell";
import { dateLabel, itemName } from "@/components/association/evidence";
import { validQuantity } from "@/components/association/interaction";

export default function InventoryPage() {
  const { state } = useDemo();
  const [category, setCategory] = useState("all");
  const [policyMessage, setPolicyMessage] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [success, setSuccess] = useState("");
  const inventory = getInventory(state).filter(
    (i) =>
      i.donation.association_id === DEMO_ASSOCIATION_ID &&
      Number(i.remaining_quantity) > 0 &&
      (category === "all" || i.donation.category === category) &&
      (dateFilter !== "unknown" ||
        !state.expiry_facts.find((f) => f.donation_id === i.donation.id)
          ?.expiry_date),
  );
  const total = inventory.reduce(
    (sum, i) => sum + Number(i.remaining_quantity),
    0,
  );
  return (
    <>
      <ConsoleTitle title="Stock" detail={`${formatCount(total)} remaining`} />
      <div className="console-summary-tiles" aria-label="Stock categories">
        {[
          ["all", "All categories"],
          ["clothes", "Clothes"],
          ["shoes", "Shoes"],
          ["food", "Dry food"],
          ["para", "Hygiene & care"],
          ["furniture", "Small furniture"],
        ].map(([key, label]) => {
          const count = getInventory(state)
            .filter(
              (i) =>
                i.donation.association_id === DEMO_ASSOCIATION_ID &&
                (key === "all" || i.donation.category === key),
            )
            .reduce((sum, i) => sum + Number(i.remaining_quantity), 0);
          return (
            <Button
              key={key}
              variant="outline"
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
            >
              <strong>
                {label}
                <span>{count}</span>
              </strong>
              <span className="console-meta">
                {count === 1 ? "item in stock" : "items in stock"}
              </span>
            </Button>
          );
        })}
      </div>
      <div className="console-stock-filter-row">
        <div className="console-filter-strip" aria-label="Stock dates">
          <Button
            variant="soft"
            size="sm"
            aria-pressed={dateFilter === "all"}
            onClick={() => setDateFilter("all")}
          >
            All
          </Button>
          {["Expired", "This week", "This month", "Later"].map((label) => (
            <Button
              key={label}
              variant="soft"
              size="sm"
              onClick={() =>
                setPolicyMessage("Expiry filters need an agreed date policy.")
              }
            >
              {label}
            </Button>
          ))}
          <Button
            variant="soft"
            size="sm"
            aria-pressed={dateFilter === "unknown"}
            onClick={() => setDateFilter("unknown")}
          >
            No date
          </Button>
        </div>
        <span className="console-meta">Date policy pending</span>
      </div>
      <Feedback message={policyMessage} error />
      <Feedback message={success} />
      <div className="console-table-wrap">
        <DataTable
          rows={inventory}
          getRowId={(item) => item.donation.id}
          getRowLabel={(item) => itemName(item.donation)}
          searchLabel="Search stock"
          searchText={(item) =>
            `${itemName(item.donation)} ${item.donation.category ? CATEGORY_LABELS[item.donation.category] : ""}`
          }
          emptyMessage="No received stock matches this view."
          columns={[
            {
              id: "item",
              label: "Item",
              sortValue: (item) => itemName(item.donation),
              cell: (item) => (
                <>
                  <strong>{itemName(item.donation)}</strong>
                  <p className="console-meta">
                    {item.donation.category
                      ? CATEGORY_LABELS[item.donation.category]
                      : "Unknown category"}
                  </p>
                </>
              ),
            },
            {
              id: "date",
              label: "Printed date",
              sortValue: (item) => {
                const facts = state.expiry_facts.find(
                  (f) => f.donation_id === item.donation.id,
                );
                return facts?.expiry_date
                  ? Date.parse(facts.expiry_date)
                  : null;
              },
              cell: (item) => {
                const facts = state.expiry_facts.find(
                  (f) => f.donation_id === item.donation.id,
                );
                return (
                  <>
                    {dateLabel(facts?.expiry_date)}
                    <p className="console-meta">
                      {facts?.date_type ?? "Date not available"}
                      {facts?.readability === "unreadable"
                        ? ", unreadable"
                        : ""}
                    </p>
                  </>
                );
              },
            },
            {
              id: "days",
              label: "Days left",
              sortValue: (item) => item.expiry.days_left,
              cell: (item) =>
                item.expiry.days_left === null
                  ? "Unknown"
                  : formatCount(item.expiry.days_left, "day"),
            },
            {
              id: "stock",
              label: "Stock",
              sortValue: (item) => Number(item.remaining_quantity),
              cell: (item) => (
                <>
                  {item.remaining_quantity} remaining
                  <p className="console-meta">
                    {item.received_quantity} received,{" "}
                    {item.distributed_quantity} given out
                  </p>
                </>
              ),
            },
            {
              id: "distribution",
              label: "Distribution",
              cell: (item) => (
                <StockDistribution item={item} onDistributed={setSuccess} />
              ),
            },
          ]}
        />
      </div>
    </>
  );
}

function StockDistribution({
  item,
  onDistributed,
}: {
  item: InventoryItem;
  onDistributed: (message: string) => void;
}) {
  const { dispatch } = useDemo();
  const [quantity, setQuantity] = useState("1");
  const [revision, setRevision] = useState(item.donation.revision);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  function distribute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (!validQuantity(quantity, item.remaining_quantity))
        throw new Error(
          "Quantity must be a positive whole number within remaining stock.",
        );
      dispatch({
        type: "distribute",
        id: item.donation.id,
        quantity,
        expected_revision: revision,
      });
      setRevision(String(BigInt(revision) + 1n));
      setError(false);
      setMessage(`${formatCount(quantity)} given out.`);
      onDistributed(
        `${formatCount(quantity)} of ${itemName(item.donation)} given out. Stock updated.`,
      );
    } catch (cause) {
      setError(true);
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Distribution could not be recorded.",
      );
    }
  }
  return (
    <>
      <form className="console-actions" onSubmit={distribute}>
        <Field
          label="Quantity"
          style={{ width: 85 }}
          type="number"
          required
          min="1"
          max={item.remaining_quantity}
          step="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          aria-label={`Quantity of ${itemName(item.donation)} to give out`}
        />
        <Button
          variant="outline"
          disabled={
            !validQuantity(quantity, item.remaining_quantity) ||
            revision !== item.donation.revision
          }
        >
          Record distribution
        </Button>
        {revision !== item.donation.revision && (
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setRevision(item.donation.revision);
              setMessage("");
            }}
          >
            Refresh stock
          </Button>
        )}
      </form>
      <Feedback message={message} error={error} />
    </>
  );
}
