// @vitest-environment jsdom
import React, { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
const { apiPage, api } = vi.hoisted(() => ({ apiPage: vi.fn(), api: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiPage, api }));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "staff" }, loading: false }),
}));
vi.mock("@/components/association/shell", () => ({
  useAssociation: () => ({ id: "association" }),
  ConsoleTitle: () => null,
  ResourceStatus: () => null,
  More: () => null,
}));
vi.mock("@/components/association/auth-photo", () => ({
  AuthPhoto: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
import Images from "./page";
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
beforeEach(() => {
  api.mockReset().mockResolvedValue({
    buckets: [],
    reference_date: "2026-10-25",
    timezone: "Europe/Paris",
  });
  apiPage.mockReset();
  apiPage.mockResolvedValue({
    data: [],
    page: { has_more: false, next_cursor: null },
  });
});

it("opens all frozen evidence on demand and closes it without changing the gallery", async () => {
  const offer = {
    id: "offer-one",
    category: "food",
    quantity: "2",
    facts_snapshot: {
      name: "Rice",
      attributes: {},
      expiry: { expiry_date: "2027-04-15" },
    },
    computed: { expiry: { bucket: "lt_90", days_left: 60 } },
  };
  const photos = [
    { id: "item", kind: "item" },
    { id: "label", kind: "label" },
  ];
  apiPage.mockImplementation(async (path: string) => ({
    data: path.includes("/images?")
      ? [
          {
            lot: {
              offer,
              receipt: { id: "receipt", created_at: "2026-10-25T10:00:00Z" },
              remaining_quantity: "2",
              expiry: offer.computed.expiry,
            },
            photos,
            indicators: [],
          },
        ]
      : [],
    page: { has_more: false, next_cursor: null },
  }));
  api.mockImplementation(async (path: string) =>
    path.endsWith("/evidence")
      ? {
          photos,
          requests: [],
          edits: [],
          category_mismatch: false,
          analyses: [
            {
              id: "analysis",
              category: "food",
              provider: "openai",
              model: "vision",
              confidence: 0.9,
              extracted: {
                dates: { expiry_date: "2027-03-15", date_type: "DDM" },
              },
              indicators: [
                { key: "seal_broken", probability: 0.5, level: "medium" },
                { key: "label_unreadable", probability: 0.1, level: "low" },
              ],
            },
          ],
        }
      : { buckets: [] },
  );
  const view = await render(<Images />);
  await settle();
  expect(api.mock.calls.some(([path]) => path.endsWith("/evidence"))).toBe(
    false,
  );
  const details =
    view.container.querySelector<HTMLDetailsElement>(".images-evidence")!;
  expect(details).not.toBeNull();
  expect(details.querySelector("summary")?.textContent).toBe(
    "View item evidence",
  );
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
  });
  await settle();
  expect(api).toHaveBeenCalledWith(
    "/offers/offer-one/evidence",
    expect.anything(),
  );
  expect(details.querySelectorAll('[role="img"]')).toHaveLength(2);
  expect(details.textContent).toContain("Broken seal");
  expect(details.textContent).toContain("Unreadable label");
  expect(details.textContent).toContain("Date corrected by donor");
  expect(details.textContent).toContain("15 Mar 2027");
  expect(details.textContent).toContain("15 Apr 2027");
  await act(async () => {
    details.open = false;
    details.dispatchEvent(new Event("toggle"));
  });
  expect(details.querySelectorAll('[role="img"]')).toHaveLength(0);
  expect(view.container.querySelectorAll(".images-tile")).toHaveLength(1);
});
it("applies the indicator chip as a filter and clears it on a second click", async () => {
  const view = await render(<Images />);
  await settle();
  expect(apiPage).toHaveBeenCalledWith(
    "/associations/association/images?",
    expect.anything(),
  );
  apiPage.mockClear();
  const stains = [...view.container.querySelectorAll("button")].find(
    (button) => button.textContent === "Stains",
  )!;
  await act(async () => stains.click());
  await settle();
  expect(apiPage).toHaveBeenCalledWith(
    "/associations/association/images?indicator_key=stains_visible",
    expect.anything(),
  );
  apiPage.mockClear();
  await act(async () => stains.click());
  await settle();
  expect(apiPage).toHaveBeenCalledWith(
    "/associations/association/images?",
    expect.anything(),
  );
});
