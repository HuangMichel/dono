"use client";
import { formatCount, indicatorLabel } from "@/lib/ui-text";
import { DataTable } from "@/components/ui/data-table";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { PublicShell } from "@/components/public-shell";
import {
  Button,
  Chip,
  EmptyState,
  PageHeading,
  LinkButton,
  Icon,
} from "@/components/ui";
import { useDemo } from "@/lib/demo-context";
import {
  STATUS_LABELS,
  isPostedOffer,
  DEMO_DONOR_ID,
  CATEGORY_LABELS,
  getWarnings,
  getReceptionRefusal,
} from "@/lib/demo-store";
import type { Donation } from "@/lib/contracts";
function DonationStatus({ donation }: { donation: Donation }) {
  const { state } = useDemo();
  const refusedAtReception = Boolean(getReceptionRefusal(state, donation.id));
  return (
    <Chip
      variant={
        ["approved", "booked", "received", "distributed"].includes(
          donation.status,
        )
          ? "success"
          : donation.status === "refused"
            ? "danger"
            : donation.status === "offered"
              ? "caution"
              : "neutral"
      }
    >
      {isPostedOffer(state, donation.id)
        ? "Posted"
        : refusedAtReception
          ? "Refused at reception"
          : STATUS_LABELS[donation.status]}
    </Chip>
  );
}
function NextAction({ donation }: { donation: Donation }) {
  const { state } = useDemo();
  if (donation.status === "draft")
    return (
      <Link className="text-link" href={"/donate?id=" + donation.id}>
        {isPostedOffer(state, donation.id) ? "View offer" : "Continue draft"}{" "}
        <Icon name="chevron-right" size={14} />
      </Link>
    );
  if (["approved", "booked"].includes(donation.status))
    return (
      <Link className="text-link" href={"/booking/" + donation.id}>
        {donation.status === "approved" ? "Book a drop-off" : "View pass"}
        <Icon name="chevron-right" size={14} />
      </Link>
    );
  return null;
}
function DonationEvidence({ donation: d }: { donation: Donation }) {
  const { state } = useDemo();
  const refusal = getReceptionRefusal(state, d.id);
  return (
    <div className="stack-sm donation-evidence">
      {refusal && (
        <>
          <strong>Refused at reception</strong>
          <p>{refusal.reason}</p>
          <p className="meta muted">
            Staff {refusal.refused_by},{" "}
            {new Intl.DateTimeFormat("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Europe/Paris",
            }).format(new Date(refusal.refused_at))}
            , Paris time.
          </p>
          <p className="meta muted">
            Original approval by staff {refusal.original_approval.decided_by},{" "}
            {new Intl.DateTimeFormat("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Europe/Paris",
            }).format(new Date(refusal.original_approval.decided_at))}
            .
          </p>
          <p className="meta muted">
            Staff refused {formatCount(refusal.original_quantity)} at reception.
            Nothing was added to stock.
          </p>
        </>
      )}
      {d.decision && !refusal && (
        <p className="notice">
          {d.decision === "approved" ? "Approved" : "Refused"} by association
          staff,{" "}
          {new Intl.DateTimeFormat("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Europe/Paris",
          }).format(new Date(d.decided_at!))}
          , Paris time.
        </p>
      )}
      {d.status === "refused" && !refusal && (
        <p className="meta muted">
          This offer was refused by staff. A new offer for the same item is
          unavailable.
        </p>
      )}
      {getWarnings(state, d.id).map((w) => (
        <p className="notice warning" key={w}>
          {w === "medicine_concern"
            ? "Medicine concern remains in the original evidence. Return medicines to a pharmacy."
            : "Chilled food concern remains in the original evidence."}
        </p>
      ))}
      {state.analyses
        .filter((a) => a.donation_id === d.id)
        .map((a) => (
          <div key={a.id}>
            <strong>Original sample evidence</strong>
            <p className="meta muted">
              {CATEGORY_LABELS[a.category]}, {a.model}, confidence{" "}
              {new Intl.NumberFormat("en", {
                style: "percent",
                maximumFractionDigits: 1,
              }).format(a.confidence)}
            </p>
            {a.indicators.map((i) => (
              <p key={i.key} className="meta">
                {indicatorLabel(i.key)}:{" "}
                {i.probability !== undefined
                  ? new Intl.NumberFormat("en", {
                      style: "percent",
                      maximumFractionDigits: 1,
                    }).format(i.probability)
                  : i.value}
              </p>
            ))}
          </div>
        ))}
      {state.receipt_originals[d.id] && (
        <p className="meta muted">
          Originally offered: {formatCount(state.receipt_originals[d.id])}.
          Received: {formatCount(d.quantity)}. This donation is complete.
        </p>
      )}
    </div>
  );
}
export default function Donations() {
  const { state, ready } = useDemo(),
    [filter, setFilter] = useState("all"),
    [expanded, setExpanded] = useState<string | null>(null);
  const donations = state.donations.filter(
    (d) =>
      d.donor_id === DEMO_DONOR_ID &&
      (filter === "all" ||
        (filter === "posted"
          ? isPostedOffer(state, d.id)
          : d.status === filter && !isPostedOffer(state, d.id))),
  );
  const name = (d: Donation) =>
    String(d.attributes.product ?? CATEGORY_LABELS[d.category!]);
  const association = (d: Donation) =>
    isPostedOffer(state, d.id)
      ? "Available to associations"
      : (state.associations.find((a) => a.id === d.association_id)?.name ??
        "Not offered yet");
  const sent = (d: Donation) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "Europe/Paris",
    }).format(new Date(d.created_at));
  const statusFilters = (
    <div className="segmented donation-filters">
      {[
        ["all", "All"],
        ["draft", "Drafts"],
        ["posted", "Posted"],
        ["offered", "Waiting for review"],
        ["approved", "Ready to book"],
        ["booked", "Appointments"],
      ].map(([key, label]) => (
        <Button
          key={key}
          variant="soft"
          aria-pressed={filter === key}
          onClick={() => setFilter(key)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
  return (
    <PublicShell>
      <main id="main" className="container donations-page">
        <PageHeading title="My donations">
          <LinkButton href="/donate">New donation</LinkButton>
        </PageHeading>
        {!ready ? (
          <p aria-busy="true">Loading your donations…</p>
        ) : state.role !== "donor" ? (
          <EmptyState title="Your donor view">
            <p>Choose the donor demo role to view your fictional donations.</p>
            <LinkButton href="/login">Choose donor demo</LinkButton>
          </EmptyState>
        ) : (
          <>
            {state.donations.length ? (
              <DataTable
                filters={statusFilters}
                rows={donations}
                getRowId={(d) => d.id}
                getRowLabel={name}
                searchLabel="Search donations"
                searchText={(d) => {
                  const refusal = getReceptionRefusal(state, d.id);
                  return `${name(d)} ${association(d)} ${isPostedOffer(state, d.id) ? "Posted Available" : STATUS_LABELS[d.status]} ${d.company_name ?? ""} ${refusal ? "Refused at reception " + refusal.reason : ""}`;
                }}
                emptyMessage="No donations in this view."
                rowClassName={(d) =>
                  d.status === "approved" ? "ready-row" : ""
                }
                columns={[
                  {
                    id: "item",
                    label: "Item",
                    sortValue: name,
                    cell: (d) => (
                      <>
                        <button
                          className="table-item"
                          aria-expanded={expanded === d.id}
                          onClick={() =>
                            setExpanded(expanded === d.id ? null : d.id)
                          }
                        >
                          {name(d)}
                          <Icon
                            name={
                              expanded === d.id
                                ? "chevron-down"
                                : "chevron-right"
                            }
                            size={14}
                          />
                        </button>
                        <span className="meta muted block">
                          {formatCount(d.quantity, "unit")}
                          {d.donor_kind === "company"
                            ? ", " + d.company_name
                            : ""}
                        </span>
                      </>
                    ),
                  },
                  {
                    id: "association",
                    label: "Association",
                    sortValue: association,
                    cell: association,
                  },
                  {
                    id: "created",
                    label: "Created",
                    sortValue: (d) => Date.parse(d.created_at),
                    cell: sent,
                  },
                  {
                    id: "status",
                    label: "Status",
                    sortValue: (d) =>
                      isPostedOffer(state, d.id)
                        ? "Posted"
                        : STATUS_LABELS[d.status],
                    cell: (d) => <DonationStatus donation={d} />,
                  },
                  {
                    id: "next",
                    label: "Next step",
                    cell: (d) => <NextAction donation={d} />,
                  },
                ]}
                renderDetails={(d) =>
                  expanded === d.id ? <DonationEvidence donation={d} /> : null
                }
                renderMobileRow={(d) => (
                  <>
                    <button
                      className="donation-mobile-row"
                      aria-expanded={expanded === d.id}
                      onClick={() =>
                        setExpanded(expanded === d.id ? null : d.id)
                      }
                    >
                      <Image
                        width={44}
                        height={44}
                        unoptimized
                        className="item-image"
                        src={"/item-" + d.category + ".svg"}
                        alt=""
                      />
                      <span className="donation-mobile-title">
                        <strong>{name(d)}</strong>
                        <span className="meta muted block">
                          {association(d)}, {sent(d)}
                        </span>
                      </span>
                      <DonationStatus donation={d} />
                    </button>
                    {expanded === d.id && (
                      <div className="mobile-donation-detail">
                        <NextAction donation={d} />
                        <DonationEvidence donation={d} />
                      </div>
                    )}
                  </>
                )}
              />
            ) : (
              <>
                {statusFilters}
                <EmptyState title="No donations in this view">
                  <p>Prepare one item to get started.</p>
                  <LinkButton href="/donate" size="app">
                    Photograph an item
                  </LinkButton>
                </EmptyState>
              </>
            )}
          </>
        )}
      </main>
    </PublicShell>
  );
}
