"use client";
import { useState } from "react";
import {
  ConsoleTitle,
  More,
  useAssociation,
} from "@/components/association/shell";
import { AuthPhoto } from "@/components/association/auth-photo";
import { Button, Chip, SelectField } from "@/components/ui";
import { useApiPage } from "@/lib/api-hooks";
import type { PostedDonation } from "@/lib/api-contracts";
import { CATEGORY_LABELS } from "@/lib/labels";
import {
  enumLabel,
  factLabel,
  formatCount,
  indicatorLabel,
  indicatorTone,
} from "@/lib/ui-text";
import { categoryFields } from "@/lib/category-fields";
import "./offers.css";
function probabilityLabel(value: number) {
  return `${Math.round(value * 100)}%`;
}
function name(item: PostedDonation) {
  if (item.name?.trim()) return item.name;
  const product = item.attributes.product ?? item.attributes.type;
  return typeof product === "string"
    ? categoryFields[item.category].product?.includes(product)
      ? enumLabel(product)
      : product
    : CATEGORY_LABELS[item.category];
}
export default function PostedOffers() {
  const { id } = useAssociation();
  const [category, setCategory] = useState("");
  const [radius, setRadius] = useState("25");
  const [selection, setSelection] = useState<string | null>(null);
  const path = `/associations/${id}/posted-donations?radius_km=${radius}&limit=12${category ? `&category=${category}` : ""}`;
  const items = useApiPage<PostedDonation>(path);
  const selected =
    items.data.find((item) => item.id === selection) ?? items.data[0];
  return (
    <>
      <ConsoleTitle
        title="Offers nearby"
        detail="Items donors have chosen to share with association staff. Distances are approximate, measured to the posting town."
      />
      <div className="row wrap posted-filters">
        <SelectField
          label="Category"
          aria-label="Category"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setSelection(null);
          }}
        >
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Distance"
          aria-label="Distance"
          value={radius}
          onChange={(event) => {
            setRadius(event.target.value);
            setSelection(null);
          }}
        >
          {[5, 10, 25, 50, 100].map((value) => (
            <option key={value} value={value}>
              Within {value} km
            </option>
          ))}
        </SelectField>
        <Button
          variant="outline"
          disabled={items.loading}
          onClick={() => void items.refresh()}
        >
          Refresh items
        </Button>
      </div>
      {items.loading && <p role="status">Loading nearby items…</p>}
      {items.error && (
        <div role="alert" className="stack-sm">
          <p>{items.error}</p>
          <Button
            variant="outline"
            onClick={() =>
              void (items.hasMore ? items.loadMore() : items.refresh())
            }
          >
            Retry
          </Button>
        </div>
      )}
      {!items.loading && !items.error && !items.data.length && (
        <p>
          No posted items within {radius} km. Try another category or distance.
        </p>
      )}
      <div className="posted-layout">
        <section aria-label="Nearby posted items">
          <div className="posted-gallery">
            {items.data.map((item) => (
              <article
                key={item.id}
                className={`posted-item ${item.id === selected?.id ? "is-selected" : ""}`}
              >
                <div className="posted-image">
                  {item.photos[0] ? (
                    <AuthPhoto
                      photo={item.photos[0]}
                      alt={`${name(item)} item photo`}
                      size={160}
                    />
                  ) : (
                    <p className="muted">No photo</p>
                  )}
                </div>
                <Button
                  variant="soft"
                  aria-pressed={item.id === selected?.id}
                  onClick={() => setSelection(item.id)}
                >
                  {name(item)}, {formatCount(item.quantity)}
                </Button>
                <p className="meta muted">
                  {item.locality}, {item.distance_km.toFixed(1)} km away
                </p>
                <Chip>{CATEGORY_LABELS[item.category]}</Chip>
              </article>
            ))}
          </div>
          <More {...items} />
        </section>
        {selected && (
          <aside className="posted-detail stack" aria-label="Selected item">
            <div>
              <h2>{name(selected)}</h2>
              <p className="meta muted">
                {selected.locality}, {selected.distance_km.toFixed(1)} km away
              </p>
            </div>
            <Button type="button" title="Demo only. No action is performed.">
              Take offer
            </Button>
            <div className="console-photos">
              {selected.photos.map((photo) => (
                <AuthPhoto
                  key={photo.id}
                  photo={photo}
                  alt={`${name(selected)} item photo`}
                  size={240}
                />
              ))}
            </div>
            <section>
              <h3>Item details</h3>
              <dl className="posted-facts">
                {selected.description && (
                  <div>
                    <dt>Description</dt>
                    <dd className="item-description">{selected.description}</dd>
                  </div>
                )}
                <div>
                  <dt>Quantity</dt>
                  <dd>{formatCount(selected.quantity)}</dd>
                </div>
                {Object.entries(selected.attributes)
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
                              categoryFields[selected.category][key]?.includes(
                                value,
                              )
                            ? enumLabel(value)
                            : String(value)}
                      </dd>
                    </div>
                  ))}
                {selected.expiry.expiry_date && (
                  <div>
                    <dt>Printed date</dt>
                    <dd>
                      {new Intl.DateTimeFormat("en-GB", {
                        day:
                          selected.expiry.date_precision === "day"
                            ? "numeric"
                            : undefined,
                        month:
                          selected.expiry.date_precision !== "year"
                            ? "short"
                            : undefined,
                        year: "numeric",
                        timeZone: "UTC",
                      }).format(
                        new Date(`${selected.expiry.expiry_date}T00:00:00Z`),
                      )}
                      {selected.expiry.date_type
                        ? ` (${enumLabel(selected.expiry.date_type)})`
                        : ""}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
            <section className="stack-sm">
              <h3>Indicators</h3>
              {!selected.indicators.length && (
                <p className="muted">No indicators available.</p>
              )}
              {selected.indicators.map((indicator, index) => (
                <div
                  className="row between wrap"
                  key={`${indicator.key}:${index}`}
                >
                  <span>{indicatorLabel(indicator.key)}</span>
                  <Chip
                    variant={indicatorTone(
                      indicator.key,
                      indicator.level ?? undefined,
                    )}
                  >
                    {[
                      indicator.value,
                      indicator.probability == null
                        ? null
                        : probabilityLabel(indicator.probability),
                      indicator.level
                        ? `${enumLabel(indicator.level)} indicator`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Not assessed"}
                  </Chip>
                </div>
              ))}
            </section>
            <p className="meta muted">
              Posted{" "}
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeZone: "Europe/Paris",
              }).format(new Date(selected.posted_at))}
              . Donor identity and private address are hidden.
            </p>
          </aside>
        )}
      </div>
    </>
  );
}
