"use client";
import { useState } from "react";
import { PublicShell } from "@/components/public-shell";
import {
  PageHeading,
  Card,
  Button,
  Field,
  Chip,
  Icon,
  LinkButton,
} from "@/components/ui";
import { CATEGORY_LABELS } from "@/lib/demo-store";
const examples = [
  {
    category: "clothes",
    title: "Winter coats, adult M–XL",
    name: "Example community wardrobe",
    note: "Adult sizes M to XL",
    progress: 12,
    target: 40,
  },
  {
    category: "food",
    title: "Dry pasta, rice and cans",
    name: "Example community pantry",
    note: "Room temperature only",
    progress: 24,
    target: 80,
  },
  {
    category: "shoes",
    title: "Complete pairs, sizes 36–44",
    name: "Example solidarity shop",
    note: "Complete pairs only",
    progress: 8,
    target: 30,
  },
  {
    category: "para",
    title: "Unopened hygiene products",
    name: "Example support centre",
    note: "No medicines",
    progress: 6,
    target: 25,
  },
  {
    category: "furniture",
    title: "Small furniture, bedside tables",
    name: "Example solidarity shop",
    note: "Donor brings the item",
    progress: 2,
    target: 6,
  },
];
export default function Needs() {
  const [category, setCategory] = useState("all"),
    [selected, setSelected] = useState("clothes"),
    [location, setLocation] = useState(""),
    [searched, setSearched] = useState(false);
  const filtered = examples.filter(
      (x) => category === "all" || x.category === category,
    ),
    item = filtered.find((x) => x.category === selected) ?? filtered[0];
  return (
    <PublicShell>
      <main id="main" className="container nearby-page">
        <PageHeading title="What is needed nearby?" />
        <div className="needs-toolbar">
          <form
            className="location-search"
            onSubmit={(e) => {
              e.preventDefault();
              setSearched(true);
            }}
          >
            <div className="location-input location-field">
              <Icon name="pin" />
              <Field
                label="Location"
                hideLabel
                id="location"
                name="location"
                aria-label="Location"
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>
            <Button variant="outline">Search</Button>
          </form>
          <div className="segmented category-filter" aria-label="Category">
            {[["all", "All"], ...Object.entries(CATEGORY_LABELS)].map(
              ([key, label]) => (
                <Button
                  key={key}
                  variant="soft"
                  aria-pressed={category === key}
                  onClick={() => setCategory(key)}
                >
                  {label}
                </Button>
              ),
            )}
          </div>
        </div>
        <p
          className="meta muted needs-note"
          role={searched ? "status" : undefined}
        >
          {searched
            ? "Location search is not connected. These Paris listings remain illustrative."
            : `${filtered.length} illustrative needs. Fictional public examples.`}
        </p>
        <div className="needs-layout">
          <div
            className="stack-sm"
            role="group"
            aria-label="Nearby example needs"
          >
            {filtered.map((x) => (
              <button
                key={x.category}
                className={`need-row ${item?.category === x.category ? "selected" : ""}`}
                onClick={() => setSelected(x.category)}
                aria-pressed={item?.category === x.category}
              >
                <span className="need-row-heading">
                  <span>
                    <strong>{x.title}</strong>
                    <span className="meta muted block">{x.name}</span>
                  </span>
                  {x.category === "clothes" && (
                    <Chip variant="warning">Urgent example</Chip>
                  )}
                </span>
                <span className="row wrap need-meta">
                  <span>Paris example</span>
                  <span>{x.note}</span>
                  <span>
                    {x.progress} of {x.target} received
                  </span>
                </span>
                <span className="progress-track">
                  <span
                    style={{ width: `${(x.progress / x.target) * 100}%` }}
                  />
                </span>
              </button>
            ))}
          </div>
          <Card className="need-detail stack-sm">
            <Chip>
              {CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS]}
            </Chip>
            <h2>{item.title}</h2>
            <p className="meta muted">{item.name}, fictional listing</p>
            <dl className="facts-list">
              <div>
                <dt>Target</dt>
                <dd>{item.target} units</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>{item.progress} units</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>Paris example</dd>
              </div>
            </dl>
            <p className="meta muted">{item.note}</p>
            <LinkButton href="/donate" size="app">
              Prepare an offer
            </LinkButton>
            <p className="meta muted">
              Only illustrative listings are shown. Matching your donation uses
              the local demo needs.
            </p>
          </Card>
        </div>
      </main>
    </PublicShell>
  );
}
