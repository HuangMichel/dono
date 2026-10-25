import type { Category } from "./contracts";
import type { DemoState } from "./demo-store";
import { associationBalances } from "./association-balances";
import { addQuantity, parseQuantity } from "./quantity";
import { capacityUsage } from "../components/ui/capacity-meter-model";
import { parisDay } from "./booking-availability";

type DashboardSource = Pick<
  DemoState,
  | "donations"
  | "needs"
  | "capacities"
  | "slots"
  | "bookings"
  | "movements"
  | "reception_refusals"
>;
const categories: Category[] = [
  "clothes",
  "shoes",
  "food",
  "para",
  "furniture",
];

export function dashboardMetrics(
  source: DashboardSource,
  associationId: string,
  now: Date,
) {
  const timestamp = now.getTime();
  const today = parisDay(now);
  // Calendar arithmetic is on the Paris date, not elapsed 24-hour periods.
  const monday = new Date(`${today}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const weekStartDay = monday.toISOString().slice(0, 10);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setUTCDate(day.getUTCDate() + index);
    return { date: day.toISOString().slice(0, 10), received: 0, givenOut: 0 };
  });
  const balances = associationBalances(source, associationId);
  const { donations, donationById, movements: scopedMovements } = balances;
  const weeklyMovements = scopedMovements.filter(
    (m) =>
      Number.isFinite(Date.parse(m.created_at)) &&
      Date.parse(m.created_at) <= timestamp,
  );
  const capacities = source.capacities
    .filter((capacity) => capacity.association_id === associationId)
    .map((capacity) => {
      const balance = balances.categoryBalance(
        capacity.category,
        capacity.limit_quantity,
      );
      return {
        category: capacity.category,
        ...balance,
        nearCapacity:
          capacityUsage(balance.inStock, balance.reserved, balance.limit)
            .tone === "danger",
      };
    });
  const needs = source.needs
    .filter((need) => need.association_id === associationId && need.active)
    .map((need) => ({
      need,
      ...balances.needBalance(need.id, need.target_quantity),
    }));
  const offered = donations.filter((d) => d.status === "offered");
  const validOfferTimes = offered
    .map((d) => (d.offered_at ? Date.parse(d.offered_at) : NaN))
    .filter((time) => Number.isFinite(time) && time <= timestamp);
  const slots = new Map(
    source.slots
      .filter((slot) => slot.association_id === associationId)
      .map((slot) => [slot.id, slot]),
  );
  const expectedToday = source.bookings
    .flatMap((booking) => {
      const donation = donationById.get(booking.donation_id);
      const slot = slots.get(booking.slot_id);
      if (
        booking.association_id !== associationId ||
        donation?.status !== "booked" ||
        !slot ||
        !Number.isFinite(Date.parse(slot.starts_at)) ||
        parisDay(new Date(slot.starts_at)) !== today
      )
        return [];
      return [{ booking, donation, slot }];
    })
    .sort(
      (a, b) => Date.parse(a.slot.starts_at) - Date.parse(b.slot.starts_at),
    );
  const byCategory = categories.map((category) => ({
    category,
    received: 0,
    givenOut: 0,
  }));
  for (const movement of weeklyMovements) {
    const day = parisDay(new Date(movement.created_at));
    if (day < weekStartDay || day > today) continue;
    const dayTotals = days.find((entry) => entry.date === day)!;
    const categoryTotals = byCategory.find(
      (entry) =>
        entry.category === donationById.get(movement.donation_id)?.category,
    );
    const key = movement.movement_type === "receipt" ? "received" : "givenOut";
    dayTotals[key] = addQuantity(
      dayTotals[key],
      parseQuantity(movement.quantity),
    );
    if (categoryTotals)
      categoryTotals[key] = addQuantity(
        categoryTotals[key],
        parseQuantity(movement.quantity),
      );
  }
  const refusals = Object.values(source.reception_refusals).filter(
    (refusal) => {
      const booking = source.bookings.find(
        (b) =>
          b.id === refusal.booking_id &&
          b.donation_id === refusal.donation_id &&
          b.association_id === associationId,
      );
      const time = Date.parse(refusal.refused_at);
      return (
        booking &&
        donationById.has(refusal.donation_id) &&
        Number.isFinite(time) &&
        time <= timestamp &&
        parisDay(new Date(time)) >= weekStartDay
      );
    },
  );
  return {
    today,
    offered,
    oldestWaitingHours: validOfferTimes.length
      ? (timestamp - Math.min(...validOfferTimes)) / 3600000
      : null,
    unknownOfferAgeCount: offered.length - validOfferTimes.length,
    expectedToday,
    capacities,
    needs,
    uncoveredNeedCount: needs.filter((need) => need.stillNeeded > 0).length,
    nearCapacityCount: capacities.filter((capacity) => capacity.nearCapacity)
      .length,
    week: {
      startDay: weekStartDay,
      days,
      byCategory,
      received: days.reduce((sum, day) => addQuantity(sum, day.received), 0),
      givenOut: days.reduce((sum, day) => addQuantity(sum, day.givenOut), 0),
      refusals,
      unknownMovementTimeCount: scopedMovements.filter(
        (m) => !Number.isFinite(Date.parse(m.created_at)),
      ).length,
    },
  };
}
