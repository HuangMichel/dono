import { describe, it, expect } from "vitest";
import {
  createInitialState,
  reduceDemo,
  getWarnings,
  fixtureId,
} from "./demo-store";
describe("local demonstration lifecycle", () => {
  it("keeps medicine warnings after category correction", () => {
    let s = createInitialState();
    s.role = "donor";
    s = reduceDemo(s, {
      type: "patch",
      id: fixtureId("medicine"),
      expected_revision: "1",
      patch: { category: "clothes" },
    });
    expect(getWarnings(s, fixtureId("medicine"))).toContain("medicine_concern");
  });
});
describe("wire identifiers and provenance", () => {
  it("retains the caller generated draft UUID", () => {
    const s = createInitialState();
    s.role = "donor";
    const next = reduceDemo(s, {
      type: "create",
      id: "20000000-0000-4000-8000-000000000001",
      input: {
        category: "food",
        donor_kind: "company",
        company_name: "Example shop",
        quantity: "24",
        attributes: { product: "Rice, 1 kg" },
      },
    });
    expect(next.donations[0].id).toBe("20000000-0000-4000-8000-000000000001");
  });
});
import {
  getExpiry,
  getInventory,
  getMatches,
  DEMO_STAFF_ID,
} from "./demo-store";
describe("human review and stock movements", () => {
  it("never books a pending offer or lets a donor approve it", () => {
    const s = createInitialState();
    s.role = "donor";
    expect(() =>
      reduceDemo(s, {
        type: "book",
        id: fixtureId("coat"),
        slot_id: fixtureId("slot-1"),
        expected_revision: "1",
      }),
    ).toThrow("Staff approval");
    expect(() =>
      reduceDemo(s, {
        type: "decision",
        id: fixtureId("coat"),
        decision: "approved",
        checks: {
          not_medicine: true,
          food_nonperishable_room_temperature: null,
          packaged_unopened: null,
        },
        expected_revision: "1",
      }),
    ).toThrow("Association access");
  });
  it("requires food safety checks and records a separate human actor", () => {
    let s = createInitialState();
    s.role = "assoc_admin";
    const command = {
      type: "decision" as const,
      id: fixtureId("food-offer"),
      decision: "approved" as const,
      checks: {
        not_medicine: true,
        food_nonperishable_room_temperature: true,
        packaged_unopened: false,
      },
      expected_revision: "1",
    };
    expect(() => reduceDemo(s, command)).toThrow("Confirm every");
    s = reduceDemo(s, {
      ...command,
      checks: { ...command.checks, packaged_unopened: true },
    });
    const d = s.donations.find((d) => d.id === command.id)!;
    expect(d.status).toBe("approved");
    expect(d.decided_by).toBe(DEMO_STAFF_ID);
    expect(d.decided_at).toBeTruthy();
  });
  it("receives two of three once, retains the offered quantity and prevents excess distribution", () => {
    let s = createInitialState();
    s.role = "assoc_admin";
    const command = {
      type: "receive" as const,
      booking_id: fixtureId("booking-sweaters"),
      quantity: "2",
      expected_revision: "1",
    };
    expect(() => reduceDemo(s, { ...command, quantity: "4" })).toThrow();
    expect(() => reduceDemo(s, { ...command, quantity: "0" })).toThrow();
    s = reduceDemo(s, command);
    expect(s.receipt_originals[fixtureId("sweaters")]).toBe("3");
    expect(
      getInventory(s).find((i) => i.donation.id === fixtureId("sweaters"))
        ?.remaining_quantity,
    ).toBe("2");
    expect(() => reduceDemo(s, { ...command, expected_revision: "2" })).toThrow(
      "Confirm receipt once",
    );
    expect(() =>
      reduceDemo(s, {
        type: "distribute",
        id: fixtureId("sweaters"),
        quantity: "3",
        expected_revision: "2",
      }),
    ).toThrow("exceeds");
    s = reduceDemo(s, {
      type: "distribute",
      id: fixtureId("sweaters"),
      quantity: "2.000",
      expected_revision: "2",
    });
    expect(
      s.donations.find((d) => d.id === fixtureId("sweaters"))?.status,
    ).toBe("distributed");
  });
  it("rejects stale edits without changing facts", () => {
    const s = createInitialState();
    s.role = "donor";
    expect(() =>
      reduceDemo(s, {
        type: "patch",
        id: fixtureId("medicine"),
        expected_revision: "999",
        patch: { quantity: "2" },
      }),
    ).toThrow("record changed");
    expect(
      s.donations.find((d) => d.id === fixtureId("medicine"))?.quantity,
    ).toBe("1");
  });
  it("protects the last slot and committed need criteria", () => {
    const s = createInitialState();
    s.role = "donor";
    expect(() =>
      reduceDemo(s, {
        type: "book",
        id: fixtureId("pasta"),
        slot_id: fixtureId("slot-0"),
        expected_revision: "1",
      }),
    ).toThrow("full");
    s.role = "assoc_admin";
    const need = s.needs.find((n) => n.category === "food")!;
    expect(() =>
      reduceDemo(s, {
        type: "need",
        id: need.id,
        patch: {
          attributes: { product: "Other product" },
          expected_revision: "1",
        },
      }),
    ).toThrow("criteria are locked");
  });
});
describe("source evidence and company drafts", () => {
  it.each([
    ["clothes", "clothes", "Winter coat"],
    ["shoes", "shoes", "Demo item"],
    ["food", "food", "Sealed pasta, 500 g"],
    ["para", "para", "Demo item"],
    ["furniture", "furniture", "Demo item"],
    ["medicine", "para", "Demo item"],
    ["cold", "food", "Sealed pasta, 500 g"],
  ] as const)(
    "seeds %s once while retaining original sample evidence",
    (scenario, category, product) => {
      let state = createInitialState();
      state.role = "donor";
      const id = "20000000-0000-4000-8000-000000000099";
      state = reduceDemo(state, {
        type: "create",
        id,
        input: { quantity: "1", attributes: {} },
      });
      state = reduceDemo(state, {
        type: "analyse",
        id,
        scenario,
        expected_revision: "1",
      });
      const original = structuredClone(state.analyses.at(-1)!);
      expect(original).toMatchObject({ category, extracted: { product } });
      expect(state.donations[0]).toMatchObject({
        category,
        attributes: { product },
      });
      state = reduceDemo(state, {
        type: "patch",
        id,
        expected_revision: "2",
        patch: { category: "shoes", attributes: { product: "My correction" } },
      });
      state = reduceDemo(state, {
        type: "analyse",
        id,
        scenario,
        expected_revision: "3",
      });
      expect(state.donations[0]).toMatchObject({
        category: "shoes",
        attributes: { product: "My correction" },
        basis_analysis_id: original.id,
      });
      expect(
        state.analyses.find((analysis) => analysis.id === original.id),
      ).toEqual(original);
    },
  );
  it("retains company quantity and product through first analysis and reanalysis", () => {
    let s = createInitialState();
    s.role = "donor";
    const id = "20000000-0000-4000-8000-000000000002";
    s = reduceDemo(s, {
      type: "create",
      id,
      input: {
        category: "food",
        donor_kind: "company",
        company_name: "Example shop",
        quantity: "24",
        attributes: { product: "Rice, 1 kg" },
      },
    });
    s = reduceDemo(s, {
      type: "analyse",
      id,
      scenario: "food",
      expected_revision: "1",
    });
    expect(s.donations[0].quantity).toBe("24");
    expect(s.donations[0].attributes.product).toBe("Rice, 1 kg");
    const original = s.donations[0].basis_analysis_id;
    s = reduceDemo(s, {
      type: "patch",
      id,
      expected_revision: "2",
      patch: { attributes: { product: "Corrected rice" } },
    });
    s = reduceDemo(s, {
      type: "analyse",
      id,
      scenario: "clothes",
      expected_revision: "3",
    });
    expect(s.donations[0].attributes.product).toBe("Corrected rice");
    expect(s.donations[0].category).toBe("food");
    expect(s.donations[0].basis_analysis_id).toBe(original);
  });
  it("leaves unreadable and PAO-only dates unknown without inferred calendar expiry", () => {
    const s = createInitialState();
    const id = fixtureId("medicine");
    s.expiry_facts.push({
      donation_id: id,
      expiry_date: null,
      date_type: "PAO",
      pao_months: 6,
      date_precision: "unknown",
      raw_label: "6M",
      readability: "readable",
      edited_by: null,
      updated_at: "2026-10-25T09:00:00Z",
    });
    expect(getExpiry(s, id).days_left).toBeNull();
    expect(getExpiry(s, id).expired).toBeNull();
    expect(getExpiry(s, id).bucket_key).toBeNull();
    s.expiry_facts.find((facts) => facts.donation_id === id)!.readability =
      "unreadable";
    expect(getExpiry(s, id).date_status).toBe("unreadable");
  });
  it("rechecks current capacity when offering", () => {
    let s = createInitialState();
    s.role = "donor";
    const id = "20000000-0000-4000-8000-000000000003";
    s = reduceDemo(s, {
      type: "create",
      id,
      input: { category: "clothes", quantity: "1" },
    });
    s = reduceDemo(s, {
      type: "analyse",
      id,
      scenario: "clothes",
      expected_revision: "1",
    });
    expect(getMatches(s, s.donations[0])).toHaveLength(1);
    s.capacities.find((c) => c.category === "clothes")!.limit_quantity = "0";
    expect(() =>
      reduceDemo(s, {
        type: "offer",
        id,
        need_id: fixtureId("need-clothes"),
        expected_revision: "2",
      }),
    ).toThrow("No eligible need");
  });
});
describe("registration and evidence identity", () => {
  it("always creates a pending registration after another applicant was approved", () => {
    let s = createInitialState();
    s.role = "platform_admin";
    s = reduceDemo(s, {
      type: "approveAssociation",
      id: fixtureId("association-pending"),
      expected_revision: "1",
    });
    s.role = "donor";
    s = reduceDemo(s, {
      type: "register",
      name: "New group",
      rna: "W751000999",
    });
    const a = s.associations.at(-1)!;
    expect(a.approval_status).toBe("pending");
    expect(a.approved_by).toBeNull();
    expect(a.approved_at).toBeNull();
    expect(a.revision).toBe("1");
  });
  it("preserves a unique immutable input photo for each sample analysis", () => {
    let s = createInitialState();
    s.role = "donor";
    const id = "20000000-0000-4000-8000-000000000004";
    s = reduceDemo(s, { type: "create", id, input: { category: "food" } });
    s = reduceDemo(s, {
      type: "analyse",
      id,
      scenario: "food",
      expected_revision: "1",
    });
    const first = s.analyses.at(-1)!,
      photoId = first.input_photos[0].photo_id;
    s = reduceDemo(s, {
      type: "analyse",
      id,
      scenario: "clothes",
      expected_revision: "2",
    });
    expect(s.analyses.at(-1)!.input_photos[0].photo_id).not.toBe(photoId);
    expect(s.photos.filter((p) => p.id === photoId)).toHaveLength(1);
    expect(s.photos.find((p) => p.id === photoId)?.content_url).toBe(
      "/item-food.svg",
    );
  });
});

