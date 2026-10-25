import { describe, expect, it } from "vitest";
import { paginateItems, paginationRange } from "./pagination-model";

describe("pagination ranges", () => {
  it("returns only the requested slice and its readable range", () => {
    expect(paginateItems(["a", "b", "c", "d", "e"], 2, 2)).toEqual({
      items: ["c", "d"],
      page: 2,
      pageCount: 3,
      totalItems: 5,
      start: 3,
      end: 4,
    });
  });
});

it("clamps a removed final page and handles empty results", () => {
  expect(paginateItems(["a", "b", "c"], 8, 2)).toEqual({
    items: ["c"],
    page: 2,
    pageCount: 2,
    totalItems: 3,
    start: 3,
    end: 3,
  });
  expect(paginateItems([], 5, 10)).toEqual({
    items: [],
    page: 1,
    pageCount: 1,
    totalItems: 0,
    start: 0,
    end: 0,
  });
});
it("normalizes invalid inputs without mutating the collection", () => {
  const items = Object.freeze([1, 2, 3]);
  expect(paginateItems(items, -3, 0).items).toEqual([1]);
  expect(paginateItems(items, NaN, Infinity).items).toEqual([1, 2, 3]);
  expect(paginationRange(12, 2, 10)).toEqual({
    page: 2,
    pageCount: 2,
    totalItems: 12,
    start: 11,
    end: 12,
  });
  expect(items).toEqual([1, 2, 3]);
});
