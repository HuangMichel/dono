import { expect, it } from "vitest";
import { safeOfferReturn } from "./offer-intent";
it("only continues to donation preparation with known fields", () => {
  expect(safeOfferReturn("/donate?need=n1&category=food&location=Paris")).toBe(
    "/donate?need=n1&category=food&location=Paris",
  );
  for (const path of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/donate/../login",
    "/donate?next=https://evil.test",
    "/donate#https://evil.test",
  ])
    expect(safeOfferReturn(path)).toBeNull();
});
