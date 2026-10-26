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
import { QrScanner } from "@/components/association/qr-scanner";
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
  const [scanError, setScanError] = useState("");
  const [scanningCheck, setScanningCheck] = useState(false);
  async function verify(value: string) {
    setResolved(null);
    const generation = ++verification.current;
    const result = await api<Resolved>(`/associations/${id}/qr/resolve`, {
      method: "POST",
      body: { payload: value },
    });
    if (generation !== verification.current) return false;
    setResolvedPayload(value);
    setResolved(result);
  }
  return (
    <>
      <ConsoleTitle
        title="Reception"
        detail="Scan the donor's QR code, then check the item before confirming reception."
      />
      <div className="reception-workspace">
        <div className="reception-verification console-stack">
          <section className="card">
            <div className="reception-qr-heading">
              <Icon name="scan" size={32} />
              <h2>Check donor QR code</h2>
            </div>
            <QrScanner
              onStart={() => {
                verification.current++;
                setResolved(null);
                setScanError("");
                setScanningCheck(false);
              }}
              onScan={(value) => {
                setPayload(value);
                setScanError("");
                setScanningCheck(true);
                const pending = verify(value);
                const generation = verification.current;
                void pending
                  .catch((cause) => {
                    if (generation !== verification.current) return;
                    setScanError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not check this QR code. Try again.",
                    );
                  })
                  .finally(() => {
                    if (generation === verification.current)
                      setScanningCheck(false);
                  });
              }}
            />
            {scanningCheck && <p role="status">Checking appointment…</p>}
            {scanError && <p role="alert">{scanError}</p>}
            <details>
              <summary>Enter QR code content manually</summary>
              <CommandForm
                submit="Check QR code"
                successMessage="QR verification complete."
                onSubmit={() => {
                  setScanError("");
                  setScanningCheck(false);
                  return verify(payload);
                }}
              >
                <Field
                  label="QR code content"
                  value={payload}
                  maxLength={2048}
                  required
                  onChange={(e) => {
                    verification.current++;
                    setScanningCheck(false);
                    setScanError("");
                    setPayload(e.target.value);
                    setResolved(null);
                  }}
                />
              </CommandForm>
            </details>
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
                    {formatCount(
                      resource.data.filter(
                        ({ booking }) =>
                          booking.computed.effective_state === "booked",
                      ).length,
                      "expected drop-off",
                    )}
                    {resource.hasMore ? " and more available" : ""}
                  </span>
                )}
            </h2>
            <Field
              label="Drop-off date (Paris time)"
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
                  <label className="check">
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
                submitVariant="danger"
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
                {arrival.offer.computed.expiry.bucket !== "not_applicable" && (
                  <div className="reception-arrival-meta">
                    <ExpiryChip expiry={arrival.offer.computed.expiry} />
                  </div>
                )}
              </article>
            ))}
          </div>
          <More {...resource} />
        </section>
      </div>
    </>
  );
}
