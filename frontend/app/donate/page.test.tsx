// @vitest-environment jsdom
import React, { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { DonationSession } from "@/components/donor/donation-session";
import type { Donation } from "@/lib/api-contracts";
import type { Match } from "@/components/donor/api-donation";
const mock = vi.hoisted(() => ({
  api: vi.fn(),
  apiPage: vi.fn(),
  push: vi.fn(),
  params: "",
  session: null as DonationSession | null,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mock.params),
  useRouter: () => ({ push: mock.push }),
}));
vi.mock("@/lib/api", () => ({ api: mock.api, apiPage: mock.apiPage }));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "donor" }, loading: false }),
}));
vi.mock("@/components/ui/notifications", () => ({
  useNotifications: () => ({ notify: vi.fn() }),
}));
vi.mock("@/components/public-shell", () => ({
  PublicShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/donor/donation-session-hook", async (original) => {
  const actual =
    await original<typeof import("@/components/donor/donation-session-hook")>();
  return {
    useDonationSession: (
      ...args: Parameters<typeof actual.useDonationSession>
    ) => {
      const result = actual.useDonationSession(...args);
      mock.session = result.session;
      return result;
    },
  };
});
import Donate from "./page";
beforeEach(() => {
  mock.params = "";
  vi.clearAllMocks();
  mock.apiPage.mockResolvedValue({
    data: [],
    page: { has_more: false, next_cursor: null },
  });
});
it.each(["before search", "with matches", "without matches"])(
  "posts without choosing an association %s",
  async (scenario) => {
    const { container } = await render(<Donate />);
    const session = mock.session!;
    const saved = {
      id: "item",
      revision: "2",
      status: "ready",
      facts: session.getSnapshot().facts,
      computed: { active_offer_id: null, inventory_state: "unreceived" },
    } as Donation;
    if (scenario === "with matches") {
      mock.apiPage.mockResolvedValue({
        data: [
          {
            need_id: "need",
            association: { id: "association", name: "Local association" },
            distance_km: 1,
            budgets: { demand_available: "3", storage_available: "3" },
            reasons: [],
          } as unknown as Match,
        ],
        page: { has_more: false, next_cursor: null },
      });
    }
    await act(async () => {
      session.setDonation(saved);
      session.setStep(2);
      if (scenario !== "before search") await session.findMatches();
      session.setSelected("");
    });
    const posting = container.querySelector('[aria-label="Nearby posting"]');
    expect(posting).not.toBeNull();
    const input = posting!.querySelector<HTMLInputElement>(
      'input[name="posting-location"]',
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "68100");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      posting!
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!
        .click(),
    );
    mock.api.mockResolvedValue({
      ...saved,
      revision: "3",
      posting: { locality: "Mulhouse", posted_at: "2026-10-26T12:00:00Z" },
    });
    await act(async () =>
      posting!
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(mock.api).toHaveBeenCalledWith(
      "/donations/item/posting",
      expect.objectContaining({
        body: { expected_revision: "2", location: "68100" },
      }),
    );
    expect(container.textContent).toContain("Posted for nearby associations");
    expect(mock.api.mock.calls.some(([path]) => path.endsWith("/offers"))).toBe(
      false,
    );
    expect(session.getSnapshot().selected).toBe("");
    if (scenario === "with matches") {
      await act(async () => session.setSelected("need"));
      const send = [...container.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Send offer for staff review"),
      )!;
      await act(async () => send.click());
      expect(mock.api).toHaveBeenCalledWith(
        "/donations/item/offers",
        expect.objectContaining({
          body: {
            expected_donation_revision: "3",
            association_id: "association",
            need_id: "need",
          },
        }),
      );
      expect(container.textContent).toContain("Your offer is sent");
    }
  },
);
it.each(["sent", "no match"])(
  "starts a fresh item from the %s screen on the same donation URL",
  async (screen) => {
    const { container } = await render(<Donate />);
    const original = mock.session!;
    await act(async () => {
      original.setFacts((f) => ({ ...f, name: "Old coat", quantity: "4" }));
      original.setFiles([
        new File(["photo"], "coat.jpg", { type: "image/jpeg" }),
      ]);
      original.setDonation({
        id: "old",
        facts: original.getSnapshot().facts,
        computed: { active_offer_id: null, inventory_state: "unreceived" },
      } as Donation);
      if (screen === "no match") await original.findMatches();
      original.setStep(screen === "sent" ? 3 : 2);
    });
    const another = [
      ...container.querySelectorAll<HTMLElement>("button, a"),
    ].find((b) => b.textContent === "Donate another item")!;
    await act(async () => another.click());
    expect(container.textContent).toContain("Take photos of your item");
    expect(mock.session!.getSnapshot().donation).toBeNull();
    expect(mock.session!.getSnapshot().files).toEqual([]);
    expect(mock.session!.getSnapshot().facts.quantity).toBe("1");
    expect(mock.session!.getSnapshot().facts.name).toBeUndefined();
    await act(async () => original.setStep(3));
    expect(container.textContent).not.toContain("Your offer is sent");
  },
);

it("removes the saved donation URL when starting another item and keeps the saved record available", async () => {
  mock.params = "id=old";
  const saved = {
    id: "old",
    status: "ready",
    facts: {
      name: "Saved coat",
      category: "clothes",
      quantity: "2",
      unit: "item",
      attributes: {},
      expiry: {},
    },
    computed: { active_offer_id: null, inventory_state: "unreceived" },
  };
  mock.api.mockResolvedValue(saved);
  const view = await render(<Donate />);
  await act(async () => mock.session!.findMatches());
  const another = [...view.container.querySelectorAll("button")].find(
    (b) => b.textContent === "Donate another item",
  )!;
  await act(async () => another.click());
  expect(mock.push).toHaveBeenCalledWith("/donate");
  mock.params = "";
  await view.rerender(<Donate />);
  expect(view.container.textContent).toContain("Take photos of your item");
  expect(mock.session!.getSnapshot().donation).toBeNull();
  expect(
    mock.api.mock.calls.every(([path]) => !path.endsWith("withdrawal")),
  ).toBe(true);
});
