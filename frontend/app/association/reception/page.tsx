"use client";

import { Button, Card, Chip, EmptyState, Field, Icon } from "@/components/ui";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Booking, Donation } from "@/lib/contracts";
import { useDemo } from "@/lib/demo-context";
import { DEMO_ASSOCIATION_ID } from "@/lib/demo-store";
import { ConsoleTitle, Feedback, Notice } from "@/components/association/shell";
import { instant, itemName } from "@/components/association/evidence";
import {
  resolveDemoArrival,
  validQuantity,
} from "@/components/association/interaction";

export default function ReceptionPage() {
  const { state } = useDemo();
  const [reference, setReference] = useState("");
  const [resolved, setResolved] = useState("");
  const [message, setMessage] = useState("");
  const [day, setDay] = useState("");
  const bookings = state.bookings.filter(
    (b) => b.association_id === DEMO_ASSOCIATION_ID,
  );
  function resolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const match = resolveDemoArrival(reference, bookings, state.slots);
    if (!match) {
      setResolved("");
      setMessage("Unknown demo booking reference. No stock was changed.");
      return;
    }
    setMessage("");
    setDay(match.arrival_date);
    setResolved(match.booking.id);
  }
  const arrivals = bookings.filter((booking) => {
    const slot = state.slots.find((s) => s.id === booking.slot_id);
    return (
      !day ||
      (slot &&
        new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
          new Date(slot.starts_at),
        ) === day)
    );
  });
  return (
    <>
      <ConsoleTitle
        title="Drop-offs"
        detail={`${arrivals.length} appointments, Europe/Paris`}
      />
      <div className="console-reception-layout">
        <div className="console-stack">
          <Card className="console-panel">
            <div className="console-scan-area">
              <Icon name="scan" />
              <span>Scan donor QR</span>
              <span className="console-meta">Demo references only</span>
            </div>
            <form
              onSubmit={resolve}
              className="console-stack"
              style={{ marginTop: 16 }}
            >
              <Field
                label="Or paste the demo code"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="DEMO-ONLY:…"
                required
              />
              <Button>Look up booking</Button>
              <Feedback message={message} error />
            </form>
            <p className="console-meta" style={{ marginTop: 12 }}>
              Check the goods before confirming reception.
            </p>
          </Card>
          <Field
            label="Arrival date, Paris"
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
          {day && (
            <Button variant="soft" size="sm" onClick={() => setDay("")}>
              Show all dates
            </Button>
          )}
        </div>
        <section className="console-reception-rows">
          {arrivals.map((booking) => {
            const donation = state.donations.find(
              (d) => d.id === booking.donation_id,
            );
            if (!donation) return null;
            return (
              <ReceiveCard
                key={booking.id}
                booking={booking}
                donation={donation}
                expanded={resolved === booking.id}
                onToggle={() => {
                  if (resolved === booking.id) {
                    setResolved("");
                    return;
                  }
                  setReference(booking.id);
                  setResolved(booking.id);
                  setMessage("");
                }}
              />
            );
          })}
          {!arrivals.length && <EmptyState title="No drop-offs on this date" />}
        </section>
      </div>
    </>
  );
}

