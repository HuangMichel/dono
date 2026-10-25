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
            "Take photos of your item. Check the extracted details and warning indicators.",
            "Find an association that needs your item and has space.",
            "Association staff review your offer. If approved, book a drop-off time and show your QR code when you arrive.",
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
