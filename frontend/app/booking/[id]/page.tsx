"use client";
import { formatCount } from "@/lib/ui-text";
import Link from "next/link";
import Image from "next/image";
import { use, useEffect, useState } from "react";
import QRCode from "qrcode";
import { PublicShell, DemoTools } from "@/components/public-shell";
import {
  Button,
  Card,
  CardActions,
  Chip,
  PageHeading,
  SelectField,
} from "@/components/ui";
import { Calendar, useParisClock } from "@/components/ui/calendar";
import { availableBookingSlots } from "@/lib/booking-availability";
import { getOccupyingBookings } from "@/lib/demo-store";
import { useDemo } from "@/lib/demo-context";
const format = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
export default function Booking({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params),
    { state, dispatch, ready } = useDemo(),
    [selected, setSelected] = useState(""),
    [selectedDate, setSelectedDate] = useState(""),
    [error, setError] = useState(""),
    [qr, setQr] = useState(""),
    [failQr, setFailQr] = useState(false),
    [attempt, setAttempt] = useState(0);
  const { now, today } = useParisClock();
  const day = selectedDate || today;
  const d = state.donations.find((d) => d.id === id),
    booking = state.bookings.find((b) => b.donation_id === id),
    slot = state.slots.find((s) => s.id === booking?.slot_id),
    association = state.associations.find((a) => a.id === d?.association_id);
  const available = availableBookingSlots(
    state.slots,
    getOccupyingBookings(state),
    d?.status === "approved" ? (d.association_id ?? undefined) : undefined,
    day,
    now ?? Number.POSITIVE_INFINITY,
  );
  const refusal = booking ? state.reception_refusals[booking.id] : undefined;
  const chosenSlot = available.find((candidate) => candidate.id === selected);
  useEffect(() => {
    let cancelled = false;
    if (booking && d?.status !== "refused" && !failQr)
      QRCode.toDataURL("DEMO-ONLY:" + booking.id, {
        width: 220,
        margin: 2,
        color: { dark: "#21201C", light: "#FDFDFC" },
      })
        .then((url) => {
          if (!cancelled) setQr(url);
        })
        .catch(() => {
          if (!cancelled)
            setError(
              "Your appointment is saved. The demo QR could not be rendered. Retry below.",
            );
        });
    return () => {
      cancelled = true;
    };
  }, [booking, d?.status, failQr, attempt]);
  function book() {
    if (!d) return;
    const current = availableBookingSlots(
      state.slots,
      getOccupyingBookings(state),
      d.status === "approved" ? (d.association_id ?? undefined) : undefined,
      day,
      // Read the wall clock only when the user confirms, not while rendering.
      // eslint-disable-next-line react-hooks/purity
      Date.now(),
    ).find((candidate) => candidate.id === selected);
    if (!current) {
      setSelected("");
      setError("This time is no longer available. Choose an available time.");
      return;
    }
    try {
      dispatch({
        type: "book",
        id,
        slot_id: selected,
        expected_revision: d.revision,
      });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <PublicShell>
      <main id="main" className="container booking-page">
        {!ready ? (
          <p>Loading appointment…</p>
        ) : !d || state.role !== "donor" ? (
          <Card className="stack">
            <h1>Appointment unavailable</h1>
            <p>Choose donor demo and open an approved donation.</p>
            <CardActions>
              <Link href="/login" className="button button-primary">
                Choose role
              </Link>
            </CardActions>
          </Card>
        ) : d.status === "refused" && booking ? (
          <Card className="stack">
            <Chip variant="danger">Refused at reception</Chip>
            <h1>This donation was refused at drop-off</h1>
            {refusal && (
              <>
                <p>{refusal.reason}</p>
                <p className="meta muted">
                  Refused by association staff {refusal.refused_by},{" "}
                  {format(refusal.refused_at)}, Europe/Paris.
                </p>
                <p className="meta muted">
                  Originally approved by staff{" "}
                  {refusal.original_approval.decided_by},{" "}
                  {format(refusal.original_approval.decided_at)}.
                </p>
                <p>
                  Staff refused {formatCount(refusal.original_quantity)} at
                  reception. Nothing was added to stock.
                </p>
              </>
            )}
            <h2>Appointment history</h2>
            <p>
              {slot ? format(slot.starts_at) : "Slot unavailable"}, Europe/Paris
            </p>
            <p>{association?.display_address}</p>
            <p className="meta muted">
              This appointment is closed. Its QR is unavailable.
            </p>
            <CardActions>
              <Link className="button button-outline" href="/donations">
                Back to my donations
              </Link>
            </CardActions>
          </Card>
        ) : !["approved", "booked", "received", "distributed"].includes(
            d.status,
          ) ? (
          <Card className="stack">
            <h1>Staff approval comes first</h1>
            <p>You can book once the association approves your offer.</p>
            <CardActions>
              <Link href="/donations" className="button button-primary">
                My donations
              </Link>
            </CardActions>
          </Card>
        ) : (
          <>
            {!booking && <Chip variant="success">Approved by staff</Chip>}
            <PageHeading
              title={booking ? "Your drop-off pass" : "Book your drop-off"}
              description={
                String(d.attributes.product) + ", " + association?.name
              }
            />
            {error && (
              <p
                className="notice error"
                role="alert"
                style={{ marginBottom: 24 }}
              >
                {error}
              </p>
            )}
            {!booking ? (
              <div className="grid-two booking-layout">
                <Card className="stack">
                  <Calendar
                    label="Drop-off date"
                    selected={day}
                    today={today}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setSelected("");
                    }}
                  />
                  <fieldset className="stack-sm booking-slot-list">
                    <legend>Choose a time, Europe/Paris</legend>
                    {available.map((s) => (
                      <label className="choice" key={s.id}>
                        <input
                          type="radio"
                          name="slot"
                          value={s.id}
                          checked={chosenSlot?.id === s.id}
                          onChange={() => setSelected(s.id)}
                        />
                        <span>{format(s.starts_at)}</span>
                      </label>
                    ))}
                    {!available.length && (
                      <p className="meta muted" role="status">
                        No available times on this date. Choose another date.
                      </p>
                    )}
                  </fieldset>
                </Card>
                <Card className="stack">
                  <h2>Your appointment</h2>
                  <dl className="appointment-facts">
                    <div>
                      <dt>When</dt>
                      <dd>
                        {chosenSlot
                          ? format(chosenSlot.starts_at)
                          : "Choose a time"}
                        , Europe/Paris
                      </dd>
                    </div>
                  </dl>
                  <SelectField
                    id="booking-location"
                    label="Drop-off location"
                    value={association?.id ?? ""}
                    onChange={() => {}}
                  >
                    <option value={association?.id ?? ""}>
                      {association?.display_address || association?.name}
                    </option>
                  </SelectField>
                  <p className="meta muted">
                    Your time is reserved after you confirm. Your demo QR code
                    then appears.
                  </p>
                  <DemoTools>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={failQr}
                        onChange={(e) => setFailQr(e.target.checked)}
                      />
                      Simulate QR failure after booking
                    </label>
                  </DemoTools>
                  <CardActions>
                    <Button
                      className="full"
                      size="app"
                      disabled={!chosenSlot}
                      onClick={book}
                    >
                      Confirm booking
                    </Button>
                  </CardActions>
                </Card>
              </div>
            ) : (
              <div className="grid-two booking-layout">
                <Card className="stack" style={{ textAlign: "center" }}>
                  <Chip variant="success">Booking saved</Chip>
                  <h2>Show this at reception</h2>
                  {failQr ? (
                    <div className="notice warning">
                      <p>QR unavailable. Your appointment is saved.</p>
                      <Button
                        style={{ marginTop: 12 }}
                        variant="outline"
                        onClick={() => {
                          setFailQr(false);
                          setAttempt((x) => x + 1);
                        }}
                      >
                        Load QR again
                      </Button>
                    </div>
                  ) : qr ? (
                    <Image
                      width={220}
                      height={220}
                      unoptimized
                      className="qr"
                      src={qr}
                      alt="QR containing only a local demo booking reference"
                    />
                  ) : (
                    <p aria-busy="true">Loading QR…</p>
                  )}
                  <code style={{ overflowWrap: "anywhere" }}>
                    DEMO-ONLY:{booking.id}
                  </code>
                  <p className="meta muted">
                    Local demo reference. No signature, security validity or
                    real appointment.
                  </p>
                  <CardActions>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQr("");
                        setAttempt((x) => x + 1);
                      }}
                    >
                      Reload QR
                    </Button>
                  </CardActions>
                </Card>
                <Card className="stack">
                  <h2>Booking confirmed</h2>
                  <p>
                    {slot ? format(slot.starts_at) : "Slot unavailable"},
                    Europe/Paris
                  </p>
                  <p>{association?.display_address}</p>
                  <p>
                    {formatCount(d.quantity, "unit")},{" "}
                    {String(d.attributes.product)}
                  </p>
                  <p className="notice">
                    Bring your item for staff inspection. Staff confirm the
                    quantity received.
                  </p>
                  <CardActions>
                    <Link className="button button-primary" href="/donations">
                      Back to my donations
                    </Link>
                    <Link href="/login" className="button button-outline">
                      Switch to reception demo
                    </Link>
                  </CardActions>
                </Card>
              </div>
            )}
            <DemoTools>
              <p className="meta muted">
                Appointment times and QR are illustrative. Production scheduling
                and signing policies remain unresolved. Cancellation and
                rescheduling are unavailable.
              </p>
            </DemoTools>
          </>
        )}
      </main>
    </PublicShell>
  );
}