function ReceiveCard({
  booking,
  donation,
  expanded,
  onToggle,
}: {
  booking: Booking;
  donation: Donation;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { state, dispatch } = useDemo();
  const inspectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (expanded) inspectionRef.current?.focus();
  }, [expanded]);
  const [reason, setReason] = useState("");
  const [confirmRefusal, setConfirmRefusal] = useState(false);
  const refusal = state.reception_refusals[booking.id];
  const refused = donation.status === "refused";
  const [quantity, setQuantity] = useState(donation.quantity ?? "1");
  const [revision, setRevision] = useState(donation.revision);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const receipt = state.movements.find(
    (m) => m.donation_id === donation.id && m.movement_type === "receipt",
  );
  const original = state.receipt_originals[donation.id] ?? donation.quantity;
  const slot = state.slots.find((item) => item.id === booking.slot_id);
  const detailsId = `reception-details-${booking.id}`;
  function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (!validQuantity(quantity, donation.quantity ?? "0"))
        throw new Error(
          "Enter a positive whole quantity no greater than the offered quantity.",
        );
      dispatch({
        type: "receive",
        booking_id: booking.id,
        quantity,
        expected_revision: revision,
      });
      setError(false);
      setMessage("Reception and stock recorded.");
    } catch (cause) {
      setError(true);
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Reception could not be recorded.",
      );
    }
  }
  function refuse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      dispatch({
        type: "refuseReception",
        booking_id: booking.id,
        reason,
        confirm_refusal: confirmRefusal,
        expected_revision: revision,
      });
      setError(false);
      setMessage("Donation refused at reception. No stock was recorded.");
    } catch (cause) {
      setError(true);
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Refusal could not be recorded.",
      );
    }
  }
  return (
    <article className="card console-panel">
      <div className="console-reception-header">
        <div>
          <h2>
            {itemName(donation)} × {donation.quantity}
          </h2>
          <p className="console-meta">
            {slot ? instant(slot.starts_at) : "Slot unavailable"}, {original}{" "}
            items originally offered
          </p>
        </div>
        <div className="console-actions">
          <Chip variant={refused ? "danger" : receipt ? "success" : "caution"}>
            {refused
              ? "Refused at reception"
              : receipt
                ? "Received"
                : "Expected"}
          </Chip>
          <Button
            variant="soft"
            size="sm"
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={onToggle}
          >
            {expanded ? "Hide details" : "More details"}
          </Button>
        </div>
      </div>
      <div
        id={detailsId}
        className="console-reception-details"
        hidden={!expanded}
        tabIndex={-1}
        ref={inspectionRef}
        aria-label={`Details for ${itemName(donation)}`}
      >
        <div className="console-stack">
          <p className="console-meta">{booking.id}</p>
          <Feedback message={message} error={error} />
          <dl>
            <div>
              <dt>Originally offered</dt>
              <dd>{original} items</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                {refused
                  ? "Refused at reception"
                  : receipt
                    ? "Received"
                    : "Booked, awaiting confirmation"}
              </dd>
            </div>
          </dl>
          {refused ? (
            <>
              <Chip variant="danger">Refused at reception</Chip>
              {refusal && (
                <dl>
                  <div>
                    <dt>Staff reason</dt>
                    <dd>{refusal.reason}</dd>
                  </div>
                  <div>
                    <dt>Refused by</dt>
                    <dd>
                      Léa Martin, {instant(refusal.refused_at)}
                      <span className="console-meta">
                        {" "}
                        ({refusal.refused_by})
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Original approval</dt>
                    <dd>
                      {instant(refusal.original_approval.decided_at)}, staff{" "}
                      {refusal.original_approval.decided_by}
                    </dd>
                  </div>
                  <div>
                    <dt>Quantity refused</dt>
                    <dd>{refusal.original_quantity} items</dd>
                  </div>
                </dl>
              )}
              <p>
                No receipt or stock movement was recorded. This appointment
                remains in history.
              </p>
            </>
          ) : receipt ? (
            <>
              <Chip variant="success">Received</Chip>
              <dl>
                <div>
                  <dt>Actual receipt</dt>
                  <dd>{receipt.quantity} items</dd>
                </div>
                <div>
                  <dt>Received by</dt>
                  <dd>Léa Martin, {instant(receipt.created_at)}</dd>
                </div>
                <div>
                  <dt>Receipt reference</dt>
                  <dd>{receipt.id}</dd>
                </div>
              </dl>
            </>
          ) : donation.status === "booked" ? (
            <>
              <form onSubmit={receive} className="console-stack">
                <Field
                  label="Actual quantity received"
                  type="number"
                  required
                  min="1"
                  max={donation.quantity ?? "0"}
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                <p className="console-meta">
                  A reduced receipt closes this booking without a pending
                  remainder.
                </p>
                {revision !== donation.revision && (
                  <Notice>
                    This donation changed.{" "}
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => {
                        setRevision(donation.revision);
                        setQuantity(donation.quantity ?? "1");
                      }}
                    >
                      Refresh quantity
                    </Button>
                  </Notice>
                )}
                <Button
                  variant="primary"
                  disabled={
                    revision !== donation.revision ||
                    !validQuantity(quantity, donation.quantity ?? "0")
                  }
                >
                  Confirm reception and stock
                </Button>
              </form>
              <form
                onSubmit={refuse}
                className="console-stack"
                style={{ marginTop: 24 }}
              >
                <h3>Refuse at reception</h3>
                <p className="console-meta">
                  Refuse the entire donation after inspection. No receipt or
                  stock is recorded.
                </p>
                <Field
                  label="Reason for refusal"
                  value={reason}
                  required
                  onChange={(event) => setReason(event.target.value)}
                />
                <label className="check">
                  <input
                    type="checkbox"
                    checked={confirmRefusal}
                    onChange={(event) =>
                      setConfirmRefusal(event.target.checked)
                    }
                  />
                  I confirm that staff refuse all {donation.quantity} items at
                  reception.
                </label>
                <Button
                  variant="danger"
                  disabled={
                    !reason.trim() ||
                    !confirmRefusal ||
                    revision !== donation.revision
                  }
                >
                  Refuse entire donation
                </Button>
                <details className="demo-tools">
                  <summary>Local demo limitation</summary>
                  <p className="console-meta">
                    Reception refusal is stored only in this browser. The
                    proposed API does not yet define this action.
                  </p>
                </details>
              </form>
            </>
          ) : (
            <p>This donation cannot be received in its current state.</p>
          )}
        </div>
      </div>
    </article>
  );
}
