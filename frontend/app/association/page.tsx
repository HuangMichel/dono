"use client";

import Link from "next/link";
import { useState } from "react";
import { useDemo } from "@/lib/demo-context";
import {
  CATEGORY_LABELS,
  DEMO_ASSOCIATION_ID,
  getCapacity,
  getWarnings,
  getOccupyingBookings,
} from "@/lib/demo-store";
import type { Category } from "@/lib/contracts";
import { CapacityMeter } from "@/components/ui/capacity-meter";
import { Card, Chip, Icon, LinkButton } from "@/components/ui";
import { ConsoleTitle } from "@/components/association/shell";
import { itemName } from "@/components/association/evidence";

export default function DashboardPage() {
  const { state } = useDemo();
  const [referenceTime] = useState(() => Date.now());
  const donations = state.donations.filter(
    (d) => d.association_id === DEMO_ASSOCIATION_ID,
  );
  const bookings = state.bookings.filter(
    (b) => b.association_id === DEMO_ASSOCIATION_ID,
  );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
  }).format(new Date());
  const todayBookings = bookings.filter((b) => {
    const slot = state.slots.find((s) => s.id === b.slot_id);
    return (
      slot &&
      new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
        new Date(slot.starts_at),
      ) === today
    );
  });
  const offered = donations.filter((d) => d.status === "offered");
  const medicineWarnings = offered.filter((d) =>
    getWarnings(state, d.id).includes("medicine_concern"),
  ).length;
  const receipts = state.movements.filter(
    (m) =>
      m.association_id === DEMO_ASSOCIATION_ID && m.movement_type === "receipt",
  );
  const distributed = state.movements.filter(
    (m) =>
      m.association_id === DEMO_ASSOCIATION_ID &&
      m.movement_type === "distribution",
  );
  const weekly = Array.from({ length: 8 }, (_, index) => {
    const end = referenceTime - (7 - index) * 7 * 86400000;
    const start = end - 7 * 86400000;
    return receipts
      .filter(
        (m) =>
          Date.parse(m.created_at) > start && Date.parse(m.created_at) <= end,
      )
      .reduce((sum, m) => sum + Number(m.quantity), 0);
  });
  const occupyingIds = new Set(
    getOccupyingBookings(state).map((booking) => booking.id),
  );
  const metrics = [
    {
      href: "/association/review",
      value: String(offered.length),
      label: "offers to review",
    },
    {
      href: "/association/reception",
      value: String(
        todayBookings.filter((booking) => occupyingIds.has(booking.id)).length,
      ),
      label: "drop-offs today",
    },
    {
      href: "/association/images",
      value: "—",
      label: "expiring under 30 days",
      pending: true,
    },
    {
      href: "/association/needs",
      value: "—",
      label: "urgent needs",
      pending: true,
    },
  ];
  return (
    <>
      <ConsoleTitle
        title="Dashboard"
        detail={new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Paris",
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date())}
      />
      <div className="console-metrics">
        {metrics.map((metric) => (
          <Link
            href={metric.href}
            key={metric.href}
            className="card console-panel"
          >
            <span className="console-metric num">{metric.value}</span>
            <span className="console-meta">{metric.label}</span>
            {metric.pending && (
              <span className="console-meta" style={{ display: "block" }}>
                Policy pending
              </span>
            )}
          </Link>
        ))}
      </div>
      <div
        className={`notice ${medicineWarnings ? "warning" : ""} console-status-line`}
        style={{ marginBottom: 20 }}
      >
        <span className="row">
          <Icon name={medicineWarnings ? "warning" : "review"} />
          {medicineWarnings
            ? `${medicineWarnings} offers have a medicine concern. Check the original evidence.`
            : `${offered.length} offers are waiting for a staff decision.`}
        </span>
        <LinkButton href="/association/review" variant="outline" size="sm">
          Open review
        </LinkButton>
      </div>
      <div className="console-grid console-grid-two">
        <Card className="console-panel">
          <h2>Capacity</h2>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const capacity = getCapacity(state, key as Category);
            return (
              <div key={key} style={{ marginBottom: 12 }}>
                <CapacityMeter
                  label={label}
                  inStock={capacity.computed.in_stock}
                  reserved={capacity.computed.reserved}
                  limit={capacity.limit_quantity}
                />
              </div>
            );
          })}
          <Link href="/association/capacity" className="console-muted-link">
            Edit capacity →
          </Link>
        </Card>
        <Card className="console-panel">
          <h2>Today&apos;s drop-offs</h2>
          {todayBookings.slice(0, 4).map((b) => {
            const d = donations.find((d) => d.id === b.donation_id);
            const slot = state.slots.find((s) => s.id === b.slot_id);
            return (
              <div className="console-row" key={b.id}>
                <span>
                  <strong>
                    {slot
                      ? new Intl.DateTimeFormat("en-GB", {
                          timeZone: "Europe/Paris",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(slot.starts_at))
                      : ""}
                  </strong>
                  , {d ? itemName(d) : "Donation"}
                </span>
                <Chip
                  variant={
                    d?.status === "refused"
                      ? "danger"
                      : d?.status === "booked"
                        ? "caution"
                        : "success"
                  }
                >
                  {d?.status === "refused"
                    ? "Refused at reception"
                    : d?.status === "booked"
                      ? "Expected"
                      : "Received"}
                </Chip>
              </div>
            );
          })}
          {!todayBookings.length && (
            <p className="console-meta">No drop-offs today.</p>
          )}
          <Link
            href="/association/reception"
            className="console-muted-link"
            style={{ display: "inline-block", marginTop: 12 }}
          >
            Open reception →
          </Link>
        </Card>
      </div>
      <div className="console-grid" style={{ marginTop: 20 }}>
        <Card className="console-panel">
          <h2>Donation activity</h2>
          <dl>
            <div>
              <dt>Offers received</dt>
              <dd>{donations.filter((d) => d.status !== "draft").length}</dd>
            </div>
            <div>
              <dt>Approved by staff</dt>
              <dd>
                {donations.filter((d) => d.decision === "approved").length}
              </dd>
            </div>
            <div>
              <dt>Refused by staff</dt>
              <dd>
                {donations.filter((d) => d.decision === "refused").length}
              </dd>
            </div>
            <div>
              <dt>Items received</dt>
              <dd>
                {receipts.reduce((sum, m) => sum + Number(m.quantity), 0)}
              </dd>
            </div>
            <div>
              <dt>Items given out</dt>
              <dd>
                {distributed.reduce((sum, m) => sum + Number(m.quantity), 0)}
              </dd>
            </div>
            <div>
              <dt>Missed drop-offs</dt>
              <dd className="console-meta">Not available</dd>
            </div>
          </dl>
        </Card>
        <Card className="console-panel">
          <h2>Items received per week</h2>
          <div
            className="console-chart"
            role="img"
            aria-label={`Items received over the last eight weeks: ${weekly.join(", ")}`}
          >
            {weekly.map((count, index) => (
              <span className="console-chart-column" key={index}>
                <span className="console-meta num">{count}</span>
                <span
                  className="console-chart-bar"
                  style={{
                    height: `${Math.max(2, (count / Math.max(1, ...weekly)) * 100)}px`,
                  }}
                />
              </span>
            ))}
          </div>
          <div
            className="console-status-line console-meta"
            style={{ marginTop: 8 }}
          >
            <span>8 weeks ago</span>
            <span>This week</span>
          </div>
        </Card>
        <Card className="console-panel">
          <h2>By category</h2>
          <div
            className="console-table-wrap"
            role="region"
            aria-label="Donation activity by category"
            tabIndex={0}
          >
            <table className="console-plain-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Offers</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <tr key={key}>
                    <td>{label}</td>
                    <td>
                      {
                        donations.filter(
                          (d) => d.category === key && d.status !== "draft",
                        ).length
                      }
                    </td>
                    <td>
                      {receipts
                        .filter((m) =>
                          donations.some(
                            (d) => d.id === m.donation_id && d.category === key,
                          ),
                        )
                        .reduce((sum, m) => sum + Number(m.quantity), 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
