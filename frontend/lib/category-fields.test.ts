import { expect, it } from "vitest";
import {
  categoryFields,
  fieldsForCategory,
  parseAttributeInput,
} from "./category-fields";
import { needAttributes } from "@/components/association/need-fields";
import { changeCategory, type Facts } from "@/components/donor/api-donation";
it("shares options and converts only boolean attributes", () => {
  expect(fieldsForCategory("shoes")).toBe(categoryFields.shoes);
  expect(fieldsForCategory("unknown")).toEqual({});
  expect(parseAttributeInput("pair_complete", "false")).toBe(false);
  expect(parseAttributeInput("non_perishable", "true")).toBe(true);
  expect(parseAttributeInput("type", "other")).toBe("other");
  expect(parseAttributeInput("product", "true")).toBe("true");
  expect(parseAttributeInput("pair_complete", "")).toBeNull();
});
it("keeps unknown need attributes and clears blank known filters", () => {
  const data = new FormData();
  data.set("attribute_type", " sneakers ");
  data.set("attribute_pair_complete", "false");
  expect(
    needAttributes(data, "shoes", { size: "43", future_attribute: "retained" }),
  ).toEqual({
    type: "sneakers",
    size: null,
    pair_complete: false,
    future_attribute: "retained",
  });
});
it("resets category-specific donor facts without losing quantity", () => {
  const previous: Facts = {
    category: "clothes",
    attributes: { size: "M", unknown: "old" },
    quantity: "7",
    unit: "item",
    expiry: { date_type: "expiry" },
  };
  expect(changeCategory(previous, "food")).toEqual({
    category: "food",
    attributes: {},
    quantity: "7",
    unit: "item",
    expiry: {},
  });
  expect(previous.attributes.size).toBe("M");
});