describe("association registration fields", () => {
  it("keeps a separate SIRET and optional address without activating membership", () => {
    const initial = createInitialState();
    initial.role = "donor";
    const state = reduceDemo(initial, {
      type: "register",
      name: "  Community pantry  ",
      rna: "  ",
      siret: "  20003452800014  ",
      display_address: "  12 rue Exemple, Paris  ",
    });
    expect(state.associations.at(-1)).toMatchObject({
      name: "Community pantry",
      rna: null,
      siret: "20003452800014",
      display_address: "12 rue Exemple, Paris",
      latitude: null,
      longitude: null,
      approval_status: "pending",
      approved_by: null,
      approved_at: null,
    });
    expect(state.role).toBe("donor");
  });
  it("keeps omitted identifiers and skipped address null", () => {
    const initial = createInitialState();
    initial.role = "donor";
    const state = reduceDemo(initial, {
      type: "register",
      name: "Example association",
      rna: " W751000999 ",
      display_address: "  ",
    });
    expect(state.associations.at(-1)).toMatchObject({
      rna: "W751000999",
      siret: null,
      display_address: null,
    });
  });
  it("rejects registration with no RNA or SIRET", () => {
    const initial = createInitialState();
    initial.role = "donor";
    expect(() =>
      reduceDemo(initial, {
        type: "register",
        name: "Example association",
        rna: " ",
        siret: " ",
      }),
    ).toThrow("Enter an RNA or SIRET reference.");
  });
});
