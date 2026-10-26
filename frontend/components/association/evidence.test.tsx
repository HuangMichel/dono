import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { Offer } from "@/lib/api-contracts";
vi.mock("@/components/association/shell", () => ({
  ResourceStatus: () => null,
}));
vi.mock("./auth-photo", () => ({
  AuthPhoto: ({ alt, size }: { alt: string; size: number }) => (
    <span data-photo-size={size}>{alt}</span>
  ),
}));
vi.mock("@/lib/api-hooks", () => ({
  useApiResource: () => ({
    data: {
      photos: [
        {
          id: "item-photo",
          kind: "item",
          content_url: "/api/v1/photos/item/content",
        },
        {
          id: "label-photo",
          kind: "label",
          content_url: "/api/v1/photos/label/content",
        },
      ],
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
import { Evidence, itemName } from "./evidence";
it("shows the frozen donor name and description as offered evidence", () => {
  const offer = {
    id: "offer",
    category: "clothes",
    quantity: "1",
    facts_snapshot: {
      name: "Blue winter coat",
      description: "Pocket torn.\n<script>private text</script>",
      attributes: { type: "coat" },
      expiry: {},
    },
    computed: { expiry: { bucket: "not_applicable" } },
  } as unknown as Offer;
  expect(itemName(offer)).toBe("Blue winter coat");
  const html = renderToStaticMarkup(<Evidence offer={offer} />);
  expect(html).toContain("Blue winter coat");
  expect(html).toContain("Pocket torn.");
  expect(html).toContain("&lt;script&gt;private text&lt;/script&gt;");
  expect(html).not.toContain("<script>");
  expect(
    itemName({
      ...offer,
      facts_snapshot: { ...offer.facts_snapshot, name: undefined },
    }),
  ).toBe("Coat");
});
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

it("keeps corrected raw dates as evidence and uses only the API expiry projection for status", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2027-03-15T12:00:00Z"));
  try {
    const offer = {
      id: "offer",
      category: "food",
      quantity: "1",
      facts_snapshot: {
        attributes: { product: "Rice" },
        expiry: { expiry_date: "2027-03-16", date_type: "DDM" },
      },
      computed: { expiry: { bucket: "today", days_left: 0 } },
    } as unknown as Offer;
    const html = renderToStaticMarkup(<Evidence offer={offer} />);
    const correction = html.match(
      /<section[^>]*aria-label="Date corrected by donor"[\s\S]*?<\/section>/,
    )?.[0];
    expect(correction).toContain("15 Mar 2027");
    expect(correction).toContain("16 Mar 2027");
    expect(correction).not.toMatch(/Expired|Expires today|days left/);
    expect(html).toContain("Expires today");
  } finally {
    vi.useRealTimers();
  }
});

it("uses the review overview without losing photos, indicators or corrections", () => {
  const offer = {
    id: "offer",
    category: "food",
    quantity: "3",
    facts_snapshot: {
      name: "Rice",
      attributes: { product: "Rice" },
      expiry: { expiry_date: "2027-03-16", date_type: "DDM" },
    },
    computed: { expiry: { bucket: "today", days_left: 0 } },
  } as unknown as Offer;
  const html = renderToStaticMarkup(<Evidence offer={offer} layout="review" />);
  expect(html).toContain("review-evidence-overview");
  expect(html.match(/data-photo-size="320"/g)).toHaveLength(2);
  expect(html).toContain("Item photo of Rice");
  expect(html).toContain("Printed label photo of Rice");
  expect(html).toContain("Selected category");
  expect(html).toContain("AI indicators for this offer");
  expect(html).toContain("Date corrected by donor");
  expect(html).toContain("Item changes before this offer");
  expect(html).toContain("15 Mar 2027");
  expect(html).toContain("16 Mar 2027");
});

function renderEvidenceData(data: Record<string, unknown>) {
  const offer = {
    id: "offer",
    category: "furniture",
    quantity: "1",
    facts_snapshot: { name: "Chair", attributes: {}, expiry: {} },
    computed: { expiry: { bucket: "not_applicable" } },
  } as unknown as Offer;
  const resource = {
    data: { photos: [], analyses: [], edits: [], requests: [], ...data },
  };
  return renderToStaticMarkup(
    <Evidence offer={offer} resource={resource as never} />,
  );
}

it("separates unassessed indicators while preserving zero and false evidence", () => {
  const html = renderEvidenceData({
    analyses: [
      {
        id: "a",
        category: "furniture",
        provider: "openai",
        model: "vision",
        confidence: 0.28,
        indicators: [
          {
            key: "looks_like_medicine",
            value: "no",
            probability: 0,
            level: "low",
          },
          { key: "surface_damage", value: false },
          { key: "structural_damage" },
        ],
        extracted: {
          attributes: { size: null, count: 0, sealed: false },
          dates: { date_type: "not_applicable", raw_label: null },
        },
      },
    ],
  });
  expect(html).toContain("Low likelihood · 0%");
  expect(html).toContain("Not assessed · 1");
  expect(html).toContain("Analysis technical details");
  expect(html).toContain("Raw value: no");
  expect(html).toContain("Information not extracted · 2");
  expect(html).toContain("Not applicable");
  expect(html).toContain(">0</dd>");
  expect(html).toContain(">No</dd>");
});

it("shows only changed fields in a history event and retains complete snapshots", () => {
  const html = renderEvidenceData({
    edits: [
      {
        id: "edit",
        change_kind: "facts_edited",
        created_at: "2026-10-26T10:00:00Z",
        from_state: "draft",
        to_state: "draft",
        before_snapshot: {
          name: "Chair",
          attributes: {
            brand: "Unchanged brand",
            tags: [{ colour: "Blue", size: "Large" }],
            note: "Removed detail",
          },
          expiry: { expiry_date: "2027-03-15" },
        },
        after_snapshot: {
          name: "Chair",
          attributes: {
            tags: [{ size: "Large", colour: "Blue" }],
            brand: "Unchanged brand",
          },
          expiry: { expiry_date: "2027-04-15" },
        },
      },
    ],
  });
  const diff = html.match(/<dl class="evidence-changes">[\s\S]*?<\/dl>/)?.[0];
  expect(diff).toContain("Previous");
  expect(diff).toContain("New");
  expect(diff).toContain("Removed detail");
  expect(diff).toContain("Removed");
  expect(diff).toContain("15 Mar 2027");
  expect(diff).toContain("15 Apr 2027");
  expect(diff).not.toContain("Unchanged brand");
  expect(diff).not.toContain("Blue");
  expect(diff).not.toContain("Chair");
  expect(html).toContain("Full snapshots");
  expect(html).toContain("Unchanged brand");
});

it("keeps creation compact and date uncertainty outside disclosures", () => {
  const html = renderEvidenceData({
    edits: [
      {
        id: "created",
        change_kind: "created",
        created_at: "2026-10-26T10:00:00Z",
        before_snapshot: {},
        after_snapshot: { name: "Chair" },
      },
    ],
    analyses: [
      {
        id: "a",
        category: "furniture",
        provider: "openai",
        model: "vision",
        confidence: 0.28,
        indicators: [],
        extracted: {
          dates: {
            readability: "unreadable",
            expiry_date: null,
            raw_label: "Unreadable label",
          },
        },
      },
    ],
  });
  const creation = html.slice(html.indexOf('class="evidence-history-event"'));
  expect(creation).toContain("Item created");
  expect(creation).not.toContain("evidence-changes");
  expect(creation.indexOf("Chair")).toBeGreaterThan(
    creation.indexOf("Full snapshots"),
  );
  const uncertainty = html.indexOf("The printed date is unclear or incomplete");
  expect(uncertainty).toBeGreaterThan(0);
  expect(uncertainty).toBeLessThan(html.indexOf("Information not extracted"));
});

it("does not invent a probability for a level-only safety warning", () => {
  const html = renderEvidenceData({
    analyses: [
      {
        id: "a",
        category: "furniture",
        provider: "openai",
        model: "vision",
        confidence: 0.28,
        indicators: [{ key: "looks_like_medicine", level: "high" }],
        extracted: {},
      },
    ],
  });
  expect(html).toContain("Medicines cannot be donated");
  expect(html).not.toContain("0%");
});

it("keeps classification metadata technical and ignores irrelevant unknown date defaults", () => {
  const html = renderEvidenceData({
    analyses: [
      {
        id: "a",
        category: "furniture",
        provider: "openai",
        model: "vision",
        confidence: 0.28,
        indicators: [],
        extracted: {
          attributes: { type: "chair" },
          category_probabilities: { food: 0.15 },
          dates: {
            readability: "unknown",
            date_precision: "unknown",
            expiry_date: null,
          },
        },
      },
    ],
  });
  const technical = html.indexOf("Analysis technical details");
  expect(html.indexOf("0.15")).toBeGreaterThan(technical);
  expect(html).not.toContain("The printed date is unclear");
});

it("does not report unchanged date values as edits when snapshot aliases differ", () => {
  const html = renderEvidenceData({
    edits: [
      {
        id: "e",
        change_kind: "facts_edited",
        created_at: "2026-10-26T10:00:00Z",
        before_snapshot: {
          dates: { expiry_date: "2027-03-15", date_type: "DDM" },
        },
        after_snapshot: {
          expiry: { expiry_date: "2027-03-15", date_type: "DDM" },
        },
      },
    ],
  });
  expect(html).toContain("No item details changed");
  expect(html).not.toContain('class="evidence-changes"');
  expect(html.match(/15 Mar 2027/g)).toHaveLength(2);
});

it("omits empty default additions but shows a real value being cleared", () => {
  const html = renderEvidenceData({
    edits: [
      {
        id: "e",
        change_kind: "facts_edited",
        created_at: "2026-10-26T10:00:00Z",
        before_snapshot: { attributes: { brand: "Old brand" } },
        after_snapshot: {
          attributes: { brand: null, size: null, tags: [], extra: {} },
        },
      },
    ],
  });
  const diff = html.match(/<dl class="evidence-changes">[\s\S]*?<\/dl>/)?.[0];
  expect(diff).toContain("Old brand");
  expect(diff).toContain("Not provided");
  expect(diff).not.toContain("Size");
  expect(diff).not.toContain("Tags");
  expect(diff).not.toContain("Extra");
});

it("charts category scores while keeping raw metadata technical and date defaults collapsed", () => {
  const html = renderEvidenceData({
    analyses: [
      {
        id: "a",
        category: "furniture",
        provider: "openai",
        model: "vision",
        confidence: 0.28,
        indicators: [],
        extracted: {
          attributes: { type: "chair" },
          classification: { probabilities: { food: 0.15, para: 0.15 } },
          dates: { readability: "unknown", date_precision: "unknown" },
        },
      },
    ],
  });
  const missing = html.indexOf("Information not extracted · 2");
  const technical = html.indexOf("Analysis technical details");
  expect(missing).toBeGreaterThan(0);
  expect(html.indexOf("Date readability")).toBeGreaterThan(missing);
  expect(html.indexOf("0.15")).toBeGreaterThan(technical);
  const chart = html.match(/<figure class="category-comparison">[\s\S]*?<\/figure>/)?.[0];
  expect(chart).toContain("Food");
  expect(chart).toContain("15%");
  expect(html.indexOf("Category comparison")).toBeLessThan(technical);
});
