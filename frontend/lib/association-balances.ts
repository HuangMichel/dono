import type { Category, Donation, Movement } from "./contracts";
import { addQuantity, parseQuantity, preciseQuantity } from "./quantity";

type BalanceSource = {
  donations: readonly Donation[];
  movements: readonly Movement[];
};

/** Current recorded balances. Movement dates belong to activity reporting only. */
export function associationBalances(
  source: BalanceSource,
  associationId: string | null,
) {
  const donations = source.donations.filter(
    (donation) => donation.association_id === associationId,
  );
  const donationById = new Map(
    donations.map((donation) => [donation.id, donation]),
  );
  const seen = new Set<string>();
  const movements = source.movements.filter((movement) => {
    if (
      movement.association_id !== associationId ||
      !donationById.has(movement.donation_id) ||
      seen.has(movement.id)
    )
      return false;
    seen.add(movement.id);
    return true;
  });
  const byDonation = new Map(
    donations.map((donation) => [
      donation.id,
      { received: 0, distributed: 0, remaining: 0 },
    ]),
  );
  for (const movement of movements) {
    const balance = byDonation.get(movement.donation_id)!;
    const key =
      movement.movement_type === "receipt" ? "received" : "distributed";
    balance[key] = addQuantity(balance[key], parseQuantity(movement.quantity));
    balance.remaining = Math.max(
      0,
      preciseQuantity(balance.received - balance.distributed),
    );
  }
  function reservedFor(records: readonly Donation[]) {
    return records
      .filter(
        (donation) =>
          donation.status === "approved" || donation.status === "booked",
      )
      .reduce(
        (sum, donation) => addQuantity(sum, parseQuantity(donation.quantity)),
        0,
      );
  }
  function categoryBalance(category: Category, limitQuantity: string) {
    const records = donations.filter(
      (donation) => donation.category === category,
    );
    const inStock = records.reduce(
      (sum, donation) =>
        addQuantity(sum, byDonation.get(donation.id)!.remaining),
      0,
    );
    const reserved = reservedFor(records);
    const limit = parseQuantity(limitQuantity);
    return {
      inStock,
      reserved,
      limit,
      available: Math.max(0, preciseQuantity(limit - inStock - reserved)),
    };
  }
  function needBalance(needId: string, targetQuantity: string) {
    const records = donations.filter((donation) => donation.need_id === needId);
    const received = records.reduce(
      (sum, donation) =>
        addQuantity(sum, byDonation.get(donation.id)!.received),
      0,
    );
    const reserved = reservedFor(records);
    const target = parseQuantity(targetQuantity);
    return {
      received,
      reserved,
      target,
      stillNeeded: Math.max(0, preciseQuantity(target - received - reserved)),
      receivedPercentage: target > 0 ? (received / target) * 100 : 0,
    };
  }
  return {
    donations,
    donationById,
    movements,
    byDonation,
    categoryBalance,
    needBalance,
  };
}
