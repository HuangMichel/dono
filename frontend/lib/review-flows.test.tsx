import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const harness = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  state: {
    role: "donor" as string | null,
    associations: [] as {
      id: string;
      name: string;
      approval_status: string;
      revision: number;
    }[],
  },
  dispatch: vi.fn(),
  push: vi.fn(),
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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: harness.push }),
}));
vi.mock("@/lib/demo-context", () => ({
  useDemo: () => ({
    state: harness.state,
    dispatch: harness.dispatch,
    storageError: null,
  }),
}));
vi.mock("@/components/public-shell", () => ({
  PublicShell: "PublicShell",
  DemoTools: "DemoTools",
}));
vi.mock("@/components/association/shell", () => ({ Feedback: "Feedback" }));
vi.mock("@/components/association/evidence", () => ({
  instant: (value: string) => value,
}));
vi.mock("@/components/ui", () => ({
  Button: "Button",
  Card: "Card",
  CardActions: "CardActions",
  Chip: "Chip",
  PageHeading: "PageHeading",
  Field: "Field",
  LinkButton: "LinkButton",
  Icon: "Icon",
}));
vi.mock("@/components/ui/data-table", () => ({ DataTable: "DataTable" }));
vi.mock("@/lib/field-validation", async () => import("./field-validation"));
vi.mock(
  "@/lib/registration-validation",
  async () => import("./registration-validation"),
);
vi.mock("@/components/ui/stepper", () => ({ Stepper: "Stepper" }));
vi.mock("@/components/ui/step-actions", () => ({ StepActions: "StepActions" }));
import ApprovalsPage from "../app/admin/page";
import Company from "../app/company/page";
import Register from "../app/register-association/page";

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
  harness.push.mockReset();
  harness.state = { role: "donor", associations: [] };
});
describe("reviewed frontend flows", () => {
  it("keeps approval details and action on the controlled table selection and clears the target", () => {
    harness.state.associations = [
      {
        id: "a",
        name: "Association A",
        approval_status: "pending",
        revision: 1,
      },
      {
        id: "b",
        name: "Association B",
        approval_status: "pending",
        revision: 2,
      },
    ];
    let tree = render(ApprovalsPage);
    expect(
      tree.some(
        (node) => node.type === "Button" && node.props.children === "Approve",
      ),
    ).toBe(false);
    find(tree, "DataTable").onSelectionChange("b");
    tree = render(ApprovalsPage);
    expect(find(tree, "DataTable").selectedRowId).toBe("b");
    expect(find(tree, "h2").children).toBe("Association B");
    find(tree, "Button", (props) => props.children === "Approve").onClick();
    expect(harness.dispatch).toHaveBeenCalledWith({
      type: "approveAssociation",
      id: "b",
      expected_revision: 2,
    });
    const table = find(tree, "DataTable");
    const nameButton = table.columns[0].cell(harness.state.associations[0]);
    nameButton.props.onClick();
    tree = render(ApprovalsPage);
    expect(find(tree, "DataTable").selectedRowId).toBe("a");
    expect(find(tree, "h2").children).toBe("Association A");
    find(tree, "DataTable").onSelectionChange(null);
    tree = render(ApprovalsPage);
    expect(
      tree.some(
        (node) => node.type === "Button" && node.props.children === "Approve",
      ),
    ).toBe(false);
  });
  it("clears the approval target when changing status filters", () => {
    harness.state.associations = [
      {
        id: "a",
        name: "Association A",
        approval_status: "pending",
        revision: 1,
      },
    ];
    let tree = render(ApprovalsPage);
    find(tree, "DataTable").onSelectionChange("a");
    tree = render(ApprovalsPage);
    find(
      tree,
      "Button",
      (props) =>
        Array.isArray(props.children) && props.children[0] === "Approved",
    ).onClick();
    tree = render(ApprovalsPage);
    expect(find(tree, "DataTable").selectedRowId).toBeNull();
    expect(
      tree.some(
        (node) => node.type === "Button" && node.props.children === "Approve",
      ),
    ).toBe(false);
  });
  it("keeps a visitor's registration details while selecting a donor demo role inline", () => {
    harness.state.role = null;
    harness.dispatch.mockImplementation((command) => {
      if (command.type === "role") harness.state.role = command.role;
    });
    let tree = render(Register);
    find(tree, "Field", (props) => props.id === "association-name").onChange({
      target: { value: "Example solidarity" },
    });
    find(tree, "Field", (props) => props.id === "registration-rna").onChange({
      target: { value: "W751234567" },
    });
    tree = render(Register);
    find(tree, "form").onSubmit({ preventDefault: vi.fn() });
    tree = render(Register);
    find(tree, "Field", (props) => props.id === "donation-address").onChange({
      target: { value: "12 rue Example, Paris" },
    });
    tree = render(Register);
    find(tree, "form").onSubmit({ preventDefault: vi.fn() });
    tree = render(Register);
    expect(
      find(
        tree,
        "Button",
        (props) => props.children?.[0] === "Submit demo registration",
      ).disabled,
    ).toBe(true);
    find(
      tree,
      "Button",
      (props) => props.children === "Use donor demo role",
    ).onClick();
    tree = render(Register);
    expect(
      tree
        .filter((node) => node.type === "dd")
        .map((node) => node.props.children),
    ).toEqual([
      "Example solidarity",
      "W751234567",
      "Not provided",
      "12 rue Example, Paris",
    ]);
    expect(
      find(
        tree,
        "Button",
        (props) => props.children?.[0] === "Submit demo registration",
      ).disabled,
    ).toBe(false);
    find(tree, "form").onSubmit({ preventDefault: vi.fn() });
    expect(harness.dispatch).toHaveBeenLastCalledWith({
      type: "register",
      name: "Example solidarity",
      rna: "W751234567",
      siret: "",
      display_address: "12 rue Example, Paris",
    });
    expect(harness.push).not.toHaveBeenCalled();
  });
  it("creates a valid company draft with trimmed product and continues to photos", () => {
    let tree = render(Company);
    find(tree, "Field", (props) => props.id === "product").onChange({
      target: { value: "  Sealed rice  " },
    });
    tree = render(Company);
    find(tree, "form").onSubmit({ preventDefault: vi.fn() });
    expect(harness.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "create",
        input: expect.objectContaining({
          attributes: { product: "Sealed rice" },
        }),
      }),
    );
    expect(harness.push).toHaveBeenCalledWith(
      expect.stringMatching(/^\/donate\?id=/),
    );
  });
  it("rejects whitespace company product before creating a draft or navigating", () => {
    let tree = render(Company);
    find(tree, "Field", (props) => props.id === "product").onChange({
      target: { value: "   " },
    });
    tree = render(Company);
    find(tree, "form").onSubmit({ preventDefault: vi.fn() });
    tree = render(Company);
    expect(harness.dispatch).not.toHaveBeenCalled();
    expect(harness.push).not.toHaveBeenCalled();
    expect(
      find(tree, "Field", (props) => props.id === "product").error,
    ).toBeTruthy();
  });
});
