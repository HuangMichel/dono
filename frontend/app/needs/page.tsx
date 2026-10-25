"use client";
import { formatCount } from "@/lib/ui-text";
import { useState } from "react";
import { PublicShell } from "@/components/public-shell";
import {
  PageHeading,
  Card,
  CardActions,
  Button,
  Field,
  Chip,
  Icon,
  LinkButton,
} from "@/components/ui";
import { CATEGORY_LABELS } from "@/lib/demo-store";
import { Pagination } from "@/components/ui/pagination";
import { paginateItems } from "@/components/ui/pagination-model";

const PAGE_SIZE = 10;
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
    [submittedLocation, setSubmittedLocation] = useState<string | null>(null),
    [page, setPage] = useState(1);
  const filtered = examples.filter(
      (x) => category === "all" || x.category === category,
    ),
    results = paginateItems(filtered, page, PAGE_SIZE),
    item =
      results.items.find((x) => x.category === selected) ?? results.items[0];
  return (
    <PublicShell>
      <main id="main" className="container nearby-page">
        <PageHeading title="What is needed nearby?" />
        <div className="needs-toolbar">
          <form
            className="location-search"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmittedLocation(location.trim());
              setPage(1);
              setSelected("");
            }}
          >
            <div className="location-input location-field">
              <Icon name="pin" />
              <Field
                label="Location (optional)"
                hideLabel
                id="location"
                name="location"
                aria-label="Location (optional)"
                aria-describedby="needs-location-status"
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
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
                  onClick={() => {
                    setCategory(key);
                    setPage(1);
                    setSelected("");
                  }}
                >
                  {label}
                </Button>
              ),
            )}
          </div>
        </div>
        <p
          className="meta muted needs-note"
          id="needs-location-status"
          role="status"
        >
          {submittedLocation
            ? "Location search is unavailable in this demo. Showing all sample needs in the selected category."
            : `${formatCount(filtered.length, "sample need")}. Location is optional; no distance filtering in this demo.`}
        </p>
        <div className="needs-layout">
          <div className="stack-sm needs-results">
            <div className="stack-sm" role="group" aria-label="Sample needs">
              {results.items.map((x) => (
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
              {results.totalItems === 0 && (
                <p className="muted">No sample needs in this category.</p>
              )}
            </div>
            <Pagination
              page={results.page}
              totalItems={results.totalItems}
              pageSize={PAGE_SIZE}
              label="Needs pages"
              onPageChange={(nextPage) => {
                setPage(nextPage);
                setSelected("");
              }}
            />
          </div>
          {item && (
            <Card className="need-detail stack-sm">
              <Chip>
                {CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS]}
              </Chip>
              <h2>{item.title}</h2>
              <p className="meta muted">{item.name}, fictional listing</p>
              <dl className="facts-list">
                <div>
                  <dt>Target</dt>
                  <dd>{formatCount(item.target, "unit")}</dd>
                </div>
                <div>
                  <dt>Received</dt>
                  <dd>{formatCount(item.progress, "unit")}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>Paris example</dd>
                </div>
              </dl>
              <p className="meta muted">{item.note}</p>
              <CardActions>
                <p className="meta muted">
                  Sample listing only. Your offer is matched against the demo
                  association’s needs.
                </p>
                <LinkButton href="/donate" size="app">
                  Prepare an offer
                </LinkButton>
              </CardActions>
            </Card>
          )}
        </div>
      </main>
    </PublicShell>
  );
}
