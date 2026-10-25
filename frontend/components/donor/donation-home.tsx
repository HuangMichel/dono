"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, Chip, Icon } from "@/components/ui";
import { useDemo } from "@/lib/demo-context";
import { CATEGORY_LABELS } from "@/lib/demo-store";
import type { Category } from "@/lib/contracts";
import {
  SAMPLE_DESCRIPTION,
  sampleDescriptionDrafts,
} from "./sample-description";
export function DonationHome({
  scan,
  scenario,
  setScenario,
}: {
  scan: () => void;
  scenario: Category | "medicine" | "cold";
  setScenario: (scenario: Category | "medicine" | "cold") => void;
}) {
  const { state, dispatch } = useDemo();
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  function structure(event: React.FormEvent) {
    event.preventDefault();
    const inputs = sampleDescriptionDrafts(description);
    if (!inputs) {
      setError(
        "Free-text parsing is unavailable in this demo. Use the sample or scan an item.",
      );
      return;
    }
    try {
      if (
        !draftIds.length ||
        !draftIds.every((id) => state.donations.some((d) => d.id === id))
      ) {
        const ids = inputs.map(() => crypto.randomUUID());
        inputs.forEach((input, index) =>
          dispatch({ type: "create", id: ids[index], input }),
        );
        setDraftIds(ids);
      }
      setError("");
      setShowResults(true);
    } catch (error) {
      setError((error as Error).message);
    }
  }
  if (showResults)
    return (
      <section className="scan-intro description-result">
        <p className="description-quote">{SAMPLE_DESCRIPTION}</p>
        <h1>2 separate donations</h1>
        <p className="meta muted">
          Fixed sample description. Each item needs photos and analysis.
        </p>
        <ul className="split-draft-list">
          {draftIds.map((id) => {
            const donation = state.donations.find((d) => d.id === id);
            return (
              <li key={id}>
                {donation ? (
                  <Link href={"/donate?id=" + id}>
                    <span>
                      <strong>{String(donation.attributes.product)}</strong>
                      <span className="meta muted block">
                        {CATEGORY_LABELS[donation.category!]},{" "}
                        {donation.quantity}{" "}
                        {donation.category === "food" ? "packs" : "item"}
                        {donation.attributes.size
                          ? ", size " + donation.attributes.size
                          : ""}
                      </span>
                    </span>
                    <Chip variant="warning">Photo needed</Chip>
                    <Icon name="arrow-right" size={16} />
                  </Link>
                ) : (
                  <p className="muted">Draft cleared. Use the sample again.</p>
                )}
              </li>
            );
          })}
        </ul>
        <Button
          size="app"
          variant="outline"
          onClick={() => setShowResults(false)}
        >
          <Icon name="arrow-left" />
          Back
        </Button>
      </section>
    );
  return (
    <section className="scan-intro">
      <h1>What would you like to give?</h1>
      <div className="scan-action">
        <Button size="app" onClick={scan}>
          <Icon name="camera" size={32} />
          <span className="scan-action-label">
            Scan an item
            <Icon name="arrow-right" size={16} />
          </span>
        </Button>
      </div>
      <form className="description-input" onSubmit={structure}>
        <label htmlFor="donation-description" className="sr-only">
          Describe what you are giving
        </label>
        <input
          id="donation-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Or describe it"
        />
        <Button
          type="submit"
          size="sm"
          aria-label="Prepare donations from description"
        >
          <Icon name="arrow-right" size={18} />
        </Button>
      </form>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <details className="demo-tools">
        <summary>Sample controls</summary>
        <div className="demo-tools-content">
          <Button
            variant="outline"
            onClick={() => {
              setDescription(SAMPLE_DESCRIPTION);
              setError("");
            }}
          >
            Use sample description
          </Button>
          <p className="meta muted">
            Only the fixed sample description is available. Other text is not
            parsed.
          </p>
          <label className="field-label" htmlFor="start-scenario">
            Sample scenario
            <select
              id="start-scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value as typeof scenario)}
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
              <option value="medicine">Medicine warning</option>
              <option value="cold">Chilled food warning</option>
            </select>
          </label>
        </div>
      </details>
    </section>
  );
}
