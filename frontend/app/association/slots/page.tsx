"use client";

import { Button, Chip, Card, Field } from "@/components/ui";

import { useState, type FormEvent } from "react";
import type { Slot, SlotInput } from "@/lib/contracts";
import { useDemo } from "@/lib/demo-context";
import {
  DEMO_ASSOCIATION_ID,
  getOccupyingBookings,
  getSlot,
} from "@/lib/demo-store";
import { Calendar, useParisClock } from "@/components/ui/calendar";
import { ConsoleTitle, Feedback } from "@/components/association/shell";
import {
  instantToParisInput,
  parisInputToInstant,
} from "@/components/association/interaction";

export default function SlotsPage() {
  const { state, dispatch } = useDemo();
  const { today } = useParisClock();
  const [date, setSelectedDay] = useState("");
  const selectedDay = date || today;
  const [editing, setEditing] = useState<Slot | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [max, setMax] = useState("5");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState(false);
  const slots = state.slots
    .filter((s) => s.association_id === DEMO_ASSOCIATION_ID)
    .map((slot) => getSlot(state, slot))
    .toSorted((a, b) => a.starts_at.localeCompare(b.starts_at));
  const occupyingBookings = getOccupyingBookings(state);
  const hasHistoricalBookings = Boolean(
    editing && state.bookings.some((b) => b.slot_id === editing.id),
  );
  const booked = editing
    ? occupyingBookings.filter((b) => b.slot_id === editing.id).length
    : 0;
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const input: SlotInput = {
        starts_at: parisInputToInstant(start),
        ends_at: parisInputToInstant(end),
        max_bookings: Number(max),
        active: editing?.active ?? true,
      };
      if (Number(max) < booked)
        throw new Error("The place limit cannot be below existing bookings.");
      dispatch(
        editing
          ? {
              type: "slot",
              id: editing.id,
              patch: {
                expected_revision: editing.revision,
                max_bookings: input.max_bookings,
                active: input.active,
                // Disabled historical times are not editable request fields.
                ...(!hasHistoricalBookings
                  ? { starts_at: input.starts_at, ends_at: input.ends_at }
                  : {}),
              },
            }
          : { type: "slot", id: crypto.randomUUID(), input },
      );
      setError(false);
      setFeedback(editing ? "Slot updated." : "Slot created.");
      setFormOpen(false);
      setEditing(null);
      setStart("");
      setEnd("");
    } catch (cause) {
      setError(true);
      setFeedback(
        cause instanceof Error ? cause.message : "Slot could not be saved.",
      );
    }
  }
  function toggle(slot: Slot) {
    try {
      dispatch({
        type: "slot",
        id: slot.id,
        patch: { active: !slot.active, expected_revision: slot.revision },
      });
      // Keep unsaved form values. Rebase only this successful status change,
      // without hiding an external edit that had already made the form stale.
      setEditing((current) =>
        current?.id === slot.id && current.revision === slot.revision
          ? {
              ...current,
              active: !slot.active,
              revision: String(BigInt(slot.revision) + 1n),
            }
          : current,
      );
      setError(false);
      setFeedback(
        slot.active
          ? "Slot closed to new bookings. Existing appointments remain booked."
          : "Slot opened.",
      );
    } catch (cause) {
      setError(true);
      setFeedback(
        cause instanceof Error ? cause.message : "Slot could not be changed.",
      );
    }
  }
  const selectedSlots = slots.filter(
    (slot) =>
      selectedDay &&
      instantToParisInput(slot.starts_at).startsWith(selectedDay),
  );
  function selectSlot(slot: Slot) {
    setEditing(slot);
    setFormOpen(true);
    setStart(instantToParisInput(slot.starts_at));
    setEnd(instantToParisInput(slot.ends_at));
    setMax(String(slot.max_bookings));
    setFeedback("");
  }
  return (
    <>
      <ConsoleTitle title="Slots" detail="Europe/Paris" />
      <Feedback message={feedback} error={error} />
      <div className="console-calendar-layout">
        <Card className="console-panel">
          <Calendar
            selected={selectedDay}
            today={today}
            onSelect={setSelectedDay}
            label="Manage drop-off dates"
            dayDescription={(day) => {
              const daySlots = slots.filter((slot) =>
                instantToParisInput(slot.starts_at).startsWith(day),
              );
              const counts = daySlots.reduce(
                (result, slot) => {
                  const count = occupyingBookings.filter(
                    (b) => b.slot_id === slot.id,
                  ).length;
                  const status = !slot.active
                    ? "closed"
                    : count >= slot.max_bookings
                      ? "full"
                      : "open";
                  result[status] += 1;
                  return result;
                },
                { open: 0, full: 0, closed: 0 },
              );
              return `${counts.open} open, ${counts.full} full, ${counts.closed} closed slots`;
            }}
            renderDay={(day) =>
              slots
                .filter((slot) =>
                  instantToParisInput(slot.starts_at).startsWith(day),
                )
                .map((slot) => {
                  const count = occupyingBookings.filter(
                    (b) => b.slot_id === slot.id,
                  ).length;
                  return (
                    <span
                      key={slot.id}
                      className={`console-calendar-dot ${!slot.active ? "is-closed" : count >= slot.max_bookings ? "is-full" : ""}`}
                    />
                  );
                })
            }
          />
          <p className="console-meta" style={{ marginTop: 12 }}>
            Green open, red full, grey closed. Select a date to inspect its
            slots.
          </p>
        </Card>
        <div className="console-stack">
          <Card className="console-panel">
            <h2>
              {selectedDay
                ? new Intl.DateTimeFormat("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  }).format(new Date(`${selectedDay}T12:00:00Z`))
                : "Loading date…"}
            </h2>
            {selectedSlots.map((slot) => {
              const occupyingCount = occupyingBookings.filter(
                (b) => b.slot_id === slot.id,
              ).length;
              const bookings = state.bookings.filter(
                (b) => b.slot_id === slot.id,
              );
              return (
                <div className="console-slot-entry" key={slot.id}>
                  <div className="console-row">
                    <strong>
                      {new Intl.DateTimeFormat("en-GB", {
                        timeZone: "Europe/Paris",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(slot.starts_at))}
                    </strong>
                    <Chip
                      variant={
                        slot.active && occupyingCount < slot.max_bookings
                          ? "success"
                          : "neutral"
                      }
                    >
                      {!slot.active
                        ? "Closed"
                        : occupyingCount >= slot.max_bookings
                          ? "Full"
                          : `${occupyingCount} / ${slot.max_bookings} booked`}
                    </Chip>
                  </div>
                  {bookings.map((booking) => {
                    const donation = state.donations.find(
                      (d) => d.id === booking.donation_id,
                    );
                    return (
                      <div className="console-row" key={booking.id}>
                        <span>
                          {donation
                            ? String(donation.attributes.product ?? "Donation")
                            : "Donation"}
                        </span>
                        <Chip
                          variant={
                            donation?.status === "refused"
                              ? "danger"
                              : donation?.status === "booked"
                                ? "caution"
                                : "success"
                          }
                        >
                          {donation?.status === "refused"
                            ? "Refused at reception"
                            : donation?.status === "booked"
                              ? "Expected"
                              : "Received"}
                        </Chip>
                      </div>
                    );
                  })}
                  <div className="console-actions" style={{ paddingTop: 8 }}>
                    <Button
                      variant="soft"
                      size="sm"
                      onClick={() => selectSlot(slot)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggle(slot)}
                    >
                      {slot.active ? "Close slot" : "Open slot"}
                    </Button>
                  </div>
                </div>
              );
            })}
            {!selectedSlots.length && (
              <p className="console-meta">No slots on this date.</p>
            )}
            <Button
              variant="soft"
              style={{ width: "100%", marginTop: 12 }}
              disabled={!selectedDay}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
                setStart(`${selectedDay}T14:00`);
                setEnd(`${selectedDay}T15:00`);
                setMax("5");
              }}
            >
              Add a slot
            </Button>
          </Card>
          {formOpen && (
            <form className="card console-panel console-stack" onSubmit={save}>
              <h2>{editing ? "Edit slot" : "Add a slot"}</h2>
              <Field
                label="Start, Paris time"
                required
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={hasHistoricalBookings}
              />
              <Field
                label="End, Paris time"
                required
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                disabled={hasHistoricalBookings}
              />
              {hasHistoricalBookings && (
                <p className="console-meta">Booked times cannot change.</p>
              )}
              <Field
                label="Maximum bookings"
                required
                type="number"
                min={Math.max(1, booked)}
                step="1"
                value={max}
                onChange={(e) => setMax(e.target.value)}
              />
              <Button>{editing ? "Save slot" : "Create slot"}</Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(false);
                  setStart("");
                  setEnd("");
                }}
              >
                Cancel
              </Button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
