import { sampleIdentity } from "./sample-identity";
import { associationBalances } from "./association-balances";
import {
  normalizeSiret,
  validateRegistrationIdentity,
} from "./registration-validation";
import type {
  Analysis,
  Association,
  Booking,
  Capacity,
  Category,
  Decision,
  Donation,
  DonationCreate,
  DonationPatch,
  ExpiryFacts,
  ExpiryRead,
  IntakeChecks,
  InventoryItem,
  Match,
  Movement,
  Need,
  NeedInput,
  NeedPatch,
  Photo,
  Slot,
  SlotInput,
  SlotPatch,
} from "./contracts";
export function fixtureId(key: string): string {
  let hash = 2166136261;
  for (const char of key)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return "10000000-0000-4000-8000-" + hash.toString(16).padStart(12, "0");
}
export const DEMO_ASSOCIATION_ID = fixtureId("association-1"),
  DEMO_DONOR_ID = fixtureId("donor-demo"),
  DEMO_STAFF_ID = fixtureId("staff-demo");
export const CATEGORY_LABELS: Record<Category, string> = {
  clothes: "Clothes",
  shoes: "Shoes",
  food: "Food",
  para: "Hygiene & care",
  furniture: "Small furniture",
};
export const STATUS_LABELS = {
  draft: "Draft",
  offered: "Waiting for review",
  approved: "Approved by staff",
  refused: "Refused by staff",
  booked: "Booked",
  received: "Received",
  distributed: "Given out",
};
export type DemoRole = "donor" | "assoc_admin" | "platform_admin" | null;
// Browser-local evidence for the requested demo reception action. Not a wire DTO.
export type ReceptionRefusal = {
  booking_id: string;
  donation_id: string;
  reason: string;
  original_quantity: string;
  original_approval: {
    decision: "approved";
    decided_by: string;
    decided_at: string;
  };
  refused_by: string;
  refused_at: string;
};
export type DemoNeed = Omit<Need, "computed">;
export type DemoSlot = Omit<Slot, "computed">;
export type DemoState = {
  role: DemoRole;
  donations: Donation[];
  analyses: Analysis[];
  photos: Photo[];
  expiry_facts: ExpiryFacts[];
  associations: Association[];
  needs: DemoNeed[];
  capacities: Capacity[];
  slots: DemoSlot[];
  bookings: Booking[];
  movements: Movement[];
  receipt_originals: Record<string, string>;
  reception_refusals: Record<string, ReceptionRefusal>;
  posted_offers: { donation_id: string; posted_at: string }[];
};
const stamp = "2026-10-25T09:00:00Z";
const checks: IntakeChecks = {
  not_medicine: true,
  food_nonperishable_room_temperature: null,
  packaged_unopened: null,
};
const fixtureProducts: Record<string, string> = {
  rice: "Rice, 1 kg",
  sweaters: "Sweaters",
  "shoes-offer": "Sneakers, size 38",
  "chair-offer": "Wooden chair",
  "coat-offer": "Winter jackets, size L",
  "care-stock": "Unopened soap",
  "beans-stock": "Tinned beans, 400 g",
  "boots-booked": "Winter boots, size 40",
  "blankets-stock": "Fleece blankets",
};
function donation(
  key: string,
  category: Category,
  status: Donation["status"],
  quantity = "1",
): Donation & { quantity: string } {
  const id = fixtureId(key);
  return {
    id,
    category,
    status,
    quantity,
    donor_id: DEMO_DONOR_ID,
    donor_kind: "individual",
    company_name: null,
    association_id: status === "draft" ? null : DEMO_ASSOCIATION_ID,
    need_id: status === "draft" ? null : fixtureId("need-" + category),
    attributes: {
      product:
        fixtureProducts[key] ??
        (category === "food"
          ? "Sealed pasta, 500 g"
          : category === "clothes"
            ? "Winter coat"
            : "Hygiene product"),
      ...(category === "clothes" ? { size: "M" } : {}),
    },
    unit: "item",
    basis_analysis_id: fixtureId("analysis-" + id),
    decision: ["approved", "booked", "received", "distributed"].includes(status)
      ? "approved"
      : status === "refused"
        ? "refused"
        : null,
    decided_by: ["draft", "offered"].includes(status) ? null : DEMO_STAFF_ID,
    decided_at: ["draft", "offered"].includes(status) ? null : stamp,
    intake_checks: ["draft", "offered"].includes(status)
      ? null
      : {
          ...checks,
          ...(category === "food"
            ? {
                food_nonperishable_room_temperature: true,
                packaged_unopened: true,
              }
            : {}),
          ...(category === "para" ? { packaged_unopened: true } : {}),
        },
    offered_at: status === "draft" ? null : stamp,
    revision: "1",
    created_at: stamp,
    updated_at: stamp,
  };
}
export function createInitialState(): DemoState {
  const donations = [
    donation("coat", "clothes", "offered"),
    donation("pasta", "food", "approved", "6"),
    donation("sweaters", "clothes", "booked", "3"),
    donation("food-offer", "food", "offered", "3"),
    donation("care-offer", "para", "offered", "2"),
    donation("rice", "food", "received", "10"),
    donation("medicine", "para", "draft"),
    donation("refused", "clothes", "refused"),
    donation("shoes-offer", "shoes", "offered"),
    donation("chair-offer", "furniture", "offered"),
    donation("coat-offer", "clothes", "offered", "2"),
    donation("care-stock", "para", "received", "8"),
    donation("beans-stock", "food", "received", "12"),
    donation("boots-booked", "shoes", "booked"),
    donation("blankets-stock", "clothes", "received", "4"),
  ];
  const associations: Association[] = [
    {
      id: DEMO_ASSOCIATION_ID,
      name: "Solidarité Oberkampf (demo)",
      registered_by: DEMO_STAFF_ID,
      rna: "W751000001",
      siret: null,
      approval_status: "approved",
      approved_by: fixtureId("platform-demo"),
      approved_at: stamp,
      display_address: "12 rue Oberkampf, 75011 Paris",
      latitude: 48.864,
      longitude: 2.371,
      timezone: "Europe/Paris",
      opening_hours: [],
      revision: "1",
      created_at: stamp,
      updated_at: stamp,
    },
    {
      id: fixtureId("association-pending"),
      name: "La Maison du partage (demo)",
      registered_by: fixtureId("applicant-demo"),
      rna: "W751000002",
      siret: null,
      approval_status: "pending",
      approved_by: null,
      approved_at: null,
      display_address: null,
      latitude: null,
      longitude: null,
      timezone: "Europe/Paris",
      opening_hours: [],
      revision: "1",
      created_at: stamp,
      updated_at: stamp,
    },
  ];
  associations.push({
    ...associations[1],
    id: fixtureId("association-pending-2"),
    name: "Le Relais des voisins (demo)",
    registered_by: fixtureId("applicant-demo-2"),
    rna: "W751000003",
    display_address: "8 rue Saint-Maur, 75011 Paris",
  });
  const categories = Object.keys(CATEGORY_LABELS) as Category[];
  const labels = ["pasta", "rice", "food-offer"].map((key) => ({
    id: fixtureId("label-" + key),
    donation_id: fixtureId(key),
    kind: "label" as const,
    mime_type: "image/svg+xml",
    size_bytes: "0",
    sha256: "demo-label-" + key,
    created_at: stamp,
    content_url:
      "/fixture-label-" + (key === "food-offer" ? "pasta" : key) + ".svg",
  }));
  const capacityLimits: Record<Category, string> = {
    clothes: "40",
    shoes: "20",
    food: "36",
    para: "24",
    furniture: "8",
  };
  return {
    role: null,
    donations,
    associations,
    analyses: donations.map((d) => ({
      id: fixtureId("analysis-" + d.id),
      donation_id: d.id,
      provider: "openai",
      model: "fixture-only",
      category: d.category!,
      extracted: {
        ...d.attributes,
        ...(d.id === fixtureId("food-offer")
          ? { expiry_date: "2026-03-15", date_type: "DDM" }
          : {}),
      },
      indicators: [
        {
          key:
            d.id === fixtureId("medicine") || d.category === "para"
              ? "looks_like_medicine"
              : d.category === "food"
                ? "packaging_open"
                : d.category === "shoes"
                  ? "worn_soles"
                  : d.category === "furniture"
                    ? "damage"
                    : "stains",
          probability:
            d.id === fixtureId("medicine")
              ? 0.97
              : d.id === fixtureId("coat")
                ? 0.61
                : 0.061,
          level:
            d.id === fixtureId("medicine")
              ? "high"
              : d.id === fixtureId("coat")
                ? "medium"
                : "low",
          source: { provider: "openai", model: "fixture-only" },
        },
      ],
      confidence: 0.942,
      input_photos: [
        { photo_id: fixtureId("photo-" + d.id), sha256: "demo-fixture" },
        ...labels
          .filter((photo) => photo.donation_id === d.id)
          .map((photo) => ({ photo_id: photo.id, sha256: photo.sha256 })),
      ],
      input_revision: "1",
      provenance: { demo: true },
      created_at: stamp,
    })),
    photos: [
      ...donations.map((d) => ({
        id: fixtureId("photo-" + d.id),
        donation_id: d.id,
        kind: "item" as const,
        mime_type: "image/svg+xml",
        size_bytes: "0",
        sha256: "demo-fixture",
        created_at: stamp,
        content_url: "/item-" + d.category + ".svg",
      })),
      ...labels,
    ],
    expiry_facts: [
      {
        donation_id: fixtureId("pasta"),
        expiry_date: "2027-03-15",
        date_type: "DDM",
        pao_months: null,
        date_precision: "day",
        raw_label: "15/03/2027",
        readability: "readable",
        edited_by: null,
        updated_at: stamp,
      },
      {
        donation_id: fixtureId("rice"),
        expiry_date: "2026-10-30",
        date_type: "DDM",
        pao_months: null,
        date_precision: "day",
        raw_label: "30/10/2026",
        readability: "readable",
        edited_by: null,
        updated_at: stamp,
      },
      {
        donation_id: fixtureId("beans-stock"),
        expiry_date: "2027-01-15",
        date_type: "DDM",
        pao_months: null,
        date_precision: "day",
        raw_label: "15/01/2027",
        readability: "readable",
        edited_by: null,
        updated_at: stamp,
      },
      {
        donation_id: fixtureId("food-offer"),
        expiry_date: "2027-03-15",
        date_type: "DDM",
        pao_months: null,
        date_precision: "day",
        raw_label: "15/03/2027",
        readability: "readable",
        edited_by: DEMO_DONOR_ID,
        updated_at: stamp,
      },
    ],
    needs: categories.map((category) => ({
      id: fixtureId("need-" + category),
      association_id: DEMO_ASSOCIATION_ID,
      category,
      attributes: {},
      seasons: null,
      target_quantity: "100",
      unit: "item",
      active: true,
      source_text: null,
      created_by: DEMO_STAFF_ID,
      revision: "1",
      created_at: stamp,
      updated_at: stamp,
    })),
    capacities: categories.map((category) => ({
      association_id: DEMO_ASSOCIATION_ID,
      category,
      unit: "item",
      limit_quantity: capacityLimits[category],
      revision: "1",
      updated_at: stamp,
      computed: {
        reserved: "0",
        in_stock: "0",
        available: capacityLimits[category],
      },
    })),
    slots: [0, 1, 2, 3, 4].map((i) => ({
      id: fixtureId("slot-" + i),
      association_id: DEMO_ASSOCIATION_ID,
      starts_at:
        i < 3 ? `2026-10-28T${13 + i}:00:00Z` : `2026-10-${26 + i}T13:00:00Z`,
      ends_at:
        i < 3 ? `2026-10-28T${14 + i}:00:00Z` : `2026-10-${26 + i}T14:00:00Z`,
      max_bookings: i === 0 ? 1 : 5,
      active: true,
      revision: "1",
      created_at: stamp,
      updated_at: stamp,
    })),
    bookings: [
      {
        id: fixtureId("booking-sweaters"),
        donation_id: fixtureId("sweaters"),
        association_id: DEMO_ASSOCIATION_ID,
        slot_id: fixtureId("slot-0"),
        qr_expires_at: "2026-10-28T18:00:00Z",
        created_at: stamp,
      },
      {
        id: fixtureId("booking-boots"),
        donation_id: fixtureId("boots-booked"),
        association_id: DEMO_ASSOCIATION_ID,
        slot_id: fixtureId("slot-3"),
        qr_expires_at: "2026-10-29T18:00:00Z",
        created_at: stamp,
      },
    ],
    movements: [
      {
        id: fixtureId("receipt-rice"),
        donation_id: fixtureId("rice"),
        association_id: DEMO_ASSOCIATION_ID,
        movement_type: "receipt",
        quantity: "10",
        unit: "item",
        actor_id: DEMO_STAFF_ID,
        created_at: stamp,
      },
      ...["care-stock", "beans-stock", "blankets-stock"].map((key) => ({
        id: fixtureId("receipt-" + key),
        donation_id: fixtureId(key),
        association_id: DEMO_ASSOCIATION_ID,
        movement_type: "receipt" as const,
        quantity: donations.find((item) => item.id === fixtureId(key))!
          .quantity,
        unit: "item" as const,
        actor_id: DEMO_STAFF_ID,
        created_at: stamp,
      })),
    ],
    reception_refusals: {},
    posted_offers: [],
    receipt_originals: Object.fromEntries(
      donations
        .filter((item) => item.status === "received")
        .map((item) => [item.id, item.quantity]),
    ),
  };
}
// Local discovery projection. Never expose the donor profile or private drafts.
export function isPostedOffer(state: DemoState, id: string): boolean {
  return (
    state.posted_offers?.some((offer) => offer.donation_id === id) ?? false
  );
}
export function getPostedOffers(state: DemoState) {
  if (state.role !== "assoc_admin") return [];
  return (state.posted_offers ?? []).flatMap((offer) => {
    const item = state.donations.find((d) => d.id === offer.donation_id);
    if (
      !item ||
      item.status !== "draft" ||
      item.association_id ||
      item.need_id ||
      !item.category
    )
      return [];
    const analysis = state.analyses.find(
      (a) => a.id === item.basis_analysis_id && a.donation_id === item.id,
    );
    const expiry = state.expiry_facts.find(
      (facts) => facts.donation_id === item.id,
    );
    return [
      {
        id: item.id,
        expiry: expiry
          ? {
              expiry_date: expiry.expiry_date,
              date_type: expiry.date_type,
              pao_months: expiry.pao_months,
              date_precision: expiry.date_precision,
              readability: expiry.readability,
            }
          : null,
        category: item.category,
        quantity: item.quantity,
        attributes: { ...item.attributes },
        posted_at: offer.posted_at,
        photos: state.photos
          .filter((photo) => photo.donation_id === item.id)
          .map((photo) => ({
            id: photo.id,
            kind: photo.kind,
            content_url: photo.content_url,
          })),
        indicators:
          analysis?.indicators.map(({ key, value, probability, level }) => ({
            key,
            value,
            probability,
            level,
          })) ?? [],
      },
    ];
  });
}

