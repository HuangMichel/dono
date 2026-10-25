export function validQuantity(quantity: string, maximum: string): boolean {
  return (
    /^\d{1,9}$/.test(quantity) &&
    Number(quantity) > 0 &&
    Number(quantity) <= Number(maximum)
  );
}

export { calendarMonth } from "../ui/calendar-model";

export function resolveDemoBookingReference<T extends { id: string }>(
  reference: string,
  scopedBookings: readonly T[],
): T | undefined {
  const bookingId = reference.trim().replace(/^(?:DEMO-ONLY:|DEMO:)/, "");
  return scopedBookings.find((booking) => booking.id === bookingId);
}

export function resolveDemoArrival<T extends { id: string; slot_id: string }>(
  reference: string,
  scopedBookings: readonly T[],
  slots: readonly { id: string; starts_at: string }[],
): { booking: T; arrival_date: string } | undefined {
  const booking = resolveDemoBookingReference(reference, scopedBookings);
  const slot =
    booking && slots.find((candidate) => candidate.id === booking.slot_id);
  if (!booking || !slot) return undefined;
  return {
    booking,
    arrival_date: instantToParisInput(slot.starts_at).slice(0, 10),
  };
}

// Find the instant whose Paris wall-clock fields match the input. The two
// possible French offsets also reveal DST gaps and repeated local times.
export function parisInputToInstant(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Enter a valid date and time.");
  const wallClock = Date.parse(`${value}:00Z`);
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const candidates = [1, 2]
    .map((offset) => new Date(wallClock - offset * 60 * 60 * 1000))
    .filter(
      (candidate) =>
        Number.isFinite(candidate.getTime()) &&
        formatter.format(candidate).replace(" ", "T") === value,
    );
  if (candidates.length !== 1)
    throw new Error(
      "This Paris time is missing or repeated during the clock change. Choose another time.",
    );
  return candidates[0].toISOString();
}

export function instantToParisInput(instant: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(instant))
    .replace(" ", "T");
}
