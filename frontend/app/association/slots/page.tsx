"use client";
import { useState } from "react";
import { useApiPage } from "@/lib/api-hooks";
import type { Booking, Offer, Slot } from "@/lib/api-contracts";
import { Field, SelectField } from "@/components/ui";
import { Calendar, useParisClock } from "@/components/ui/calendar";
import {
  ConsoleTitle,
  useAssociation,
  ResourceStatus,
  More,
  NumberInput,
} from "@/components/association/shell";
import {
  CommandForm,
  text,
  useCommand,
} from "@/components/association/command";
import { OpeningHours } from "@/components/association/opening-hours";
import {
  parisInputToInstant,
  instantToParisInput,
} from "@/components/association/interaction";
import { parisDay } from "@/lib/booking-availability";
import { instant, itemName } from "@/components/association/evidence";
import { StateChip } from "@/components/association/status";
import { formatCount } from "@/lib/ui-text";

function dayWindow(now: number) {
  return {
    from: parisDay(new Date(now - 35 * 86400000)),
    to: parisDay(new Date(now + 65 * 86400000)),
  };
}
export default function Slots() {
  const { id, membership, association, refresh } = useAssociation();
  const { now, today } = useParisClock();
  const window = now === null ? null : dayWindow(now);
  const resource = useApiPage<Slot>(
    window
      ? `/associations/${id}/slots?from=${encodeURIComponent(window.from + "T00:00:00Z")}&to=${encodeURIComponent(window.to + "T23:59:59Z")}&limit=100`
      : null,
  );
  const [selectedDay, setSelectedDay] = useState("");
  const day = selectedDay || today;
  const command = useCommand();
  const admin = membership.role === "assoc_admin";
  const slotsByDay = (date: string) =>
    resource.data.filter((slot) =>
      instantToParisInput(slot.starts_at).startsWith(date),
    );
  return (
    <>
      <ConsoleTitle
        title="Site and appointments"
        detail="Times are in Paris time. Set daily item limits in Storage and intake."
      />
      {admin && (
        <section className="card">
          <h2>Drop-off site</h2>
          {association.timezone !== "Europe/Paris" && (
            <p>Timezone: {association.timezone}</p>
          )}
          <CommandForm
            key={association.revision}
            submit="Save site"
            successMessage="Drop-off site saved."
            onSubmit={async (data) => {
              const address = text(data, "address");
              await command(
                `/associations/${id}`,
                {
                  expected_revision: association.revision,
                  ...(address ? { address } : {}),
                  opening_hours: JSON.parse(text(data, "hours")),
                },
                "PATCH",
              );
              await refresh();
            }}
          >
            <Field
              label="Drop-off address"
              name="address"
              defaultValue={association.display_address ?? ""}
            />
            <OpeningHours initial={association.opening_hours} />
          </CommandForm>
        </section>
      )}
      <div className="console-calendar-layout">
        <section className="card console-panel">
          <Calendar
            selected={day}
            today={today}
            onSelect={setSelectedDay}
            label="Manage drop-off dates"
            dayDescription={(date) => {
              const daySlots = slotsByDay(date);
              const counts = daySlots.reduce(
                (result, slot) => {
                  const status = !slot.active
                    ? "closed"
                    : slot.computed.remaining_places === 0
                      ? "full"
                      : slot.computed.booked_count > 0
                        ? "busy"
                        : "open";
                  result[status] += 1;
                  return result;
                },
                { open: 0, busy: 0, full: 0, closed: 0 },
              );
              return `${counts.open} open, ${counts.busy} busy, ${counts.full} full, ${counts.closed} closed appointment times`;
            }}
            renderDay={(date) =>
              slotsByDay(date).map((slot) => (
                <span
                  key={slot.id}
                  className={`console-calendar-dot ${!slot.active ? "is-closed" : slot.computed.remaining_places === 0 ? "is-full" : slot.computed.booked_count > 0 ? "is-busy" : ""}`}
                />
              ))
            }
          />
          <p className="console-meta">
            Green dot: open. Orange bar: busy. Red square: full. Grey dash:
            closed. Select a date to see its appointments.
          </p>
          <ResourceStatus {...resource} />
          <More {...resource} />
        </section>
        <DayDetails
          associationId={id}
          day={day}
          slots={slotsByDay(day)}
          admin={admin}
          refreshSlots={resource.refresh}
        />
      </div>
      {admin && (
        <section className="card">
          <h2>Create appointment time</h2>
          <CommandForm
            submit="Create appointment time"
            successMessage="Appointment time created."
            onSubmit={async (data) => {
              if (association.timezone !== "Europe/Paris")
                throw new Error(
                  "You can edit appointment times only for sites in Europe/Paris.",
                );
              await command(`/associations/${id}/slots`, {
                starts_at: parisInputToInstant(text(data, "start")),
                ends_at: parisInputToInstant(text(data, "end")),
                max_bookings: Number(text(data, "places")),
              });
              await resource.refresh();
            }}
          >
            <Field
              label="Starts (Paris time)"
              name="start"
              type="datetime-local"
              required
            />
            <Field
              label="Ends (Paris time)"
              name="end"
              type="datetime-local"
              required
            />
            <NumberInput label="Appointment places" name="places" min={1} />
          </CommandForm>
        </section>
      )}
    </>
  );
}
function DayDetails({
  associationId,
  day,
  slots,
  admin,
  refreshSlots,
}: {
  associationId: string;
  day: string;
  slots: Slot[];
  admin: boolean;
  refreshSlots: () => Promise<void>;
}) {
  const arrivals = useApiPage<{ booking: Booking; offer: Offer }>(
    day
      ? `/associations/${associationId}/arrivals?date=${day}&limit=100`
      : null,
  );
  const command = useCommand();
  const dayLabel = day
    ? new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(`${day}T12:00:00Z`))
    : "Loading date…";
  const booked = arrivals.data.filter(
    ({ booking }) => booking.computed.effective_state === "booked",
  ).length;
  return (
    <section className="card console-panel console-stack">
      <h2>
        {dayLabel}
        {day && (
          <span className="console-meta">
            {" "}
            {formatCount(booked, "expected drop-off")}
          </span>
        )}
      </h2>
      <ResourceStatus {...arrivals} />
      {!arrivals.loading && !arrivals.error && !arrivals.data.length && (
        <p className="console-meta">No drop-offs booked on this date.</p>
      )}
      {arrivals.data.map(({ booking, offer }) => (
        <div className="dashboard-arrival" key={booking.id}>
          <div>
            <strong className="num">
              {new Intl.DateTimeFormat("en-GB", {
                timeZone: "Europe/Paris",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(booking.computed.starts_at))}
            </strong>
            <span> {itemName(offer)}</span>
            <span className="console-meta block">
              {formatCount(offer.quantity)}
            </span>
          </div>
          <StateChip state={booking.computed.effective_state} />
        </div>
      ))}
      {slots.length > 0 && <h3>Appointment times</h3>}
      {slots.map((slot) => (
        <div className="console-stack" key={slot.id}>
          <div>
            <strong>
              {instant(slot.starts_at)} to {instant(slot.ends_at)}
            </strong>
            <p className="console-meta">
              {slot.active ? "Active" : "Paused"},{" "}
              {slot.computed.remaining_places} of {slot.max_bookings}{" "}
              appointment places available
            </p>
          </div>
          {admin && (
            <CommandForm
              key={slot.revision}
              submit="Update appointment time"
              submitVariant="outline"
              successMessage="Appointment time updated."
              onSubmit={async (data) => {
                await command(
                  `/associations/${associationId}/slots/${slot.id}`,
                  {
                    expected_revision: slot.revision,
                    max_bookings: Number(text(data, "places")),
                    active: text(data, "active") === "true",
                  },
                  "PATCH",
                );
                await refreshSlots();
              }}
            >
              <div className="console-form-grid">
                <NumberInput
                  label="Appointment places"
                  name="places"
                  min={1}
                  value={slot.max_bookings}
                />
                <SelectField
                  label="Status"
                  name="active"
                  defaultValue={String(slot.active)}
                >
                  <option value="true">Active</option>
                  <option value="false">Paused</option>
                </SelectField>
              </div>
            </CommandForm>
          )}
        </div>
      ))}
    </section>
  );
}