export function getWarnings(s: DemoState, id: string): string[] {
  return s.analyses
    .filter((a) => a.donation_id === id)
    .flatMap((a) =>
      a.indicators
        .filter((i) => i.level === "high")
        .flatMap((i) =>
          i.key === "looks_like_medicine"
            ? ["medicine_concern"]
            : i.key === "cold_food"
              ? ["cold_food_concern"]
              : [],
        ),
    );
}
export function getExpiry(s: DemoState, id: string): ExpiryRead {
  const f = s.expiry_facts.find((x) => x.donation_id === id);
  return {
    reference_date: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
    }).format(new Date()),
    timezone: "Europe/Paris",
    days_left:
      f?.readability === "readable" &&
      f?.date_type !== "PAO" &&
      f?.expiry_date &&
      f.date_precision === "day"
        ? Math.round(
            (Date.parse(f.expiry_date) -
              Date.parse(
                new Intl.DateTimeFormat("en-CA", {
                  timeZone: "Europe/Paris",
                }).format(new Date()),
              )) /
              86400000,
          )
        : null,
    expired: null,
    bucket_key: null,
    date_status: !f
      ? ["food", "para"].includes(
          s.donations.find((d) => d.id === id)?.category ?? "",
        )
        ? "unknown"
        : "not_applicable"
      : f.readability === "unreadable"
        ? "unreadable"
        : f.expiry_date
          ? "known"
          : "unknown",
    policy_status: "unresolved",
    policy_version: null,
  };
}
export function getInventory(s: DemoState): InventoryItem[] {
  const scopes = new Map(
    [...new Set(s.donations.map((donation) => donation.association_id))].map(
      (associationId) => [associationId, associationBalances(s, associationId)],
    ),
  );
  return s.donations
    .filter((donation) => ["received", "distributed"].includes(donation.status))
    .map((donation) => {
      const balance = scopes
        .get(donation.association_id)!
        .byDonation.get(donation.id)!;
      return {
        donation,
        received_quantity: String(balance.received),
        distributed_quantity: String(balance.distributed),
        remaining_quantity: String(balance.remaining),
        unit: "item",
        expiry: getExpiry(s, donation.id),
      };
    });
}
export function getCapacity(
  s: DemoState,
  category: Category,
  associationId = DEMO_ASSOCIATION_ID,
): Capacity {
  const capacity = s.capacities.find(
    (record) =>
      record.association_id === associationId && record.category === category,
  )!;
  const balance = associationBalances(s, associationId).categoryBalance(
    category,
    capacity.limit_quantity,
  );
  return {
    ...capacity,
    computed: {
      reserved: String(balance.reserved),
      in_stock: String(balance.inStock),
      available: String(balance.available),
    },
  };
}
export function isNeedCriteriaLocked(
  state: DemoState,
  needId: string,
): boolean {
  return state.donations.some(
    (donation) =>
      donation.need_id === needId &&
      (donation.decision === "approved" ||
        Boolean(getReceptionRefusal(state, donation.id))),
  );
}

