"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ConsoleTitle,
  ResourceStatus,
  useAssociation,
} from "@/components/association/shell";
import { useApiPage, useApiResource } from "@/lib/api-hooks";
import { api } from "@/lib/api";
import type {
  Booking,
  Capacity,
  Evidence as EvidenceDTO,
  ExpiryCounts,
  Need,
  Offer,
  StockLot,
} from "@/lib/api-contracts";
import { CATEGORY_LABELS } from "@/lib/labels";
import { formatCount } from "@/lib/ui-text";
import { CapacityMeter } from "@/components/ui/capacity-meter";
import { ExpiryChip, StateChip } from "@/components/association/status";
import { instant, itemName } from "@/components/association/evidence";
import { Icon, LinkButton } from "@/components/ui";
import "./dashboard.css";

function needTitle(need: Need) {
  const title = String(
    need.attributes.product ??
      need.attributes.type ??
      CATEGORY_LABELS[need.category],
  );
  return need.attributes.size ? `${title}, ${need.attributes.size}` : title;
}
/** Counts stay on the client: the API has no aggregate endpoint. */
function countLabel(resource: {
  data: unknown[];
  loading: boolean;
  hasMore: boolean;
}) {
  if (resource.loading) return null;
  return `${resource.data.length}${resource.hasMore ? "+" : ""}`;
}
export default function Dashboard() {
  const { id, association } = useAssociation();
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
  }).format(new Date());
  const offers = useApiPage<Offer>(
    `/associations/${id}/offers?effective_state=pending_review&limit=100`,
  );
  const arrivals = useApiPage<{ booking: Booking; offer: Offer }>(
    `/associations/${id}/arrivals?date=${day}&limit=100`,
  );
  const needs = useApiPage<Need>(`/associations/${id}/needs?limit=100`);
  const stock = useApiPage<StockLot>(
    `/associations/${id}/expiry?view=distribute_first&limit=5`,
  );
  const capacity = useApiPage<Capacity>(`/associations/${id}/capacity`);
  const counts = useApiResource<ExpiryCounts>(
    `/associations/${id}/expiry-counts`,
  );
  const urgent = counts.data?.buckets
    .filter((b) => ["today", "lt_7", "lt_30"].includes(b.key))
    .reduce((sum, b) => sum + b.count, 0);
  const uncovered = needs.data.filter(
    (need) => need.active && Number(need.computed.available_quantity) > 0,
  );
  const nearCapacity = capacity.data.filter((c) => {
    const limit = c.limit_storage_units;
    const used =
      c.computed.occupied_storage_units + c.computed.reserved_storage_units;
    return limit > 0 && used / limit > 0.85;
  });
  const waitingCount = countLabel(offers);
  const arrivalsCount = countLabel(arrivals);
  const uncoveredCount = countLabel({ ...needs, data: uncovered });
  const [medicineCount, setMedicineCount] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    const pending = offers.data
      .filter((offer) => offer.computed.effective_state === "pending_review")
      .slice(0, 8);
    const count = pending.length
      ? Promise.all(
          pending.map((offer) =>
            api<EvidenceDTO>(`/offers/${offer.id}/evidence`).catch(
              () => null as EvidenceDTO | null,
            ),
          ),
        ).then(
          (results) =>
            results.filter((evidence) =>
              evidence?.analyses.some((analysis) =>
                analysis.indicators.some(
                  (indicator) =>
                    indicator.key === "looks_like_medicine" &&
                    ((indicator.probability ?? 0) >= 0.5 ||
                      indicator.level === "high"),
                ),
              ),
            ).length,
        )
      : Promise.resolve(0);
    void count.then((value) => {
      if (active) setMedicineCount(value);
    });
    return () => {
      active = false;
    };
  }, [offers.data]);
  const oldestWaiting = offers.data.reduce<string | null>(
    (oldest, offer) =>
      oldest === null || offer.created_at < oldest ? offer.created_at : oldest,
    null,
  );
  return (
    <>
      <ConsoleTitle
        title="Dashboard"
        detail={`${association.name}, ${day}, Paris time`}
      />
      <nav
        className="console-metrics dashboard-metrics"
        aria-label="Today's priorities"
      >
        <Link
          className="card console-panel dashboard-action-card"
          href="/association/review"
        >
          {waitingCount && (
            <span className="console-metric num">{waitingCount}</span>
          )}
          <strong>Review offers</strong>
          <span className="console-meta">
            {waitingCount === null
              ? "Loading offers…"
              : offers.data.length
                ? `Oldest offer ${instant(oldestWaiting ?? "")}`
                : "No offers waiting"}
          </span>
        </Link>
        <Link
          className="card console-panel dashboard-action-card"
          href="/association/reception"
        >
          {arrivalsCount && (
            <span className="console-metric num">{arrivalsCount}</span>
          )}
          <strong>Receive drop-offs</strong>
          <span className="console-meta">
            {arrivalsCount === null
              ? "Loading appointments…"
              : arrivals.data.length
                ? "Appointments still awaiting reception"
                : "No drop-offs scheduled today."}
          </span>
        </Link>
        <Link
          className="card console-panel dashboard-action-card"
          href="/association/inventory"
        >
          {urgent !== undefined ? (
            <span className="console-metric num">{urgent}</span>
          ) : null}
          <strong>Distribute first</strong>
          <span className="console-meta">
            {urgent === undefined
              ? "Expiry priorities"
              : formatCount(urgent, "donation")}{" "}
            expiring within 30 days
          </span>
        </Link>
        <Link
          className="card console-panel dashboard-action-card"
          href="/association/needs"
        >
          {uncoveredCount && (
            <span className="console-metric num">{uncoveredCount}</span>
          )}
          <strong>Manage needs</strong>
          <span className="console-meta">
            {uncoveredCount === null
              ? "Loading needs…"
              : uncovered.length
                ? "After received and reserved items"
                : "No uncovered needs"}
          </span>
        </Link>
      </nav>
      {medicineCount ? (
        <div className="notice warning console-status-line dashboard-notice">
          <span className="row">
            <Icon name="warning" />
            {`${medicineCount} ${medicineCount === 1 ? "offer is" : "offers are"} flagged as a possible medicine. Review the indicators before accepting.`}
          </span>
          <LinkButton href="/association/review" variant="outline" size="sm">
            Open review
          </LinkButton>
        </div>
      ) : null}
      <div className="dashboard-grid">
        <section className="card console-panel dashboard-panel">
          <h2>Waiting for review</h2>
          <ResourceStatus {...offers} />
          {!offers.loading && !offers.error && !offers.data.length && (
            <p className="console-meta">No offers waiting for review.</p>
          )}
          <ul className="dashboard-preview-list">
            {offers.data.slice(0, 5).map((o) => (
              <li key={o.id}>
                <Link href="/association/review">
                  {itemName(o)} × {Number(o.quantity)}
                </Link>
                <div>
                  <span className="console-meta">
                    {CATEGORY_LABELS[o.category]}
                  </span>
                  {o.computed.manual_review_required && (
                    <span className="chip chip-caution">
                      Manual review required
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {offers.data.length > 5 && (
            <p className="console-meta">
              {formatCount(offers.data.length - 5, "more offer")} in Review.
            </p>
          )}
          <Link className="dashboard-section-link" href="/association/review">
            Open review
          </Link>
        </section>
        <section className="card console-panel dashboard-panel">
          <h2>Distribute first</h2>
          <ResourceStatus {...stock} />
          <ResourceStatus {...counts} />
          {!stock.loading && !stock.error && !stock.data.length && (
            <p className="console-meta">No stock awaiting distribution.</p>
          )}
          <ul className="dashboard-preview-list">
            {stock.data.map((lot) => (
              <li key={lot.receipt.id}>
                <strong>
                  {itemName(lot.offer)} × {Number(lot.remaining_quantity)}
                </strong>
                <ExpiryChip expiry={lot.expiry} />
              </li>
            ))}
          </ul>
          {stock.hasMore && (
            <p className="console-meta">
              More stock is available in the distribution list.
            </p>
          )}
          <Link
            className="dashboard-section-link"
            href="/association/inventory"
          >
            Open stock
          </Link>
        </section>
        <section className="card console-panel dashboard-panel">
          <h2>Today&apos;s drop-offs</h2>
          <ResourceStatus {...arrivals} />
          {!arrivals.loading && !arrivals.error && !arrivals.data.length && (
            <p className="console-meta">No drop-offs scheduled today.</p>
          )}
          <ul className="dashboard-preview-list">
            {arrivals.data.slice(0, 5).map(({ booking, offer }) => (
              <li key={booking.id}>
                <div>
                  <strong>{itemName(offer)}</strong>
                  <p className="console-meta">
                    {instant(booking.computed.starts_at)},{" "}
                    {formatCount(offer.quantity)}
                  </p>
                </div>
                <StateChip state={booking.computed.effective_state} />
              </li>
            ))}
          </ul>
          {arrivals.data.length > 5 && (
            <p className="console-meta">
              {formatCount(arrivals.data.length - 5, "more appointment")} in
              reception.
            </p>
          )}
          <Link
            className="dashboard-section-link"
            href="/association/reception"
          >
            Open reception
          </Link>
        </section>
        <section className="card console-panel dashboard-panel dashboard-capacity">
          <h2>Storage capacity</h2>
          <ResourceStatus {...capacity} />
          {!capacity.loading && !capacity.error && !capacity.data.length && (
            <p className="console-meta">No storage limits configured.</p>
          )}
          {!capacity.loading && !capacity.error && nearCapacity.length > 0 && (
            <p className="console-meta">
              {nearCapacity.length === 1
                ? "1 category is above 85% capacity, including reservations."
                : `${nearCapacity.length} categories are above 85% capacity, including reservations.`}
            </p>
          )}
          <div className="dashboard-capacity-grid">
            {capacity.data.map((c) => (
              <CapacityMeter
                key={c.category}
                label={CATEGORY_LABELS[c.category]}
                inStock={String(c.computed.occupied_storage_units)}
                reserved={String(c.computed.reserved_storage_units)}
                limit={String(c.limit_storage_units)}
                description={`${c.computed.occupied_storage_units} occupied, ${c.computed.reserved_storage_units} reserved, ${c.computed.available_storage_units} available places`}
              />
            ))}
          </div>
          <Link className="dashboard-section-link" href="/association/capacity">
            View capacity and intake
          </Link>
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="card console-panel dashboard-panel">
          <h2>Active needs</h2>
          <ResourceStatus {...needs} />
          {!needs.loading && !needs.error && !uncovered.length && (
            <p className="console-meta">No active needs.</p>
          )}
          <div className="dashboard-list">
            {uncovered.slice(0, 5).map((need) => {
              const received = Number(need.computed.fulfilled_quantity);
              const reserved = Number(need.computed.held_quantity);
              const stillNeeded = Number(need.computed.available_quantity);
              const target = Number(need.target_quantity);
              return (
                <div className="dashboard-need" key={need.id}>
                  <strong>{needTitle(need)}</strong>
                  <span className="console-meta">
                    {formatCount(need.target_quantity)} needed
                  </span>
                  <progress
                    value={Math.min(received, target)}
                    max={target || 1}
                    aria-label={`${needTitle(need)} received`}
                    aria-valuetext={`${received} received of ${target}, reserved ${reserved}, ${stillNeeded} still needed`}
                  />
                  <dl className="dashboard-need-counts">
                    <div>
                      <dt>Received</dt>
                      <dd>{received}</dd>
                    </div>
                    <div>
                      <dt>Reserved</dt>
                      <dd>{reserved}</dd>
                    </div>
                    <div>
                      <dt>Still needed</dt>
                      <dd>{stillNeeded}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
          {uncovered.length > 5 && (
            <p className="console-meta">
              {formatCount(uncovered.length - 5, "more active need")} in Needs.
            </p>
          )}
          <Link className="dashboard-section-link" href="/association/needs">
            Review needs
          </Link>
        </section>
      </div>
    </>
  );
}
