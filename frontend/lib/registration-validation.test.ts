import { describe, expect, it } from "vitest";
import {
  isValidSiret,
  normalizeSiret,
  validateRegistrationIdentity,
} from "./registration-validation";
describe("association legal references", () => {
  it("accepts the INSEE checksum example and normalizes spaces", () => {
    expect(isValidSiret("20003452800014")).toBe(true);
    expect(normalizeSiret(" 200 034 528 00014 ")).toBe("20003452800014");
    expect(isValidSiret(" 200 034 528 00014 ")).toBe(true);
  });
  it.each([
    "20003452800041",
    "12345678901234",
    "00000000000000",
    "2000345280001",
    "2000345280001x",
  ])("rejects invalid %s", (value) => expect(isValidSiret(value)).toBe(false));
  it("accepts RNA alone but rejects invalid supplied SIRET even with RNA", () => {
    expect(validateRegistrationIdentity("Example", "W751000001", "")).toEqual(
      {},
    );
    expect(
      validateRegistrationIdentity("Example", "W751000001", "20003452800041")
        .siret,
    ).toBeTruthy();
  });
  it("reports every missing identity field and keeps address optional", () => {
    expect(Object.keys(validateRegistrationIdentity(" ", "", " "))).toEqual([
      "name",
      "rna",
      "siret",
    ]);
    expect(
      validateRegistrationIdentity("Example", "", "20003452800014"),
    ).toEqual({});
  });
  it("supports La Poste digit-sum exception", () => {
    expect(isValidSiret("35600000000048")).toBe(true);
    expect(isValidSiret("35600000000001")).toBe(true);
    expect(isValidSiret("35600000000049")).toBe(false);
  });
});
import { createInitialState, reduceDemo } from "./demo-store";
it("blocks invalid SIRET at the shared demo command boundary, including with RNA", () => {
  const state = createInitialState();
  state.role = "donor";
  expect(() =>
    reduceDemo(state, {
      type: "register",
      name: "Example",
      rna: "W751000001",
      siret: "20003452800041",
    }),
  ).toThrow("SIRET");
});