export function getSlot(state: DemoState, slot: DemoSlot): Slot {
  const bookedCount = getOccupyingBookings(state).filter(
    (booking) => booking.slot_id === slot.id,
  ).length;
  return {
    ...slot,
    computed: {
      booked_count: bookedCount,
      remaining_places: Math.max(0, slot.max_bookings - bookedCount),
    },
  };
}

function needWithBalances(
  need: DemoNeed,
  balances: ReturnType<typeof associationBalances>,
): Need {
  const balance = balances.needBalance(need.id, need.target_quantity);
  return {
    ...need,
    computed: {
      pending_hold: String(balance.reserved),
      fulfilled: String(balance.received),
      available: String(balance.stillNeeded),
    },
  };
}
export function getNeed(s: DemoState, need: DemoNeed): Need {
  return needWithBalances(need, associationBalances(s, need.association_id));
}

export function getNeeds(
  s: DemoState,
  associationId = DEMO_ASSOCIATION_ID,
): Need[] {
  const balances = associationBalances(s, associationId);
  return s.needs
    .filter((need) => need.association_id === associationId)
    .map((need) => needWithBalances(need, balances));
}

export function getMatches(s: DemoState, d: Donation): Match[] {
  if (!d.category || !d.quantity || getWarnings(s, d.id).length) return [];
  const scopes = new Map<
    string,
    {
      balances: ReturnType<typeof associationBalances>;
      available: number;
    } | null
  >();
  return s.needs
    .filter((need) => {
      if (!need.active || need.category !== d.category || need.seasons?.length)
        return false;
      if (!scopes.has(need.association_id)) {
        const capacity = s.capacities.find(
          (record) =>
            record.association_id === need.association_id &&
            record.category === need.category,
        );
        if (capacity) {
          const balances = associationBalances(s, need.association_id);
          scopes.set(need.association_id, {
            balances,
            available: balances.categoryBalance(
              need.category,
              capacity.limit_quantity,
            ).available,
          });
        } else {
          scopes.set(need.association_id, null);
        }
      }
      const scope = scopes.get(need.association_id);
      if (!scope) return false;
      return (
        scope.balances.needBalance(need.id, need.target_quantity).stillNeeded >=
          Number(d.quantity) &&
        scope.available >= Number(d.quantity) &&
        Object.entries(need.attributes).every(
          ([key, value]) => d.attributes[key] === value,
        )
      );
    })
    .map((n) => ({
      association: {
        id: n.association_id,
        name: s.associations.find((a) => a.id === n.association_id)!.name,
      },
      need_id: n.id,
      category: n.category,
      distance_km: 0.8,
      reasons: ["need_matches", "capacity_available"],
    }));
}
// Refused appointments remain in history, but no longer occupy a place.
export function getOccupyingBookings(
  state: Pick<DemoState, "bookings" | "donations">,
): Booking[] {
  const occupying = new Set(
    state.donations.filter((d) => d.status !== "refused").map((d) => d.id),
  );
  return state.bookings.filter((b) => occupying.has(b.donation_id));
}

