import { describe, expect, it } from "vitest";
import { filterAndSortRows, toggleRowSelection } from "./data-table-model";
describe("table controls", () => {
  const rows = [
    { id: "a", name: "Winter coat", quantity: 12, date: "2026-11-02" },
    { id: "b", name: "Rice", quantity: 2, date: "2026-10-30" },
    { id: "c", name: "Coat", quantity: 4, date: "2027-01-01" },
  ];
  it("searches without case sensitivity and sorts quantities numerically", () => {
    expect(
      filterAndSortRows(
        rows,
        "  COAT ",
        (r) => r.name,
        (r) => r.quantity,
        "ascending",
      ).map((r) => r.id),
    ).toEqual(["c", "a"]);
  });
  it("sorts dates chronologically and leaves missing values last", () => {
    const dated = [
      ...rows,
      { id: "d", name: "Undated", quantity: 1, date: "" },
    ];
    expect(
      filterAndSortRows(
        dated,
        "",
        (r) => r.name,
        (r) => (r.date ? Date.parse(r.date) : null),
        "descending",
      ).map((r) => r.id),
    ).toEqual(["c", "a", "b", "d"]);
  });
  it("selects one row and replaces the previous selection", () => {
    expect(toggleRowSelection(null, "a")).toBe("a");
    expect(toggleRowSelection("a", "b")).toBe("b");
    expect(toggleRowSelection("b", "b")).toBeNull();
  });
  it("keeps the selected identity when search hides it or sort reorders it", () => {
    const selected = toggleRowSelection(null, "a");
    const hidden = filterAndSortRows(rows, "Rice", (r) => r.name);
    expect(hidden.some((r) => r.id === selected)).toBe(false);
    const restored = filterAndSortRows(
      rows,
      "",
      (r) => r.name,
      (r) => r.quantity,
      "ascending",
    );
    expect(restored.map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(selected).toBe("a");
    expect(restored.find((r) => r.id === selected)?.name).toBe("Winter coat");
  });
});
