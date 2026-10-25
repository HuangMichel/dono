import { describe, expect, it } from "vitest";
import { createInitialState } from "./demo-store";
import { createDemoPersistence } from "./demo-persistence";

describe("browser-local demo persistence", () => {
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