export function getReceptionRefusal(
  state: DemoState,
  donationId: string,
): ReceptionRefusal | undefined {
  return Object.values(state.reception_refusals).find(
    (refusal) => refusal.donation_id === donationId,
  );
}

export function normalizeDemoState(state: DemoState): DemoState {
  const records = state.reception_refusals;
  return {
    ...state,
    // Older browser snapshots contain cached read totals. Keep their source facts.
    needs: state.needs.map((need) => {
      const source: DemoNeed & { computed?: Need["computed"] } = { ...need };
      delete source.computed;
      return source;
    }),
    slots: state.slots.map((slot) => {
      const source: DemoSlot & { computed?: Slot["computed"] } = { ...slot };
      delete source.computed;
      return source;
    }),
    posted_offers: Array.isArray(state.posted_offers)
      ? state.posted_offers
      : [],
    reception_refusals:
      records && typeof records === "object" && !Array.isArray(records)
        ? records
        : {},
  };
}

export type DemoCommand =
  | { type: "role"; role: DemoRole }
  | {
      type: "refuseReception";
      booking_id: string;
      reason: string;
      confirm_refusal: boolean;
      expected_revision: string;
    }
  | { type: "create"; id: string; input: DonationCreate }
  | {
      type: "patch";
      id: string;
      expected_revision: string;
      patch: Omit<DonationPatch, "expected_revision">;
    }
  | {
      type: "analyse";
      id: string;
      scenario: Category | "medicine" | "cold";
      expected_revision: string;
    }
  | {
      type: "postOffer" | "withdrawOffer";
      id: string;
      expected_revision: string;
    }
  | { type: "offer"; id: string; need_id: string; expected_revision: string }
  | {
      type: "decision";
      id: string;
      decision: Decision;
      checks: IntakeChecks;
      expected_revision: string;
    }
  | { type: "book"; id: string; slot_id: string; expected_revision: string }
  | {
      type: "receive";
      booking_id: string;
      quantity: string;
      expected_revision: string;
    }
  | {
      type: "distribute";
      id: string;
      quantity: string;
      expected_revision: string;
    }
  | { type: "need"; id: string; input: NeedInput; patch?: never }
  | { type: "need"; id: string; patch: NeedPatch; input?: never }
  | {
      type: "capacity";
      category: Category;
      quantity: string;
      expected_revision: string;
    }
  | { type: "slot"; id: string; input: SlotInput; patch?: never }
  | { type: "slot"; id: string; patch: SlotPatch; input?: never }
  | { type: "approveAssociation"; id: string; expected_revision: string }
  | {
      type: "register";
      name: string;
      rna?: string | null;
      siret?: string | null;
      display_address?: string | null;
    };
