"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { PublicShell } from "@/components/public-shell";
import { Field, PageHeading } from "@/components/ui";
import {
  CommandForm,
  text,
  useCommand,
} from "@/components/association/command";
export default function Register() {
  const auth = useAuth();
  const command = useCommand();
  const [sent, setSent] = useState(false);
  return (
    <PublicShell>
      <main id="main" className="container narrow">
        <PageHeading title="Register your association" />
        {auth.loading ? (
          <p role="status">Loading account…</p>
        ) : !auth.user ? (
          <p>
            <Link href="/login">Sign in to register an association</Link>
          </p>
        ) : sent ? (
          <div role="status">
            <h2>Registration sent</h2>
            <p>
              A platform administrator must verify the association. Your
              association workspace becomes available after approval.
            </p>
          </div>
        ) : (
          <CommandForm
            submit="Submit registration"
            onSubmit={async (data) => {
              const rna = text(data, "rna").replaceAll(/\s/g, "").toUpperCase();
              const siret = text(data, "siret").replaceAll(/\s/g, "");
              if (!rna && !siret)
                throw new Error(
                  "Provide an RNA or SIRET registration identifier.",
                );
              await command("/associations", {
                name: text(data, "name"),
                ...(rna ? { rna } : {}),
                ...(siret ? { siret } : {}),
                timezone: "Europe/Paris",
              });
              setSent(true);
              await auth.refresh();
            }}
          >
            <Field
              label="Association name"
              name="name"
              required
              maxLength={120}
            />
            <Field
              label="RNA (W followed by 9 digits)"
              name="rna"
              pattern="W[0-9]{9}"
            />
            <Field label="SIRET (14 digits)" name="siret" pattern="[0-9]{14}" />
            <p>
              Configure the drop-off address and opening hours in your
              association workspace after approval.
            </p>
          </CommandForm>
        )}
      </main>
    </PublicShell>
  );
}
