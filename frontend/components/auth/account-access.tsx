"use client";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { accountHref, safeOfferReturn } from "@/lib/offer-intent";
import { PublicShell } from "@/components/public-shell";
import { Button, Field, LinkButton } from "@/components/ui";
import { AuthLayout } from "./auth-layout";
import { useAuth } from "@/lib/auth-context";

export function AccountAccess({ mode }: { mode: "login" | "signup" }) {
  return (
    <Suspense fallback={<p role="status">Loading account…</p>}>
      <AccountForm mode={mode} />
    </Suspense>
  );
}
function AccountForm({ mode }: { mode: "login" | "signup" }) {
  const auth = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const next = safeOfferReturn(params.get("next"));
  useEffect(() => {
    if (next && auth.user && !auth.loading && !auth.error) router.replace(next);
  }, [next, auth.user, auth.loading, auth.error, router]);
  const signup = mode === "signup";
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(
    null,
  );

  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Sign-in failed. Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (pending.current || !form.reportValidity()) return;
    const values = new FormData(form);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    // Programmatic submissions must respect the same minimum as native validation.
    if (signup && password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    await perform(async () => {
      if (signup) {
        const { confirmationRequired } = await (next
          ? auth.signUp(email, password, next)
          : auth.signUp(email, password));
        if (confirmationRequired) setConfirmationEmail(email);
      } else {
        await auth.signIn(email, password);
      }
      form.reset();
    });
  }
  return (
    <PublicShell>
      <AuthLayout>
        <h2>
          {auth.sessionUser
            ? "Your account"
            : signup
              ? "Create an account"
              : "Sign in"}
        </h2>
        {(error || auth.error) && (
          <p role="alert" className="notice danger">
            {error || auth.error}
          </p>
        )}
        {auth.loading ? (
          <p role="status">Signing you in…</p>
        ) : auth.user ? (
          <div className="stack-sm">
            <p>{auth.profile?.display_name || auth.user.email}</p>
            <LinkButton href="/donations">My donations</LinkButton>
            {auth.memberships.some((m) => m.active) && (
              <LinkButton href="/association" variant="outline">
                Open association workspace
              </LinkButton>
            )}
            {auth.profile?.platform_role === "platform_admin" && (
              <LinkButton href="/admin" variant="outline">
                Review registrations
              </LinkButton>
            )}
          </div>
        ) : !auth.sessionUser && confirmationEmail ? (
          <div className="stack-sm">
            <p role="status">
              Check your email at {confirmationEmail} to confirm your account,
              then sign in.
            </p>
            <LinkButton href={next ? accountHref("login", next) : "/login"}>
              Sign in
            </LinkButton>
            <Button
              variant="outline"
              onClick={() => setConfirmationEmail(null)}
            >
              Use another email
            </Button>
          </div>
        ) : !auth.sessionUser ? (
          <>
            <p className="muted">
              {signup
                ? "Create an account to offer items to associations."
                : "Sign in to prepare donations or access your association."}
            </p>
            <form
              className="stack"
              onSubmit={(event) => void submit(event)}
              aria-busy={busy}
            >
              <Field
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={busy}
              />
              <Field
                label="Password"
                name="password"
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={signup ? 8 : undefined}
                aria-describedby={signup ? "password-help" : undefined}
                required
                disabled={busy}
              />
              {signup && (
                <p id="password-help" className="meta muted">
                  Use at least 8 characters.
                </p>
              )}
              <Button type="submit" size="app" className="full" disabled={busy}>
                {busy
                  ? signup
                    ? "Creating account…"
                    : "Signing in…"
                  : signup
                    ? "Create an account"
                    : "Sign in"}
              </Button>
            </form>
            <p className="muted">
              {signup ? "Already have an account? " : "New to Dono? "}
              <Link
                className="text-link"
                href={
                  next
                    ? accountHref(signup ? "login" : "signup", next)
                    : signup
                      ? "/login"
                      : "/signup"
                }
              >
                {signup ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </>
        ) : null}
        {auth.sessionUser && (
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => void perform(auth.signOut)}
          >
            Sign out
          </Button>
        )}
        {auth.error && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void perform(auth.refresh)}
          >
            Retry connection
          </Button>
        )}
        <p className="meta muted">
          Your association membership gives you access to its workspace.
        </p>
        <Link className="text-link" href="/register-association">
          Register an association
        </Link>
      </AuthLayout>
    </PublicShell>
  );
}
