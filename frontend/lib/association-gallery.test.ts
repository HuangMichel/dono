import { expect, it } from "vitest";
import { createInitialState, DEMO_ASSOCIATION_ID } from "./demo-store";
import {
  associationGallery,
  filterGalleryDonations,
} from "./association-gallery";

it("preserves scoped donation order, first evidence and analysis-key insertion order", () => {
  const state = createInitialState();
  const first = {
    ...state.donations[0],
    id: "first",
    basis_analysis_id: "basis",
  };
  const second = {
    ...first,
    id: "second",
    category: "food" as const,
    basis_analysis_id: "other",
  };
  state.donations = [
    first,
    second,
    { ...first, id: "draft", status: "draft" },
    {
      ...first,
      id: "foreign",
      association_id: "foreign",
      basis_analysis_id: "foreign-analysis",
    },
  ];
  const analysis = state.analyses[0];
  const source = analysis.indicators[0].source;
  state.analyses = [
    {
      ...analysis,
      id: "foreign-analysis",
      indicators: [{ source, key: "foreign" }],
    },
    {
      ...analysis,
      id: "other",
      indicators: [
        { source, key: "seal", level: "low" },
        { source, key: "stains", level: "high" },
      ],
    },
    {
      ...analysis,
      id: "basis",
      indicators: [
        { source, key: "stains", level: "low" },
        { source, key: "medicine", level: "high" },
      ],
    },
    {
      ...analysis,
      id: "basis",
      indicators: [{ source, key: "duplicate-analysis-key", level: "high" }],
    },
    {
      ...analysis,
      id: "historical",
      indicators: [{ source, key: "historical" }],
    },
  ];
  state.photos = [
    {
      ...state.photos[0],
      id: "first-photo",
      donation_id: first.id,
      content_url: "/first.jpg",
    },
    {
      ...state.photos[0],
      id: "second-photo",
      donation_id: first.id,
      content_url: "/second.jpg",
    },
  ];
  state.expiry_facts = [
    { ...state.expiry_facts[0], donation_id: first.id, expiry_date: null },
    {
      ...state.expiry_facts[0],
      donation_id: first.id,
      expiry_date: "2027-01-01",
    },
  ];
  const gallery = associationGallery(state, DEMO_ASSOCIATION_ID);
  expect(gallery.donations.map((d) => d.id)).toEqual(["first", "second"]);
  expect(gallery.keys).toEqual([
    "seal",
    "stains",
    "medicine",
    "duplicate-analysis-key",
  ]);
  expect(gallery.analysisById.get("basis")).toBe(state.analyses[2]);
  expect(gallery.photoByDonationId.get("first")?.content_url).toBe(
    "/first.jpg",
  );
  expect(gallery.expiryByDonationId.get("first")?.expiry_date).toBeNull();
  expect(
    filterGalleryDonations(gallery, "all", "stains", "high").map((d) => d.id),
  ).toEqual(["second"]);
  expect(filterGalleryDonations(gallery, "clothes", "stains", "high")).toEqual(
    [],
  );
  expect(
    filterGalleryDonations(gallery, "all", "", "high").map((d) => d.id),
  ).toEqual(["first", "second"]);
  expect(
    filterGalleryDonations(gallery, "all", "duplicate-analysis-key", "high"),
  ).toEqual([]);
  const changed = associationGallery(
    {
      ...state,
      photos: [state.photos[1]],
      donations: [{ ...first, basis_analysis_id: "missing" }],
    },
    DEMO_ASSOCIATION_ID,
  );
  expect(changed.photoByDonationId.get("first")?.content_url).toBe(
    "/second.jpg",
  );
  expect(changed.keys).toEqual([]);
  expect(filterGalleryDonations(changed, "all", "", "")).toHaveLength(1);
  expect(filterGalleryDonations(changed, "all", "", "high")).toEqual([]);
});
