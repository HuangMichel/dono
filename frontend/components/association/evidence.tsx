"use client";
import type {
  Offer,
  Analysis,
  Evidence as EvidenceDTO,
} from "@/lib/api-contracts";
import { useApiResource } from "@/lib/api-hooks";
import { AnalysisDetails } from "./evidence-details";
import { ItemHistory } from "./evidence-history";
import { dateLabel, probabilityLabel } from "./evidence-format";
export { dateLabel, instant, probabilityLabel } from "./evidence-format";
import "./evidence-details.css";
import { CATEGORY_LABELS } from "@/lib/labels";
import { categoryFields } from "@/lib/category-fields";
import {
  factLabel,
  enumLabel,
  formatCount,
  safetyWarnings,
} from "@/lib/ui-text";
import { ExpiryChip } from "./status";
import { ResourceStatus } from "./shell";
import { AuthPhoto } from "./auth-photo";
export { AuthPhoto } from "./auth-photo";
export function itemName(offer: Offer) {
  if (offer.facts_snapshot.name?.trim()) return offer.facts_snapshot.name;
  const a = offer.facts_snapshot.attributes;
  if (
    typeof a.type === "string" &&
    categoryFields[offer.category].type?.includes(a.type)
  ) {
    return enumLabel(a.type);
  }
  return String(
    a.type ?? a.product ?? a.name ?? CATEGORY_LABELS[offer.category],
  );
}
/** The donor may correct a date the AI misread; staff verify against the label photo. */
function DateCorrection({
  analysis,
  offer,
}: {
  analysis: Analysis;
  offer: Offer;
}) {
  const detected =
    (
      analysis.extracted as {
        dates?: { expiry_date?: string | null };
      }
    ).dates?.expiry_date ?? null;
  const donorSet = offer.facts_snapshot.expiry.expiry_date;
  if (!detected || !donorSet || detected === donorSet) return null;
  return (
    <section
      className="notice caution console-evidence-correction"
      aria-label="Date corrected by donor"
    >
      <strong>Date corrected by donor</strong>
      <dl className="console-evidence-facts">
        <div>
          <dt>Detected</dt>
          <dd>{dateLabel(detected)}</dd>
        </div>
        <div>
          <dt>Donor set</dt>
          <dd>{dateLabel(donorSet)}</dd>
        </div>
      </dl>
      <p className="console-meta">
        Verify against the label photo. See Expiry priority for the offer’s date
        status.
      </p>
    </section>
  );
}
export function labelCorrectionApplies(offer: Offer, analyses: Analysis[]) {
  const donorSet = offer.facts_snapshot.expiry.expiry_date;
  return analyses.some((analysis) => {
    const dates = (
      analysis.extracted as {
        dates?: {
          expiry_date?: string | null;
          date_type?: string | null;
          pao_months?: number | null;
        };
      }
    ).dates;
    const strict =
      ["DLC", "expiry", "PAO"].includes(dates?.date_type ?? "") ||
      dates?.pao_months != null;
    return (
      strict &&
      !!dates?.expiry_date &&
      !!donorSet &&
      dates.expiry_date !== donorSet
    );
  });
}
type EvidenceResource = ReturnType<typeof useApiResource<EvidenceDTO>>;
export function Evidence({
  offer,
  resource: shared,
  layout = "default",
}: {
  offer: Offer;
  resource?: EvidenceResource;
  layout?: "default" | "review";
}) {
  const own = useApiResource<EvidenceDTO>(
    shared ? null : `/offers/${offer.id}/evidence`,
  );
  const resource = shared ?? own;
  const warnings = safetyWarnings(
    resource.data?.analyses.flatMap((analysis) => analysis.indicators) ?? [],
  );
  return (
    <div className="console-stack">
      {warnings.map((warning) => (
        <div key={warning.key} className="notice danger" role="note">
          <strong>
            {warning.key === "looks_like_medicine"
              ? "Looks like a medicine"
              : "Chilled or frozen food likely"}
            {warning.probability != null &&
              `, ${probabilityLabel(warning.probability)}`}
          </strong>
          <p>
            {warning.key === "looks_like_medicine"
              ? "Medicines cannot be donated through Dono. If this is a medicine, refuse the offer and suggest a pharmacy."
              : "Individuals can only give food stored at room temperature. Check the storage instructions on the label."}
          </p>
        </div>
      ))}
      <ResourceStatus {...resource} />
      <div
        className={
          layout === "review" ? "review-evidence-overview" : "console-stack"
        }
      >
        {resource.data && resource.data.photos.length > 0 && (
          <div className="console-photos">
            {resource.data.photos.map((p) => (
              <AuthPhoto
                key={p.id}
                photo={p}
                size={layout === "review" ? 320 : 160}
                alt={`${p.kind === "label" ? "Printed label" : "Item"} photo of ${itemName(offer)}`}
              />
            ))}
          </div>
        )}
        <section className="console-evidence-section">
          <h2>Offered item</h2>
          <dl className="console-evidence-facts">
            <div>
              <dt>Item name</dt>
              <dd>{itemName(offer)}</dd>
            </div>
            {layout === "review" && (
              <div>
                <dt>Selected category</dt>
                <dd>{CATEGORY_LABELS[offer.category]}</dd>
              </div>
            )}
            {offer.facts_snapshot.description && (
              <div>
                <dt>Description</dt>
                <dd className="item-description">
                  {offer.facts_snapshot.description}
                </dd>
              </div>
            )}
            {Object.entries(offer.facts_snapshot.attributes)
              .filter(([, value]) => value !== null && value !== "")
              .map(([key, value]) => (
                <div key={key}>
                  <dt>{factLabel(key)}</dt>
                  <dd>
                    {typeof value === "boolean"
                      ? value
                        ? "Yes"
                        : "No"
                      : typeof value === "string" &&
                          categoryFields[offer.category][key]?.includes(value)
                        ? enumLabel(value)
                        : Array.isArray(value)
                          ? value
                              .map((part) => enumLabel(String(part)))
                              .join(", ")
                          : String(value)}
                  </dd>
                </div>
              ))}
            <div>
              <dt>Quantity</dt>
              <dd>{formatCount(offer.quantity)}</dd>
            </div>
            {offer.computed.expiry.bucket !== "not_applicable" && (
              <>
                <div>
                  <dt>Printed date</dt>
                  <dd>
                    {dateLabel(offer.facts_snapshot.expiry.expiry_date)}
                    {offer.facts_snapshot.expiry.date_type &&
                      ` (${enumLabel(offer.facts_snapshot.expiry.date_type)})`}
                  </dd>
                </div>
                <div>
                  <dt>Expiry priority</dt>
                  <dd>
                    <ExpiryChip expiry={offer.computed.expiry} />
                  </dd>
                </div>
              </>
            )}
          </dl>
        </section>
      </div>
      {resource.data && (
        <>
          {layout !== "review" && resource.data.category_mismatch && (
            <p className="notice warning">
              The AI identified a different category from the one in this offer.
            </p>
          )}
          <section className="console-evidence-section">
            <h2>AI indicators for this offer</h2>
            {resource.data.analyses.length === 0 && (
              <p className="console-meta">
                No analysis available. Review the item manually.
              </p>
            )}
            {resource.data.requests
              .filter((r) => r.state !== "succeeded")
              .map((r) => (
                <p key={r.id} className="console-meta">
                  {r.state === "pending"
                    ? "Analysis pending."
                    : "Analysis unavailable."}
                </p>
              ))}
            {resource.data.analyses.map((a) => (
              <section key={a.id} className="evidence-analysis">
                <p className="console-meta">
                  Suggested category: {CATEGORY_LABELS[a.category]} · Category
                  confidence {probabilityLabel(a.confidence)}
                </p>
                <DateCorrection analysis={a} offer={offer} />
                <AnalysisDetails
                  analysis={a}
                  dateRelevant={
                    offer.computed.expiry.bucket !== "not_applicable" ||
                    (offer.computed.expiry.required_date_checks?.length ?? 0) >
                      0
                  }
                />
              </section>
            ))}
          </section>
          {resource.data.edits.length > 0 && (
            <ItemHistory
              edits={resource.data.edits}
              category={offer.category}
            />
          )}
        </>
      )}
    </div>
  );
}
