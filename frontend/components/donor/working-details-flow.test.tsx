import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import {
  createInitialState,
  fixtureId,
  reduceDemo,
  type DemoState,
} from "../../lib/demo-store";

const harness = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  effects: [] as (() => void)[],
  state: null as unknown as DemoState,
  dispatch: vi.fn(),
  failSave: false,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.values))
      harness.values[index] =
        typeof initial === "function" ? initial() : initial;
    return [
      harness.values[index],
      (next: unknown) => {
        harness.values[index] =
          typeof next === "function" ? next(harness.values[index]) : next;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.values))
      harness.values[index] = { current: initial };
    return harness.values[index];
  },
  useEffect: (effect: () => void) => {
    harness.effects.push(effect);
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams({ id: fixtureId("coat") }),
}));
vi.mock("@/lib/demo-context", () => ({
  useDemo: () => ({
    state: harness.state,
    dispatch: harness.dispatch,
    ready: true,
  }),
}));
vi.mock("@/components/public-shell", () => ({
  PublicShell: "PublicShell",
  DemoTools: "DemoTools",
}));
vi.mock("@/components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Chip: "Chip",
  Field: "Field",
  SelectField: "SelectField",
  PageHeading: "PageHeading",
  Icon: "Icon",
  LinkButton: "LinkButton",
}));
vi.mock("@/components/ui/step-actions", () => ({ StepActions: "StepActions" }));
vi.mock("@/components/ui/stepper", () => ({ Stepper: "Stepper" }));
vi.mock("@/components/ui/file-upload", () => ({ FileUpload: "FileUpload" }));
vi.mock("@/lib/demo-store", async () => import("../../lib/demo-store"));
vi.mock(
  "@/components/donor/working-details",
  async () => import("./working-details"),
);
vi.mock("@/components/donor/donation-home", () => ({
  DonationHome: "DonationHome",
}));
vi.mock("@/components/donor/flow-states", () => ({
  AnalysisState: "AnalysisState",
  PhotoProblem: "PhotoProblem",
  SafetyWarning: "SafetyWarning",
  OfferSent: "OfferSent",
}));
vi.mock("@/components/donor/local-photos", () => ({
  DEMO_ITEM_PHOTO_LIMIT: 6,
  createPhotoController: (publish: (snapshot: unknown) => void) => ({
    addFiles: () =>
      publish({
        photos: [{ id: "sample", kind: "item", src: "/item-clothes.svg" }],
        errors: [],
      }),
    dispose: vi.fn(),
  }),
}));
import Donate from "../../app/donate/page";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Inspect event props at mocked component boundaries.
type Node = ReactElement<Record<string, any>>;
function nodes(node: ReactNode): Node[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement(node)) return [];
  const element = node as Node;
  return [element, ...nodes(element.props.children)];
}
function render() {
  harness.cursor = 0;
  harness.effects = [];
  const route = (Donate().props.children as ReactElement)
    .type as () => ReactElement;
  const flow = route();
  const tree = nodes((flow.type as (props: unknown) => ReactNode)(flow.props));
  for (const node of tree) {
    if (node.type === "dialog")
      node.props.ref.current = {
        showModal: vi.fn(),
        close: vi.fn(),
        open: true,
      };
  }
  for (const effect of harness.effects) effect();
  return tree;
}
function find(
  tree: Node[],
  type: string,
  match: (props: Node["props"]) => boolean = () => true,
) {
  const node = tree.find((node) => node.type === type && match(node.props));
  if (!node) throw Error("Missing " + type);
  return node.props;
}
function change(tree: Node[], id: string, value: string) {
  find(tree, "Field", (props) => props.id === id).onChange({
    target: { value },
  });
}
function open(tree: Node[]) {
  find(
    tree,
    "Button",
    (props) => props.children === "Correct details",
  ).onClick();
}
function submit(tree: Node[]) {
  find(tree, "form", (props) => props.id === "donation-corrections").onSubmit({
    preventDefault: vi.fn(),
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  harness.values = [];
  harness.failSave = false;
  harness.state = createInitialState();
  harness.state.role = "donor";
  const donation = harness.state.donations.find(
    (item) => item.id === fixtureId("coat"),
  )!;
  Object.assign(donation, {
    status: "draft",
    decision: null,
    association_id: null,
    need_id: null,
  });
  harness.dispatch.mockReset().mockImplementation((command) => {
    if (command.type === "patch" && harness.failSave)
      throw Error("Save failed. Try again.");
    harness.state = reduceDemo(harness.state, command);
  });
});
afterEach(() => {
  vi.useRealTimers();
});
function review() {
  let tree = render();
  find(tree, "FileUpload", (props) => props.id === "item-photo").onFilesChange(
    [],
  );
  tree = render();
  find(tree, "form", (props) => props.id === "donation-photo-step").onSubmit({
    preventDefault: vi.fn(),
  });
  vi.advanceTimersByTime(650);
  return render();
}
describe("donation corrections at mocked React boundaries", () => {
  it.each([
    ["food", "food", "Sealed pasta, 500 g"],
    ["shoes", "shoes", "Demo item"],
    ["medicine", "para", "Demo item"],
    ["cold", "food", "Sealed pasta, 500 g"],
  ])(
    "shows the %s sample identity on first analysis",
    (scenario, category, product) => {
      const donation = harness.state.donations.find(
        (item) => item.id === fixtureId("coat"),
      )!;
      donation.basis_analysis_id = null;
      donation.attributes = {};
      let tree = render();
      find(tree, "select", (props) => props.value === "clothes").onChange({
        target: { value: scenario },
      });
      tree = review();
      const warning = tree.find((node) => node.type === "SafetyWarning");
      if (warning) {
        warning.props.review();
        tree = render();
      }
      expect(
        find(tree, "Field", (props) => props.id === "working-product").value,
      ).toBe(product);
      expect(
        find(tree, "SelectField", (props) => props.label === "Category").value,
      ).toBe(category);
    },
  );
  it("retains a company product on first analysis", () => {
    const donation = harness.state.donations.find(
      (item) => item.id === fixtureId("coat"),
    )!;
    donation.basis_analysis_id = null;
    donation.donor_kind = "company";
    donation.company_name = "Example shop";
    donation.attributes = { product: "Our coats" };
    const tree = review();
    expect(
      find(tree, "Field", (props) => props.id === "working-product").value,
    ).toBe("Our coats");
    expect(
      harness.state.donations.find((item) => item.id === donation.id)
        ?.attributes.product,
    ).toBe("Our coats");
  });
  it.each(["Back", "Escape"])(
    "restores every correction on %s without changing stored facts",
    (dismissal) => {
      let tree = review();
      open(tree);
      const initialProduct = find(
        tree,
        "Field",
        (props) => props.id === "working-product",
      ).value;
      change(tree, "working-product", "Different coat");
      change(tree, "working-quantity", "4");
      change(tree, "working-size", "XL");
      find(tree, "SelectField", (props) => props.label === "Category").onChange(
        { target: { value: "para" } },
      );
      tree = render();
      change(tree, "working-expiry", "2027-03-15");
      tree = render();
      find(
        tree,
        "SelectField",
        (props) => props.label === "Printed date type",
      ).onChange({ target: { value: "PAO" } });
      tree = render();
      change(tree, "pao-months", "12");
      tree = render();
      if (dismissal === "Escape") find(tree, "dialog").onCancel();
      else
        find(
          tree,
          "StepActions",
          (props) => props.backLabel === "Back",
        ).onBack();
      tree = render();
      expect(
        find(tree, "Field", (props) => props.id === "working-product").value,
      ).toBe(initialProduct);
      expect(
        find(tree, "Field", (props) => props.id === "working-quantity").value,
      ).toBe("1");
      expect(
        find(tree, "Field", (props) => props.id === "working-size").value,
      ).toBe("M");
      expect(
        find(tree, "SelectField", (props) => props.label === "Category").value,
      ).toBe("clothes");
      open(tree);
      find(tree, "SelectField", (props) => props.label === "Category").onChange(
        { target: { value: "para" } },
      );
      tree = render();
      expect(
        find(
          tree,
          "SelectField",
          (props) => props.label === "Printed date type",
        ).value,
      ).toBe("DDM");
      expect(
        find(tree, "Field", (props) => props.id === "working-expiry").value,
      ).toBe("");
      find(
        tree,
        "SelectField",
        (props) => props.label === "Printed date type",
      ).onChange({ target: { value: "PAO" } });
      tree = render();
      expect(
        find(tree, "Field", (props) => props.id === "pao-months").value,
      ).toBe("");
      expect(
        harness.dispatch.mock.calls.some(
          ([command]) => command.type === "patch",
        ),
      ).toBe(false);
    },
  );
  it("keeps unsaved values on external updates and failed Save, then saves with the current revision and retains original evidence", () => {
    let tree = review();
    const originalEvidence = structuredClone(harness.state.analyses);
    open(tree);
    change(tree, "working-product", "Blue coat");
    change(tree, "working-quantity", "2");
    const donation = harness.state.donations.find(
      (item) => item.id === fixtureId("coat"),
    )!;
    harness.state = {
      ...harness.state,
      donations: harness.state.donations.map((item) =>
        item.id === donation.id ? { ...item, revision: "8" } : item,
      ),
    };
    harness.failSave = true;
    tree = render();
    submit(tree);
    tree = render();
    expect(
      find(tree, "Field", (props) => props.id === "working-product").value,
    ).toBe("Blue coat");
    expect(
      find(tree, "Field", (props) => props.id === "working-quantity").value,
    ).toBe("2");
    expect(find(tree, "div", (props) => props.role === "alert").children).toBe(
      "Save failed. Try again.",
    );
    harness.failSave = false;
    submit(tree);
    expect(harness.dispatch).toHaveBeenLastCalledWith({
      type: "patch",
      id: donation.id,
      expected_revision: "8",
      patch: {
        category: "clothes",
        quantity: "2",
        attributes: { product: "Blue coat", size: "M" },
      },
    });
    expect(
      harness.state.donations.find((item) => item.id === donation.id)
        ?.attributes.product,
    ).toBe("Blue coat");
    expect(harness.state.analyses).toEqual(originalEvidence);
  });
  it("clears the calendar date on PAO selection and sends only printed PAO evidence", () => {
    let tree = review();
    open(tree);
    find(tree, "SelectField", (props) => props.label === "Category").onChange({
      target: { value: "para" },
    });
    tree = render();
    change(tree, "working-expiry", "2027-03-15");
    tree = render();
    find(
      tree,
      "SelectField",
      (props) => props.label === "Printed date type",
    ).onChange({ target: { value: "PAO" } });
    tree = render();
    change(tree, "pao-months", "12");
    tree = render();
    submit(tree);
    expect(harness.dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        patch: {
          category: "para",
          quantity: "1",
          attributes: { product: "Winter coat" },
          expiry: {
            expiry_date: null,
            date_type: "PAO",
            pao_months: 12,
            date_precision: "unknown",
            raw_label: null,
            readability: "unknown",
          },
        },
      }),
    );
  });
});
