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

/** Native :disabled includes disabled fieldsets and respects their legend exception. */
export function isControlDisabled(control: {
  disabled: boolean;
  matches: (selector: string) => boolean;
}): boolean {
  return control.disabled || control.matches(":disabled");
}
