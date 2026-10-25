import { beforeEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useId: () => "selection-hint",
  useMemo: (calculate: () => unknown, dependencies: unknown[]) => {
    const index = hooks.cursor++;
    const previous = hooks.values[index] as
      { value: unknown; dependencies: unknown[] } | undefined;
    if (
      !previous ||
      dependencies.some(
        (dependency, i) => !Object.is(dependency, previous.dependencies[i]),
      )
    ) {
      hooks.values[index] = { value: calculate(), dependencies };
    }
    return (hooks.values[index] as { value: unknown }).value;
  },
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [
      hooks.values[index],
      (next: unknown) => {
        hooks.values[index] =
          typeof next === "function" ? next(hooks.values[index]) : next;
      },
    ];
  },
}));
vi.mock("@/components/ui", () => ({ Button: "Button", Icon: "Icon" }));
import { DataTable } from "./data-table";
import { Pagination } from "./pagination";
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Inspect UI boundary props in the existing hook harness pattern.
type Node = ReactElement<Record<string, any>>;
function nodes(node: ReactNode): Node[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement(node)) return [];
  const element = node as Node;
  return [element, ...nodes(element.props.children)];
}
const rows = Array.from({ length: 25 }, (_, i) => ({
  id: String(i + 1),
  name: `Item ${i + 1}`,
}));
const columns = [
  {
    id: "name",
    label: "Item",
    cell: (row: (typeof rows)[number]) => row.name,
    sortValue: (row: (typeof rows)[number]) => Number(row.id),
  },
];
const defaultSearchText = (row: (typeof rows)[number]) => row.name;
function render(
  source = rows,
  pageSize?: number,
  overrides: {
    searchText?: typeof defaultSearchText;
    columns?: typeof columns;
  } = {},
) {
  hooks.cursor = 0;
  return nodes(
    DataTable({
      rows: source,
      columns,
      getRowId: (row) => row.id,
      getRowLabel: (row) => row.name,
      searchText: defaultSearchText,
      searchLabel: "Search items",
      renderMobileRow: (row) => row.name,
      pageSize,
      ...overrides,
    }),
  );
}
function pagination(tree: Node[]) {
  return tree.find((node) => node.type === Pagination)!.props;
}
function desktopRows(tree: Node[]) {
  return tree.filter((node) => node.type === "tr" && node.props.tabIndex === 0);
}
function mobileRows(tree: Node[]) {
  return tree.filter((node) => node.type === "li");
}
beforeEach(() => {
  hooks.values = [];
  hooks.cursor = 0;
});
it("defaults to ten rows and uses the same page in desktop and mobile views", () => {
  let tree = render();
  expect(desktopRows(tree)).toHaveLength(10);
  pagination(tree).onPageChange(3);
  tree = render();
  expect(desktopRows(tree).map((node) => node.props["aria-label"])).toEqual([
    "Item 21",
    "Item 22",
    "Item 23",
    "Item 24",
    "Item 25",
  ]);
  expect(mobileRows(tree).map((node) => node.props["aria-label"])).toEqual(
    desktopRows(tree).map((node) => node.props["aria-label"]),
  );
});
it("resets search and both sort controls to page one before slicing all matching rows", () => {
  let tree = render();
  pagination(tree).onPageChange(3);
  tree = render();
  tree
    .find((node) => node.type === "input")!
    .props.onChange({ target: { value: "Item 2" } });
  tree = render();
  expect(pagination(tree).page).toBe(1);
  expect(desktopRows(tree).map((node) => node.props["aria-label"])).toEqual([
    "Item 2",
    "Item 12",
    "Item 20",
    "Item 21",
    "Item 22",
    "Item 23",
    "Item 24",
    "Item 25",
  ]);
  tree
    .find((node) => node.type === "input")!
    .props.onChange({ target: { value: "" } });
  tree = render();
  pagination(tree).onPageChange(2);
  tree = render();
  tree
    .find((node) => node.type === "select")!
    .props.onChange({ target: { value: "name:descending" } });
  tree = render();
  expect(pagination(tree).page).toBe(1);
  expect(desktopRows(tree)[0].props["aria-label"]).toBe("Item 25");
  pagination(tree).onPageChange(2);
  tree = render();
  tree
    .find(
      (node) =>
        node.type === "button" && node.props.className === "data-table-sort",
    )!
    .props.onClick();
  tree = render();
  expect(pagination(tree).page).toBe(1);
  expect(desktopRows(tree)[0].props["aria-label"]).toBe("Item 1");
});
it("keeps one selected row across pages and does not toggle when actions are clicked", () => {
  let tree = render();
  const key = (node: Node) =>
    node.props.onKeyDown({
      target: "row",
      currentTarget: "row",
      key: "Enter",
      preventDefault: vi.fn(),
    });
  key(desktopRows(tree)[0]);
  tree = render();
  expect(
    desktopRows(tree).filter((node) => node.props["aria-selected"]),
  ).toHaveLength(1);
  pagination(tree).onPageChange(2);
  tree = render();
  expect(desktopRows(tree).some((node) => node.props["aria-selected"])).toBe(
    false,
  );
  key(desktopRows(tree)[0]);
  pagination(tree).onPageChange(1);
  tree = render();
  expect(desktopRows(tree).some((node) => node.props["aria-selected"])).toBe(
    false,
  );
  pagination(tree).onPageChange(2);
  tree = render();
  expect(desktopRows(tree)[0].props["aria-selected"]).toBe(true);
  class Target {
    closest() {
      return {};
    }
  }
  vi.stubGlobal("Element", Target);
  desktopRows(tree)[0].props.onClick({ target: new Target() });
  tree = render();
  expect(desktopRows(tree)[0].props["aria-selected"]).toBe(true);
  vi.unstubAllGlobals();
});
it("clamps the current page after data shrinks and supports custom page sizes", () => {
  let tree = render(rows, 4);
  expect(desktopRows(tree)).toHaveLength(4);
  pagination(tree).onPageChange(7);
  tree = render(rows.slice(0, 5), 4);
  expect(pagination(tree).page).toBe(2);
  expect(desktopRows(tree).map((node) => node.props["aria-label"])).toEqual([
    "Item 5",
  ]);
  tree = render(rows, 4);
  expect(pagination(tree).page).toBe(2);
  tree = render([], 4);
  expect(pagination(tree).page).toBe(1);
  expect(desktopRows(tree)).toHaveLength(0);
});

