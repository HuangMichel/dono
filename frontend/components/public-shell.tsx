"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemo } from "@/lib/demo-context";
import { Icon, LinkButton } from "@/components/ui";
export function DemoTools({ children }: { children?: React.ReactNode }) {
  const { reset } = useDemo();
  return (
    <details className="demo-tools">
      <summary>
        Local demo <span className="muted">Fictional data</span>
      </summary>
      <div className="demo-tools-content">
        <p className="meta muted">
          Roles, analysis and appointments are simulated in this browser.
        </p>
        {children}
        <div className="row wrap">
          <Link href="/login">Switch demo role</Link>
          <button type="button" onClick={reset}>
            Reset demo
          </button>
        </div>
      </div>
    </details>
  );
}
export function PublicShell({
  children,
  donorBack,
}: {
  children: React.ReactNode;
  donorBack?: { href: string; label: string };
}) {
  const { state } = useDemo(),
    path = usePathname();
  const donor = ["/donate", "/donations", "/booking/"].some((p) =>
    path.startsWith(p),
  );
  const landing = path === "/";
  return (
    <div className={donor ? "public-shell donor-shell" : "public-shell"}>
      <header className={`public-header ${landing ? "landing-header" : ""}`}>
        <Link href="/" className="logo">
          dono
        </Link>
        <nav aria-label="Main navigation">
          <Link
            href="/needs"
            aria-current={path === "/needs" ? "page" : undefined}
          >
            Nearby needs
          </Link>
          {!landing && (
            <Link
              href="/donations"
              aria-current={path === "/donations" ? "page" : undefined}
            >
              My donations
            </Link>
          )}
          <LinkButton variant="outline" href="/login">
            {state.role ? "Demo account" : "Sign in"}
          </LinkButton>
        </nav>
      </header>
      <div className="demo-disclosure">
        <DemoTools />
      </div>
      {donor && (
        <nav className="donor-topbar" aria-label="Donation navigation">
          <Link
            href={
              donorBack?.href ??
              (path === "/donations" ? "/donate" : "/donations")
            }
            aria-label={
              donorBack?.label ??
              (path === "/donations"
                ? "Prepare a donation"
                : "Back to my donations")
            }
            title={donorBack?.label}
          >
            <Icon
              name={donorBack ? "arrow-left" : "chevron-left"}
              size={donorBack ? 20 : 24}
            />
          </Link>
          <Link href="/" className="logo">
            dono
          </Link>
        </nav>
      )}
      {children}
      <footer className="public-footer">
        <Link href="/register-association">Register an association</Link>
        <Link href="/company">Company offers</Link>
        <span>Status stays in Dono.</span>
      </footer>
      {donor && (
        <nav className="donor-bottom-nav" aria-label="Donor navigation">
          <Link
            href="/donate"
            aria-current={path === "/donate" ? "page" : undefined}
          >
            <Icon name="scan" />
            Home
          </Link>
          <Link href="/needs">
            <Icon name="needs" />
            Needs
          </Link>
          <Link
            href="/donations"
            aria-current={path === "/donations" ? "page" : undefined}
          >
            <Icon name="inventory" />
            Donations
          </Link>
        </nav>
      )}
    </div>
  );
}
