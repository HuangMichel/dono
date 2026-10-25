"use client";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
} from "react";
import {
  requiredFieldError,
  isControlDisabled,
} from "../../lib/field-validation";
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type FeedbackProps = { label: string; error?: string; hideLabel?: boolean };
type CommonProps = {
  id?: string;
  value?: string | number | readonly string[];
  defaultValue?: string | number | readonly string[];
  required?: boolean;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
};
function useFieldFeedback<T extends Control>(
  props: CommonProps,
  label: string,
  error?: string,
) {
  const generatedId = useId(),
    id = props.id ?? generatedId,
    ref = useRef<T>(null);
  const [touched, setTouched] = useState(false),
    [localValue, setLocalValue] = useState(String(props.defaultValue ?? ""));
  const [inheritedDisabled, setInheritedDisabled] = useState(false);
  const attachRef = useCallback((control: T | null) => {
    ref.current = control;
    if (control) setInheritedDisabled(isControlDisabled(control));
  }, []);
  const [nativeError, setNativeError] = useState({ value: "", message: "" });
  function inspect(control: T) {
    const disabled = isControlDisabled(control);
    setInheritedDisabled(disabled);
    if (disabled) {
      setTouched(false);
      setNativeError({ value: control.value, message: "" });
      return;
    }
    setTouched(true);
    setLocalValue(control.value);
    setNativeError({
      value: control.value,
      message:
        !control.validity.valid && !control.validity.valueMissing
          ? control.validationMessage
          : "",
    });
  }
  useEffect(() => {
    const control = ref.current,
      form = control?.form;
    if (!control) return;
    const observer = new MutationObserver(() =>
      setInheritedDisabled(isControlDisabled(control)),
    );
    observer.observe(control, {
      attributes: true,
      attributeFilter: ["disabled"],
    });
    let ancestor = control.parentElement;
    while (ancestor) {
      if (ancestor.tagName === "FIELDSET")
        observer.observe(ancestor, {
          attributes: true,
          attributeFilter: ["disabled"],
        });
      ancestor = ancestor.parentElement;
    }
    const validate = () => inspect(control);
    form?.addEventListener("submit", validate, true);
    return () => {
      form?.removeEventListener("submit", validate, true);
      observer.disconnect();
    };
    // The owning form and label are stable; each check reads the current DOM value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const value = String(props.value ?? localValue);
  const disabled = Boolean(props.disabled) || inheritedDisabled;
  const message = disabled
    ? ""
    : error ||
      (touched
        ? requiredFieldError(
            label,
            value,
            Boolean(props.required),
            props.disabled,
          ) || (nativeError.value === value ? nativeError.message : "")
        : "");
  const errorId = id + "-error";
  return {
    id,
    ref: attachRef,
    message,
    errorId,
    invalid: disabled ? undefined : message ? true : props["aria-invalid"],
    describedBy:
      [
        ...new Set(
          [props["aria-describedby"], message ? errorId : null]
            .filter(Boolean)
            .flatMap((value) => value!.split(/\s+/))
            .filter(Boolean),
        ),
      ].join(" ") || undefined,
    change: (event: ChangeEvent<T>) => {
      const control = event.currentTarget;
      setLocalValue(control.value);
      if (touched) inspect(control);
    },
    blur: (event: FocusEvent<T>) => inspect(event.currentTarget),
    invalidEvent: (event: FormEvent<T>) => inspect(event.currentTarget),
  };
}
export function Field({
  label,
  error,
  hideLabel = false,
  className = "",
  onBlur,
  onChange,
  onInvalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FeedbackProps) {
  const {
    id,
    ref,
    message,
    errorId,
    invalid,
    describedBy,
    change,
    blur,
    invalidEvent,
  } = useFieldFeedback<HTMLInputElement>(props, label, error);
  return (
    <label className="field-label" htmlFor={id}>
      <span id={id + "-label"} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </span>
      <input
        {...props}
        id={id}
        ref={ref}
        className={`field ${className}`}
        aria-labelledby={
          props["aria-labelledby"] ??
          (props["aria-label"] ? undefined : id + "-label")
        }
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onBlur={(e) => {
          blur(e);
          onBlur?.(e);
        }}
        onChange={(e) => {
          change(e);
          onChange?.(e);
        }}
        onInvalid={(e) => {
          invalidEvent(e);
          onInvalid?.(e);
        }}
      />
      {message && (
        <span id={errorId} className="field-error">
          {message}
        </span>
      )}
    </label>
  );
}
export function SelectField({
  label,
  error,
  hideLabel = false,
  className = "",
  onBlur,
  onChange,
  onInvalid,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FeedbackProps) {
  const {
    id,
    ref,
    message,
    errorId,
    invalid,
    describedBy,
    change,
    blur,
    invalidEvent,
  } = useFieldFeedback<HTMLSelectElement>(props, label, error);
  return (
    <label className="field-label" htmlFor={id}>
      <span id={id + "-label"} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </span>
      <select
        {...props}
        id={id}
        ref={ref}
        className={`field ${className}`}
        aria-labelledby={
          props["aria-labelledby"] ??
          (props["aria-label"] ? undefined : id + "-label")
        }
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onBlur={(e) => {
          blur(e);
          onBlur?.(e);
        }}
        onChange={(e) => {
          change(e);
          onChange?.(e);
        }}
        onInvalid={(e) => {
          invalidEvent(e);
          onInvalid?.(e);
        }}
      />
      {message && (
        <span id={errorId} className="field-error">
          {message}
        </span>
      )}
    </label>
  );
}
export function TextareaField({
  label,
  error,
  hideLabel = false,
  className = "",
  onBlur,
  onChange,
  onInvalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FeedbackProps) {
  const {
    id,
    ref,
    message,
    errorId,
    invalid,
    describedBy,
    change,
    blur,
    invalidEvent,
  } = useFieldFeedback<HTMLTextAreaElement>(props, label, error);
  return (
    <label className="field-label" htmlFor={id}>
      <span id={id + "-label"} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </span>
      <textarea
        {...props}
        id={id}
        ref={ref}
        className={`field ${className}`}
        aria-labelledby={
          props["aria-labelledby"] ??
          (props["aria-label"] ? undefined : id + "-label")
        }
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onBlur={(e) => {
          blur(e);
          onBlur?.(e);
        }}
        onChange={(e) => {
          change(e);
          onChange?.(e);
        }}
        onInvalid={(e) => {
          invalidEvent(e);
          onInvalid?.(e);
        }}
      />
      {message && (
        <span id={errorId} className="field-error">
          {message}
        </span>
      )}
    </label>
  );
}
