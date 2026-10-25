import { describe, expect, it } from "vitest";
import { createInitialState, getPostedOffers, reduceDemo } from "./demo-store";
import { createDemoPersistence } from "./demo-persistence";

describe("browser-local demo persistence", () => {
  it("shows a donor post in an already-open association session and preserves both roles", () => {
    let state = { ...createInitialState(), role: "donor" as const };
    state = reduceDemo(state, {
      type: "create",
      id: "cross-tab-offer",
      input: {
        category: "clothes",
        quantity: "101",
        attributes: { product: "Coats" },
      },
    }) as typeof state;
    state = reduceDemo(state, {
      type: "analyse",
      id: "cross-tab-offer",
      scenario: "clothes",
      expected_revision: "1",
    }) as typeof state;
    let saved = JSON.stringify(state);
    const storage = {
      getItem: () => saved,
      setItem: (_key: string, value: string) => {
        saved = value;
      },
    };
    const donor = createDemoPersistence(state, () => storage);
    const association = createDemoPersistence(
      { ...state, role: "assoc_admin" },
      () => storage,
    );
    const observer = createDemoPersistence(
      { ...state, role: "assoc_admin" },
      () => storage,
    );
    donor.update((latest) =>
      reduceDemo(latest, {
        type: "postOffer",
        id: "cross-tab-offer",
        expected_revision: "2",
      }),
    );
    expect(
      getPostedOffers(observer.synchronize().state).map((offer) => offer.id),
    ).toEqual(["cross-tab-offer"]);
    expect(observer.snapshot().state.role).toBe("assoc_admin");
    // A local action can run before the browser delivers its storage event.
    association.update((latest) =>
      reduceDemo(latest, { type: "role", role: "assoc_admin" }),
    );
    expect(
      getPostedOffers(association.synchronize().state).map((offer) => offer.id),
    ).toEqual(["cross-tab-offer"]);
    expect(donor.synchronize().state.role).toBe("donor");
    donor.update((latest) =>
      reduceDemo(latest, {
        type: "withdrawOffer",
        id: "cross-tab-offer",
        expected_revision: "3",
      }),
    );
    expect(getPostedOffers(association.synchronize().state)).toEqual([]);
    expect(getPostedOffers(observer.synchronize().state)).toEqual([]);
    expect(association.snapshot().state.role).toBe("assoc_admin");
  });
  it("preserves unsaved local edits and the newer browser copy until explicit conflict retry", () => {
    const initial = { ...createInitialState(), role: "donor" as const };
    let saved = JSON.stringify(initial);
    let blocked = true;
    const session = createDemoPersistence(initial, () => ({
      getItem: () => saved,
      setItem: (_key, value) => {
        if (blocked) throw new DOMException("Full", "QuotaExceededError");
        saved = value;
      },
    }));
    session.hydrate();
    session.update((latest) =>
      reduceDemo(latest, {
        type: "create",
        id: "unsaved-local",
        input: { category: "clothes", quantity: "1" },
      }),
    );
    const remote = reduceDemo(initial, {
      type: "create",
      id: "saved-remote",
      input: { category: "clothes", quantity: "1" },
    });
    saved = JSON.stringify(remote);
    blocked = false;
    expect(session.synchronize().storageError).toContain("Another tab");
    expect(session.snapshot().state.donations[0].id).toBe("unsaved-local");
    session.update((latest) =>
      reduceDemo(latest, { type: "role", role: "assoc_admin" }),
    );
    expect(JSON.parse(saved).donations[0].id).toBe("saved-remote");
    expect(session.snapshot().state.donations[0].id).toBe("unsaved-local");
    expect(session.retry().storageError).toBeNull();
    expect(JSON.parse(saved).donations[0].id).toBe("unsaved-local");
  });
  it("retains refreshed data after a stale revision rejects a local command", () => {
    const initial = { ...createInitialState(), role: "donor" as const };
    const withDraft = reduceDemo(initial, {
      type: "create",
      id: "updated-elsewhere",
      input: { category: "clothes", quantity: "1" },
    });
    let saved = JSON.stringify(withDraft);
    const session = createDemoPersistence(withDraft, () => ({
      getItem: () => saved,
      setItem: (_key, value) => {
        saved = value;
      },
    }));
    session.hydrate();
    saved = JSON.stringify(
      reduceDemo(withDraft, {
        type: "patch",
        id: "updated-elsewhere",
        expected_revision: "1",
        patch: { quantity: "2" },
      }),
    );
    expect(() =>
      session.update((latest) =>
        reduceDemo(latest, {
          type: "patch",
          id: "updated-elsewhere",
          expected_revision: "1",
          patch: { quantity: "3" },
        }),
      ),
    ).toThrow("record changed");
    expect(session.snapshot().state.donations[0].quantity).toBe("2");
    expect(JSON.parse(saved).donations[0].quantity).toBe("2");
  });
  it("reveals a delayed conflict before retry can replace another tab's saved changes", () => {
    const initial = createInitialState();
    let saved = JSON.stringify(initial);
    let blocked = true;
    const session = createDemoPersistence(initial, () => ({
      getItem: () => saved,
      setItem: (_key, value) => {
        if (blocked) throw new Error("Storage full");
        saved = value;
      },
    }));
    session.hydrate();
    session.update((latest) =>
      reduceDemo(latest, { type: "role", role: "donor" }),
    );
    saved = JSON.stringify({ ...initial, role: "platform_admin" });
    blocked = false;
    expect(session.retry().storageError).toContain("Another tab");
    expect(JSON.parse(saved).role).toBe("platform_admin");
    expect(session.snapshot().state.role).toBe("donor");
    expect(session.retry().storageError).toBeNull();
    expect(JSON.parse(saved).role).toBe("donor");
  });
  it("keeps the current session when another tab leaves corrupt storage", () => {
    const initial = createInitialState();
    let saved = JSON.stringify(initial);
    let writes = 0;
    const session = createDemoPersistence(initial, () => ({
      getItem: () => saved,
      setItem: () => {
        writes++;
      },
    }));
    session.hydrate();
    saved = "broken JSON";
    expect(session.synchronize().storageError).toContain("could not be loaded");
    session.update((latest) =>
      reduceDemo(latest, { type: "role", role: "donor" }),
    );
    expect(session.snapshot().state.role).toBe("donor");
    expect(writes).toBe(0);
    expect(saved).toBe("broken JSON");
  });
  it.each(["QuotaExceededError", "SecurityError"])(
    "retains session changes after %s and retries only the latest state",
    (name) => {
      let blocked = true;
      let saved: string | null = null;
      const initial = createInitialState();
      const session = createDemoPersistence(initial, () => ({
        getItem: () => saved,
        setItem: (_key, value) => {
          if (blocked) throw new DOMException("Storage unavailable", name);
          saved = value;
        },
      }));
      const donor = { ...initial, role: "donor" as const };
      expect(session.publish(donor).state).toBe(donor);
      expect(session.snapshot().storageError).toContain("not saved");
      const latest = { ...donor, role: "assoc_admin" as const };
      session.publish(latest);
      blocked = false;
      expect(session.retry().storageError).toBeNull();
      expect(JSON.parse(saved!)).toEqual(latest);
      expect(session.snapshot().state).toBe(latest);
    },
  );
  it("clears a write warning when a later action saves the entire latest session", () => {
    let blocked = true;
    let saved = "";
    const initial = createInitialState();
    const session = createDemoPersistence(initial, () => ({
      getItem: () => null,
      setItem: (_key, value) => {
        if (blocked) throw new DOMException("Full", "QuotaExceededError");
        saved = value;
      },
    }));
    session.publish({ ...initial, role: "donor" });
    blocked = false;
    const latest = { ...initial, role: "platform_admin" as const };
    expect(session.publish(latest).storageError).toBeNull();
    expect(JSON.parse(saved)).toEqual(latest);
  });
  it.each(["denied", "corrupt"])(
    "protects the unread browser copy after a %s startup until explicit retry",
    (failure) => {
      let writes = 0;
      let saved = "prior browser data";
      const initial = createInitialState();
      const session = createDemoPersistence(initial, () => ({
        getItem: () => {
          if (failure === "denied")
            throw new DOMException("Denied", "SecurityError");
          return "broken JSON";
        },
        setItem: (_key, value) => {
          writes++;
          saved = value;
        },
      }));
      expect(session.hydrate().storageError).toContain("could not be loaded");
      const latest = { ...initial, role: "donor" as const };
      expect(session.publish(latest).state).toBe(latest);
      expect(writes).toBe(0);
      expect(saved).toBe("prior browser data");
      expect(session.retry().storageError).toBeNull();
      expect(writes).toBe(1);
      expect(JSON.parse(saved)).toEqual(latest);
    },
  );
  it("loads and normalizes existing browser data under the unchanged key", () => {
    const initial = createInitialState();
    const saved = { ...initial, role: "donor" as const };
    const session = createDemoPersistence(initial, () => ({
      getItem: (key) => {
        expect(key).toBe("dono-demo-v1");
        return JSON.stringify(saved);
      },
      setItem: () => {
        throw new Error("Hydration must not write");
      },
    }));
    expect(session.hydrate().state.role).toBe("donor");
    expect(session.snapshot().storageError).toBeNull();
  });
});
