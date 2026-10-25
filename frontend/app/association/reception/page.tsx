"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useApiPage } from "@/lib/api-hooks";
import type { Offer, Booking } from "@/lib/api-contracts";
import { Button, Field, Icon } from "@/components/ui";
import {
  ConsoleTitle,
  useAssociation,
  ResourceStatus,
  More,
} from "@/components/association/shell";
import {
  CommandForm,
  text,
  useCommand,
} from "@/components/association/command";
import { Evidence, itemName, instant } from "@/components/association/evidence";
import { DateChecks, dateCommand } from "@/components/association/date-checks";
import { StateChip, ExpiryChip } from "@/components/association/status";
import { formatCount, enumLabel } from "@/lib/ui-text";
import "@/components/association/reception-stock.css";
type Arrival = { booking: Booking; offer: Offer };
type Resolved = Arrival & { receivable: boolean; blocking_codes: string[] };
export default function Reception() {
  const { id } = useAssociation();
  const [day, setDay] = useState(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
      new Date(),
    ),
  );
  const resource = useApiPage<Arrival>(
    `/associations/${id}/arrivals?date=${day}`,
  );
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [payload, setPayload] = useState("");
  const [resolvedPayload, setResolvedPayload] = useState("");
  const command = useCommand();
  const verification = useRef(0);
  return (
    <>
      <ConsoleTitle
        title="Reception"
        detail="Use a QR reader on your device, then paste the donor's QR code content below."
      />
      <div className="reception-workspace">
        <div className="reception-verification console-stack">
          <section className="card">
            <div className="reception-qr-heading">
              <Icon name="scan" size={32} />
              <h2>Check donor QR code</h2>
            </div>
            <p className="console-meta">
              Paste the donor&apos;s QR code content to check this appointment.
            </p>
            <CommandForm
              submit="Check QR code"
              successMessage="QR verification complete."
              onSubmit={async () => {
                setResolved(null);
                const generation = ++verification.current;
                const result = await api<Resolved>(
                  `/associations/${id}/qr/resolve`,
                  { method: "POST", body: { payload } },
                );
                if (generation !== verification.current) return false;
                setResolvedPayload(payload);
                setResolved(result);
              }}
            >
              <Field
                label="QR code content"
                value={payload}
                maxLength={2048}
                required
                onChange={(e) => {
                  verification.current++;
                  setPayload(e.target.value);
                  setResolved(null);
                }}
              />
            </CommandForm>
          </section>
        </div>
        <section
          className="reception-arrivals console-stack"
          aria-label="Arrivals"
        >
          <div className="reception-arrivals-heading">
            <h2>
              Drop-offs
              {!resource.loading &&
                !resource.error &&
                resource.data.length > 0 && (
                  <span className="console-meta">
                    {" "}
                    {formatCount(resource.data.length, "expected drop-off")}
                    {resource.hasMore ? " and more available" : ""}
                  </span>
                )}
            </h2>
            <Field
              label="Drop-off date (Europe/Paris)"
              type="date"
              value={day}
              onChange={(e) => {
                if (e.target.value) setDay(e.target.value);
              }}
            />
          </div>
          <ResourceStatus {...resource} />
          {!resource.loading && !resource.error && !resource.data.length && (
            <p className="reception-empty">No drop-offs on this date.</p>
          )}
          {resolved && (
            <section
              key={`${resolved.booking.id}:${resolved.booking.revision}`}
              className="card reception-resolved"
            >
              <div className="console-status-line">
                <h2>{itemName(resolved.offer)}</h2>
                <StateChip state={resolved.booking.computed.effective_state} />
              </div>
              <p className="console-meta">
                {instant(resolved.booking.computed.starts_at)},{" "}
                {formatCount(resolved.offer.quantity)}
              </p>
              <Evidence offer={resolved.offer} />
              {!resolved.receivable ? (
                <p role="alert">
                  Reception unavailable:{" "}
                  {resolved.blocking_codes.map(enumLabel).join(", ")}.
                </p>
              ) : (
                <CommandForm
                  submit={`Receive all ${formatCount(resolved.offer.quantity)} into stock`}
                  successMessage="Full quantity received into stock."
                  onSubmit={async (data) => {
                    await command(
                      `/bookings/${resolved.booking.id}/reception`,
                      {
                        expected_revision: resolved.booking.revision,
                        payload: resolvedPayload,
                        confirm_full_received: true,
                        ...dateCommand(data),
                      },
                    );
                    setResolved((current) =>
                      current === resolved ? null : current,
                    );
                    setPayload((current) =>
                      current === resolvedPayload ? "" : current,
                    );
                    await resource.refresh();
                  }}
                >
                  <DateChecks expiry={resolved.offer.computed.expiry} />
                  <label>
                    <input type="checkbox" required /> I checked the physical
                    item and received the full offered quantity.
                  </label>
                </CommandForm>
              )}
              <p>
                For a quantity or item mismatch, cancel the appointment before
                receiving any items and ask the donor to correct and offer the
                item again.
              </p>
              <CommandForm
                submit="Cancel appointment"
                successMessage="Appointment and offer cancelled."
                onSubmit={async (data) => {
                  await command(
                    `/bookings/${resolved.booking.id}/cancellation`,
                    {
                      expected_revision: resolved.booking.revision,
                      reason: text(data, "reason"),
                    },
                  );
                  setResolved((current) =>
                    current === resolved ? null : current,
                  );
                  setPayload((current) =>
                    current === resolvedPayload ? "" : current,
                  );
                  await resource.refresh();
                }}
              >
                <Field
                  label="Cancellation reason"
                  name="reason"
                  required
                  maxLength={240}
                />
              </CommandForm>
              <Button variant="soft" onClick={() => setResolved(null)}>
                Close
              </Button>
            </section>
          )}
          <div className="reception-arrival-list">
            {resource.data.map((arrival) => (
              <article
                className="card reception-arrival"
                key={arrival.booking.id}
              >
                <div className="reception-arrival-main">
                  <time dateTime={arrival.booking.computed.starts_at}>
                    {new Intl.DateTimeFormat("en-GB", {
                      timeZone: "Europe/Paris",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(arrival.booking.computed.starts_at))}
                  </time>
                  <div>
                    <h3>{itemName(arrival.offer)}</h3>
                    <p className="console-meta">
                      {formatCount(arrival.offer.quantity)}
                    </p>
                  </div>
                  <StateChip state={arrival.booking.computed.effective_state} />
                </div>
                <div className="reception-arrival-meta">
                  <ExpiryChip expiry={arrival.offer.computed.expiry} />
                  <span className="console-meta">
                    {instant(arrival.booking.computed.starts_at)}
                  </span>
                </div>
              </article>
            ))}
          </div>
          <More {...resource} />
        </section>
      </div>
    </>
  );
}
