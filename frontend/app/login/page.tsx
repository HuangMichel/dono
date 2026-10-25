"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { Button, Field } from "@/components/ui";
import { useDemo } from "@/lib/demo-context";
import { AuthLayout } from "@/components/auth/auth-layout";
import type { DemoRole } from "@/lib/demo-store";
export default function Login() {
  const { dispatch } = useDemo(),
    router = useRouter();
  const [account, setAccount] = useState<"donor" | "association">("donor");
  function choose(role: DemoRole, path: string) {
    dispatch({ type: "role", role });
    router.push(path);
  }
  return (
    <PublicShell>
      <AuthLayout>
        <div className="segmented" aria-label="Account type">
          {(["donor", "association"] as const).map((a) => (
            <Button
              key={a}
              variant="soft"
              aria-pressed={account === a}
              onClick={() => setAccount(a)}
            >
              {a === "donor" ? "Donor" : "Association"}
            </Button>
          ))}
        </div>
        <h2>Sign in</h2>
        <p className="muted">
          {account === "donor"
            ? "To photograph items and send offers."
            : "To review offers and manage donations."}
        </p>
        <div className="stack-sm auth-fields">
          <Field
            id="demo-email"
            label="Email"
            type="email"
            placeholder="you@example.fr"
            autoComplete="email"
            disabled
          />
          <Field
            id="demo-password"
            label="Password"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            disabled
          />
        </div>
        <p className="meta muted">
          Sign-in is unavailable in this local demo. No account or password is
          created.
        </p>
        <Button
          size="app"
          className="full"
          onClick={() =>
            choose(
              account === "donor" ? "donor" : "assoc_admin",
              account === "donor" ? "/donate" : "/association",
            )
          }
        >
          {account === "donor"
            ? "Continue as a demo donor"
            : "Open association demo"}
        </Button>
        <p className="meta muted">
          New to Dono?{" "}
          <Link className="text-link" href="/signup">
            Create a donor account
          </Link>
        </p>
        <p className="meta muted">
          New association?{" "}
          <Link className="text-link" href="/register-association">
            Register your association
          </Link>
        </p>
        <details className="demo-tools">
          <summary>Platform demo</summary>
          <Button
            variant="outline"
            onClick={() => choose("platform_admin", "/admin")}
          >
            Review association registrations
          </Button>
        </details>
      </AuthLayout>
    </PublicShell>
  );
}
