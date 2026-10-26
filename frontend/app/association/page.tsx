"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useAssociation } from "@/components/association/shell";
import { useApiPage, useApiResource } from "@/lib/api-hooks";
import { api } from "@/lib/api";
import type {
  Booking,
  Capacity,
  Evidence as EvidenceDTO,
  ExpiryBucket,
  ExpiryCounts,
  Need,
  Offer,
  StockLot,
} from "@/lib/api-contracts";
import { CATEGORY_LABELS } from "@/lib/labels";
import {
  enumLabel,
  formatCount,
  indicatorLabel,
  timeAgo,
} from "@/lib/ui-text";
import {
  CAPACITY_THRESHOLDS,
  capacityUsage,
} from "@/components/ui/capacity-meter-model";
import { useParisClock } from "@/components/ui/calendar";
import { ExpiryChip, StateChip } from "@/components/association/status";
import { instant, itemName } from "@/components/association/evidence";
import { Button, Chip, PageHeading } from "@/components/ui";
import "./dashboard.css";

/** Evidence is read per offer, so the medicine check stays bounded. */
const MEDICINE_CHECK_LIMIT = 8;
const REVIEW_SOON_MS = 24 * 60 * 60 * 1000;
const ATTENTION_ROWS_PER_KIND = 3;
const EXPIRING_BUCKETS: ExpiryBucket[] = ["today", "lt_7", "lt_30"];
const UNDER_SEVEN_BUCKETS: ExpiryBucket[] = ["today", "lt_7"];

type Arrival = { booking: Booking; offer: Offer };
type AttentionRow = {
  key: string;
  chip: ReactNode;
  title: string;
  detail?: string;
  href: string;
  action: string;
  /** Overflow rows stand for several flagged items. */
  items?: number;
};

const percent = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const parisTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
});
const parisDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const parisWeekday = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  weekday: "long",
});

function bucketTotal(counts: ExpiryCounts, keys: ExpiryBucket[]) {
  return counts.buckets
    .filter((bucket) => keys.includes(bucket.key))
    .reduce((sum, bucket) => sum + bucket.count, 0);
}
function quantityLabel(offer: Offer, quantity = offer.quantity) {
  return `${itemName(offer)} × ${Number(quantity)}`;
}
function closesIn(deadline: string, now: number) {
  const minutes = Math.max(1, Math.round((Date.parse(deadline) - now) / 60000));
  return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
}
function closesSoon(offer: Offer, now: number | null) {
  if (now === null) return false;
  const left = Date.parse(offer.review_deadline) - now;
  return left > 0 && left < REVIEW_SOON_MS;
}
function medicineIndicator(evidence: EvidenceDTO) {
  for (const analysis of evidence.analyses)
    for (const indicator of analysis.indicators)
      if (
        indicator.key === "looks_like_medicine" &&
        ((indicator.probability ?? 0) >= 0.5 || indicator.level === "high")
      )
        return indicator;
  return null;
}
function medicinePercent(probability: number | null) {
  return probability === null ? "high" : `${percent.format(probability * 100)}%`;
}

/** Reads evidence for the oldest pending offers; failed reads stay visible as failures. */
function useMedicineCheck(offers: Offer[], attempt: number) {
  const ids = offers
    .slice(0, MEDICINE_CHECK_LIMIT)
    .map((offer) => offer.id)
    .join(",");
  const [result, setResult] = useState<{
    key: string;
    flagged: Record<string, number | null>;
    failed: number;
  } | null>(null);
  const key = `${attempt}:${ids}`;
  useEffect(() => {
    let active = true;
    const list = ids ? ids.split(",") : [];
    void Promise.all(
      list.map((offerId) =>
        api<EvidenceDTO>(`/offers/${offerId}/evidence`).then(
          medicineIndicator,
          () => undefined,
        ),
      ),
    ).then((indicators) => {
      if (!active) return;
      const flagged: Record<string, number | null> = {};
      let failed = 0;
      indicators.forEach((indicator, index) => {
        if (indicator === undefined) failed++;
        else if (indicator) flagged[list[index]] = indicator.probability ?? null;
      });
      setResult({ key: `${attempt}:${ids}`, flagged, failed });
    });
    return () => {
      active = false;
    };
  }, [ids, attempt]);
  return result?.key === key ? result : null;
}

