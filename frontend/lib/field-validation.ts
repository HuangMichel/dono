export function requiredFieldError(
  label: string,
  value: string,
  required: boolean,
  disabled = false,
): string {
  return required && !disabled && !value.trim()
    ? `Enter ${label.toLowerCase().replace(/\s*\(required\)/g, "")}.`
    : "";
}

/** Use constraint flags rather than the browser's localised validationMessage. */
export function nativeFieldError(
  control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): string {
  const validity = control.validity;
  if (isControlDisabled(control) || validity.valid || validity.valueMissing)
    return "";
  if (validity.badInput) return "Enter a valid value.";
  if (validity.typeMismatch)
    return control.getAttribute("type") === "email"
      ? "Enter a valid email address."
      : "Enter a valid web address.";
  if (validity.patternMismatch) return "Use the requested format.";
  if (validity.rangeUnderflow)
    return `Enter a value of ${control.getAttribute("min")} or more.`;
  if (validity.rangeOverflow)
    return `Enter a value of ${control.getAttribute("max")} or less.`;
  if (validity.tooShort)
    return `Enter at least ${control.getAttribute("minlength")} characters.`;
  if (validity.tooLong)
    return `Enter no more than ${control.getAttribute("maxlength")} characters.`;
  if (validity.stepMismatch)
    return "Enter a value that matches the required step.";
  return "Check this value.";
}

/** Native :disabled includes disabled fieldsets and respects their legend exception. */
export function isControlDisabled(control: {
  disabled: boolean;
  matches: (selector: string) => boolean;
}): boolean {
  return control.disabled || control.matches(":disabled");
}
