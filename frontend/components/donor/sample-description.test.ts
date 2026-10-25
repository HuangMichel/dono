import { describe, expect, it } from "vitest";
import {
  SAMPLE_DESCRIPTION,
  sampleDescriptionDrafts,
} from "./sample-description";
import { createInitialState, reduceDemo } from "../../lib/demo-store";

describe("fixed description demo", () => {
  it("creates two separate unanalysed drafts and preserves their quantities and facts", () => {
    const inputs = sampleDescriptionDrafts(SAMPLE_DESCRIPTION);
    expect(inputs).not.toBeNull();
    let state = createInitialState();
    state.role = "donor";
    const ids = [
      "10000000-0000-4000-8000-000000000901",
      "10000000-0000-4000-8000-000000000902",
    ];
    inputs!.forEach((input, index) => {
      state = reduceDemo(state, { type: "create", id: ids[index], input });
    });
    expect(state.donations.find((d) => d.id === ids[0])).toMatchObject({
      category: "food",
      quantity: "6",
      attributes: { product: "Pasta, 500 g" },
      status: "draft",
      basis_analysis_id: null,
    });
    expect(state.donations.find((d) => d.id === ids[1])).toMatchObject({
      category: "clothes",
      quantity: "1",
      attributes: { product: "Winter coat", size: "M" },
      status: "draft",
      basis_analysis_id: null,
    });
  });
  it("does not pretend to extract facts from an unsupported description", () => {
    expect(sampleDescriptionDrafts("200 frozen pizzas")).toBeNull();
    expect(sampleDescriptionDrafts("")).toBeNull();
  });
});
