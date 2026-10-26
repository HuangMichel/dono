"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Icon } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";

const demoEmail = "demo@example.com";

export function DemoWorkspace() {
  const auth = useAuth();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const navigated = useRef(false);
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const demoSession = auth.sessionUser?.email === demoEmail;
  const switching = Boolean(auth.sessionUser && !demoSession);
  const accountError = requested && auth.error;
  const waiting = busy || (requested && !error && !accountError);

  useEffect(() => {
    if (
      requested &&
      !busy &&
      !auth.loading &&
      !auth.error &&
      !error &&
      auth.user?.email === demoEmail &&
      !navigated.current
    ) {
      navigated.current = true;
      dialog.current?.close();
      router.push("/association");
    }
  }, [requested, busy, auth.loading, auth.error, auth.user, error, router]);

  async function openWorkspace() {
    if (pending.current || waiting || auth.loading) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setRequested(true);
    try {
      if (demoSession) {
        if (auth.error || !auth.user) await auth.refresh();
      } else {
        // This public, shared demo account is intentionally available to visitors.
        await auth.signIn(demoEmail, "demoabcde");
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The demo could not open. Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="demo-workspace-entry">
      <Button
        type="button"
        aria-haspopup="dialog"
        disabled={auth.loading || waiting}
        onClick={() => dialog.current?.showModal()}
      >
        Demo workspace
        <Icon name="arrow-right" />
      </Button>
      <dialog
        ref={dialog}
        className="correction-dialog demo-workspace-dialog"
        aria-labelledby="demo-title"
        aria-describedby="demo-description"
        onCancel={(event) => {
          if (waiting) event.preventDefault();
        }}
      >
        <h2 id="demo-title">Explore the demo workspace</h2>
        <p id="demo-description">
          Shared demo data. Changes are visible to other visitors. Do not enter
          personal information.
        </p>
        {switching && <p>Opening the demo switches your signed-in account.</p>}
        {waiting && (
          <p role="status">Signing in and loading workspace access…</p>
        )}
        {(error || accountError) && (
          <p role="alert" className="notice danger">
            {error || "Demo access could not load. Please try again."}
          </p>
        )}
        <div className="row wrap demo-workspace-actions">
          <Button
            type="button"
            disabled={auth.loading || waiting}
            onClick={() => void openWorkspace()}
          >
            {waiting
              ? "Opening demo…"
              : error || accountError
                ? "Retry demo"
                : switching
                  ? "Switch to demo"
                  : "Enter demo"}
          </Button>
          <Button
            type="button"
            variant="outline"
            autoFocus
            disabled={waiting}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </Button>
        </div>
      </dialog>
    </div>
  );
}
