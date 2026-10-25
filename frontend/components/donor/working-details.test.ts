import { describe, expect, it } from "vitest";
import { hydrateWorkingDetails, workingDetailsPatch } from "./working-details";

describe("working donation details", () => {
  it("keeps existing defaults for an empty draft", () => {
    expect(hydrateWorkingDetails()).toEqual({
      product: "Winter coat",
      category: "clothes",
      quantity: "1",
      size: "M",
      expiry: "",
      paoMonths: "",
      dateType: "DDM",
    });
  });
  it.each(["clothes", "shoes", "furniture"] as const)(
    "only sends category-relevant attributes for %s",
    (category) => {
      const details = {
        ...hydrateWorkingDetails(),
        category,
        product: "Sample item",
        size: "XL",
        expiry: "2027-01-01",
        paoMonths: "12",
      };
      expect(workingDetailsPatch(details)).toEqual({
        category,
        quantity: "1",
        attributes:
          category === "clothes"
            ? { product: "Sample item", size: "XL" }
            : { product: "Sample item" },
      });
    },
  );
  it("sends calendar-date evidence without retained PAO months for food", () => {
    expect(
      workingDetailsPatch({
        ...hydrateWorkingDetails(),
        category: "food",
        product: "Rice",
        expiry: "2027-03-15",
        paoMonths: "12",
        dateType: "DLC",
      }),
    ).toEqual({
      category: "food",
      quantity: "1",
      attributes: { product: "Rice" },
      expiry: {
        expiry_date: "2027-03-15",
        date_type: "DLC",
        pao_months: null,
        date_precision: "day",
        raw_label: "2027-03-15",
        readability: "readable",
      },
    });
  });
  it("hydrates source facts without adding derived dates or analysis fields", () => {
    const details = hydrateWorkingDetails(
      {
        category: "para",
        quantity: "3",
        attributes: { product: "Sealed cream" },
      },
      { expiry_date: null, date_type: "PAO", pao_months: 12 },
    );
    expect(details).toEqual({
      product: "Sealed cream",
      category: "para",
      quantity: "3",
      size: "M",
      expiry: "",
      paoMonths: "12",
      dateType: "PAO",
    });
    expect(workingDetailsPatch(details)).toEqual({
      category: "para",
      quantity: "3",
      attributes: { product: "Sealed cream" },
      expiry: {
        expiry_date: null,
        date_type: "PAO",
        pao_months: 12,
        date_precision: "unknown",
        raw_label: null,
        readability: "unknown",
      },
    });
  });
});
