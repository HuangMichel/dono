"use client";

import Image from "next/image";
import type { Donation } from "@/lib/contracts";
import { useDemo } from "@/lib/demo-context";
import { CATEGORY_LABELS, getExpiry, getWarnings } from "@/lib/demo-store";
import { Chip, Icon } from "@/components/ui";

export function itemName(donation: Donation) {
  return String(
    donation.attributes.type ??
      donation.attributes.product ??
      donation.attributes.name ??
      (donation.category ? CATEGORY_LABELS[donation.category] : "Item"),
  );
}
export function instant(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
export function dateLabel(value: string | null | undefined) {
  if (!value) return "Unknown";
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Paris",
      }).format(parsed);
}
export const indicatorLabels: Record<string, string> = {
  looks_like_medicine: "Medicine concern",
  cold_food: "Needs refrigeration",
  stains: "Stains",
  sealed: "Sealed",
  packaged_unopened: "Unopened packaging",
  damaged_packaging: "Damaged packaging",
  date_readable: "Date readable",
  sole_wear: "Sole wear",
  pairs_complete: "Pairs complete",
};
export function probabilityLabel(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(value);
}
function factValue(value: unknown) {
  return value === null || value === undefined
    ? "Unknown"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}

export function Evidence({ donation }: { donation: Donation }) {
  const { state } = useDemo();
  const analysis = state.analyses.find(
    (a) => a.id === donation.basis_analysis_id,
  );
  const photos = state.photos.filter((p) => p.donation_id === donation.id);
  const facts = state.expiry_facts.find((f) => f.donation_id === donation.id);
  const expiry = getExpiry(state, donation.id);
  const warnings = getWarnings(state, donation.id);
  const extractedDate =
    typeof analysis?.extracted.expiry_date === "string"
      ? analysis.extracted.expiry_date
      : null;
  return (
    <div className="console-stack">
      <div className="console-photos">
        {photos.map((photo) => (
          <a
            key={photo.id}
            href={photo.content_url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Enlarge ${photo.kind} photo`}
          >
            <Image
              unoptimized
              className="console-photo"
              src={photo.content_url}
              alt={`${photo.kind === "label" ? "Label" : "Item"} photo of ${itemName(donation)}`}
              width={160}
              height={160}
            />
            {photo.kind === "label" && (
              <span className="console-meta">Label photo</span>
            )}
          </a>
        ))}
      </div>
      {warnings.map((warning) => (
        <div
          className={`notice ${warning === "medicine_concern" ? "error" : "warning"}`}
          key={warning}
        >
          <span className="row">
            <Icon name="warning" />
            {warning === "medicine_concern"
              ? "Medicine concern. Medicines cannot be donated. Refer to a pharmacy."
              : "Possible chilled or frozen food. Only non-perishable food stored at room temperature is in scope."}
          </span>
        </div>
      ))}
      {analysis && analysis.category !== donation.category && (
        <div className="notice warning">
          Category corrected from {CATEGORY_LABELS[analysis.category]} to{" "}
          {donation.category ? CATEGORY_LABELS[donation.category] : "unknown"}.
          Indicators retain their original category.
        </div>
      )}
      {facts?.edited_by && (
        <div className="notice console-date-comparison">
          <strong>Date corrected by donor</strong>
          <dl>
            <div>
              <dt>Detected</dt>
              <dd>{dateLabel(extractedDate)}</dd>
            </div>
            <div>
              <dt>Donor set</dt>
              <dd>{dateLabel(facts.expiry_date)}</dd>
            </div>
          </dl>
          <p className="console-meta">Verify against the label photo.</p>
        </div>
      )}
      <div className="console-evidence-columns">
        <section>
          <h2>Details</h2>
          <dl>
            <div>
              <dt>Category</dt>
              <dd>
                {donation.category
                  ? CATEGORY_LABELS[donation.category]
                  : "Unknown"}
              </dd>
            </div>
            {Object.entries(donation.attributes).map(([key, value]) => (
              <div key={key}>
                <dt>{key.replaceAll("_", " ")}</dt>
                <dd>{factValue(value)}</dd>
              </div>
            ))}
            <div>
              <dt>Quantity</dt>
              <dd>{donation.quantity} items</dd>
            </div>
            {(donation.category === "food" || donation.category === "para") && (
              <>
                <div>
                  <dt>Date type</dt>
                  <dd>{facts?.date_type ?? "Unknown"}</dd>
                </div>
                <div>
                  <dt>Source date</dt>
                  <dd>{dateLabel(facts?.expiry_date)}</dd>
                </div>
                <div>
                  <dt>Readability</dt>
                  <dd>{facts?.readability ?? "Unknown"}</dd>
                </div>
                {facts?.date_type === "PAO" && (
                  <div>
                    <dt>After opening</dt>
                    <dd>
                      {facts.pao_months ?? "Unknown"} months, no opening date
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Days left</dt>
                  <dd>
                    {expiry.days_left === null
                      ? "Unknown"
                      : `${expiry.days_left} days`}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </section>
        <section>
          <div className="console-title">
            <h2>Original AI indicators</h2>
            {analysis && (
              <span className="console-meta">
                Confidence {probabilityLabel(analysis.confidence)}
              </span>
            )}
          </div>
          {analysis ? (
            <>
              <dl>
                {analysis.indicators.map((indicator, index) => (
                  <div key={`${indicator.key}-${index}`}>
                    <dt>
                      {indicatorLabels[indicator.key] ??
                        indicator.key.replaceAll("_", " ")}
                    </dt>
                    <dd>
                      {indicator.value}
                      {indicator.probability !== undefined &&
                        ` ${probabilityLabel(indicator.probability)}`}
                      {indicator.level && (
                        <Chip
                          variant={
                            indicator.level === "high" ? "warning" : "neutral"
                          }
                        >
                          {indicator.level}
                        </Chip>
                      )}
                      {indicator.value === undefined &&
                        indicator.probability === undefined &&
                        !indicator.level &&
                        "Not provided"}
                    </dd>
                  </div>
                ))}
              </dl>
              <details style={{ marginTop: 12 }}>
                <summary className="console-meta">
                  Original extraction and source
                </summary>
                <p className="console-meta" style={{ marginTop: 8 }}>
                  {analysis.provider}, {analysis.model}
                </p>
                <dl>
                  {Object.entries(analysis.extracted).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key.replaceAll("_", " ")}</dt>
                      <dd>{factValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </>
          ) : (
            <p className="console-meta">No retained analysis.</p>
          )}
        </section>
      </div>
    </div>
  );
}
