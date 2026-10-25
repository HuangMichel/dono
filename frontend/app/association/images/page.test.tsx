// @vitest-environment jsdom
import React, { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
const { apiPage } = vi.hoisted(() => ({ apiPage: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiPage }));
vi.mock("@/lib/api-hooks", () => ({
  useApiPage: (path: string) => {
    const data = apiPage(path);
    return {
      data: data?.data ?? [],
      loading: !data,
      error: null,
      hasMore: false,
      refresh: vi.fn(),
      loadMore: vi.fn(),
    };
  },
  useApiResource: (path: string) => {
    if (path.includes("expiry-counts"))
      return {
        data: {
          buckets: [],
          reference_date: "2026-10-25",
          timezone: "Europe/Paris",
        },
        loading: false,
        error: null,
        refresh: vi.fn(),
      };
    return {
      data: null,
      loading: false,
      error: null,
      refresh: vi.fn(),
    };
  },
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "staff" }, loading: false }),
}));
vi.mock("@/components/association/shell", () => ({
  useAssociation: () => ({ id: "association" }),
  ConsoleTitle: () => null,
  ResourceStatus: () => null,
  More: () => null,
}));
vi.mock("@/components/association/evidence", () => ({
  AuthPhoto: () => null,
  itemName: () => "Item",
  probabilityLabel: () => "",
  instant: () => "",
}));
import Images from "./page";
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
beforeEach(() => {
  apiPage.mockReset();
  apiPage.mockResolvedValue({
    data: [],
    page: { has_more: false, next_cursor: null },
  });
});
it("applies the indicator chip as a filter and clears it on a second click", async () => {
  const view = await render(<Images />);
  await settle();
  expect(apiPage).toHaveBeenCalledWith("/associations/association/images?");
  apiPage.mockClear();
  const stains = [...view.container.querySelectorAll("button")].find(
    (button) => button.textContent === "Stains",
  )!;
  await act(async () => stains.click());
  await settle();
  expect(apiPage).toHaveBeenCalledWith(
    "/associations/association/images?indicator_key=stains_visible",
  );
  apiPage.mockClear();
  await act(async () => stains.click());
  await settle();
  expect(apiPage).toHaveBeenCalledWith("/associations/association/images?");
});
