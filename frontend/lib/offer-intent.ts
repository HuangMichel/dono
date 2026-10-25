import type { Category } from "./api-contracts";
export type OfferIntent = {
  need?: string;
  category?: Category;
  location?: string;
};
const categories = ["clothes", "shoes", "food", "para", "furniture"];
export function offerIntent(params: URLSearchParams): OfferIntent {
  const category = params.get("category") ?? "";
  return {
    need: params.get("need")?.slice(0, 100) || undefined,
    category: categories.includes(category)
      ? (category as Category)
      : undefined,
    location: params.get("location")?.trim().slice(0, 200) || undefined,
  };
}
export function donationHref(intent: OfferIntent = {}): string {
  const params = new URLSearchParams();
  if (intent.need) params.set("need", intent.need);
  if (intent.category) params.set("category", intent.category);
  if (intent.location) params.set("location", intent.location);
  return `/donate${params.size ? `?${params}` : ""}`;
}
export function safeOfferReturn(value: string | null): string | null {
  if (!value || !/^\/donate(?:\?|$)/.test(value) || /[\\#\r\n]/.test(value))
    return null;
  const params = new URLSearchParams(value.split("?")[1]);
  if (
    [...params.keys()].some(
      (key) => !["need", "category", "location", "id"].includes(key),
    )
  )
    return null;
  const path = donationHref(offerIntent(params));
  const id = params.get("id");
  if (!id) return path;
  const result = new URL(path, "https://dono.invalid");
  result.searchParams.set("id", id.slice(0, 100));
  return result.pathname + result.search;
}
export function accountHref(mode: "login" | "signup", next: string): string {
  const safe = safeOfferReturn(next);
  return `/${mode}${safe ? `?${new URLSearchParams({ next: safe })}` : ""}`;
}