function StatusCount({
  href,
  value,
  singular,
  plural,
  detail,
  tone,
  loading,
  error,
  more = false,
}: {
  href: string;
  value: number;
  singular: string;
  plural: string;
  detail: string;
  tone?: "amber" | "orange";
  loading: boolean;
  error: string | null;
  more?: boolean;
}) {
  return (
    <Link className="dashboard-count" href={href}>
      {loading ? (
        <span className="dashboard-count-value is-loading">
          <span className="sr-only">Loading</span>
        </span>
      ) : error ? (
        <span className="dashboard-count-value is-error">Couldn’t load</span>
      ) : (
        <span
          className={`dashboard-count-value num ${tone && value > 0 ? `is-${tone}` : ""}`}
        >
          {value}
          {more ? "+" : ""}
        </span>
      )}
      <span className="dashboard-count-label">
        {value === 1 && !more && !loading && !error ? singular : plural}
      </span>
      <span className="console-meta" aria-hidden={loading || !!error}>
        {loading || error ? "\u00a0" : detail}
      </span>
    </Link>
  );
}

export default function Dashboard() {
  const { id } = useAssociation();
  const { now, today } = useParisClock();
  const [attempt, setAttempt] = useState(0);
  const offers = useApiPage<Offer>(
    `/associations/${id}/offers?effective_state=pending_review&limit=100`,
  );
  const arrivals = useApiPage<Arrival>(
    today ? `/associations/${id}/arrivals?date=${today}&limit=100` : null,
  );
  const needs = useApiPage<Need>(`/associations/${id}/needs?limit=100`);
  const stock = useApiPage<StockLot>(
    `/associations/${id}/expiry?view=distribute_first&limit=5`,
  );
  const capacity = useApiPage<Capacity>(`/associations/${id}/capacity`);
  const counts = useApiResource<ExpiryCounts>(
    `/associations/${id}/expiry-counts`,
  );

  const pending = offers.data
    .filter((offer) => offer.computed.effective_state === "pending_review")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const medicine = useMedicineCheck(pending, attempt);
  const flagged = medicine?.flagged ?? {};

  const arrivalsLoading = !today || arrivals.loading;
  const booked = arrivals.data
    .filter(({ booking }) => booking.computed.effective_state === "booked")
    .sort((a, b) =>
      a.booking.computed.starts_at.localeCompare(b.booking.computed.starts_at),
    );
  const nextBooked =
    now === null
      ? undefined
      : booked.find(
          ({ booking }) => Date.parse(booking.computed.ends_at) > now,
        );
  const otherArrivals = arrivals.data
    .filter(({ booking }) => booking.computed.effective_state !== "booked")
    .sort((a, b) =>
      a.booking.computed.starts_at.localeCompare(b.booking.computed.starts_at),
    );
  const dayArrivals = [...booked, ...otherArrivals];

  const activeNeeds = needs.data.filter((need) => need.active);
  const openNeeds = activeNeeds.filter(
    (need) => Number(need.computed.available_quantity) > 0,
  );

  const attention: AttentionRow[] = [];
  for (const offer of pending.filter((offer) => offer.id in flagged))
    attention.push({
      key: `medicine-${offer.id}`,
      chip: (
        <Chip variant="danger">Medicine {medicinePercent(flagged[offer.id])}</Chip>
      ),
      title: quantityLabel(offer),
      detail: `Waiting for review since ${parisDate.format(new Date(offer.created_at))}`,
      href: "/association/review",
      action: "Open review",
    });
  for (const row of capacity.data) {
    const usage = capacityUsage(
      row.computed.occupied_storage_units,
      row.computed.reserved_storage_units,
      row.limit_storage_units,
    );
    if (usage.tone !== "danger" || usage.percentage === null) continue;
    // Whole percent, unless rounding would hide that the threshold was crossed.
    const shown =
      Math.round(usage.percentage) > CAPACITY_THRESHOLDS.danger
        ? Math.round(usage.percentage)
        : percent.format(usage.percentage);
    attention.push({
      key: `storage-${row.category}`,
      chip: <Chip variant="danger">Storage {shown}%</Chip>,
      title: CATEGORY_LABELS[row.category],
      detail: `${usage.used} of ${row.limit_storage_units} storage places used, ${row.computed.reserved_storage_units} reserved`,
      href: "/association/capacity",
      action: "Storage",
    });
  }
  function pushStock(
    buckets: ExpiryBucket[],
    overflow: { chip: ReactNode; noun: string; detail: string },
  ) {
    const lots = stock.data
      .filter((lot) => buckets.includes(lot.expiry.bucket))
      .slice(0, ATTENTION_ROWS_PER_KIND);
    for (const lot of lots)
      attention.push({
        key: `stock-${lot.receipt.id}`,
        chip: <ExpiryChip expiry={lot.expiry} />,
        title: quantityLabel(lot.offer, lot.remaining_quantity),
        detail: lot.expiry.distribution_restriction
          ? enumLabel(lot.expiry.distribution_restriction)
          : "In stock, distribute first",
        href: "/association/inventory",
        action: "Stock",
      });
    const rest = (counts.data ? bucketTotal(counts.data, buckets) : 0) - lots.length;
    if (rest > 0)
      attention.push({
        key: `stock-more-${buckets.join("-")}`,
        chip: overflow.chip,
        title: formatCount(rest, lots.length ? `more ${overflow.noun}` : overflow.noun),
        detail: overflow.detail,
        href: "/association/inventory",
        action: "Stock",
        items: rest,
      });
  }
  pushStock(["expired"], {
    chip: <Chip variant="danger">Expired</Chip>,
    noun: "expired donation",
    detail: enumLabel("date_passed"),
  });
  pushStock(UNDER_SEVEN_BUCKETS, {
    chip: <Chip variant="warning">Under 7 days</Chip>,
    noun: "donation",
    detail: "Expiring within 7 days",
  });
  const closing = pending.filter(
    (offer) => !(offer.id in flagged) && closesSoon(offer, now),
  );
  for (const offer of closing.slice(0, ATTENTION_ROWS_PER_KIND))
    attention.push({
      key: `review-${offer.id}`,
      chip: (
        <Chip variant="caution">
          Review closes in {closesIn(offer.review_deadline, now ?? 0)}
        </Chip>
      ),
      title: quantityLabel(offer),
      detail: `Offered ${instant(offer.created_at)}`,
      href: "/association/review",
      action: "Open review",
    });
  if (closing.length > ATTENTION_ROWS_PER_KIND)
    attention.push({
      key: "review-more",
      chip: <Chip variant="caution">Within 24 h</Chip>,
      title: formatCount(closing.length - ATTENTION_ROWS_PER_KIND, "more offer"),
      detail: "Review window closes within 24 hours",
      href: "/association/review",
      action: "Open review",
      items: closing.length - ATTENTION_ROWS_PER_KIND,
    });
  const attentionItems = attention.reduce((sum, row) => sum + (row.items ?? 1), 0);

  const attentionSources = [offers, capacity, stock, counts];
  const checking =
    now === null ||
    attentionSources.some((source) => source.loading) ||
    (pending.length > 0 && medicine === null);
  const attentionIncomplete =
    attentionSources.some((source) => source.error) || (medicine?.failed ?? 0) > 0;
  const failedSources = [...attentionSources, arrivals, needs].filter(
    (source) => source.error,
  );
  const incomplete = failedSources.length > 0 || attentionIncomplete;

  function offerChip(offer: Offer) {
    if (offer.id in flagged)
      return (
        <Chip variant="danger">
          {indicatorLabel("looks_like_medicine")} {medicinePercent(flagged[offer.id])}
        </Chip>
      );
    if (offer.computed.manual_review_required)
      return <Chip variant="caution">Manual review required</Chip>;
    if (closesSoon(offer, now))
      return (
        <Chip variant="caution">
          Review closes in {closesIn(offer.review_deadline, now ?? 0)}
        </Chip>
      );
    return null;
  }

  return (
    <>
      <PageHeading title="Today">
        {now !== null && (
          <span className="console-meta">
            {parisWeekday.format(now)} {parisDate.format(now)}
          </span>
        )}
      </PageHeading>

      <nav className="dashboard-status" aria-label="Today's counts">
        <StatusCount
          href="/association/review"
          value={pending.length}
          more={offers.hasMore}
          singular="offer awaiting review"
          plural="offers awaiting review"
          detail={
            pending.length && now !== null
              ? Date.parse(pending[0].created_at) > now - 60000
                ? "Just submitted"
                : `Waiting for ${timeAgo(pending[0].created_at, now).replace(/ ago$/, "")}`
              : "None waiting"
          }
          tone="amber"
          loading={offers.loading}
          error={offers.error}
        />
        <StatusCount
          href="/association/reception"
          value={booked.length}
          more={arrivals.hasMore}
          singular="drop-off expected today"
          plural="drop-offs expected today"
          detail={
            nextBooked
              ? `Next at ${parisTime.format(new Date(nextBooked.booking.computed.starts_at))}`
              : booked.length
                ? "Awaiting reception"
                : "No active bookings"
          }
          loading={arrivalsLoading}
          error={arrivals.error}
        />
        <StatusCount
          href="/association/inventory"
          value={counts.data ? bucketTotal(counts.data, EXPIRING_BUCKETS) : 0}
          singular="donation expiring in under 30 days"
          plural="donations expiring in under 30 days"
          detail={
            counts.data && bucketTotal(counts.data, UNDER_SEVEN_BUCKETS)
              ? `${bucketTotal(counts.data, UNDER_SEVEN_BUCKETS)} ${bucketTotal(counts.data, UNDER_SEVEN_BUCKETS) === 1 ? "expires" : "expire"} in under 7 days`
              : "None under 7 days"
          }
          tone="orange"
          loading={counts.loading}
          error={counts.error}
        />
        <StatusCount
          href="/association/needs"
          value={openNeeds.length}
          more={needs.hasMore}
          singular="open need"
          plural="open needs"
          detail={
            openNeeds.length
              ? "Still accepting donations"
              : "No unmet quantities"
          }
          loading={needs.loading}
          error={needs.error}
        />
      </nav>

      <section
        className="card console-panel dashboard-attention"
        aria-labelledby="dashboard-attention-title"
      >
        <div className="dashboard-panel-title">
          <h2 id="dashboard-attention-title">Needs attention</h2>
          {attentionItems > 0 && (
            <span className="console-meta">{attentionItems}</span>
          )}
        </div>
        {attention.length > 0 && (
          <ul className="dashboard-rows">
            {attention.map((row) => (
              <li key={row.key}>
                <Link className="dashboard-row dashboard-row-link" href={row.href}>
                  <span className="dashboard-row-tag">{row.chip}</span>
                  <span className="dashboard-row-text">
                    <span>{row.title}</span>
                    {row.detail && (
                      <span className="console-meta">{row.detail}</span>
                    )}
                  </span>
                  <span className="dashboard-link">{row.action}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {checking && !attention.length && (
          <p className="console-meta dashboard-quiet" role="status">
            Checking offers, storage and stock…
          </p>
        )}
        {!checking && !attentionIncomplete && !attention.length && (
          <p className="dashboard-calm">Nothing needs attention right now.</p>
        )}
        {incomplete && (
          <div className="dashboard-incomplete" role="status">
            <p>Some data couldn’t load, so counts and lists may be incomplete.</p>
            <Button
              variant="outline"
              onClick={() => {
                setAttempt((value) => value + 1);
                void Promise.all(failedSources.map((source) => source.refresh()));
              }}
            >
              Retry
            </Button>
          </div>
        )}
        {!checking && pending.length > MEDICINE_CHECK_LIMIT && (
          <p className="console-meta dashboard-quiet">
            Medicine indicators were checked for the {MEDICINE_CHECK_LIMIT}{" "}
            oldest offers.
          </p>
        )}
      </section>

      <div className="dashboard-columns">
        <section
          className="card console-panel dashboard-panel"
          aria-labelledby="dashboard-dropoffs-title"
        >
          <div className="dashboard-panel-title">
            <h2 id="dashboard-dropoffs-title">Today&apos;s drop-offs</h2>
            {!arrivalsLoading && !arrivals.error && arrivals.data.length > 0 && (
              <span className="console-meta">{booked.length} expected</span>
            )}
          </div>
          {arrivalsLoading ? (
            <p className="console-meta dashboard-quiet" role="status">
              Loading today’s drop-offs…
            </p>
          ) : arrivals.error ? (
            <p className="dashboard-quiet dashboard-failed">
              Couldn’t load today’s drop-offs.
            </p>
          ) : (
            !arrivals.data.length && (
              <p className="console-meta dashboard-quiet">No drop-offs today.</p>
            )
          )}
          <ul className="dashboard-rows">
            {dayArrivals.slice(0, 5).map(({ booking, offer }) => (
              <li
                className={`dashboard-row ${booking.computed.effective_state === "booked" ? "" : "is-past"}`}
                key={booking.id}
              >
                <time
                  className="dashboard-time num"
                  dateTime={booking.computed.starts_at}
                >
                  {parisTime.format(new Date(booking.computed.starts_at))}
                </time>
                <div className="dashboard-row-text">
                  <span>{itemName(offer)}</span>
                  <span className="console-meta">
                    {formatCount(offer.quantity)}
                  </span>
                </div>
                <StateChip state={booking.computed.effective_state} />
              </li>
            ))}
          </ul>
          <div className="dashboard-panel-foot">
            <Link className="dashboard-link" href="/association/reception">
              Open reception
            </Link>
            {dayArrivals.length > 5 && (
              <span className="console-meta">
                {dayArrivals.length - 5}
                {arrivals.hasMore ? "+" : ""} more
              </span>
            )}
          </div>
        </section>

        <section
          className="card console-panel dashboard-panel"
          aria-labelledby="dashboard-review-title"
        >
          <div className="dashboard-panel-title">
            <h2 id="dashboard-review-title">Waiting for review</h2>
            {pending.length > 0 && (
              <span className="console-meta">Oldest first</span>
            )}
          </div>
          {offers.loading ? (
            <p className="console-meta dashboard-quiet" role="status">
              Loading offers…
            </p>
          ) : offers.error ? (
            <p className="dashboard-quiet dashboard-failed">
              Couldn’t load offers.
            </p>
          ) : (
            !pending.length && (
              <p className="console-meta dashboard-quiet">No offers waiting.</p>
            )
          )}
          <ul className="dashboard-rows">
            {pending.slice(0, 4).map((offer) => (
              <li className="dashboard-row" key={offer.id}>
                <div className="dashboard-row-text">
                  <span>{quantityLabel(offer)}</span>
                  <span className="console-meta">
                    {CATEGORY_LABELS[offer.category]}
                    {now !== null && `, ${timeAgo(offer.created_at, now)}`}
                  </span>
                </div>
                {offerChip(offer)}
              </li>
            ))}
          </ul>
          <div className="dashboard-panel-foot">
            <Link className="dashboard-link" href="/association/review">
              Open review
            </Link>
            {pending.length > 4 && (
              <span className="console-meta">
                {pending.length - 4}
                {offers.hasMore ? "+" : ""} more
              </span>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
