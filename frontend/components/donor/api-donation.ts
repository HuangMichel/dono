import type { Facts as WireFacts, SourceDates } from "@/lib/api-contracts";
import type { Category } from "@/lib/api-contracts";
import { enumLabel } from "@/lib/ui-text";
import { CATEGORY_LABELS, donorStatusLabel } from "@/lib/labels";
import { MAX_PHOTO_BYTES, MAX_PHOTO_SIZE_LABEL } from "@/lib/photo-limits";
export type {
  Category,
  Donation,
  Offer,
  OfferEvent,
  Booking,
  Analysis,
  Match,
  RedirectPoint,
  SlotOption as Slot,
} from "@/lib/api-contracts";
export const categories = CATEGORY_LABELS;
export type Facts = Omit<WireFacts, "expiry"> & {
  expiry: Partial<SourceDates>;
};
export function validatePhotoFiles(files: File[]) {
  if (files.length > 3) throw Error("Choose at most three photos.");
  for (const file of files) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw Error("Use JPEG, PNG or WebP photos.");
    if (file.size > MAX_PHOTO_BYTES)
      throw Error(`Each photo must be at most ${MAX_PHOTO_SIZE_LABEL}.`);
  }
}
export function changeCategory(facts: Facts, category: Category): Facts {
  return { ...facts, category, attributes: {}, expiry: {} };
}
export function itemName(facts: Facts) {
  return String(
    facts.attributes.product ??
      (typeof facts.attributes.type === "string"
        ? enumLabel(facts.attributes.type)
        : facts.attributes.type) ??
      (facts.category ? categories[facts.category] : "Donation"),
  );
}
export const statusLabel = donorStatusLabel;
export function parisTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}
/** Keep the same command identity when a response is lost and the user retries. */
export function createCommandKeys(
  makeId: () => string = () => crypto.randomUUID(),
) {
  const keys = new Map<string | object, string>();
  return (command: string | object) => {
    let key = keys.get(command);
    if (!key) {
      key = makeId();
      keys.set(command, key);
    }
    return key;
  };
}
