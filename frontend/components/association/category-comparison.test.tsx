import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { CategoryComparison } from "./category-comparison";

it("shows returned category scores in descending order with friendly labels and zero", () => {
  const html = renderToStaticMarkup(
    <CategoryComparison
      extracted={{ clothes: 0, para: 0.2, furniture: 0.8 }}
    />,
  );
  expect(html.indexOf("Small furniture")).toBeLessThan(
    html.indexOf("Hygiene &amp; care"),
  );
  expect(html.indexOf("Hygiene &amp; care")).toBeLessThan(
    html.indexOf("Clothes"),
  );
  expect(html).toContain("80%");
  expect(html).toContain("20%");
  expect(html).toContain("0%");
  expect(html).toContain("width:80%");
  expect(html).toContain(
    "These are category suggestions, not approval decisions.",
  );
});
it("finds a nested metadata map without changing or normalising its scores", () => {
  const html = renderToStaticMarkup(
    <CategoryComparison
      extracted={{
        classification: { probabilities: { food: 0.28, furniture: 0.15 } },
      }}
    />,
  );
  expect(html).toContain("28%");
  expect(html).toContain("15%");
});
it.each([
  { probabilities: { food: 1.1, clothes: 0 } },
  { probabilities: { food: -0.1, clothes: 0.2 } },
  { probabilities: { food: Number.NaN, clothes: 0.2 } },
  { probabilities: { food: "0.2", clothes: 0.2 } },
  { probabilities: { food: 0.2 } },
  { probabilities: { food: 0.2, unknown: 0.8 } },
  { one: { food: 0.2, clothes: 0.8 }, two: { shoes: 0.4, furniture: 0.6 } },
  {
    attributes: { food: 0.2, clothes: 0.8 },
    dates: { food: 0.2, clothes: 0.8 },
  },
])("does not chart malformed, ambiguous or item-fact data", (extracted) => {
  expect(
    renderToStaticMarkup(<CategoryComparison extracted={extracted} />),
  ).toBe("");
});
