// @vitest-environment jsdom
import React, { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { Donation, Offer } from "@/lib/api-contracts";
const { api, apiPage, notify } = vi.hoisted(() => ({
  api: vi.fn(),
  apiPage: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api, apiPage }));
vi.mock("@/components/ui/notifications", () => ({
  useNotifications: () => ({ notify }),
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "donor" }, loading: false }),
}));
import { DonationRow } from "./donation-row";
const donation = {
  id: "item",
  revision: "1",
  status: "ready",
  facts: {
    category: "food",
    attributes: { product: "Rice" },
    quantity: "3",
    expiry: {},
  },
  computed: { active_offer_id: null, inventory_state: "unreceived" },
} as unknown as Donation;
const offer = {
  id: "offer",
  decision: null,
  computed: { effective_state: "refused" },
} as Offer;
const page = (items: Offer[], cursor: string | null = null) => ({
  data: items,
  page: { has_more: !!cursor, next_cursor: cursor },
});
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
beforeEach(() => {
  api.mockReset();
  apiPage.mockReset();
  notify.mockReset();
  apiPage.mockResolvedValue(page([offer]));
});
it("shows the authored description in expanded donation details", async () => {
  const view = await render(
    <DonationRow
      compact
      donation={{
        ...donation,
        facts: {
          ...donation.facts,
          name: "Basmati rice",
          description: "Unopened bag.\nStored in a dry cupboard.",
        },
      }}
      refresh={async () => {}}
    />,
  );
  expect(view.container.querySelector(".item-description")?.textContent).toBe(
    "Unopened bag.\nStored in a dry cupboard.",
  );
});
it("loads a one-record summary while collapsed, then paginates history on demand", async () => {
  apiPage.mockImplementation(async (path: string) =>
    path.endsWith("/offers") ? page([offer], "earlier") : page([offer]),
  );
  const view = await render(
    <DonationRow donation={donation} refresh={async () => {}} />,
  );
  await settle();
  expect(apiPage.mock.calls.map(([path]) => path)).toEqual([
    "/donations/item/offers?limit=1",
  ]);
  expect(view.container.textContent).toContain("Refused by staff");
  const details = view.container.querySelector("details")!;
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
  });
  await settle();
  expect(apiPage).toHaveBeenCalledWith(
    "/donations/item/offers",
    expect.anything(),
  );
  const more = [...view.container.querySelectorAll("button")].find(
    (button) => button.textContent === "Load earlier offers",
  )!;
  await act(async () => more.click());
  expect(apiPage).toHaveBeenCalledWith(
    "/donations/item/offers?cursor=earlier",
    expect.anything(),
  );
});
it("loads an active offer directly and reconciles its state after a failed withdrawal", async () => {
  let active = { ...offer, computed: { effective_state: "approved" } } as Offer;
  api.mockImplementation(async (path: string) => {
    if (path.endsWith("/withdrawal")) {
      active = {
        ...offer,
        computed: { effective_state: "withdrawn" },
      } as Offer;
      throw Error("Response lost");
    }
    return active;
  });
  const refresh = vi.fn(async () => {});
  const view = await render(
    <DonationRow
      donation={{
        ...donation,
        computed: { ...donation.computed, active_offer_id: "offer" },
      }}
      refresh={refresh}
    />,
  );
  await settle();
  expect(api).toHaveBeenCalledWith("/offers/offer", expect.anything());
  expect(apiPage).not.toHaveBeenCalled();
  expect(view.container.textContent).toContain("Manage drop-off");
  const withdraw = [...view.container.querySelectorAll("button")].find(
    (button) => button.textContent === "Withdraw donation",
  )!;
  await act(async () => withdraw.click());
  expect(refresh).toHaveBeenCalled();
  expect(notify).toHaveBeenCalledWith({
    message: "Response lost",
    tone: "error",
  });
  expect(notify).not.toHaveBeenCalledWith(
    expect.objectContaining({ tone: "success" }),
  );
  expect(view.container.textContent).not.toContain("Manage drop-off");
  expect(apiPage).not.toHaveBeenCalled();
});

it.each(["in_stock", "distributed"] as const)(
  "does not suggest another offer after the donation is %s",
  async (inventoryState) => {
    apiPage.mockResolvedValue(
      page([
        {
          ...offer,
          decision: "approved",
          computed: { effective_state: "fulfilled" },
        } as Offer,
      ]),
    );
    const view = await render(
      <DonationRow
        donation={{
          ...donation,
          computed: { ...donation.computed, inventory_state: inventoryState },
        }}
        refresh={async () => {}}
      />,
    );
    await settle();
    expect(view.container.textContent).toContain(
      "The association has received your donation.",
    );
    expect(view.container.textContent).not.toContain("you can offer it again");
    expect(view.container.textContent).not.toContain("Book your drop-off");
  },
);
