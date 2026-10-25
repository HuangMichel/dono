"use client";
import "./needs.css";
import { useEffect, useState, type FormEvent } from "react";
import { PublicShell } from "@/components/public-shell";
import {
  Button,
  Card,
  Chip,
  Field,
  PageHeading,
  LinkButton,
} from "@/components/ui";
import { publicNeedsPage } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error-messages";
import { useAuth } from "@/lib/auth-context";
import type { Category, Page, PublicNeed } from "@/lib/api-contracts";
import { categories } from "@/components/donor/api-donation";
import { enumLabel, factLabel, formatCount } from "@/lib/ui-text";
import { categoryFields } from "@/lib/category-fields";
import { accountHref, donationHref } from "@/lib/offer-intent";

function needAttribute(need: PublicNeed, key: string, value: unknown) {
  const text = String(value);
  const options = categoryFields[need.category][key];
  return typeof value === "boolean" || options?.includes(text)
    ? enumLabel(text)
    : text;
}

function needTitle(need: PublicNeed) {
  const facts = Object.entries(need.attributes)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key, value]) => needAttribute(need, key, value))
    .join(", ");
  return facts || categories[need.category];
}
type Query = { location: string; category: Category | ""; cursors: string[] };
export default function Needs() {
  const { user } = useAuth();
  const [query, setQuery] = useState<Query>({
    location: "",
    category: "",
    cursors: [],
  });
  const [result, setResult] = useState<{
    query: Query;
    page?: Page<PublicNeed>;
    error?: string;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const [locationError, setLocationError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [accountFor, setAccountFor] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "10" });
    if (query.location) params.set("location", query.location);
    if (query.category) params.set("category", query.category);
    const cursor = query.cursors.at(-1);
    if (cursor) params.set("cursor", cursor);
    void publicNeedsPage<PublicNeed>(params.toString(), controller.signal).then(
      (page) => {
        if (!controller.signal.aborted) setResult({ query, page });
      },
      (error) => {
        if (!controller.signal.aborted)
          setResult({
            query,
            error:
              error instanceof Error
                ? error.message
                : "Cannot load needs. Try again.",
          });
      },
    );
    return () => controller.abort();
  }, [query, retry]);
  const current = result?.query === query ? result : null;
  const loading = !current;
  const needs = current?.page?.data ?? [];
  const selected = needs.find((need) => need.id === selectedId) ?? needs[0];
  const next = selected
    ? donationHref({
        need: selected.id,
        category: selected.category,
        location: query.location,
      })
    : "/donate";
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const location = String(
      new FormData(event.currentTarget).get("location") ?? "",
    ).trim();
    // Validate the trimmed value so optional whitespace still lists all needs.
    if (
      location &&
      ([...location].length < 3 ||
        [...location].length > 200 ||
        !/^[\p{L}\p{N}]/u.test(location))
    ) {
      setLocationError(apiErrorMessage("invalid_location", 422));
      const input = event.currentTarget.elements.namedItem("location");
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    setLocationError("");
    setQuery((old) => ({ ...old, location, cursors: [] }));
    setSelectedId("");
    setAccountFor(null);
  }
  return (
    <PublicShell>
      <main id="main" className="container nearby-page">
        <PageHeading title="What is needed nearby?" />
        <div className="row wrap needs-toolbar">
          <form className="row wrap needs-search" onSubmit={search}>
            <Field
              label="Town or postcode (optional)"
              name="location"
              maxLength={200}
              error={locationError}
              aria-describedby="location-hint"
              onChange={() => setLocationError("")}
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
          <div
            className="segmented category-filter"
            role="group"
            aria-label="Category"
          >
            {[["", "All"], ...Object.entries(categories)].map(
              ([category, label]) => (
                <Button
                  key={category}
                  variant="soft"
                  aria-pressed={query.category === category}
                  onClick={() => {
                    setQuery((old) => ({
                      ...old,
                      category: category as Query["category"],
                      cursors: [],
                    }));
                    setSelectedId("");
                    setAccountFor(null);
                  }}
                >
                  {label}
                </Button>
              ),
            )}
          </div>
        </div>
        <p id="location-hint" className="meta muted needs-note">
          Use a town or a 5-digit postcode, or leave it blank to see all needs.
        </p>
        {loading ? (
          <p role="status">Loading needs…</p>
        ) : current.error ? (
          <Card className="stack">
            <p role="alert">{current.error}</p>
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setRetry((value) => value + 1);
              }}
            >
              Retry
            </Button>
          </Card>
        ) : !needs.length ? (
          <p role="status">
            No open needs match this search. Try another town or category.
          </p>
        ) : (
          <div className="needs-layout">
            <div className="needs-results stack">
              <ul className="stack" aria-label="Nearby needs">
                {needs.map((need) => (
                  <li key={need.id}>
                    <button
                      type="button"
                      className={`need-row ${selected?.id === need.id ? "selected" : ""}`}
                      aria-pressed={selected?.id === need.id}
                      aria-controls="need-detail"
                      onClick={() => {
                        setSelectedId(need.id);
                        setAccountFor(null);
                        document
                          .getElementById("need-detail")
                          ?.scrollIntoView?.({ block: "nearest" });
                      }}
                    >
                      <span className="need-row-heading">
                        <span>
                          <strong>{needTitle(need)}</strong>
                          <span className="meta muted">
                            {need.association.name},{" "}
                            {need.association.display_address}
                          </span>
                        </span>
                        <Chip>{categories[need.category]}</Chip>
                      </span>
                      <span className="row wrap need-meta">
                        {need.distance_km !== null && (
                          <span>{need.distance_km.toFixed(1)} km</span>
                        )}
                        <span>
                          {formatCount(need.available_quantity)} still needed
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {(query.cursors.length > 0 || current.page?.page.has_more) && (
                <nav className="row" aria-label="Results pages">
                  <Button
                    variant="outline"
                    disabled={!query.cursors.length}
                    onClick={() =>
                      setQuery((old) => ({
                        ...old,
                        cursors: old.cursors.slice(0, -1),
                      }))
                    }
                  >
                    Previous
                  </Button>
                  <span className="meta">Page {query.cursors.length + 1}</span>
                  <Button
                    variant="outline"
                    disabled={
                      !current.page?.page.has_more ||
                      !current.page.page.next_cursor
                    }
                    onClick={() => {
                      const cursor = current.page?.page.next_cursor;
                      if (cursor)
                        setQuery((old) => ({
                          ...old,
                          cursors: [...old.cursors, cursor],
                        }));
                    }}
                  >
                    Next
                  </Button>
                </nav>
              )}
            </div>
            {selected && (
              <aside
                id="need-detail"
                aria-label="Selected need"
                className="card need-detail stack-sm"
              >
                <Chip>{categories[selected.category]}</Chip>
                <h2>{needTitle(selected)}</h2>
                <p className="meta muted">
                  {selected.association.name},{" "}
                  {selected.association.display_address}
                </p>
                <dl className="facts-list">
                  <div>
                    <dt>Total requested</dt>
                    <dd>{formatCount(selected.target_quantity)}</dd>
                  </div>
                  <div>
                    <dt>Still needed</dt>
                    <dd>{formatCount(selected.available_quantity)}</dd>
                  </div>
                  {selected.distance_km !== null && (
                    <div>
                      <dt>Distance</dt>
                      <dd>{selected.distance_km.toFixed(1)} km</dd>
                    </div>
                  )}
                  {selected.seasons.length > 0 && (
                    <div>
                      <dt>Seasons</dt>
                      <dd>{selected.seasons.map(enumLabel).join(", ")}</dd>
                    </div>
                  )}
                  {Object.entries(selected.attributes)
                    .filter(
                      ([, value]) =>
                        value !== null &&
                        ["string", "number", "boolean"].includes(typeof value),
                    )
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt>{factLabel(key)}</dt>
                        <dd>{needAttribute(selected, key, value)}</dd>
                      </div>
                    ))}
                </dl>
                <p className="meta muted">
                  We check matching and availability when you prepare your item.
                </p>
                {user ? (
                  <LinkButton href={next}>Offer an item</LinkButton>
                ) : (
                  <Button
                    variant={accountFor === selected.id ? "soft" : "primary"}
                    aria-expanded={accountFor === selected.id}
                    aria-controls={`account-${selected.id}`}
                    onClick={() => setAccountFor(selected.id)}
                  >
                    Offer an item
                  </Button>
                )}
                {!user && accountFor === selected.id && (
                  <div
                    id={`account-${selected.id}`}
                    className="stack-sm"
                    role="region"
                    aria-label="Account needed to offer"
                  >
                    <p>Create an account or sign in to prepare your offer.</p>
                    <LinkButton href={accountHref("signup", next)}>
                      Create an account
                    </LinkButton>
                    <LinkButton
                      href={accountHref("login", next)}
                      variant="outline"
                    >
                      Sign in
                    </LinkButton>
                  </div>
                )}
              </aside>
            )}
          </div>
        )}
      </main>
    </PublicShell>
  );
}