it("reuses full-set filtering and sorting across page and selection changes", () => {
  const searchText = vi.fn(defaultSearchText);
  const sortValue = vi.fn(columns[0].sortValue);
  const options = { searchText, columns: [{ ...columns[0], sortValue }] };
  let tree = render(rows, 4, options);
  tree
    .find((node) => node.type === "input")!
    .props.onChange({ target: { value: "Item" } });
  tree
    .find((node) => node.type === "select")!
    .props.onChange({ target: { value: "name:ascending" } });
  tree = render(rows, 4, options);
  expect(searchText).toHaveBeenCalledTimes(25);
  expect(sortValue.mock.calls.length).toBeGreaterThan(0);
  const sortCalls = sortValue.mock.calls.length;
  pagination(tree).onPageChange(2);
  tree = render(rows, 4, options);
  desktopRows(tree)[0].props.onKeyDown({
    target: "row",
    currentTarget: "row",
    key: "Enter",
    preventDefault: vi.fn(),
  });
  tree = render(rows, 4, options);
  expect(desktopRows(tree)[0].props["aria-selected"]).toBe(true);
  expect(searchText).toHaveBeenCalledTimes(25);
  expect(sortValue).toHaveBeenCalledTimes(sortCalls);
});

it("refreshes cached results when rows, query, search function or selected sort accessor changes", () => {
  let tree = render();
  tree
    .find((node) => node.type === "select")!
    .props.onChange({ target: { value: "name:ascending" } });
  tree = render();
  expect(desktopRows(tree)[0].props["aria-label"]).toBe("Item 1");
  const reversedAccessor = {
    columns: [
      {
        ...columns[0],
        sortValue: (row: (typeof rows)[number]) => -Number(row.id),
      },
    ],
  };
  tree = render(rows, undefined, reversedAccessor);
  expect(desktopRows(tree)[0].props["aria-label"]).toBe("Item 25");
  tree
    .find((node) => node.type === "input")!
    .props.onChange({ target: { value: "Item 2" } });
  tree = render(rows, undefined, reversedAccessor);
  expect(desktopRows(tree).map((node) => node.props["aria-label"])).toEqual([
    "Item 25",
    "Item 24",
    "Item 23",
    "Item 22",
    "Item 21",
    "Item 20",
    "Item 12",
    "Item 2",
  ]);
  tree = render(rows, undefined, {
    ...reversedAccessor,
    searchText: () => "hidden",
  });
  expect(desktopRows(tree)).toHaveLength(0);
  const changedRows = [{ ...rows[0], name: "Item 200" }];
  tree = render(changedRows, undefined, reversedAccessor);
  expect(desktopRows(tree).map((node) => node.props["aria-label"])).toEqual([
    "Item 200",
  ]);
  tree = render(rows, undefined, reversedAccessor);
  tree
    .find((node) => node.type === "select")!
    .props.onChange({ target: { value: "name:descending" } });
  tree = render(rows, undefined, reversedAccessor);
  expect(desktopRows(tree)[0].props["aria-label"]).toBe("Item 2");
});
