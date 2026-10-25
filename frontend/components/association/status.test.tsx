import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ExpiryChip, StateChip } from "./status";
it("shows expiry urgency in words and color without exposing bucket codes", () => {
  const html = renderToStaticMarkup(
    <ExpiryChip expiry={{ bucket: "lt_7", days_left: 3 }} />,
  );
  expect(html).toContain("3 days left");
  expect(html).toContain("chip-warning");
  expect(html).not.toContain("lt_7");
  expect(
    renderToStaticMarkup(
      <ExpiryChip expiry={{ bucket: "unknown", days_left: null }} />,
    ),
  ).toContain("Date unknown");
});
it("omits the expiry chip for undated items unless a count needs the label", () => {
  const expiry = { bucket: "not_applicable" as const, days_left: null };
  expect(renderToStaticMarkup(<ExpiryChip expiry={expiry} />)).toBe("");
  expect(
    renderToStaticMarkup(<ExpiryChip expiry={expiry} showNotApplicable />),
  ).toContain("Expiry not applicable");
});
it("identifies approval as a staff decision", () => {
  expect(renderToStaticMarkup(<StateChip state="approved" />)).toContain(
    "Approved by staff",
  );
});
