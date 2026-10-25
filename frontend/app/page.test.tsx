import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/components/public-shell", () => ({
  PublicShell: ({ children }: { children: React.ReactNode }) => children,
}));
import Home from "./page";

it("shows the impact chain in order with a linked source for every figure", () => {
  const html = renderToStaticMarkup(<Home />);
  const steps = ["Easy to donate", "The right association", "Less waste"].map(
    (step) => html.indexOf(`<h3>${step}</h3>`),
  );
  expect(steps.every((index) => index >= 0)).toBe(true);
  expect([...steps].sort((a, b) => a - b)).toEqual(steps);
  const evidence =
    html.match(/<figure class="impact-evidence">.*?<\/figure>/g) ?? [];
  expect(evidence).toHaveLength(3);
  for (const item of evidence)
    expect(item).toMatch(
      /<strong class="num">[^<]+<\/strong>.*Source: <a href="https:\/\/[^"]+">[^<]+<\/a>/,
    );
});