function positive(q: string | null) {
  if (!q || !/^\d{1,9}(\.0{1,3})?$/.test(q) || Number(q) <= 0)
    throw Error("Enter a positive whole quantity, up to 999999999.");
}
function revision(current: string, expected: string | undefined) {
  if (current !== expected)
    throw Error("This record changed. Reload it before trying again.");
}
function updateWorkingFacts(
  s: DemoState,
  d: Donation,
  c: Extract<DemoCommand, { type: "patch" }>,
  now: string,
): void {
  if (d.status !== "draft")
    throw Error("Item details cannot be changed after sending an offer.");
  const { expiry, ...patch } = c.patch;
  Object.assign(d, patch);
  positive(d.quantity);
  if (d.donor_kind === "company" && !d.company_name?.trim())
    throw Error("Enter a company name.");
  if (d.donor_kind === "individual") d.company_name = null;
  if (expiry) {
    if (expiry.date_type === "PAO" && expiry.expiry_date)
      throw Error("A period after opening does not specify an expiry date.");
    if (
      expiry.pao_months !== null &&
      (!Number.isInteger(expiry.pao_months) || expiry.pao_months < 1)
    )
      throw Error("Enter a positive whole number of months after opening.");
    if (
      expiry.expiry_date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(expiry.expiry_date) ||
        !Number.isFinite(Date.parse(expiry.expiry_date)) ||
        new Date(expiry.expiry_date).toISOString().slice(0, 10) !==
          expiry.expiry_date)
    )
      throw Error("Enter a valid printed calendar date.");
    s.expiry_facts = s.expiry_facts.filter((f) => f.donation_id !== d.id);
    s.expiry_facts.push({
      ...expiry,
      donation_id: d.id,
      edited_by: DEMO_DONOR_ID,
      updated_at: now,
    });
  }
}

function appendSampleAnalysis(
  s: DemoState,
  d: Donation,
  c: Extract<DemoCommand, { type: "analyse" }>,
  now: string,
): void {
  if (d.status !== "draft") throw Error("Only drafts can be analysed.");
  const { category, product } = sampleIdentity(c.scenario);
  const photoId = crypto.randomUUID();
  const a: Analysis = {
    id: crypto.randomUUID(),
    donation_id: d.id,
    provider: "openai",
    model: "fixture-only",
    category,
    extracted: { product },
    indicators: [
      {
        key:
          c.scenario === "medicine"
            ? "looks_like_medicine"
            : c.scenario === "cold"
              ? "cold_food"
              : "stains",
        probability:
          c.scenario === "medicine"
            ? 0.97
            : c.scenario === "cold"
              ? 0.93
              : 0.061,
        level: ["medicine", "cold"].includes(c.scenario) ? "high" : "low",
        source: { provider: "openai", model: "fixture-only" },
      },
    ],
    confidence: 0.942,
    input_photos: [{ photo_id: photoId, sha256: "demo-fixture" }],
    input_revision: d.revision,
    provenance: { demo: true },
    created_at: now,
  };
  s.analyses.push(a);
  if (!d.basis_analysis_id) {
    d.basis_analysis_id = a.id;
    d.category = category;
    if (!Object.keys(d.attributes).length) d.attributes = { ...a.extracted };
  }
  s.photos.push({
    id: photoId,
    donation_id: d.id,
    kind: "item",
    mime_type: "image/svg+xml",
    size_bytes: "0",
    sha256: "demo-fixture",
    created_at: now,
    content_url: "/item-" + category + ".svg",
  });
}

