// @vitest-environment jsdom
import React, { act } from "react";
import { expect, it, vi } from "vitest";
import { render } from "@/test/render";
const { page } = vi.hoisted(() => ({ page: vi.fn() }));
vi.mock("@/lib/api-hooks", () => ({ useApiPage: page }));
vi.mock("@/components/association/shell", () => ({
  ConsoleTitle: ({ title }: { title: string }) => <h1>{title}</h1>,
  useAssociation: () => ({ id: "assoc" }),
  More: () => null,
}));
vi.mock("@/components/association/auth-photo", () => ({
  AuthPhoto: () => <span>Item photo</span>,
}));
import Offers from "./page";
it("filters nearby posted items and handles empty results", async () => {
  page.mockReturnValue({
    data: [
      {
        id: "one",
        name: "Blue winter coat",
        description: "Small tear inside the pocket.",
        category: "clothes",
        attributes: { product: "Coat" },
        quantity: "2",
        unit: "item",
        expiry: { expiry_date: null },
        photos: [],
        indicators: [],
        locality: "Mulhouse",
        distance_km: 2,
        posted_at: "2026-10-25T10:00:00Z",
      },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  const view = await render(<Offers />);
  expect(view.container.textContent).toContain("Offers nearby");
  expect(view.container.textContent).toContain("Mulhouse");
  expect(view.container.querySelector(".posted-detail h2")?.textContent).toBe(
    "Blue winter coat",
  );
  expect(view.container.querySelector(".posted-detail")?.textContent).toContain(
    "Small tear inside the pocket.",
  );
  expect(
    view.container.querySelector(".posted-gallery")?.textContent,
  ).not.toContain("Small tear inside the pocket.");
  const category = view.container.querySelector<HTMLSelectElement>(
    'select[aria-label="Category"]',
  )!;
  await act(async () => {
    category.value = "food";
    category.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(page.mock.lastCall?.[0]).toContain("category=food");
  const radius = view.container.querySelector<HTMLSelectElement>(
    'select[aria-label="Distance"]',
  )!;
  await act(async () => {
    radius.value = "50";
    radius.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(page.mock.lastCall?.[0]).toContain("radius_km=50");
  page.mockReturnValue({
    data: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  await view.rerender(<Offers />);
  expect(view.container.textContent).toContain("No posted items");
});
it("shows loading and recoverable errors without stale selected evidence", async () => {
  const refresh = vi.fn();
  page.mockReturnValue({ data: [], loading: true, error: null, refresh });
  const view = await render(<Offers />);
  expect(
    view.container.querySelector('[role="status"]')?.textContent,
  ).toContain("Loading");
  page.mockReturnValue({
    data: [],
    loading: false,
    error: "Set your association site address.",
    refresh,
  });
  await view.rerender(<Offers />);
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
    "site address",
  );
  expect(
    view.container.querySelector('[aria-label="Selected item"]'),
  ).toBeNull();
  const retry = Array.from(view.container.querySelectorAll("button")).find(
    (button) => button.textContent === "Retry",
  )!;
  await act(async () => retry.click());
  expect(refresh).toHaveBeenCalledOnce();
});
