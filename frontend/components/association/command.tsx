"use client";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";
import { useNotifications } from "@/components/ui/notifications";
export function CommandForm({
  children,
  submit,
  onSubmit,
  successMessage = "Saved.",
  submitDisabled = false,
}: {
  children: ReactNode;
  submit: string;
  successMessage?: string;
  submitDisabled?: boolean;
  onSubmit: (data: FormData) => Promise<void | false>;
}) {
  const [busy, setBusy] = useState(false);
  const { notify } = useNotifications();
  const inFlight = useRef(false);
  async function handle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await onSubmit(new FormData(e.currentTarget));
      if (result !== false) notify({ message: successMessage });
    } catch (err) {
      notify({
        message:
          err instanceof Error
            ? err.message
            : "The action failed. Check the current details and try again.",
        tone: "error",
      });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <form className="console-stack" onSubmit={handle}>
      <fieldset
        disabled={busy}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <div className="console-stack">
          {children}
          <Button type="submit" disabled={busy || submitDisabled}>
            {busy ? "Please wait…" : submit}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
export function useCommand() {
  const retry = useRef(new Map<string, string>());
  return async (
    path: string,
    body: unknown,
    method: "POST" | "PATCH" | "PUT" = "POST",
  ) => {
    const signature = JSON.stringify([path, body, method]);
    if (!retry.current.has(signature))
      retry.current.set(signature, crypto.randomUUID());
    const result = await api(path, {
      method,
      body,
      idempotencyKey: retry.current.get(signature),
    });
    retry.current.delete(signature);
    return result;
  };
}
export function text(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}
