"use client";
import { useState } from "react";
import { useApiPage, useApiResource } from "@/lib/api-hooks";
import type {
  StockLot,
  Photo,
  Indicator,
  ExpiryBucket,
  Offer,
} from "@/lib/api-contracts";
import { Button, Chip, SelectField } from "@/components/ui";
import {
  ConsoleTitle,
  useAssociation,
  ResourceStatus,
  More,
} from "@/components/association/shell";
import {
  AuthPhoto,
  itemName,
  probabilityLabel,
  instant,
  Evidence,
} from "@/components/association/evidence";
import { ExpiryChip, expiryLabel } from "@/components/association/status";
import { indicatorLabel, indicatorTone, formatCount } from "@/lib/ui-text";
import { CATEGORY_LABELS } from "@/lib/labels";
import "./images.css";
type Gallery = { lot: StockLot; photos: Photo[]; indicators: Indicator[] };
const INDICATOR_FILTERS: [string, string][] = [
  ["looks_like_medicine", "Medicine"],
  ["chilled_or_frozen", "Chilled or frozen"],
  ["stains_visible", "Stains"],
  ["seal_broken", "Broken seal"],
  ["label_unreadable", "Unreadable date"],
];
export default function Images() {
  const { id } = useAssociation();
  const [category, setCategory] = useState("");
  const [indicator, setIndicator] = useState("");
  const [expiry, setExpiry] = useState("");
  const query = new URLSearchParams();
  if (category) query.set("category", category);
  if (indicator) query.set("indicator_key", indicator);
  if (expiry) query.set("expiry_filter", expiry);
  const resource = useApiPage<Gallery>(`/associations/${id}/images?${query}`);
  const counts = useApiResource<{
    buckets: { key: ExpiryBucket; count: number }[];
    reference_date: string;
    timezone: string;
  }>(
    `/associations/${id}/expiry-counts${category ? `?category=${category}` : ""}`,
  );
  const fefo = useApiPage<StockLot>(
    `/associations/${id}/expiry?view=distribute_first&limit=3${category ? `&category=${category}` : ""}`,
  );
  return (
    <>
      <ConsoleTitle
        title="Photos"
        detail="Photos of received donations still in stock."
      />
      <div className="row wrap">
        <div
          className="segmented images-category-filter"
          role="group"
          aria-label="Category"
        >
          <Button
            type="button"
            variant="soft"
            aria-pressed={category === ""}
            onClick={() => setCategory("")}
          >
            All
          </Button>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              variant="soft"
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="row wrap" role="group" aria-label="Indicator">
          {INDICATOR_FILTERS.map(([key, label]) => (
            <Button
              key={key}
              type="button"
              variant="soft"
              className={`indicator-filter tone-${indicatorTone(key, "high")}`}
              aria-pressed={indicator === key}
              onClick={() => setIndicator(indicator === key ? "" : key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <SelectField
          label="Expiry"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
        >
          <option value="">All date groups</option>
          {[
            "expired",
            "today",
            "lt_7",
            "lt_30",
            "lt_90",
            "at_90",
            "gt_90",
            "unknown",
            "not_applicable",
          ].map((b) => (
            <option key={b} value={b}>
              {expiryLabel(b as ExpiryBucket)}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="images-layout">
        <div className="console-stack">
          <ResourceStatus {...resource} empty={!resource.data.length} />
          {!resource.loading && !resource.error && !resource.data.length && (
            <p className="console-meta">No photos match these filters.</p>
          )}
          <div className="images-gallery">
            {resource.data.map((row) => {
              const firstIndicator = row.indicators[0];
              return (
                <figure className="images-tile" key={row.lot.receipt.id}>
                  <div className="images-tile-photo">
                    {row.photos[0] ? (
                      <AuthPhoto
                        photo={row.photos[0]}
                        alt={`${row.photos[0].kind === "label" ? "Printed label" : "Item"} photo of ${itemName(row.lot.offer)}`}
                      />
                    ) : (
                      <p className="meta muted">No photo available</p>
                    )}
                    <div className="images-tile-chips">
                      <Chip>{CATEGORY_LABELS[row.lot.offer.category]}</Chip>
                      <ExpiryChip expiry={row.lot.expiry} />
                    </div>
                  </div>
                  <figcaption>
                    <strong>{itemName(row.lot.offer)}</strong>
                    <p className="meta muted">
                      {formatCount(row.lot.remaining_quantity)}
                      {row.photos.length > 1
                        ? `, ${row.photos.length} photos`
                        : ""}
                    </p>
                    {firstIndicator && (
                      <p className="meta muted">
                        {indicatorLabel(firstIndicator.key)}
                        {firstIndicator.probability == null
                          ? (firstIndicator.value ?? "")
                          : ` ${probabilityLabel(firstIndicator.probability)}`}
                      </p>
                    )}
                    <p className="meta muted">
                      Received {instant(row.lot.receipt.created_at)}
                    </p>
                    <GalleryEvidence offer={row.lot.offer} />
                  </figcaption>
                </figure>
              );
            })}
          </div>
          <More {...resource} />
        </div>
        <aside className="console-stack images-aside">
          <section className="card">
            <h2>Expiry buckets</h2>
            <ResourceStatus {...counts} />
            {counts.data &&
              (counts.data.buckets.some((bucket) => bucket.count > 0) ? (
                <ul className="images-buckets">
                  {counts.data.buckets
                    .filter((bucket) => bucket.count > 0)
                    .map((bucket) => (
                      <li key={bucket.key}>
                        <ExpiryChip
                          expiry={{ bucket: bucket.key, days_left: null }}
                          showNotApplicable
                        />
                        <strong className="num">{bucket.count}</strong>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="console-meta">No items in stock.</p>
              ))}
          </section>
          <section className="card">
            <h2>Distribute first</h2>
            <ResourceStatus {...fefo} />
            <ol className="images-fefo">
              {fefo.data.map((lot, index) => (
                <li key={lot.receipt.id}>
                  <span className="num">{index + 1}</span>
                  <span>{itemName(lot.offer)}</span>
                  <ExpiryChip expiry={lot.expiry} />
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}

function GalleryEvidence({ offer }: { offer: Offer }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="images-evidence"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>View item evidence</summary>
      {open && <Evidence offer={offer} />}
    </details>
  );
}
