"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Icon } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";

const demoEmail = "demo@example.com";

export function DemoWorkspace() {
  const auth = useAuth();
  const router = useRouter();
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
        aria-describedby="demo-description"
        disabled={auth.loading || waiting}
        onClick={() => void openWorkspace()}
      >
        {waiting
          ? "Opening demo workspace…"
          : error || accountError
            ? "Retry demo workspace"
            : switching
              ? "Switch to demo workspace"
              : "Open workspace"}
        <Icon name="arrow-right" />
      </Button>
      <p id="demo-description" className="sr-only">
        Explore the association workspace with shared fictional data. Changes
        are visible to other visitors. Do not enter personal information.
      </p>
      {switching && (
        <p className="sr-only">
          Opening the demo switches your signed-in account.
        </p>
      )}
      {waiting && (
        <p role="status" className="sr-only">
          Signing in and loading workspace access…
        </p>
      )}
      {(error || accountError) && (
        <p role="alert" className="notice danger demo-workspace-error">
          {error || "Demo access could not load. Please try again."}
        </p>
      )}
    </div>
  );
}
