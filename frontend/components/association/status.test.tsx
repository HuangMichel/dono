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
it("identifies approval as a staff decision", () => {
  expect(renderToStaticMarkup(<StateChip state="approved" />)).toContain(
    "Approved by staff",
  );
});
