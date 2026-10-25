"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDemo } from "@/lib/demo-context";
import {
  CATEGORY_LABELS,
  DEMO_ASSOCIATION_ID,
  getWarnings,
  type DemoNeed,
} from "@/lib/demo-store";
import { dashboardMetrics } from "@/lib/dashboard-metrics";
import { enumLabel, formatCount } from "@/lib/ui-text";
import { CapacityMeter } from "@/components/ui/capacity-meter";
import { Card, CardActions, Chip, Icon, LinkButton } from "@/components/ui";
import { ConsoleTitle } from "@/components/association/shell";
import { itemName } from "@/components/association/evidence";
import "./dashboard.css";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  weekday: "long",
  day: "numeric",
  month: "long",
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
});
function shortDate(day: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T12:00:00Z`));
}
function needTitle(need: DemoNeed) {
  const title = String(
    need.attributes.product ??
      need.attributes.type ??
      CATEGORY_LABELS[need.category],
  );
  return need.attributes.size ? `${title}, ${need.attributes.size}` : title;
}

function waitingTime(hours: number | null) {
  if (hours === null) return "Waiting time not recorded";
  if (hours < 1) return "Oldest offer: less than an hour";
  return `Oldest offer: ${hours < 24 ? formatCount(Math.floor(hours), "hour") : formatCount(Math.floor(hours / 24), "day")}`;
}

export default function DashboardPage() {
  const { state, ready } = useDemo();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const initial = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  if (!ready || !now)
    return (
      <>
        <ConsoleTitle title="Dashboard" />
        <p role="status" className="console-meta">
          Loading dashboard…
        </p>
      </>
    );
  const metrics = dashboardMetrics(state, DEMO_ASSOCIATION_ID, now);
  const medicineWarnings = metrics.offered.filter((donation) =>
    getWarnings(state, donation.id).includes("medicine_concern"),
  ).length;
  const cards = [
    {
      href: "/association/review",
      value: metrics.offered.length,
      label: "Offers waiting for review",
      detail: metrics.offered.length
        ? waitingTime(metrics.oldestWaitingHours)
        : "No offers waiting",
    },
    {
      href: "/association/reception",
      value: metrics.expectedToday.length,
      label: "Expected drop-offs today",
      detail: "Appointments still awaiting reception",
    },
    {
      href: "/association/needs",
      value: metrics.uncoveredNeedCount,
      label: "Needs still uncovered",
      detail: "After received and reserved items",
    },
    {
      href: "/association/capacity",
      value: metrics.nearCapacityCount,
      label: "Categories near capacity",
      detail: "Above 85%, including reservations",
    },
  ];
  const maxActivity = Math.max(
    1,
    ...metrics.week.days.flatMap((day) => [day.received, day.givenOut]),
  );
  const weekLabel = `${shortDate(metrics.week.startDay)} to ${shortDate(metrics.today)}`;
  return (
    <>
      <ConsoleTitle
        title="Dashboard"
        detail={`${dateFormatter.format(now)}, Paris time`}
      />
      <div className="console-metrics dashboard-metrics">
        {cards.map((card) => (
          <Link
            href={card.href}
            key={card.href}
            className="card console-panel dashboard-action-card"
          >
            <span className="console-metric num">{card.value}</span>
            <strong>{card.label}</strong>
            <span className="console-meta">{card.detail}</span>
          </Link>
        ))}
      </div>
      {metrics.unknownOfferAgeCount > 0 && (
        <p className="console-meta dashboard-age-note">
          Waiting time unavailable for{" "}
          {formatCount(metrics.unknownOfferAgeCount, "offer")}.
        </p>
      )}
      {medicineWarnings > 0 && (
        <div className="notice warning console-status-line dashboard-notice">
          <span className="row">
            <Icon name="warning" />
            {formatCount(medicineWarnings, "offer")}{" "}
            {medicineWarnings === 1 ? "has" : "have"} a medicine concern. Check
            the original evidence.
          </span>
          <LinkButton href="/association/review" variant="outline" size="sm">
            Open review
          </LinkButton>
        </div>
      )}
      <div className="dashboard-grid">
        <Card className="console-panel dashboard-panel">
          <h2>Capacity</h2>
          <div className="dashboard-list">
            {metrics.capacities.map((capacity) => (
              <CapacityMeter
                key={capacity.category}
                label={CATEGORY_LABELS[capacity.category]}
                inStock={String(capacity.inStock)}
                reserved={String(capacity.reserved)}
                limit={String(capacity.limit)}
                description={`${formatCount(capacity.inStock)} in stock, ${formatCount(capacity.reserved)} reserved, limit ${capacity.limit}`}
              />
            ))}
            {!metrics.capacities.length && (
              <p className="console-meta">No capacity limits configured.</p>
            )}
          </div>
          <CardActions>
            <LinkButton
              href="/association/capacity"
              variant="outline"
              size="sm"
            >
              Edit capacity <Icon name="arrow-right" />
            </LinkButton>
          </CardActions>
        </Card>
        <Card className="console-panel dashboard-panel">
          <h2>Active needs</h2>
          <div className="dashboard-list">
            {metrics.needs
              .slice(0, 5)
              .map(
                ({
                  need,
                  received,
                  reserved,
                  target,
                  stillNeeded,
                  receivedPercentage,
                }) => (
                  <div className="dashboard-need" key={need.id}>
                    <strong>{needTitle(need)}</strong>
                    {need.seasons && need.seasons.length > 0 && (
                      <span className="console-meta">
                        {need.seasons.map(enumLabel).join(", ")}
                      </span>
                    )}
                    <span className="console-meta">
                      {formatCount(target)} needed
                    </span>
                    <progress
                      value={Math.min(received, target)}
                      max={target || 1}
                      aria-label={`${needTitle(need)}${need.seasons?.length ? `, ${need.seasons.map(enumLabel).join(", ")}` : ""} received`}
                      aria-valuetext={`${formatCount(received)} received of ${formatCount(target)}, ${Math.round(receivedPercentage)}%`}
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
                ),
              )}
            {!metrics.needs.length && (
              <p className="console-meta">No active needs.</p>
            )}
            {metrics.needs.length > 5 && (
              <p className="console-meta">
                {formatCount(metrics.needs.length - 5, "more active need")}.
              </p>
            )}
          </div>
          <CardActions>
            <LinkButton href="/association/needs" variant="outline" size="sm">
              Review needs <Icon name="arrow-right" />
            </LinkButton>
          </CardActions>
        </Card>
        <Card className="console-panel dashboard-panel">
          <h2>Expected drop-offs today</h2>
          <p className="console-meta">{shortDate(metrics.today)}, Paris time</p>
          <div className="dashboard-list">
            {metrics.expectedToday
              .slice(0, 5)
              .map(({ booking, donation, slot }) => (
                <div className="dashboard-arrival" key={booking.id}>
                  <div>
                    <strong className="num">
                      {timeFormatter.format(new Date(slot.starts_at))}
                    </strong>
                    <span>{itemName(donation)}</span>
                    <span className="console-meta">
                      {formatCount(donation.quantity)}
                    </span>
                  </div>
                  <Chip variant="caution">Expected</Chip>
                </div>
              ))}
            {!metrics.expectedToday.length && (
              <p className="console-meta">
                No drop-offs awaiting reception today.
              </p>
            )}
            {metrics.expectedToday.length > 5 && (
              <p className="console-meta">
                {formatCount(
                  metrics.expectedToday.length - 5,
                  "more appointment",
                )}
                .
              </p>
            )}
          </div>
          <CardActions>
            <LinkButton
              href="/association/reception"
              variant="outline"
              size="sm"
            >
              Open reception <Icon name="arrow-right" />
            </LinkButton>
          </CardActions>
        </Card>
      </div>
      <div className="dashboard-week-heading">
        <h2>This week</h2>
        <span className="console-meta">
          {weekLabel}, up to {timeFormatter.format(now)} today, Paris time
        </span>
      </div>
      <div className="dashboard-week-grid">
        <Card className="console-panel dashboard-panel">
          <h2>Received and given out</h2>
          <p className="console-meta">
            {formatCount(metrics.week.received)} received,{" "}
            {formatCount(metrics.week.givenOut)} given out
          </p>
          <div className="dashboard-legend">
            <span>
              <i className="dashboard-received" />
              Received
            </span>
            <span>
              <i className="dashboard-given" />
              Given out
            </span>
          </div>
          <div
            className="dashboard-chart"
            role="img"
            aria-label={`Daily items, Monday to Sunday. ${metrics.week.days.map((day) => `${shortDate(day.date)}: ${day.received} received, ${day.givenOut} given out`).join(". ")}. Future days have no recorded activity.`}
          >
            {metrics.week.days.map((day) => (
              <div className="dashboard-chart-day" key={day.date}>
                <div className="dashboard-chart-pair">
                  <span
                    className="dashboard-received"
                    style={{ height: `${(day.received / maxActivity) * 100}%` }}
                  />
                  <span
                    className="dashboard-given"
                    style={{ height: `${(day.givenOut / maxActivity) * 100}%` }}
                  />
                </div>
                <span className="console-meta">
                  {new Intl.DateTimeFormat("en-GB", {
                    weekday: "short",
                    timeZone: "UTC",
                  }).format(new Date(`${day.date}T12:00:00Z`))}
                </span>
              </div>
            ))}
          </div>
          <details className="dashboard-daily-details">
            <summary>Daily quantities</summary>
            <table className="dashboard-table">
              <caption className="sr-only">
                Daily items received and given out this week
              </caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Received</th>
                  <th>Given out</th>
                </tr>
              </thead>
              <tbody>
                {metrics.week.days
                  .filter((day) => day.date <= metrics.today)
                  .map((day) => (
                    <tr key={day.date}>
                      <th scope="row">{shortDate(day.date)}</th>
                      <td>{day.received}</td>
                      <td>{day.givenOut}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </details>
          {metrics.week.unknownMovementTimeCount > 0 && (
            <p className="console-meta">
              {formatCount(
                metrics.week.unknownMovementTimeCount,
                "inventory record",
              )}{" "}
              without a valid date excluded from this week.
            </p>
          )}
        </Card>
        <Card className="console-panel dashboard-panel">
          <h2>By category</h2>
          <table className="dashboard-table">
            <caption className="sr-only">
              Items received and given out by category this week
            </caption>
            <thead>
              <tr>
                <th>Category</th>
                <th>Received</th>
                <th>Given out</th>
              </tr>
            </thead>
            <tbody>
              {metrics.week.byCategory.map((row) => (
                <tr key={row.category}>
                  <th scope="row">{CATEGORY_LABELS[row.category]}</th>
                  <td>{row.received}</td>
                  <td>{row.givenOut}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <CardActions>
            <LinkButton
              href="/association/inventory"
              variant="outline"
              size="sm"
            >
              Open stock <Icon name="arrow-right" />
            </LinkButton>
          </CardActions>
        </Card>
        <Card className="console-panel dashboard-panel">
          <h2>Refused at reception</h2>
          <p className="dashboard-refusal-total">
            {formatCount(metrics.week.refusals.length, "drop-off")}
          </p>
          <div className="dashboard-list">
            {metrics.week.refusals.map((refusal) => (
              <div className="dashboard-refusal" key={refusal.booking_id}>
                <strong>
                  {itemName(
                    state.donations.find(
                      (donation) => donation.id === refusal.donation_id,
                    )!,
                  )}
                </strong>
                <p>{refusal.reason || "Reason not recorded"}</p>
              </div>
            ))}
            {!metrics.week.refusals.length && (
              <p className="console-meta">
                No reception refusals recorded this week.
              </p>
            )}
          </div>
          <CardActions>
            <LinkButton
              href="/association/reception"
              variant="outline"
              size="sm"
            >
              Open reception <Icon name="arrow-right" />
            </LinkButton>
          </CardActions>
        </Card>
      </div>
    </>
  );
}
