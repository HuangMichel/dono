import { beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const harness = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.values)) harness.values[index] = initial;
    return [
      harness.values[index],
      (value: unknown) => {
        harness.values[index] = value;
      },
    ];
  },
}));
vi.mock("@/components/public-shell", () => ({ PublicShell: "PublicShell" }));
vi.mock("@/lib/demo-store", async () => import("../../lib/demo-store"));
vi.mock("@/components/ui/pagination", () => ({ Pagination: "Pagination" }));
vi.mock(
  "@/components/ui/pagination-model",
  async () => import("../../components/ui/pagination-model"),
);
vi.mock("@/components/ui", () => ({
  PageHeading: "PageHeading",
  Card: "Card",
  CardActions: "CardActions",
  Button: "Button",
  Field: "Field",
  Chip: "Chip",
  Icon: "Icon",
  LinkButton: "LinkButton",
}));
import Needs from "./page";
// Mocked component boundaries expose event handlers without simulating a browser.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = ReactElement<Record<string, any>>;
function nodes(node: ReactNode): Node[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement(node)) return [];
  const element = node as Node;
  return [element, ...nodes(element.props.children)];
}
function render() {
  harness.cursor = 0;
  return nodes(Needs());
}
function find(tree: Node[], type: string, text?: string) {
  const node = tree.find(
    (node) =>
      node.type === type &&
      (text === undefined || node.props.children === text),
  );
  if (!node) throw Error(`Missing ${type}: ${text ?? ""}`);
  return node.props;
}
beforeEach(() => {
  harness.values = [];
  harness.cursor = 0;
});
it("allows empty or whitespace location submissions without a required-field error", () => {
  let tree = render();
  expect(find(tree, "Field").required).not.toBe(true);
  find(tree, "Field").onChange({ target: { value: "   " } });
  tree = render();
  find(tree, "form").onSubmit({ preventDefault: vi.fn() });
  tree = render();
  expect(find(tree, "Pagination").totalItems).toBe(5);
  expect(
    tree.filter(
      (node) =>
        node.type === "button" && node.props.className?.includes("need-row"),
    ),
  ).toHaveLength(5);
  expect(tree.some((node) => node.props.children === "Enter location")).toBe(
    false,
  );
});
it("clamps a stale page request and selects visible details after a category change", () => {
  let tree = render();
  find(tree, "Pagination").onPageChange(2);
  tree = render();
  expect(find(tree, "Pagination").page).toBe(1);
  expect(find(tree, "h2").children).toBe("Winter coats, adult M–XL");
  expect(
    tree.filter(
      (node) =>
        node.type === "button" && node.props.className?.includes("need-row"),
    ),
  ).toHaveLength(5);
  tree
    .find((node) => node.type === "button" && node.key === "furniture")!
    .props.onClick();
  tree = render();
  expect(find(tree, "h2").children).toBe("Small furniture, bedside tables");
  find(tree, "Button", "Clothes").onClick();
  tree = render();
  expect(find(tree, "Pagination").page).toBe(1);
  expect(find(tree, "Pagination").totalItems).toBe(1);
  expect(find(tree, "h2").children).toBe("Winter coats, adult M–XL");
});
it("resets selection when submitting location without filtering fictitious examples", () => {
  let tree = render();
  tree
    .find((node) => node.type === "button" && node.key === "furniture")!
    .props.onClick();
  tree = render();
  find(tree, "Field").onChange({ target: { value: "Lyon" } });
  tree = render();
  find(tree, "form").onSubmit({ preventDefault: vi.fn() });
  tree = render();
  expect(find(tree, "Pagination").page).toBe(1);
  expect(find(tree, "Pagination").totalItems).toBe(5);
  expect(find(tree, "h2").children).toBe("Winter coats, adult M–XL");
  expect(
    tree.some(
      (node) =>
        typeof node.props.children === "string" &&
        node.props.children.includes("Location search is unavailable"),
    ),
  ).toBe(true);
});
it("keeps the category filter when a location is cleared and submitted", () => {
  let tree = render();
  find(tree, "Button", "Food").onClick();
  tree = render();
  find(tree, "Field").onChange({ target: { value: "   " } });
  tree = render();
  find(tree, "form").onSubmit({ preventDefault: vi.fn() });
  tree = render();
  expect(find(tree, "Pagination").totalItems).toBe(1);
  expect(find(tree, "h2").children).toBe("Dry pasta, rice and cans");
  expect(find(tree, "Button", "Food")["aria-pressed"]).toBe(true);
});
