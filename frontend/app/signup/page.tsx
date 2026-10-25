"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/auth-layout";
import { PublicShell } from "@/components/public-shell";
import { Button, Field } from "@/components/ui";
import { useDemo } from "@/lib/demo-context";

export default function Signup() {
  const { dispatch } = useDemo();
  const router = useRouter();

  function continueAsDonor() {
    dispatch({ type: "role", role: "donor" });
    router.push("/donate");
  }

  return (
    <PublicShell>
      <AuthLayout>
        <h2>Create a donor account</h2>
        <p className="muted">To photograph items and send offers.</p>
        <div className="stack-sm auth-fields">
          <Field
            id="signup-email"
            label="Email"
            type="email"
            placeholder="you@example.fr"
            autoComplete="email"
            disabled
          />
          <Field
            id="signup-password"
            label="Password"
            type="password"
            placeholder="Password"
            autoComplete="new-password"
            disabled
          />
        </div>
        <p className="meta muted">
          Account creation is unavailable in this local demo. No account is
          created and no password is collected. Continue with fictional data.
        </p>
        <Button size="app" className="full" onClick={continueAsDonor}>
          Continue as a demo donor
        </Button>
        <p className="meta muted">
          Already have an account?{" "}
          <Link className="text-link" href="/login">
            Sign in
          </Link>
        </p>
        <p className="meta muted">
          Registering an association?{" "}
          <Link className="text-link" href="/register-association">
            Register your association
          </Link>
        </p>
      </AuthLayout>
    </PublicShell>
  );
}
