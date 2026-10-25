type BookableSlot = {
  id: string;
  association_id: string;
  starts_at: string;
  active: boolean;
  max_bookings: number;
};
export function parisDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function availableBookingSlots<T extends BookableSlot>(
  slots: readonly T[],
  bookings: readonly { slot_id: string }[],
  associationId: string | undefined,
  day: string,
  now: number,
): T[] {
  if (!associationId || !day) return [];
  const counts = new Map<string, number>();
  for (const booking of bookings)
    counts.set(booking.slot_id, (counts.get(booking.slot_id) ?? 0) + 1);
  return slots
    .filter(
      (slot) =>
        slot.association_id === associationId &&
        slot.active &&
        Date.parse(slot.starts_at) > now &&
        (counts.get(slot.id) ?? 0) < slot.max_bookings &&
        parisDay(new Date(slot.starts_at)) === day,
    )
    .toSorted((a, b) => a.starts_at.localeCompare(b.starts_at));
}
