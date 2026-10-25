"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PublicShell } from "@/components/public-shell";
import { accountHref, safeOfferReturn } from "@/lib/offer-intent";
import { LinkButton } from "@/components/ui";

export default function AuthCallback() {
  return (
    <Suspense fallback={<p role="status">Connecting your account…</p>}>
      <Callback />
    </Suspense>
  );
}
function Callback() {
  const { user, loading, error } = useAuth();
  const params = useSearchParams();
  const next = safeOfferReturn(params.get("next"));
  const router = useRouter();
  useEffect(() => {
    if (!loading && user && !error) router.replace(next ?? "/donations");
  }, [loading, user, error, next, router]);
  return (
    <PublicShell>
      <main id="main" className="page narrow">
        <h1>Connecting your account</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <LinkButton href={next ? accountHref("login", next) : "/login"}>
              Back to sign in
            </LinkButton>
          </>
        ) : (
          <p role="status">
            {loading || user
              ? "Signing you in…"
              : "We could not sign you in. Please try signing in again."}
          </p>
        )}
        {!loading && !user && !error && (
          <LinkButton href={next ? accountHref("login", next) : "/login"}>
            Sign in
          </LinkButton>
        )}
      </main>
    </PublicShell>
  );
}
