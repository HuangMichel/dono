import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const { counts } = vi.hoisted(() => ({ counts: { soon: 3, month: 2 } }));
beforeEach(() => {
  counts.soon = 3;
  counts.month = 2;
});
vi.mock("@/components/association/shell", () => ({
  ConsoleTitle: ({ title }: { title: string }) => <h1>{title}</h1>,
  useAssociation: () => ({
    id: "association",
    membership: { role: "assoc_admin" },
    association: { name: "Real association" },
  }),
  ResourceStatus: () => null,
}));
vi.mock("@/lib/api-hooks", () => ({
  useApiPage: () => ({ data: [], loading: false, error: null, hasMore: false }),
  useApiResource: () => ({
    data: {
      buckets: [
        { key: "lt_7", count: counts.soon },
        { key: "lt_30", count: counts.month },
      ],
      reference_date: "2026-10-25",
    },
    loading: false,
    error: null,
  }),
}));
import Dashboard from "./page";
it("shows operational priorities with exact expiry counts and honest empty sections", () => {
  const html = renderToStaticMarkup(<Dashboard />);
  expect(html).toContain("Distribute first");
  expect(html).toContain("5 donations");
  expect(html).toContain("No offers waiting for review.");
  expect(html).toContain("No drop-offs scheduled today.");
  expect(html).not.toContain("0 offers");
});

it("uses the singular when one donation expires soon", () => {
  counts.soon = 1;
  counts.month = 0;
  const html = renderToStaticMarkup(<Dashboard />);
  expect(html).toContain("1 donation expiring within 30 days");
  expect(html).not.toContain("1 donations");
});
