import { describe, expect, it } from "vitest";
import {
  createInitialState,
  reduceDemo,
  getPostedOffers,
  normalizeDemoState,
  DEMO_DONOR_ID,
} from "./demo-store";

function unmatched() {
  let state = createInitialState();
  state.role = "donor";
  state = reduceDemo(state, {
    type: "create",
    id: "posted-test",
    input: {
      category: "clothes",
      quantity: "2",
      attributes: { product: "Coat" },
    },
  });
  state = reduceDemo(state, {
    type: "analyse",
    id: "posted-test",
    scenario: "clothes",
    expected_revision: "1",
  });
  state.needs = [];
  return state;
}
describe("posted offers", () => {
  it("posts an unmatched draft for association discovery without allocation", () => {
    const state = unmatched();
    const next = reduceDemo(state, {
      type: "postOffer",
      id: "posted-test",
      expected_revision: "2",
    });
    expect(next.posted_offers).toHaveLength(1);
    expect(next.donations[0]).toMatchObject({
      status: "draft",
      association_id: null,
      need_id: null,
      decision: null,
      offered_at: null,
    });
    expect(next.bookings).toEqual(state.bookings);
    expect(next.movements).toEqual(state.movements);
    expect(getPostedOffers(next)).toEqual([]);
    next.role = "assoc_admin";
    expect(getPostedOffers(next).map((offer) => offer.id)).toEqual([
      "posted-test",
    ]);
    expect(getPostedOffers(next)[0]).not.toHaveProperty("donor_id");
  });
});

describe("posting guards and withdrawal", () => {
  const post = {
    type: "postOffer" as const,
    id: "posted-test",
    expected_revision: "2",
  };
  it("rejects stale revisions and foreign ownership", () => {
    const state = unmatched();
    expect(() =>
      reduceDemo(state, { ...post, expected_revision: "1" }),
    ).toThrow("record changed");
    state.donations[0].donor_id = "someone-else";
    expect(() => reduceDemo(state, post)).toThrow("another donor");
  });
  it("requires the donor role and retained successful analysis", () => {
    const state = unmatched();
    state.role = "assoc_admin";
    expect(() => reduceDemo(state, post)).toThrow("donor demo");
    state.role = "donor";
    state.analyses = [];
    expect(() => reduceDemo(state, post)).toThrow("successful analysis");
  });
  it.each(["medicine", "cold"] as const)(
    "blocks %s warnings despite empty matches",
    (scenario) => {
      let state = unmatched();
      state = reduceDemo(state, {
        type: "analyse",
        id: post.id,
        scenario,
        expected_revision: "2",
      });
      expect(() =>
        reduceDemo(state, { ...post, expected_revision: "3" }),
      ).toThrow("safety warning");
    },
  );
  it("rejects a current eligible match", () => {
    const state = unmatched();
    state.needs = createInitialState().needs;
    expect(() => reduceDemo(state, post)).toThrow("current match");
  });
  it.each([
    { quantity: "0" },
    { category: null },
    { attributes: { product: " " } },
  ])("requires valid facts %j", (patch) => {
    const state = unmatched();
    Object.assign(state.donations[0], patch);
    expect(() => reduceDemo(state, post)).toThrow();
  });
  it("locks posted facts and prevents duplicate listings", () => {
    const state = reduceDemo(unmatched(), post);
    expect(() =>
      reduceDemo(state, { ...post, expected_revision: "3" }),
    ).toThrow("Withdraw");
    expect(() => reduceDemo(state, post)).toThrow("record changed");
    expect(() =>
      reduceDemo(state, {
        type: "patch",
        id: post.id,
        expected_revision: "3",
        patch: { quantity: "4" },
      }),
    ).toThrow("Withdraw");
    expect(() =>
      reduceDemo(state, {
        type: "analyse",
        id: post.id,
        expected_revision: "3",
        scenario: "clothes",
      }),
    ).toThrow("Withdraw");
    expect(() =>
      reduceDemo(state, {
        type: "offer",
        id: post.id,
        expected_revision: "3",
        need_id: "any",
      }),
    ).toThrow("Withdraw");
    expect(state.posted_offers).toHaveLength(1);
  });
  it("withdraws only for the owner and preserves all evidence and working facts", () => {
    const state = reduceDemo(unmatched(), post);
    const withdraw = {
      type: "withdrawOffer" as const,
      id: post.id,
      expected_revision: "3",
    };
    state.donations[0].donor_id = "other";
    expect(() => reduceDemo(state, withdraw)).toThrow("another donor");
    state.donations[0].donor_id = DEMO_DONOR_ID;
    const next = reduceDemo(state, withdraw);
    expect(next.posted_offers).toEqual([]);
    expect(next.photos).toEqual(state.photos);
    expect(next.analyses).toEqual(state.analyses);
    expect(next.donations[0].attributes).toEqual(state.donations[0].attributes);
    expect(next.donations[0].status).toBe("draft");
    expect(
      reduceDemo(next, {
        type: "patch",
        id: post.id,
        expected_revision: "4",
        patch: { quantity: "4" },
      }).donations[0].quantity,
    ).toBe("4");
  });
  it("normalizes legacy state while preserving persisted posts", () => {
    const state = unmatched();
    const { posted_offers: omitted, ...legacy } = state;
    expect(omitted).toEqual([]);
    expect(normalizeDemoState(legacy as typeof state).posted_offers).toEqual(
      [],
    );
    const posted = reduceDemo(state, post);
    expect(
      normalizeDemoState(JSON.parse(JSON.stringify(posted))).posted_offers,
    ).toEqual(posted.posted_offers);
  });
});

describe("posted expiry source facts", () => {
  it.each([
    {
      expiry_date: "2027-06-30",
      date_type: "DDM" as const,
      pao_months: null,
      date_precision: "day" as const,
      readability: "readable" as const,
    },
    {
      expiry_date: null,
      date_type: "PAO" as const,
      pao_months: 12,
      date_precision: "unknown" as const,
      readability: "readable" as const,
    },
    {
      expiry_date: null,
      date_type: null,
      pao_months: null,
      date_precision: "unknown" as const,
      readability: "unreadable" as const,
    },
  ])("exposes corrected date facts without private actor data: %j", (facts) => {
    let state = unmatched();
    state = reduceDemo(state, {
      type: "patch",
      id: "posted-test",
      expected_revision: "2",
      patch: {
        category: "food",
        expiry: { ...facts, raw_label: "Private label transcription" },
      },
    });
    state = reduceDemo(state, {
      type: "postOffer",
      id: "posted-test",
      expected_revision: "3",
    });
    state.role = "assoc_admin";
    expect(getPostedOffers(state)[0].expiry).toEqual(facts);
    expect(getPostedOffers(state)[0].expiry).not.toHaveProperty("edited_by");
    expect(getPostedOffers(state)[0].expiry).not.toHaveProperty("raw_label");
  });
});
