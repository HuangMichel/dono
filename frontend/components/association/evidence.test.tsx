import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { Offer } from "@/lib/api-contracts";
vi.mock("@/components/association/shell", () => ({
  ResourceStatus: () => null,
}));
vi.mock("./auth-photo", () => ({ AuthPhoto: () => null }));
vi.mock("@/lib/api-hooks", () => ({
  useApiResource: () => ({
    data: {
      photos: [],
      category_mismatch: false,
      requests: [],
      edits: [
        {
          id: "private-edit-id",
          donation_id: "private-donation-id",
          actor_id: "private-actor-id",
          change_kind: "facts_edited",
          created_at: "2026-10-25T10:00:00Z",
          before_snapshot: {
            category: "food",
            attributes: { product: "Original pasta", brand: "a_brand" },
            expiry: {
              expiry_date: "2027-03-15",
              date_type: "DDM",
              raw_label: "BEST_BEFORE_15/03/2027",
            },
            quantity: "2",
          },
          after_snapshot: {
            category: "food",
            attributes: { product: "Corrected rice", brand: "a_brand" },
            expiry: {
              expiry_date: "2027-04-15",
              date_type: "DDM",
              raw_label: "BEST_BEFORE_15/04/2027",
            },
            quantity: "3",
          },
          from_state: "draft",
          to_state: "draft",
        },
      ],
      analyses: [
        {
          id: "analysis",
          category: "food",
          provider: "openai",
          model: "vision",
          confidence: 0.8,
          indicators: [
            { key: "looks_like_medicine", probability: 0.61, level: "high" },
            { key: "packaged_unopened", probability: 0.9, level: "high" },
          ],
          extracted: {
            schema_version: "analysis-v1",
            attributes: {
              product: "Original pasta",
              storage_condition: "room_temperature",
              brand: "a_brand",
            },
            dates: {
              expiry_date: "2027-03-15",
              date_type: "DDM",
              raw_label: "BEST_BEFORE_15/03/2027",
            },
          },
        },
      ],
    },
  }),
}));
import { Evidence } from "./evidence";
it("labels risk indicators and keeps AI output separate from approval colors", () => {
  const offer = {
    id: "offer",
    category: "food",
    quantity: "2",
    facts_snapshot: {
      attributes: {
        product: "Rice",
        storage_condition: "room_temperature",
        brand: "a_brand",
      },
      expiry: { expiry_date: "2027-03-15", date_type: "DDM" },
    },
    computed: { expiry: { bucket: "lt_30", days_left: 15 } },
  } as unknown as Offer;
  const html = renderToStaticMarkup(<Evidence offer={offer} />);
  expect(html).toContain("Looks like medicine");
  expect(html).toContain("Room temperature");
  expect(html).toContain("a_brand");
  expect(html).not.toContain("room_temperature");
  expect(html).toContain("chip-danger");
  expect(html).toContain("15 Mar 2027");
  expect(html).not.toContain("chip-success");
  expect(html).not.toContain("lt_30");
});

it("preserves original AI facts and before/after corrections with readable fields", () => {
  const offer = {
    id: "offer",
    category: "food",
    quantity: "3",
    facts_snapshot: { attributes: { product: "Corrected rice" }, expiry: {} },
    computed: { expiry: { bucket: "unknown", days_left: null } },
  } as unknown as Offer;
  const html = renderToStaticMarkup(<Evidence offer={offer} />);
  expect(html).toContain("Original pasta");
  expect(html).toContain("Corrected rice");
  expect(html).toContain("Before change");
  expect(html).toContain("After change");
  expect(html).toContain("BEST_BEFORE_15/03/2027");
  expect(html).toContain("BEST_BEFORE_15/04/2027");
  expect(html).toContain("15 Mar 2027");
  expect(html).toContain("15 Apr 2027");
  expect(html).toContain("2 items");
  expect(html).toContain("3 items");
  expect(html).toContain("Printed date");
  expect(html).toContain("Room temperature");
  expect(html).toContain("a_brand");
  expect(html).not.toContain("schema_version");
  expect(html).not.toContain("before_snapshot");
  expect(html).not.toContain("expiry_date");
  expect(html).not.toContain("private-edit-id");
  expect(html).not.toContain("private-actor-id");
});