function submitOffer(
  s: DemoState,
  d: Donation,
  c: Extract<DemoCommand, { type: "offer" }>,
  now: string,
): void {
  if (d.status !== "draft" || !d.basis_analysis_id)
    throw Error("Review a successful analysis before offering.");
  if (!getMatches(s, d).some((m) => m.need_id === c.need_id))
    throw Error("No eligible need remains. Check warnings and capacity.");
  d.need_id = c.need_id;
  d.association_id = s.needs.find((n) => n.id === c.need_id)!.association_id;
  d.status = "offered";
  d.offered_at = now;
}

function recordHumanDecision(
  s: DemoState,
  d: Donation,
  c: Extract<DemoCommand, { type: "decision" }>,
  now: string,
): void {
  if (d.status !== "offered")
    throw Error("This offer is no longer waiting for review.");
  if (c.decision === "approved") {
    if (getWarnings(s, d.id).length)
      throw Error(
        "A safety warning requires clarification. Approval is unavailable in this demo.",
      );
    if (
      !c.checks.not_medicine ||
      (d.category === "food" &&
        !c.checks.food_nonperishable_room_temperature) ||
      (["food", "para"].includes(d.category!) && !c.checks.packaged_unopened)
    )
      throw Error("Confirm every applicable intake check.");
    if (!getMatches(s, d).some((m) => m.need_id === d.need_id))
      throw Error("Need or capacity changed.");
  }
  d.decision = c.decision;
  d.status = c.decision;
  d.intake_checks = c.checks;
  d.decided_by = DEMO_STAFF_ID;
  d.decided_at = now;
}

function createBooking(
  s: DemoState,
  d: Donation,
  c: Extract<DemoCommand, { type: "book" }>,
  now: string,
): void {
  if (d.status !== "approved")
    throw Error("Staff approval is required before booking.");
  const slot = s.slots.find((x) => x.id === c.slot_id);
  if (
    !slot?.active ||
    slot.association_id !== d.association_id ||
    Date.parse(slot.starts_at) <= Date.parse(now) ||
    getOccupyingBookings(s).filter((b) => b.slot_id === slot.id).length >=
      slot.max_bookings
  )
    throw Error("This slot is full or unavailable.");
  s.bookings.push({
    id: crypto.randomUUID(),
    donation_id: d.id,
    association_id: d.association_id!,
    slot_id: slot.id,
    qr_expires_at: slot.ends_at,
    created_at: now,
  });
  d.status = "booked";
}

function receiveDonation(
  s: DemoState,
  d: Donation,
  c: Extract<DemoCommand, { type: "receive" }>,
  now: string,
): void {
  positive(c.quantity);
  const booking = s.bookings.find((b) => b.id === c.booking_id);
  if (
    !booking ||
    booking.association_id !== DEMO_ASSOCIATION_ID ||
    d.association_id !== DEMO_ASSOCIATION_ID
  )
    throw Error("Booking not found for this association.");
  if (
    d.status !== "booked" ||
    Number(c.quantity) > Number(d.quantity) ||
    s.movements.some(
      (m) => m.donation_id === d.id && m.movement_type === "receipt",
    )
  )
    throw Error(
      "Confirm receipt once. The quantity cannot exceed the offered quantity.",
    );
  s.receipt_originals[d.id] = d.quantity!;
  d.quantity = c.quantity;
  d.status = "received";
  s.movements.push({
    id: crypto.randomUUID(),
    donation_id: d.id,
    association_id: d.association_id!,
    movement_type: "receipt",
    quantity: c.quantity,
    unit: "item",
    actor_id: DEMO_STAFF_ID,
    created_at: now,
  });
}

function distributeStock(
  s: DemoState,
  d: Donation,
  c: Extract<DemoCommand, { type: "distribute" }>,
  now: string,
): void {
  positive(c.quantity);
  const item = getInventory(s).find((i) => i.donation.id === d.id);
  if (!item || Number(c.quantity) > Number(item.remaining_quantity))
    throw Error("Quantity exceeds remaining stock.");
  s.movements.push({
    id: crypto.randomUUID(),
    donation_id: d.id,
    association_id: d.association_id!,
    movement_type: "distribution",
    quantity: c.quantity,
    unit: "item",
    actor_id: DEMO_STAFF_ID,
    created_at: now,
  });
  if (Number(c.quantity) === Number(item.remaining_quantity))
    d.status = "distributed";
}

