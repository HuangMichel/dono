import React from "react";
import { NotificationProvider } from "@/components/ui/notifications";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  role: "assoc_staff",
  data: [] as unknown[],
}));
vi.mock("@/components/association/shell", () => ({
  ConsoleTitle: ({ title }: { title: string }) => <h1>{title}</h1>,
  useAssociation: () => ({
    id: "actual-association",
    membership: { role: state.role },
  }),
  ResourceStatus: ({ empty }: { empty: boolean }) =>
    empty ? <p>No results.</p> : null,
  More: () => null,
  CategorySelect: () => null,
  NumberInput: ({ label }: { label: string }) => (
    <label>
      {label}
      <input />
    </label>
  ),
  Feedback: () => null,
}));
vi.mock("@/lib/api-hooks", () => ({
  useApiPage: () => ({
    data: state.data,
    loading: false,
    error: null,
    refresh: vi.fn(),
    hasMore: false,
    loadMore: vi.fn(),
  }),
}));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));
import Needs from "./page";
beforeEach(() => {
  state.role = "assoc_staff";
  state.data = [];
});
it("shows an empty live workspace without invented needs", () => {
  const html = renderToStaticMarkup(
    <NotificationProvider>
      <Needs />
    </NotificationProvider>,
  );
  expect(html).toContain("No results.");
  expect(html).not.toContain("Save need");
});
it("lets association admins configure needs and independent storage rates", () => {
  state.role = "assoc_admin";
  const html = renderToStaticMarkup(
    <NotificationProvider>
      <Needs />
    </NotificationProvider>,
  );
  expect(html).toContain("Save need");
  expect(html).toContain("Storage places per item");
  expect(html).not.toContain("sample");
});
it("shows actual scoped demand balances to staff without edit controls", () => {
  state.data = [
    {
      id: "need-real",
      category: "food",
      attributes: { product: "Rice" },
      target_quantity: "12.000",
      storage_units_per_item: 2,
      active: true,
      computed: {
        held_quantity: "3.000",
        fulfilled_quantity: "4.000",
        available_quantity: "5.000",
      },
    },
  ];
  const html = renderToStaticMarkup(
    <NotificationProvider>
      <Needs />
    </NotificationProvider>,
  );
  expect(html).toContain("Rice");
  expect(html).toContain("5.000");
  expect(html).not.toContain("Edit need");
});
it("names each need in the phone list, not only its category", () => {
  state.data = [
    {
      id: "need-real",
      category: "food",
      attributes: { product: "Rice" },
      target_quantity: "12.000",
      storage_units_per_item: 2,
      active: true,
      computed: {
        held_quantity: "3.000",
        fulfilled_quantity: "4.000",
        available_quantity: "5.000",
      },
    },
  ];
  const html = renderToStaticMarkup(
    <NotificationProvider>
      <Needs />
    </NotificationProvider>,
  );
  const phoneList = html.split('class="data-table-mobile-list"')[1] ?? "";
  expect(phoneList).toContain("Product: Rice");
});
