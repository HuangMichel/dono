import { beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const harness = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  state: null as unknown as import("./demo-store").DemoState,
  dispatch: vi.fn(),
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: () => {},
    useRef: () => ({ current: null }),
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
  };
});
vi.mock("@/lib/demo-context", () => ({
  useDemo: () => ({
    state: harness.state,
    dispatch: harness.dispatch,
    storageError: null,
  }),
}));
vi.mock("@/components/association/shell", () => ({
  Feedback: "Feedback",
  ConsoleTitle: "ConsoleTitle",
  CategorySelect: "CategorySelect",
}));
vi.mock("@/components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Chip: "Chip",
  Field: "Field",
  SelectField: "SelectField",
}));
vi.mock("@/components/ui/data-table", () => ({ DataTable: "DataTable" }));
vi.mock("@/components/association/need-voice-input", () => ({
  NeedVoiceInput: "NeedVoiceInput",
}));
vi.mock("@/lib/demo-store", async () => import("./demo-store"));
vi.mock("@/components/ui/calendar", () => ({
  Calendar: "Calendar",
  useParisClock: () => ({ today: "2026-10-28" }),
}));
vi.mock(
  "@/components/association/interaction",
  async () => import("../components/association/interaction"),
);
import SlotsPage from "../app/association/slots/page";
import NeedsPage from "../app/association/needs/page";
import { createInitialState, fixtureId, reduceDemo } from "./demo-store";
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test boundary spans native and shared component event props.
type Node = ReactElement<Record<string, any>>; // Element props are inspected at mocked UI boundaries.
function nodes(node: ReactNode): Node[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement(node)) return [];
  const element = node as Node;
  return [element, ...nodes(element.props.children)];
}
function render(page: () => ReactNode) {
  harness.cursor = 0;
  return nodes(page());
}
function find(
  tree: Node[],
  type: string,
  predicate: (props: Node["props"]) => boolean = () => true,
) {
  const node = tree.find((node) => node.type === type && predicate(node.props));
  if (!node) throw Error("Missing " + type);
  return node.props;
}
beforeEach(() => {
  vi.stubGlobal("document", { getElementById: () => ({ focus: vi.fn() }) });
  harness.values = [];
  harness.cursor = 0;
  harness.dispatch.mockReset();
  harness.dispatch.mockImplementation((command) => {
    harness.state = reduceDemo(harness.state, command);
  });
  harness.state = createInitialState();
  harness.state.role = "assoc_admin";
});
it("keeps criteria disabled after refusal releases the last commitment", () => {
  harness.state = reduceDemo(harness.state, {
    type: "refuseReception",
    booking_id: fixtureId("booking-sweaters"),
    reason: "Damp item",
    confirm_refusal: true,
    expected_revision: "1",
  });
  for (const donation of harness.state.donations)
    if (donation.id !== fixtureId("sweaters")) donation.need_id = null;
  let tree = render(NeedsPage);
  find(tree, "DataTable").onSelectionChange(fixtureId("need-clothes"));
  tree = render(NeedsPage);
  expect(find(tree, "fieldset").disabled).toBe(true);
});

it("preserves unsaved need fields and rebases only its own successful status toggle", () => {
  let tree = render(NeedsPage);
  find(tree, "DataTable").onSelectionChange(fixtureId("need-clothes"));
  tree = render(NeedsPage);
  find(tree, "Field", (props) => props.label === "Target, items").onChange({
    target: { value: "150" },
  });
  tree = render(NeedsPage);
  const table = find(tree, "DataTable");
  const need = table.rows.find(
    (need: { id: string }) => need.id === fixtureId("need-clothes"),
  );
  const action = table.columns
    .find((column: { id: string }) => column.id === "actions")
    .cell(need);
  nodes(action)
    .find((node) => node.type === "Button")!
    .props.onClick();
  tree = render(NeedsPage);
  expect(
    find(tree, "Field", (props) => props.label === "Target, items").value,
  ).toBe("150");
  find(tree, "form").onSubmit({ preventDefault: vi.fn() });
  expect(
    harness.state.needs.find((need) => need.id === fixtureId("need-clothes")),
  ).toMatchObject({ active: false, target_quantity: "150", revision: "3" });
});

it("does not mask an external change when toggling a stale need form", () => {
  let tree = render(NeedsPage);
  find(tree, "DataTable").onSelectionChange(fixtureId("need-clothes"));
  harness.state = reduceDemo(harness.state, {
    type: "need",
    id: fixtureId("need-clothes"),
    patch: { expected_revision: "1", target_quantity: "160" },
  });
  tree = render(NeedsPage);
  const table = find(tree, "DataTable");
  const need = table.rows.find(
    (need: { id: string }) => need.id === fixtureId("need-clothes"),
  );
  const action = table.columns
    .find((column: { id: string }) => column.id === "actions")
    .cell(need);
  nodes(action)
    .find((node) => node.type === "Button")!
    .props.onClick();
  tree = render(NeedsPage);
  find(tree, "form").onSubmit({ preventDefault: vi.fn() });
  tree = render(NeedsPage);
  expect(find(tree, "Feedback").message).toContain("record changed");
  expect(
    harness.state.needs.find((need) => need.id === fixtureId("need-clothes"))
      ?.target_quantity,
  ).toBe("160");
});

it("preserves unsaved slot limits after its own toggle and saves against the updated revision", () => {
  let tree = render(SlotsPage);
  find(tree, "Button", (props) => props.children === "Edit").onClick();
  tree = render(SlotsPage);
  find(tree, "Field", (props) => props.label === "Maximum bookings").onChange({
    target: { value: "4" },
  });
  tree = render(SlotsPage);
  find(tree, "Button", (props) => props.children === "Close slot").onClick();
  tree = render(SlotsPage);
  expect(
    find(tree, "Field", (props) => props.label === "Maximum bookings").value,
  ).toBe("4");
  find(tree, "form").onSubmit({ preventDefault: vi.fn() });
  expect(find(render(SlotsPage), "Feedback").message).toBe("Slot updated.");
  expect(
    harness.state.slots.find((slot) => slot.id === fixtureId("slot-0")),
  ).toMatchObject({ active: false, max_bookings: 4, revision: "3" });
});

it("keeps a slot edit stale if an external change preceded its status toggle", () => {
  let tree = render(SlotsPage);
  find(tree, "Button", (props) => props.children === "Edit").onClick();
  harness.state = reduceDemo(harness.state, {
    type: "slot",
    id: fixtureId("slot-0"),
    patch: { expected_revision: "1", max_bookings: 3 },
  });
  tree = render(SlotsPage);
  find(tree, "Button", (props) => props.children === "Close slot").onClick();
  tree = render(SlotsPage);
  find(tree, "form").onSubmit({ preventDefault: vi.fn() });
  tree = render(SlotsPage);
  expect(find(tree, "Feedback").message).toContain("record changed");
  expect(
    harness.state.slots.find((slot) => slot.id === fixtureId("slot-0"))
      ?.max_bookings,
  ).toBe(3);
});
