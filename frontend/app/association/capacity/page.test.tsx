import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/components/association/shell", () => ({
  ConsoleTitle: ({ title }: { title: string }) => <h1>{title}</h1>,
  CategorySelect: () => null,
  useAssociation: () => ({
    id: "association",
    membership: { role: "assoc_staff" },
    association: { name: "Real association" },
  }),
  ResourceStatus: () => null,
  More: () => null,
  NumberInput: () => null,
}));
vi.mock("@/lib/api-hooks", () => ({
  useApiPage: (url: string) =>
    url.includes("/capacity")
      ? {
          data: [
            {
              association_id: "association",
              category: "clothes",
              storage_unit: "item_slot",
              limit_storage_units: 10,
              revision: 1,
              computed: {
                occupied_storage_units: 3,
                reserved_storage_units: 2,
                available_storage_units: 5,
              },
            },
          ],
          loading: false,
          error: null,
          hasMore: false,
        }
      : { data: [], loading: false, error: null, hasMore: false },
}));
import CapacityPage from "./page";

it("shows the storage meter with the shared threshold colours and exact places", () => {
  const html = renderToStaticMarkup(<CapacityPage />);
  expect(html).toContain("Storage capacity");
  expect(html).toContain("50%");
  expect(html).toContain("Clothes");
  expect(html).toContain("3 occupied, 2 reserved, 5 available places");
  expect(html).toContain(
    "Green through 60%; orange above 60% through 85%; red above 85%.",
  );
});
