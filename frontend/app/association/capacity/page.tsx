"use client";

import { CapacityMeter } from "@/components/ui/capacity-meter";
import { Button, Chip, Field } from "@/components/ui";

import { useState, type FormEvent } from "react";
import type { Category } from "@/lib/contracts";
import { useDemo } from "@/lib/demo-context";
import { CATEGORY_LABELS, getCapacity } from "@/lib/demo-store";
import {
  CategorySelect,
  ConsoleTitle,
  Feedback,
} from "@/components/association/shell";

export default function CapacityPage() {
  const { state, dispatch } = useDemo();
  const [category, setCategory] = useState<Category>("clothes");
  const [quantity, setQuantity] = useState(
    getCapacity(state, "clothes").limit_quantity,
  );
  const [revision, setRevision] = useState(
    getCapacity(state, "clothes").revision,
  );
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState(false);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      dispatch({
        type: "capacity",
        category,
        quantity,
        expected_revision: revision,
      });
      setRevision(String(BigInt(revision) + 1n));
      setError(false);
      setFeedback("Capacity updated in the demo.");
    } catch (cause) {
      setError(true);
      setFeedback(
        cause instanceof Error ? cause.message : "Capacity could not be saved.",
      );
    }
  }
  return (
    <>
      <ConsoleTitle title="Capacity" />
      <Feedback message={feedback} error={error} />
      <div className="console-columns">
        <section className="card console-panel">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const capacity = getCapacity(state, key as Category);
            const limit = Number(capacity.limit_quantity);
            return (
              <div className="console-row console-capacity-row" key={key}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <CapacityMeter
                    label={label}
                    inStock={capacity.computed.in_stock}
                    reserved={capacity.computed.reserved}
                    limit={capacity.limit_quantity}
                    description={`${capacity.computed.in_stock} in stock, ${capacity.computed.reserved} reserved, ${capacity.limit_quantity} limit`}
                  />
                </div>
                <Chip
                  variant={
                    Number(capacity.computed.available) > 0
                      ? "success"
                      : "neutral"
                  }
                >
                  {limit === 0
                    ? "Paused"
                    : Number(capacity.computed.available) === 0
                      ? "Full"
                      : `${capacity.computed.available} available`}
                </Chip>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCategory(key as Category);
                    setQuantity(capacity.limit_quantity);
                    setRevision(capacity.revision);
                  }}
                >
                  Edit
                </Button>
              </div>
            );
          })}
        </section>
        <form className="card console-panel console-stack" onSubmit={save}>
          <h2>Edit category capacity</h2>
          <CategorySelect
            value={category}
            onChange={(value) => {
              setCategory(value as Category);
              setQuantity(getCapacity(state, value as Category).limit_quantity);
              setRevision(getCapacity(state, value as Category).revision);
            }}
          />
          <Field
            label="Limit, items"
            required
            type="number"
            min="0"
            step="1"
            max="999999999"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <p className="console-meta">
            The limit includes stock and approved reservations. Set zero to
            close an empty category. Pause individual needs on the Needs page.
          </p>
          <Button variant="primary">Save capacity</Button>
        </form>
      </div>
    </>
  );
}
