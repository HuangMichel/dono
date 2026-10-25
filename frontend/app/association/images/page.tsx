"use client";

import Image from "next/image";
import { useState } from "react";
import { useDemo } from "@/lib/demo-context";
import {
  CATEGORY_LABELS,
  DEMO_ASSOCIATION_ID,
  DEMO_STAFF_ID,
  STATUS_LABELS,
  getInventory,
} from "@/lib/demo-store";
import { Button, Card, Chip, EmptyState, SelectField } from "@/components/ui";
import { ConsoleTitle } from "@/components/association/shell";
import {
  Evidence,
  dateLabel,
  indicatorLabels,
  instant,
  itemName,
  probabilityLabel,
} from "@/components/association/evidence";

export default function ImagesPage() {
  const { state } = useDemo();
  const [category, setCategory] = useState("all");
  const [indicator, setIndicator] = useState("");
  const [level, setLevel] = useState("");
  const [selected, setSelected] = useState("");
  const scoped = state.donations.filter(
    (d) => d.association_id === DEMO_ASSOCIATION_ID && d.status !== "draft",
  );
  const keys = [
    ...new Set(
      state.analyses
        .filter((a) => scoped.some((d) => d.basis_analysis_id === a.id))
        .flatMap((a) => a.indicators.map((i) => i.key)),
    ),
  ];
  const donations = scoped.filter((d) => {
    const a = state.analyses.find((a) => a.id === d.basis_analysis_id);
    return (
      (category === "all" || d.category === category) &&
      (!indicator ||
        a?.indicators.some(
          (i) => i.key === indicator && (!level || i.level === level),
        )) &&
      (!level ||
        a?.indicators.some(
          (i) => (!indicator || i.key === indicator) && i.level === level,
        ))
    );
  });
  const detail = donations.find((d) => d.id === selected);
  const stock = getInventory(state).filter(
    (i) =>
      i.donation.association_id === DEMO_ASSOCIATION_ID &&
      Number(i.remaining_quantity) > 0,
  );
  const unknownDates = stock.filter(
    (i) =>
      !state.expiry_facts.find((f) => f.donation_id === i.donation.id)
        ?.expiry_date,
  ).length;
  return (
    <>
      <ConsoleTitle title="Images" detail={`${donations.length} items`} />
      <div className="console-actions" style={{ marginBottom: 16 }}>
        <div
          className="console-filter-strip console-category-tabs"
          aria-label="Image categories"
        >
          {[
            ["all", "All"],
            ["food", "Food"],
            ["para", "Care"],
            ["clothes", "Clothes"],
            ["shoes", "Shoes"],
            ["furniture", "Furniture"],
          ].map(([key, label]) => (
            <Button
              size="sm"
              variant="soft"
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
              key={key}
            >
              {label}
            </Button>
          ))}
        </div>
        {keys.slice(0, 4).map((key) => (
          <Button
            key={key}
            variant={indicator === key ? "outline" : "soft"}
            size="sm"
            aria-pressed={indicator === key}
            onClick={() => setIndicator(indicator === key ? "" : key)}
          >
            {indicatorLabels[key] ?? key.replaceAll("_", " ")}
          </Button>
        ))}
        <SelectField
          label="Indicator level"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="">All levels</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </SelectField>
      </div>
      <div className="console-gallery-layout">
        <div className="console-gallery-grid">
          {donations.map((d) => {
            const photo = state.photos.find((p) => p.donation_id === d.id);
            const analysis = state.analyses.find(
              (a) => a.id === d.basis_analysis_id,
            );
            const indicator = analysis?.indicators[0];
            const facts = state.expiry_facts.find(
              (f) => f.donation_id === d.id,
            );
            return (
              <Card key={d.id}>
                <div className="console-gallery-image">
                  {photo && (
                    <Image
                      unoptimized
                      className="console-photo"
                      src={photo.content_url}
                      alt={itemName(d)}
                      width={320}
                      height={320}
                      loading="lazy"
                    />
                  )}
                  <Chip>
                    {d.category ? CATEGORY_LABELS[d.category] : "Unknown"}
                  </Chip>
                  {indicator && (
                    <Chip
                      variant={
                        indicator.level === "high" ? "danger" : "warning"
                      }
                    >
                      {indicatorLabels[indicator.key] ??
                        indicator.key.replaceAll("_", " ")}
                      {indicator.probability !== undefined
                        ? ` ${probabilityLabel(indicator.probability)}`
                        : ""}
                    </Chip>
                  )}
                </div>
                <div className="console-gallery-caption">
                  <h2>
                    {itemName(d)} ×{d.quantity}
                  </h2>
                  <p className="console-meta">
                    {facts?.expiry_date
                      ? dateLabel(facts.expiry_date)
                      : STATUS_LABELS[d.status]}
                  </p>
                  {d.decided_by && (
                    <p className="console-meta">
                      {d.decision === "refused" ? "Refused" : "Approved"} by{" "}
                      {d.decided_by === DEMO_STAFF_ID ? "Léa" : "staff"}
                      {d.decided_at ? `, ${instant(d.decided_at)}` : ""}
                    </p>
                  )}
                  <Button
                    variant="soft"
                    size="sm"
                    aria-pressed={selected === d.id}
                    onClick={() => setSelected(d.id)}
                  >
                    Inspect
                  </Button>
                </div>
              </Card>
            );
          })}
          {!donations.length && (
            <EmptyState title="No images match these filters" />
          )}
        </div>
        <aside className="console-stack console-inspection">
          {detail ? (
            <Card className="console-panel">
              <div className="console-title">
                <h2>{itemName(detail)}</h2>
                <Button
                  size="sm"
                  variant="soft"
                  aria-label="Close inspection"
                  onClick={() => setSelected("")}
                >
                  Close
                </Button>
              </div>
              <Evidence donation={detail} />
            </Card>
          ) : (
            <>
              <Card className="console-panel">
                <div className="console-title">
                  <h2>Expiry buckets</h2>
                  <Chip variant="caution">Policy pending</Chip>
                </div>
                <dl>
                  {[
                    "Expired",
                    "Under 7 days",
                    "7–30 days",
                    "30–90 days",
                    "Over 90 days",
                  ].map((label) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>—</dd>
                    </div>
                  ))}
                  <div>
                    <dt>No source date</dt>
                    <dd>{unknownDates}</dd>
                  </div>
                </dl>
                <p className="console-meta" style={{ marginTop: 8 }}>
                  Received, undistributed stock only.
                </p>
              </Card>
              <Card variant="subtle" className="console-panel">
                <h2>Quality</h2>
                <dl>
                  <div>
                    <dt>Average shelf life</dt>
                    <dd>—</dd>
                  </div>
                  <div>
                    <dt>AI vs staff agreement</dt>
                    <dd>—</dd>
                  </div>
                </dl>
                <span className="console-meta">Metrics unavailable.</span>
              </Card>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
