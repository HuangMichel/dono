"use client";
import {
  formatCount,
  indicatorLabel,
  factLabel,
  enumLabel,
} from "@/lib/ui-text";

import Image from "next/image";
import { useState } from "react";
import { Button, Card, Chip, EmptyState, Field, Icon } from "@/components/ui";
import { ConsoleTitle } from "@/components/association/shell";
import { useDemo } from "@/lib/demo-context";
import { CATEGORY_LABELS, getPostedOffers } from "@/lib/demo-store";
import type { Category, ExpiryFacts } from "@/lib/contracts";

function printedDate(date: string, precision: ExpiryFacts["date_precision"]) {
  if (precision === "unknown") return "Date precision unknown";
  const value = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(value.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    ...(precision !== "year" ? { month: "short" as const } : {}),
    ...(precision === "day" ? { day: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(value);
}

export default function OffersPage() {
  const { state, ready } = useDemo();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const offers = getPostedOffers(state);
  const filtered = offers.filter(
    (offer) =>
      (category === "all" || offer.category === category) &&
      `${String(offer.attributes.product ?? "")} ${CATEGORY_LABELS[offer.category]}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const selected =
    filtered.find((offer) => offer.id === selectedId) ?? filtered[0];
  const photo = (offer: (typeof offers)[number]) =>
    offer.photos.find((photo) => photo.kind === "item")?.content_url ??
    "/item-" + offer.category + ".svg";
  const isIllustration = (offer: (typeof offers)[number]) =>
    /^\/item-(clothes|shoes|food|para|furniture)\.svg$/.test(photo(offer));
  if (!ready) return <p role="status">Loading posted offers…</p>;
  if (state.role !== "assoc_admin")
    return (
      <EmptyState title="Association access required">
        Choose the association demo role to browse posted offers.
      </EmptyState>
    );
  return (
    <>
      <ConsoleTitle
        title="Posted offers"
        detail={`${offers.length} available`}
      />
      <div className="console-gallery-layout">
        <section className="console-stack">
          <div className="console-actions" aria-label="Offer categories">
            {(
              ["all", ...Object.keys(CATEGORY_LABELS)] as (Category | "all")[]
            ).map((key) => (
              <Button
                key={key}
                variant="soft"
                size="sm"
                aria-pressed={category === key}
                onClick={() => setCategory(key)}
              >
                {key === "all" ? "All categories" : CATEGORY_LABELS[key]}
              </Button>
            ))}
          </div>
          <Field
            label="Search offers"
            placeholder="Search by item"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {filtered.length ? (
            <div className="console-posted-grid">
              {filtered.map((offer, index) => (
                <button
                  key={offer.id}
                  className="console-posted-card"
                  aria-pressed={selected?.id === offer.id}
                  onClick={() => setSelectedId(offer.id)}
                >
                  <span className="console-posted-image">
                    <Image
                      src={photo(offer)}
                      alt={
                        isIllustration(offer)
                          ? "Sample illustration"
                          : String(offer.attributes.product)
                      }
                      width={240}
                      height={180}
                      loading={index === 0 ? "eager" : "lazy"}
                      unoptimized
                    />
                    {selected?.id === offer.id && (
                      <span className="console-posted-check">
                        <Icon name="check" size={16} />
                      </span>
                    )}
                  </span>
                  <strong>
                    {String(offer.attributes.product)},{" "}
                    {formatCount(offer.quantity, "unit")}
                  </strong>
                  <span className="console-meta">
                    {CATEGORY_LABELS[offer.category]}
                  </span>
                  {isIllustration(offer) && (
                    <span className="console-meta">Sample illustration</span>
                  )}
                  <Chip>Available</Chip>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title={offers.length ? "No offers match" : "No posted offers yet"}
            >
              <p>
                {offers.length
                  ? "Try another search or category."
                  : "Items posted by donors will appear here."}
              </p>
            </EmptyState>
          )}
        </section>
        {selected && (
          <Card
            className="console-panel console-stack"
            aria-label="Selected offer details"
          >
            <Image
              className="console-posted-detail-photo"
              src={photo(selected)}
              alt={
                isIllustration(selected)
                  ? "Sample illustration"
                  : String(selected.attributes.product)
              }
              width={360}
              height={270}
              loading="eager"
              unoptimized
            />
            {isIllustration(selected) && (
              <p className="console-meta">Sample illustration</p>
            )}
            <div className="console-stack">
              <h2>{String(selected.attributes.product)}</h2>
              <span className="console-meta">
                {CATEGORY_LABELS[selected.category]},{" "}
                {formatCount(selected.quantity, "unit")}
              </span>
              <Chip>Available</Chip>
            </div>
            <dl className="facts-list">
              {Object.entries(selected.attributes)
                .filter(([key]) => key !== "product")
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>{factLabel(key)}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
            </dl>
            {["food", "para"].includes(selected.category) && (
              <dl className="facts-list">
                <div>
                  <dt>Printed date</dt>
                  <dd>
                    {selected.expiry?.readability === "unreadable"
                      ? "Unreadable"
                      : selected.expiry?.date_type === "PAO"
                        ? selected.expiry.pao_months !== null
                          ? `PAO, ${formatCount(selected.expiry.pao_months, "month")} after opening`
                          : "PAO, months unknown"
                        : selected.expiry?.expiry_date
                          ? `${selected.expiry.date_type ?? "Type unknown"}, ${printedDate(selected.expiry.expiry_date, selected.expiry.date_precision)}`
                          : "Unknown"}
                  </dd>
                </div>
                {selected.expiry?.expiry_date && (
                  <div>
                    <dt>Date precision</dt>
                    <dd>{enumLabel(selected.expiry.date_precision)}</dd>
                  </div>
                )}
              </dl>
            )}
            {selected.indicators.length > 0 && (
              <section className="console-stack">
                <h3>Sample indicators</h3>
                <dl className="facts-list">
                  {selected.indicators.map((indicator) => (
                    <div key={indicator.key}>
                      <dt>{indicatorLabel(indicator.key)}</dt>
                      <dd>
                        {[
                          indicator.value ?? indicator.level,
                          indicator.probability !== undefined
                            ? new Intl.NumberFormat("en", {
                                style: "percent",
                                maximumFractionDigits: 0,
                              }).format(indicator.probability)
                            : undefined,
                        ]
                          .filter(
                            (value) => value !== undefined && value !== "",
                          )
                          .join(", ")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            <p className="console-meta">
              Posted{" "}
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeZone: "Europe/Paris",
              }).format(new Date(selected.posted_at))}
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
