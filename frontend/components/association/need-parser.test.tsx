import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/components/association/shell", () => ({ Feedback: () => null }));
vi.mock("@/lib/api", () => ({ api: vi.fn() }));
import { api } from "@/lib/api";
import {
  NeedParserForm,
  prepareNeedForReview,
  prepareNeedDraft,
  ParsedNeedConfirmation,
} from "./need-parser";
it("requests only an extracted draft and does not persist the need", async () => {
  const result = {
    draft: {
      category: "clothes",
      attributes: { type: "coat" },
      target_quantity: "12.000",
    },
    warnings: ["Size not provided"],
  };
  vi.mocked(api).mockResolvedValueOnce(result);
  expect(
    await prepareNeedDraft("actual-association", "We need 12 coats"),
  ).toEqual(result);
  expect(api).toHaveBeenCalledExactlyOnceWith(
    "/associations/actual-association/needs/parse",
    { method: "POST", body: { text: "We need 12 coats" } },
  );
});
it("requires explicit human confirmation and retains parser warnings", () => {
  const html = renderToStaticMarkup(
    <ParsedNeedConfirmation warnings={["Size not provided"]} />,
  );
  expect(html).toContain("Size not provided");
  expect(html).toContain('name="confirm_draft"');
  expect(html).toContain('required=""');
  expect(html).toContain("not saved");
});

it("reports draft preparation after parsing without claiming a saved need", async () => {
  const result = {
    draft: { category: "food", attributes: { product: "Rice" } },
    warnings: [],
  };
  vi.mocked(api).mockResolvedValueOnce(result);
  const onDraft = vi.fn();
  const section = NeedParserForm({
    id: "association-real",
    onDraft,
    getSignal: () => new AbortController().signal,
  });
  const form = section.props.children[1];
  expect(form.props.successMessage).toBe(
    "Draft prepared. Review and confirm it below.",
  );
  const fields = new FormData();
  fields.set("source", "We need rice");
  await form.props.onSubmit(fields);
  expect(onDraft).toHaveBeenCalledWith(result, "We need rice");
});

it("discards a late parser response after leaving the draft form", async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(api).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const onDraft = vi.fn();
  const controller = new AbortController();
  const pending = prepareNeedForReview(
    "association-real",
    "We need rice",
    onDraft,
    controller.signal,
  );
  controller.abort();
  resolve({
    draft: { category: "food", attributes: { product: "Rice" } },
    warnings: [],
  });
  await pending;
  expect(onDraft).not.toHaveBeenCalled();
});
