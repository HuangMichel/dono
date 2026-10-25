"use client";
import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { PublicShell } from "@/components/public-shell";
import {
  Button,
  Card,
  Chip,
  Field,
  PageHeading,
  LinkButton,
} from "@/components/ui";
import { formatCount } from "@/lib/ui-text";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useApiPage, useApiResource } from "@/lib/api-hooks";
import { Calendar, useParisClock } from "@/components/ui/calendar";
import { useNotifications } from "@/components/ui/notifications";
import "./booking.css";
import {
  createCommandKeys,
  type Offer,
  type Booking as BookingData,
  type Slot,
  parisTime,
  statusLabel,
  itemName,
} from "@/components/donor/api-donation";
export default function Booking({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const auth = useAuth();
  return <BookingFlow key={`${auth.user?.id ?? "guest"}:${id}`} id={id} />;
}
function BookingFlow({ id }: { id: string }) {
  const auth = useAuth();
  const { notify } = useNotifications();
  const commandKey = useRef(createCommandKeys());
  const { today } = useParisClock();
  const offer = useApiResource<Offer>(auth.user ? `/offers/${id}` : null);
  const [booking, setBooking] = useState<BookingData | null>(null),
    [checking, setChecking] = useState(true),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [qr, setQr] = useState(""),
    [qrError, setQrError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [reason, setReason] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const slots = useApiPage<Slot>(
    auth.user && offer.data?.computed.effective_state === "approved" && !booking
      ? `/offers/${id}/slots`
      : null,
  );
  const day = selectedDay || slots.data[0]?.quota_date || today;
  const daySlots = slots.data.filter((slot) => slot.quota_date === day);
  const chosenSlot = daySlots.find((slot) => slot.id === selected);
  useEffect(() => {
    if (!auth.user) return;
    const controller = new AbortController();
    api<BookingData>(`/offers/${id}/booking`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setBooking(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted && e.status !== 404) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, [id, auth.user]);
  useEffect(() => {
    if (!booking || booking.computed.effective_state !== "booked") return;
    let active = true;
    api<{ payload: string }>(`/bookings/${booking.id}/qr`)
      .then((data) => QRCode.toDataURL(data.payload, { width: 260, margin: 2 }))
      .then((src) => {
        if (active) setQr(src);
      })
      .catch((e) => {
        if (active) setQrError(e.message);
      });
    return () => {
      active = false;
    };
  }, [booking, attempt]);
  async function book() {
    if (!offer.data || !chosenSlot || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await api<BookingData>(`/offers/${id}/bookings`, {
        method: "POST",
        idempotencyKey: commandKey.current(
          JSON.stringify([id, offer.data.revision, selected]),
        ),
        body: {
          expected_offer_revision: offer.data.revision,
          slot_id: chosenSlot.id,
        },
      });
      setBooking(next);
      notify({ message: "Appointment confirmed.", tone: "success" });
      await offer.refresh();
    } catch (e) {
      try {
        const saved = await api<BookingData>(`/offers/${id}/booking`);
        setBooking(saved);
        setError("");
        notify({
          message:
            saved.computed.effective_state === "booked"
              ? "Appointment confirmed."
              : "Appointment status refreshed.",
          tone:
            saved.computed.effective_state === "booked" ? "success" : "info",
        });
      } catch {
        notify({
          message:
            e instanceof Error
              ? e.message
              : "Could not book the appointment. Try again.",
          tone: "error",
        });
      }
      await slots.refresh();
      await offer.refresh();
      setSelected("");
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!booking) return;
    setBusy(true);
    setError("");
    setQr("");
    setQrError("");
    try {
      const result = await api<{ booking: BookingData }>(
        `/bookings/${booking.id}/cancellation`,
        {
          method: "POST",
          body: { expected_revision: booking.revision, reason },
          idempotencyKey: commandKey.current(
            JSON.stringify(["cancel", booking.id, booking.revision, reason]),
          ),
        },
      );
      setBooking(result.booking);
      notify({ message: "Appointment cancelled.", tone: "success" });
      setQr("");
      await offer.refresh();
    } catch (e) {
      try {
        const saved = await api<BookingData>(`/bookings/${booking.id}`);
        setBooking(saved);
        if (saved.computed.effective_state === "cancelled")
          notify({ message: "Appointment cancelled.", tone: "success" });
        else
          notify({
            message:
              e instanceof Error
                ? e.message
                : "Could not cancel the appointment. Try again.",
            tone: "error",
          });
        await offer.refresh();
      } catch {
        notify({
          message:
            e instanceof Error
              ? e.message
              : "Could not cancel the appointment. Try again.",
          tone: "error",
        });
        setQrError(
          "We could not check your appointment status. Reload the QR code to check whether it is still valid.",
        );
      }
    } finally {
      setBusy(false);
    }
  }
  const loading = auth.loading || offer.loading || checking;
  return (
    <PublicShell>
      <main id="main" className="container booking-page">
        <PageHeading
          title={booking ? "Your drop-off pass" : "Book your drop-off"}
          description={
            offer.data ? itemName(offer.data.facts_snapshot) : undefined
          }
        />
        {auth.loading ? (
          <p role="status">Loading account…</p>
        ) : !auth.user ? (
          <Card>
            <p>Sign in to view your appointment.</p>
            <LinkButton href="/login">Sign in</LinkButton>
          </Card>
        ) : (
          <div className="stack">
            {loading && <p role="status">Loading appointment…</p>}
            {(error || offer.error) && (
              <p className="notice danger" role="alert">
                {error || offer.error}
              </p>
            )}
            {booking ? (
              <div className="grid-two booking-layout">
                <Card className="stack booking-pass">
                  <Chip
                    variant={
                      booking.computed.effective_state === "booked" ||
                      booking.computed.effective_state === "received"
                        ? "success"
                        : "neutral"
                    }
                  >
                    {statusLabel(booking.computed.effective_state)}
                  </Chip>
                  <h2>
                    {booking.computed.effective_state === "booked"
                      ? "Show this at reception"
                      : "Appointment status"}
                  </h2>
                  {booking.computed.effective_state === "booked" && (
                    <>
                      {qr ? (
                        <Image
                          src={qr}
                          width={260}
                          height={260}
                          alt="QR code to show when you drop off your donation"
                          unoptimized
                        />
                      ) : qrError ? (
                        <div>
                          <p role="alert">QR code unavailable. {qrError}</p>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setQrError("");
                              setAttempt((a) => a + 1);
                            }}
                          >
                            Reload QR code
                          </Button>
                        </div>
                      ) : (
                        <p role="status">Loading your QR code…</p>
                      )}
                    </>
                  )}
                </Card>
                <Card className="stack" aria-label="Appointment summary">
                  <h2>Your appointment</h2>
                  <dl className="appointment-facts">
                    {offer.data && (
                      <div>
                        <dt>Item</dt>
                        <dd>
                          {itemName(offer.data.facts_snapshot)},{" "}
                          {formatCount(offer.data.quantity)}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>When</dt>
                      <dd>
                        {parisTime(booking.computed.starts_at)} to{" "}
                        {bookingTime(booking.computed.ends_at)}
                      </dd>
                    </div>
                    <div>
                      <dt>Where</dt>
                      <dd>{booking.dropoff_address}</dd>
                    </div>
                  </dl>
                  <p className="meta muted">Times are shown in Europe/Paris.</p>
                  {booking.computed.effective_state === "booked" && (
                    <details className="booking-cancellation">
                      <summary>Cancel this appointment</summary>
                      <form
                        className="stack-sm"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void cancel();
                        }}
                      >
                        <p className="meta muted">
                          Cancelling also closes this offer. To arrange another
                          drop-off, send a new offer for staff to review.
                        </p>
                        <Field
                          id="cancel-reason"
                          label="Cancellation reason"
                          required
                          maxLength={240}
                          value={reason}
                          disabled={busy}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <Button disabled={busy} variant="outline">
                          Cancel appointment
                        </Button>
                      </form>
                    </details>
                  )}
                </Card>
              </div>
            ) : !loading &&
              offer.data?.computed.effective_state === "approved" ? (
              <div className="grid-two booking-layout">
                <Card className="stack">
                  <Calendar
                    label="Drop-off date"
                    today={today}
                    selected={day}
                    onSelect={(next) => {
                      setSelectedDay(next);
                      setSelected("");
                    }}
                    dayDescription={(date) => {
                      const count = slots.data.filter(
                        (slot) => slot.quota_date === date,
                      ).length;
                      return count
                        ? `${count} available ${count === 1 ? "time" : "times"} shown`
                        : "No available times shown";
                    }}
                    renderDay={(date) =>
                      slots.data.some((slot) => slot.quota_date === date) ? (
                        <span className="booking-available-dot" />
                      ) : null
                    }
                  />
                  {slots.error && (
                    <p role="alert">
                      {slots.error}{" "}
                      <Button
                        variant="outline"
                        onClick={() => void slots.refresh()}
                      >
                        Retry
                      </Button>
                    </p>
                  )}
                  {slots.loading && (
                    <p role="status">Loading available times…</p>
                  )}
                  <fieldset className="stack-sm booking-slot-list">
                    <legend>Choose a time, Europe/Paris</legend>
                    {!slots.loading && !slots.error && !daySlots.length && (
                      <p className="meta muted" role="status">
                        {slots.hasMore
                          ? "No times shown for this date. Choose another date or load more times."
                          : "No available times on this date. Choose another date."}
                      </p>
                    )}
                    {daySlots.map((slot) => (
                      <label key={slot.id} className="choice">
                        <input
                          type="radio"
                          name="slot"
                          disabled={busy}
                          checked={selected === slot.id}
                          onChange={() => setSelected(slot.id)}
                        />
                        {bookingTime(slot.starts_at)} to{" "}
                        {bookingTime(slot.ends_at)}
                      </label>
                    ))}
                  </fieldset>
                  {slots.hasMore && (
                    <Button
                      variant="outline"
                      disabled={slots.loading}
                      onClick={() => void slots.loadMore()}
                    >
                      Load more available times
                    </Button>
                  )}
                </Card>
                <Card className="stack" aria-label="Appointment summary">
                  <Chip variant="success">Approved by staff</Chip>
                  <h2>Your appointment</h2>
                  <dl className="appointment-facts">
                    <div>
                      <dt>Item</dt>
                      <dd>
                        {itemName(offer.data.facts_snapshot)},{" "}
                        {formatCount(offer.data.quantity)}
                      </dd>
                    </div>
                    <div>
                      <dt>When</dt>
                      <dd>
                        {chosenSlot
                          ? `${parisTime(chosenSlot.starts_at)} to ${bookingTime(chosenSlot.ends_at)}`
                          : "Choose a date and time"}
                      </dd>
                    </div>
                  </dl>
                  <p className="meta muted">
                    Confirm your appointment to reserve this time. Your pass
                    will show the drop-off address and QR code.
                  </p>
                  <Button
                    size="app"
                    disabled={
                      busy || !chosenSlot || slots.loading || !!slots.error
                    }
                    onClick={() => void book()}
                  >
                    Confirm appointment
                  </Button>
                </Card>
              </div>
            ) : (
              !loading && (
                <Card className="stack-sm">
                  <h2>
                    {offer.data
                      ? statusLabel(offer.data.computed.effective_state)
                      : "Offer unavailable"}
                  </h2>
                  <p>
                    {offer.data &&
                    ["refused", "cancelled", "expired", "withdrawn"].includes(
                      offer.data.computed.effective_state,
                    )
                      ? "This offer is closed. The item stays in your donations, and you can offer it to another association."
                      : "You can book a drop-off time once association staff approve your offer."}
                  </p>
                </Card>
              )
            )}
            <LinkButton href="/donations" variant="outline">
              My donations
            </LinkButton>
          </div>
        )}
      </main>
    </PublicShell>
  );
}

function bookingTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}