function refuseAtReception(
  state: DemoState,
  donation: Donation,
  command: Extract<DemoCommand, { type: "refuseReception" }>,
  now: string,
): void {
  const booking = state.bookings.find((b) => b.id === command.booking_id);
  if (
    !booking ||
    booking.association_id !== DEMO_ASSOCIATION_ID ||
    donation.association_id !== DEMO_ASSOCIATION_ID ||
    booking.donation_id !== donation.id
  )
    throw Error("Booking not found for this association.");
  if (
    donation.status !== "booked" ||
    state.reception_refusals[booking.id] ||
    state.movements.some(
      (m) => m.donation_id === donation.id && m.movement_type === "receipt",
    )
  )
    throw Error(
      "Only a booked, unreceived donation can be refused at reception.",
    );
  const reason = command.reason.trim();
  if (!reason) throw Error("Enter a reason for refusing this item.");
  if (!command.confirm_refusal)
    throw Error("Confirm that staff refuse the entire donation.");
  if (
    donation.decision !== "approved" ||
    !donation.decided_by ||
    !donation.decided_at ||
    !donation.quantity
  )
    throw Error("The original staff approval is missing.");
  state.reception_refusals[booking.id] = {
    booking_id: booking.id,
    donation_id: donation.id,
    reason,
    original_quantity: donation.quantity,
    original_approval: {
      decision: "approved",
      decided_by: donation.decided_by,
      decided_at: donation.decided_at,
    },
    refused_by: DEMO_STAFF_ID,
    refused_at: now,
  };
  donation.status = "refused";
  donation.decision = "refused";
  donation.decided_by = DEMO_STAFF_ID;
  donation.decided_at = now;
}

