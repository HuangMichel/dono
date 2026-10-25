import Link from "next/link";
import type { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="auth-layout">
      <aside className="auth-intro">
        <Link href="/" className="logo">
          dono
        </Link>
        <h1>Give what associations actually need.</h1>
        <ol>
          {[
            "Photograph an item. AI returns indicators, never a verdict.",
            "See associations that need it and have room.",
            "Staff decide. On approval, book a slot and show a QR code.",
          ].map((s, i) => (
            <li key={s}>
              <span className="step-number">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <p className="meta muted">
          Medicines cannot be donated through Dono. Return them to a pharmacy.
        </p>
      </aside>
      <section className="auth-form">{children}</section>
    </main>
  );
}
