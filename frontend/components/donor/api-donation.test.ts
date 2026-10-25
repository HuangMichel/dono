import { expect, it } from "vitest";
import {
  validatePhotoFiles,
  changeCategory,
  createCommandKeys,
  itemName,
} from "./api-donation";
it("uses the donor's item name and retains it across category changes", () => {
  const facts = {
    name: "Blue winter coat",
    description: "Small tear inside the left pocket.",
    category: "clothes" as const,
    attributes: { type: "coat" },
    quantity: "1",
    unit: "item" as const,
    expiry: {},
  };
  expect(itemName(facts)).toBe("Blue winter coat");
  expect(changeCategory(facts, "furniture")).toMatchObject({
    name: "Blue winter coat",
    description: "Small tear inside the left pocket.",
    attributes: {},
  });
  expect(itemName({ ...facts, name: null })).toBe("Coat");
});
it("rejects unsupported, oversized and excessive analysis photos", () => {
  expect(() =>
    validatePhotoFiles([{ type: "image/gif", size: 100 }] as File[]),
  ).toThrow("JPEG");
  expect(() =>
    validatePhotoFiles([{ type: "image/jpeg", size: 4_194_305 }] as File[]),
  ).toThrow("4 MB");
  expect(() =>
    validatePhotoFiles(
      Array.from({ length: 4 }, () => ({
        type: "image/png",
        size: 100,
      })) as File[],
    ),
  ).toThrow("three");
});
it("allows three supported photos at the exact 4 MiB boundary", () => {
  expect(() =>
    validatePhotoFiles(
      ["image/jpeg", "image/png", "image/webp"].map((type) => ({
        type,
        size: 4_194_304,
      })) as File[],
    ),
  ).not.toThrow();
});
it("drops incompatible attributes and dates when changing category", () => {
  expect(
    changeCategory(
      {
        category: "food",
        attributes: { product: "Rice" },
        quantity: "2",
        unit: "item",
        expiry: { expiry_date: "2027-01-01" },
      },
      "clothes",
    ),
  ).toEqual({
    category: "clothes",
    attributes: {},
    quantity: "2",
    unit: "item",
    expiry: {},
  });
});

it("reuses command keys after a lost response and separates changed payloads", () => {
  let counter = 0;
  const key = createCommandKeys(() => String(++counter));
  const upload = {};
  expect(key(upload)).toBe("1");
  expect(key(upload)).toBe("1");
  expect(key("book:slot-a:rev1")).toBe("2");
  expect(key("book:slot-a:rev1")).toBe("2");
  expect(key("book:slot-b:rev1")).toBe("3");
});
