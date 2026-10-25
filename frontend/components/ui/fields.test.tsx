// @vitest-environment jsdom
import React, { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { nativeFieldError } from "@/lib/field-validation";
import { Field, SelectField, TextareaField } from "./fields";

describe("English constraint feedback", () => {
  it.each([
    [{ type: "email" }, "invalid", "Enter a valid email address."],
    [{ pattern: "[A-Z]{3}" }, "abc", "Use the requested format."],
    [{ type: "number", min: 2 }, "1", "Enter a value of 2 or more."],
    [{ type: "number", max: 5 }, "6", "Enter a value of 5 or less."],
    [
      { type: "number", min: 0, step: 2 },
      "3",
      "Enter a value that matches the required step.",
    ],
  ])(
    "ignores French browser messages for %j",
    async (props, value, message) => {
      const view = await render(
        <Field label="Value" defaultValue={value} {...props} />,
      );
      const control = view.container.querySelector("input")!;
      Object.defineProperty(control, "validationMessage", {
        get: () => "Veuillez saisir une valeur valide.",
      });
      await act(async () => {
        control.reportValidity();
      });
      expect(view.container.textContent).toContain(message);
      expect(view.container.textContent).not.toContain("Veuillez");
      expect(control.getAttribute("aria-invalid")).toBe("true");
      expect(control.getAttribute("aria-describedby")).toBe(
        `${control.id}-error`,
      );
    },
  );

  it("blocks invalid submission, cancels browser bubbles, keeps callbacks and focuses the first invalid field", async () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const invalid = vi.fn();
    const view = await render(
      <form onSubmit={submit}>
        <Field
          label="Email"
          type="email"
          defaultValue="invalid"
          onInvalid={invalid}
        />
        <SelectField label="Category" required defaultValue="">
          <option value="">Choose</option>
        </SelectField>
        <TextareaField label="Details" required />
        <button>Save</button>
      </form>,
    );
    const control = view.container.querySelector("input")!;
    const nativeInvalid = vi.fn((event: Event) =>
      expect(event.defaultPrevented).toBe(true),
    );
    control.addEventListener("invalid", nativeInvalid);
    await act(async () => {
      view.container.querySelector("button")!.click();
    });
    expect(submit).not.toHaveBeenCalled();
    expect(invalid).toHaveBeenCalledTimes(1);
    expect(nativeInvalid).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(control);
    expect(view.container.textContent).toContain("Enter category.");
    expect(view.container.textContent).toContain("Enter details.");
  });

  it("clears the error when a value is corrected and allows submission", async () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const view = await render(
      <form onSubmit={submit}>
        <Field label="Email" type="email" defaultValue="invalid" />
        <button>Save</button>
      </form>,
    );
    const control = view.container.querySelector("input")!;
    await act(async () => {
      control.reportValidity();
    });
    expect(view.container.textContent).toContain(
      "Enter a valid email address.",
    );
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(control, "donor@example.org");
      control.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(view.container.querySelector(".field-error")).toBeNull();
    expect(control.hasAttribute("aria-invalid")).toBe(false);
    await act(async () => {
      view.container.querySelector("button")!.click();
    });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("ignores disabled fields and disabled fieldsets", async () => {
    const view = await render(
      <form>
        <fieldset disabled>
          <Field label="Email" type="email" defaultValue="invalid" />
        </fieldset>
        <Field
          label="Quantity"
          type="number"
          min={2}
          defaultValue="1"
          disabled
        />
      </form>,
    );
    for (const control of view.container.querySelectorAll("input")) {
      expect(nativeFieldError(control)).toBe("");
    }
    await act(async () => {
      expect(view.container.querySelector("form")!.reportValidity()).toBe(true);
    });
    expect(view.container.querySelector(".field-error")).toBeNull();
  });
});
