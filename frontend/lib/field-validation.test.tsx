import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Field, SelectField, TextareaField } from "../components/ui/fields";
import { requiredFieldError } from "./field-validation";
describe("shared required field feedback", () => {
  it("treats whitespace as empty, keeps optional and disabled fields optional", () => {
    expect(requiredFieldError("Association name", "  ", true)).toBe(
      "Enter association name.",
    );
    expect(requiredFieldError("Address", "", false)).toBe("");
    expect(requiredFieldError("Email", "", true, true)).toBe("");
    expect(requiredFieldError("Name", "Example", true)).toBe("");
  });
  it("does not mark untouched required controls red on first render", () => {
    const html = renderToStaticMarkup(
      <>
        <Field label="Name" required />
        <SelectField label="Category" required>
          <option value="">Choose</option>
        </SelectField>
        <TextareaField label="Details" required />
      </>,
    );
    expect(html).not.toContain('aria-invalid="true"');
    expect(html).not.toContain("field-error");
  });
  it.each(["input", "select", "textarea"])(
    "links %s error text accessibly without duplicate IDs",
    (kind) => {
      const props = {
        id: "example",
        label: "Name",
        error: "Enter a name.",
        "aria-describedby": "help example-error help",
      };
      const control =
        kind === "input" ? (
          <Field {...props} />
        ) : kind === "select" ? (
          <SelectField {...props}>
            <option value="" />
          </SelectField>
        ) : (
          <TextareaField {...props} />
        );
      const html = renderToStaticMarkup(control);
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('aria-describedby="help example-error"');
      expect(html).toContain('id="example-error"');
      expect(html).toContain("Enter a name.");
    },
  );
  it("suppresses stale external errors and invalid flags on disabled demo credentials", () => {
    const html = renderToStaticMarkup(
      <Field
        id="email"
        label="Email"
        required
        disabled
        error="Enter email."
        aria-invalid
      />,
    );
    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain("field-error");
  });
});

import { isControlDisabled } from "./field-validation";
describe("native disabled fieldsets", () => {
  it("ignores required controls disabled by an ancestor fieldset even without their own disabled attribute", () => {
    const disabledByFieldset = {
      disabled: false,
      matches: (selector: string) => selector === ":disabled",
    };
    expect(
      requiredFieldError(
        "Item",
        "",
        true,
        isControlDisabled(disabledByFieldset),
      ),
    ).toBe("");
  });
  it("keeps enabled required fields, including the native first-legend exception, validated", () => {
    const enabled = { disabled: false, matches: () => false };
    expect(
      requiredFieldError("Item", "", true, isControlDisabled(enabled)),
    ).toBe("Enter item.");
  });
  it.each(["input", "select", "textarea"])(
    "keeps the %s accessible label independent of error content",
    (kind) => {
      const props = { id: "stable", label: "Item", error: "Enter item." };
      const html = renderToStaticMarkup(
        kind === "input" ? (
          <Field {...props} />
        ) : kind === "select" ? (
          <SelectField {...props} />
        ) : (
          <TextareaField {...props} />
        ),
      );
      expect(html).toContain('aria-labelledby="stable-label"');
      expect(html).toContain('<span id="stable-label">Item</span>');
      expect(html).toContain('aria-describedby="stable-error"');
    },
  );
});

describe("caller-provided accessible names", () => {
  it.each(["input", "select", "textarea"])(
    "respects an explicit aria-label on %s",
    (kind) => {
      const props = {
        id: "quantity",
        label: "Quantity",
        "aria-label": "Quantity for winter coats",
        error: "Enter quantity.",
      };
      const html = renderToStaticMarkup(
        kind === "input" ? (
          <Field {...props} />
        ) : kind === "select" ? (
          <SelectField {...props} />
        ) : (
          <TextareaField {...props} />
        ),
      );
      expect(html).toContain('aria-label="Quantity for winter coats"');
      expect(html).not.toContain("aria-labelledby=");
      expect(html).toContain('aria-describedby="quantity-error"');
    },
  );
  it.each(["input", "select", "textarea"])(
    "preserves explicit aria-labelledby precedence on %s",
    (kind) => {
      const props = {
        id: "quantity",
        label: "Quantity",
        "aria-label": "Fallback",
        "aria-labelledby": "item-name quantity-label",
      };
      const html = renderToStaticMarkup(
        kind === "input" ? (
          <Field {...props} />
        ) : kind === "select" ? (
          <SelectField {...props} />
        ) : (
          <TextareaField {...props} />
        ),
      );
      expect(html).toContain('aria-labelledby="item-name quantity-label"');
    },
  );
});
