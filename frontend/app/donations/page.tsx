"use client";
import "@/components/donor/donation-flow.css";
import { useState } from "react";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import {
  Button,
  EmptyState,
  PageHeading,
  LinkButton,
  Icon,
} from "@/components/ui";
import { DataTable } from "@/components/ui/data-table";
import { useAuth } from "@/lib/auth-context";
import { useApiPage } from "@/lib/api-hooks";
import type { Donation } from "@/lib/api-contracts";
import { itemName, categories } from "@/components/donor/api-donation";
import {
  DonationRow,
  DonationStatusChip,
  donationNextStep,
} from "@/components/donor/donation-row";
import { formatCount } from "@/lib/ui-text";

type StatusFilter = "all" | "draft" | "offered" | "received" | "withdrawn";
const STATUS_FILTERS: [StatusFilter, string][] = [
  ["all", "All"],
  ["draft", "Drafts"],
  ["offered", "Offered"],
  ["received", "Received"],
  ["withdrawn", "Withdrawn"],
];
function filterKey(donation: Donation): StatusFilter {
  if (donation.computed.inventory_state !== "unreceived") return "received";
  if (donation.status === "withdrawn") return "withdrawn";
  if (donation.computed.active_offer_id) return "offered";
  if (donation.status === "draft") return "draft";
  return "all";
}
function createdLabel(donation: Donation) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(donation.created_at));
}
export default function Donations() {
  const auth = useAuth();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const items = useApiPage<Donation>(auth.user ? "/donations?limit=100" : null);
  const rows = items.data.filter(
    (donation) => filter === "all" || filterKey(donation) === filter,
  );
  const statusFilters = (
    <div className="segmented" role="group" aria-label="Donation status">
      {STATUS_FILTERS.map(([key, label]) => (
        <Button
          key={key}
          type="button"
          variant="soft"
          aria-pressed={filter === key}
          onClick={() => {
            setFilter(key);
            setSelected(null);
          }}
        >
          {label}
        </Button>
      ))}
    </div>
  );
  return (
    <PublicShell>
      <main id="main" className="container">
        <PageHeading title="My donations">
          <LinkButton href="/donate">New donation</LinkButton>
        </PageHeading>
        {auth.loading ? (
          <p role="status">Loading your account…</p>
        ) : !auth.user ? (
          <EmptyState title="Sign in to view your donations">
            <LinkButton href="/login">Sign in</LinkButton>
          </EmptyState>
        ) : (
          <div className="stack">
            {items.error && (
              <p role="alert">
                {items.error}{" "}
                <Button variant="outline" onClick={() => void items.refresh()}>
                  Retry
                </Button>
              </p>
            )}
            {items.loading && <p role="status">Loading donations…</p>}
            {!items.loading && !items.error && !items.data.length ? (
              <EmptyState title="No donations yet">
                <LinkButton href="/donate" size="app">
                  Photograph an item
                </LinkButton>
              </EmptyState>
            ) : (
              <>
                <DataTable
                  rows={rows}
                  pageSize={10}
                  getRowId={(donation) => donation.id}
                  getRowLabel={(donation) => itemName(donation.facts)}
                  searchLabel="Search donations"
                  searchText={(donation) =>
                    `${itemName(donation.facts)} ${categories[donation.facts.category ?? "clothes"]} ${createdLabel(donation)}`
                  }
                  filters={statusFilters}
                  emptyMessage="No donations in this view."
                  selectedRowId={selected}
                  onSelectionChange={setSelected}
                  columns={[
                    {
                      id: "item",
                      label: "Item",
                      width: "34%",
                      sortValue: (donation) => itemName(donation.facts),
                      cell: (donation) => (
                        <>
                          <strong>{itemName(donation.facts)}</strong>
                          <p className="meta muted">
                            {formatCount(donation.facts.quantity)},{" "}
                            {categories[donation.facts.category ?? "clothes"]}
                          </p>
                        </>
                      ),
                    },
                    {
                      id: "created",
                      label: "Created",
                      width: "14%",
                      sortValue: (donation) => Date.parse(donation.created_at),
                      cell: createdLabel,
                    },
                    {
                      id: "status",
                      label: "Status",
                      width: "20%",
                      cell: (donation) => (
                        <DonationStatusChip donation={donation} />
                      ),
                    },
                    {
                      id: "next",
                      label: "Next step",
                      width: "32%",
                      cell: (donation) => {
                        const next = donationNextStep(donation);
                        return next ? (
                          <Link className="text-link" href={next.href}>
                            {next.label} <Icon name="chevron-right" size={14} />
                          </Link>
                        ) : (
                          <span className="meta muted">—</span>
                        );
                      },
                    },
                  ]}
                  renderDetails={(donation) =>
                    selected === donation.id ? (
                      <DonationRow
                        donation={donation}
                        refresh={items.refresh}
                        compact
                      />
                    ) : null
                  }
                  renderMobileRow={(donation) => {
                    const next = donationNextStep(donation);
                    return (
                      <>
                        <strong>{itemName(donation.facts)}</strong>
                        <p className="meta muted">
                          {formatCount(donation.facts.quantity)},{" "}
                          {createdLabel(donation)}
                        </p>
                        <DonationStatusChip donation={donation} />
                        {next && (
                          <p>
                            <Link className="text-link" href={next.href}>
                              {next.label}
                            </Link>
                          </p>
                        )}
                      </>
                    );
                  }}
                />
                {items.hasMore && (
                  <Button
                    disabled={items.loading}
                    variant="outline"
                    onClick={() => void items.loadMore()}
                  >
                    Load more donations
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </PublicShell>
  );
}