export function reduceDemo(state: DemoState, c: DemoCommand): DemoState {
  const s = normalizeDemoState(structuredClone(state)),
    now = new Date().toISOString();
  if (c.type === "role") {
    s.role = c.role;
    return s;
  }
  if (!s.role) throw Error("Choose a demo role to continue.");
  const staff = [
    "decision",
    "receive",
    "refuseReception",
    "distribute",
    "need",
    "capacity",
    "slot",
  ].includes(c.type);
  if (staff && s.role !== "assoc_admin")
    throw Error("Association access is required.");
  if (
    [
      "create",
      "patch",
      "analyse",
      "offer",
      "book",
      "postOffer",
      "withdrawOffer",
    ].includes(c.type) &&
    s.role !== "donor"
  )
    throw Error("Choose the donor demo role.");
  if (c.type === "create") {
    const d = donation(
      c.id,
      c.input.category ?? "clothes",
      "draft",
      c.input.quantity ?? "1",
    );
    Object.assign(d, c.input, {
      id: c.id,
      basis_analysis_id: null,
      created_at: now,
      updated_at: now,
    });
    positive(d.quantity);
    if (d.donor_kind === "company" && !d.company_name?.trim())
      throw Error("Enter a company name.");
    if (d.donor_kind === "individual") d.company_name = null;
    s.donations.unshift(d);
    return s;
  }
  if (c.type === "register") {
    const name = c.name.trim();
    const rna = c.rna?.trim() || null;
    const siret = normalizeSiret(c.siret ?? "") || null;
    const displayAddress = c.display_address?.trim() || null;
    const errors = validateRegistrationIdentity(name, rna ?? "", siret ?? "");
    if (Object.keys(errors).length) throw Error(Object.values(errors)[0]);
    s.associations.push({
      id: crypto.randomUUID(),
      name,
      registered_by: DEMO_DONOR_ID,
      rna,
      siret,
      approval_status: "pending",
      approved_by: null,
      approved_at: null,
      display_address: displayAddress,
      latitude: null,
      longitude: null,
      timezone: "Europe/Paris",
      opening_hours: [],
      revision: "1",
      created_at: now,
      updated_at: now,
    });
    return s;
  }
  if (c.type === "approveAssociation") {
    if (s.role !== "platform_admin")
      throw Error("Platform access is required.");
    const a = s.associations.find((a) => a.id === c.id)!;
    revision(a.revision, c.expected_revision);
    a.approval_status = "approved";
    a.approved_by = fixtureId("platform-demo");
    a.approved_at = now;
    a.revision = String(BigInt(a.revision) + 1n);
    return s;
  }
  if (c.type === "need") {
    const old = s.needs.find((need) => need.id === c.id);
    if (c.patch && !old) throw Error("Need not found.");
    if (c.input && old) throw Error("Need already exists.");
    if (old) revision(old.revision, c.patch?.expected_revision);
    const input = c.input ?? c.patch!;
    const need: DemoNeed = {
      ...(old ?? {
        id: c.id,
        association_id: DEMO_ASSOCIATION_ID,
        created_by: DEMO_STAFF_ID,
        created_at: now,
        active: true,
        source_text: null,
      }),
      category: input.category ?? old!.category,
      attributes: input.attributes ?? old!.attributes,
      seasons: input.seasons === undefined ? old!.seasons : input.seasons,
      target_quantity: input.target_quantity ?? old!.target_quantity,
      unit: input.unit ?? old!.unit,
      active: input.active ?? old?.active ?? true,
      source_text:
        input.source_text === undefined
          ? (old?.source_text ?? null)
          : input.source_text,
      revision: old ? String(BigInt(old.revision) + 1n) : "1",
      updated_at: now,
    };
    if (old) {
      if (
        isNeedCriteriaLocked(s, old.id) &&
        JSON.stringify([
          old.category,
          old.attributes,
          old.seasons,
          old.unit,
        ]) !==
          JSON.stringify([
            need.category,
            need.attributes,
            need.seasons,
            need.unit,
          ])
      )
        throw Error(
          "Need criteria are locked. Pause this need and create another.",
        );
      const { pending_hold, fulfilled } = getNeed(s, old).computed;
      if (
        Number(need.target_quantity) <
        Number(pending_hold) + Number(fulfilled)
      )
        throw Error(
          "The target cannot be below the received and reserved quantity.",
        );
    }
    positive(need.target_quantity);
    s.needs = s.needs.filter((record) => record.id !== c.id);
    s.needs.push(need);
    return s;
  }
  if (c.type === "capacity") {
    const old = s.capacities.find((x) => x.category === c.category)!;
    revision(old.revision, c.expected_revision);
    const { reserved, in_stock } = getCapacity(s, c.category).computed;
    if (
      !/^\d{1,9}$/.test(c.quantity) ||
      Number(c.quantity) < Number(reserved) + Number(in_stock)
    )
      throw Error("Capacity cannot be below reserved and in-stock quantities.");
    old.limit_quantity = c.quantity;
    old.revision = String(BigInt(old.revision) + 1n);
    return s;
  }
  if (c.type === "slot") {
    const old = s.slots.find((slot) => slot.id === c.id);
    if (c.patch && !old) throw Error("Slot not found.");
    if (c.input && old) throw Error("Slot already exists.");
    if (old) revision(old.revision, c.patch?.expected_revision);
    const input = c.input ?? c.patch!;
    const slot: DemoSlot = {
      ...(old ?? {
        id: c.id,
        association_id: DEMO_ASSOCIATION_ID,
        created_at: now,
      }),
      starts_at: input.starts_at ?? old!.starts_at,
      ends_at: input.ends_at ?? old!.ends_at,
      max_bookings: input.max_bookings ?? old!.max_bookings,
      active: input.active ?? old?.active ?? true,
      revision: old ? String(BigInt(old.revision) + 1n) : "1",
      updated_at: now,
    };
    if (
      old &&
      s.bookings.some((booking) => booking.slot_id === old.id) &&
      (old.starts_at !== slot.starts_at || old.ends_at !== slot.ends_at)
    )
      throw Error("Booked slot times cannot change.");
    if (slot.max_bookings < getSlot(s, slot).computed.booked_count)
      throw Error("The booking limit cannot be below existing bookings.");
    if (
      !Number.isFinite(Date.parse(slot.starts_at)) ||
      !Number.isFinite(Date.parse(slot.ends_at)) ||
      Date.parse(slot.starts_at) >= Date.parse(slot.ends_at) ||
      !Number.isInteger(slot.max_bookings) ||
      slot.max_bookings < 1
    )
      throw Error(
        "Enter valid start and end times and a positive booking limit.",
      );
    s.slots = s.slots.filter((record) => record.id !== c.id);
    s.slots.push(slot);
    return s;
  }
  const id =
    c.type === "receive" || c.type === "refuseReception"
      ? s.bookings.find((b) => b.id === c.booking_id)?.donation_id
      : c.id;
  const d = s.donations.find((d) => d.id === id);
  if (!d) throw Error("Donation not found.");
  if (
    ["postOffer", "withdrawOffer", "patch", "analyse", "offer"].includes(
      c.type,
    ) &&
    d.donor_id !== DEMO_DONOR_ID
  )
    throw Error("This donation belongs to another donor.");
  revision(d.revision, c.expected_revision);
  if (
    isPostedOffer(s, d.id) &&
    ["patch", "analyse", "offer", "postOffer"].includes(c.type)
  )
    throw Error("Withdraw the post before editing or offering this item.");
  if (c.type === "postOffer") {
    if (
      d.status !== "draft" ||
      d.association_id ||
      d.need_id ||
      !s.analyses.some(
        (a) => a.id === d.basis_analysis_id && a.donation_id === d.id,
      )
    )
      throw Error("Review a successful analysis before posting.");
    positive(d.quantity);
    if (!d.category || !String(d.attributes.product ?? "").trim())
      throw Error("Enter an item and category before posting.");
    if (getWarnings(s, d.id).length)
      throw Error("This item has a safety warning and cannot be posted.");
    if (getMatches(s, d).length)
      throw Error(
        "A current match is available. Send this offer to an association.",
      );
    s.posted_offers.push({ donation_id: d.id, posted_at: now });
  }
  if (c.type === "withdrawOffer") {
    if (!isPostedOffer(s, d.id)) throw Error("This offer is no longer posted.");
    s.posted_offers = s.posted_offers.filter(
      (offer) => offer.donation_id !== d.id,
    );
  }
  if (c.type === "patch") updateWorkingFacts(s, d, c, now);
  if (c.type === "analyse") appendSampleAnalysis(s, d, c, now);
  if (c.type === "offer") submitOffer(s, d, c, now);
  if (c.type === "decision") recordHumanDecision(s, d, c, now);
  if (c.type === "book") createBooking(s, d, c, now);
  if (c.type === "receive") receiveDonation(s, d, c, now);
  if (c.type === "refuseReception") refuseAtReception(s, d, c, now);
  if (c.type === "distribute") distributeStock(s, d, c, now);
  d.revision = String(BigInt(d.revision) + 1n);
  d.updated_at = now;
  return s;
}
