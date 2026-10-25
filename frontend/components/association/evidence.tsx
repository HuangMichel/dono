"use client";
import type {
  Offer,
  Category,
  Analysis,
  Evidence as EvidenceDTO,
} from "@/lib/api-contracts";
import { useApiResource } from "@/lib/api-hooks";
import { Chip } from "@/components/ui";
import { CATEGORY_LABELS } from "@/lib/labels";
import { categoryFields } from "@/lib/category-fields";
import {
  factLabel,
  indicatorLabel,
  indicatorTone,
  enumLabel,
  formatCount,
  rankIndicators,
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
        timeZone: "UTC",
      }).format(parsed);
}
export function probabilityLabel(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}
function dateStatus(date: string) {
  const days = Math.floor(
    (Date.parse(`${date}T00:00:00Z`) - Date.now()) / 86400000,
  );
  if (days < 0) return <Chip variant="danger">Expired</Chip>;
  if (days === 0) return <Chip variant="warning">Expires today</Chip>;
  return <Chip variant="success">{days} days left</Chip>;
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
          <dd>
            {dateLabel(detected)} {dateStatus(detected)}
          </dd>
        </div>
        <div>
          <dt>Donor set</dt>
          <dd>
            {dateLabel(donorSet)} {dateStatus(donorSet)}
          </dd>
        </div>
      </dl>
      <p className="console-meta">Verify against the label photo.</p>
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
const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  jev: "Jev",
  hybrid: "OpenAI and Jev",
};
type EvidenceResource = ReturnType<typeof useApiResource<EvidenceDTO>>;
export function Evidence({
  offer,
  resource: shared,
}: {
  offer: Offer;
  resource?: EvidenceResource;
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
            , {probabilityLabel(warning.probability ?? 0)}
          </strong>
          <p>
            {warning.key === "looks_like_medicine"
              ? "Medicines cannot be donated through Dono. If this is a medicine, refuse the offer and suggest a pharmacy."
              : "Individuals can only give food stored at room temperature. Check the storage instructions on the label."}
          </p>
        </div>
      ))}
      <ResourceStatus {...resource} />
      {resource.data && resource.data.photos.length > 0 && (
        <div className="console-photos">
          {resource.data.photos.map((p) => (
            <AuthPhoto
              key={p.id}
              photo={p}
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
      {resource.data && (
        <>
          {resource.data.category_mismatch && (
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
              <section key={a.id}>
                <p className="console-meta">
                  {CATEGORY_LABELS[a.category]},{" "}
                  {PROVIDER_LABELS[a.provider] ?? a.provider}, category
                  confidence {probabilityLabel(a.confidence)}
                </p>
                <DateCorrection analysis={a} offer={offer} />
                <ul className="console-evidence-indicators">
                  {rankIndicators(a.indicators).map((i, index) => (
                    <li key={index}>
                      <span>{indicatorLabel(i.key)}</span>
                      <Chip variant={indicatorTone(i.key, i.level)}>
                        {[
                          i.value,
                          i.probability == null
                            ? null
                            : probabilityLabel(i.probability),
                          i.level ? `${enumLabel(i.level)} indicator` : null,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Not assessed"}
                      </Chip>
                    </li>
                  ))}
                </ul>
                <details>
                  <summary>Details read by the AI</summary>
                  <p className="console-meta">Model: {a.model}</p>
                  <SourceFacts category={a.category} facts={a.extracted} />
                </details>
              </section>
            ))}
          </section>
          {resource.data.edits.length > 0 && (
            <details>
              <summary>Item changes before this offer</summary>
              {resource.data.edits.map((e) => (
                <section key={e.id}>
                  <p>
                    {enumLabel(e.change_kind)}, {instant(e.created_at)}
                  </p>
                  {Object.keys(e.before_snapshot).length > 0 && (
                    <section>
                      <h3>Before change</h3>
                      <SourceFacts
                        category={offer.category}
                        facts={e.before_snapshot}
                      />
                    </section>
                  )}
                  <section>
                    <h3>After change</h3>
                    <SourceFacts
                      category={offer.category}
                      facts={e.after_snapshot}
                    />
                  </section>
                  {e.from_state !== e.to_state && e.to_state && (
                    <p>
                      Item status:{" "}
                      {e.from_state ? `${enumLabel(e.from_state)} to ` : ""}
                      {enumLabel(e.to_state)}
                    </p>
                  )}
                </section>
              ))}
            </details>
          )}
        </>
      )}
    </div>
  );
}

function SourceFacts({
  category,
  facts,
}: {
  category: Category;
  facts: Record<string, unknown>;
}) {
  const attributes = (facts.attributes ?? {}) as Record<string, unknown>;
  const dates = (facts.dates ?? facts.expiry ?? {}) as Record<string, unknown>;
  const sourceCategory =
    typeof facts.category === "string" && facts.category in CATEGORY_LABELS
      ? (facts.category as Category)
      : category;
  return (
    <dl className="console-evidence-facts">
      {["name", "description"].map((key) =>
        typeof facts[key] === "string" && facts[key] ? (
          <div key={key}>
            <dt>{key === "name" ? "Item name" : "Description"}</dt>
            <dd className="item-description">{String(facts[key])}</dd>
          </div>
        ) : null,
      )}
      {typeof facts.category === "string" && (
        <div>
          <dt>Category</dt>
          <dd>{CATEGORY_LABELS[sourceCategory]}</dd>
        </div>
      )}
      {Object.entries(attributes).map(([key, value]) => {
        let display =
          value == null || value === "" ? "Not provided" : String(value);
        if (typeof value === "boolean") display = value ? "Yes" : "No";
        else if (Array.isArray(value))
          display = value.map(String).map(enumLabel).join(", ");
        else if (
          typeof value === "string" &&
          categoryFields[sourceCategory][key]?.includes(value)
        ) {
          display = enumLabel(value);
        }
        return (
          <div key={key}>
            <dt>{factLabel(key)}</dt>
            <dd>{display}</dd>
          </div>
        );
      })}
      {facts.quantity != null && (
        <div>
          <dt>Quantity</dt>
          <dd>{formatCount(String(facts.quantity))}</dd>
        </div>
      )}
      {Object.entries(dates).map(([key, value]) => {
        let display =
          value == null || value === "" ? "Not provided" : String(value);
        if (typeof value === "string") {
          if (["expiry_date", "opened_on"].includes(key))
            display = dateLabel(value);
          else if (["date_type", "date_precision", "readability"].includes(key))
            display = enumLabel(value);
        }
        return (
          <div key={key}>
            <dt>{factLabel(key)}</dt>
            <dd>{display}</dd>
          </div>
        );
      })}
    </dl>
  );
}
