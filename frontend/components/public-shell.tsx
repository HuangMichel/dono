"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Icon, LinkButton } from "@/components/ui";
import { DemoWorkspace } from "@/components/auth/demo-workspace";
export function PublicShell({
  children,
  donorBack,
}: {
  children: React.ReactNode;
  donorBack?: { href: string; label: string };
}) {
  const { user, memberships } = useAuth(),
    path = usePathname();
  const donor = ["/donate", "/donations", "/booking/"].some((p) =>
    path.startsWith(p),
  );
  const landing = path === "/";
  return (
    <div className={donor ? "public-shell donor-shell" : "public-shell"}>
      <header className={`public-header ${landing ? "landing-header" : ""}`}>
        <Link href="/" className="logo">
          <Image src="/logo.svg" alt="Dono" width={96} height={32} />
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
          {!landing && memberships.some((member) => member.active) && (
            <Link href="/association">Association</Link>
          )}
          <LinkButton variant="outline" href="/login">
            {user ? "Account" : "Sign in"}
          </LinkButton>
          {landing && <DemoWorkspace />}
        </nav>
      </header>
      {donor && (
        <nav className="donor-topbar" aria-label="Donation navigation">
          {donorBack || path !== "/donations" ? (
            <Link
              href={donorBack?.href ?? "/donations"}
              aria-label={donorBack?.label ?? "Back to my donations"}
              title={donorBack?.label}
            >
              <Icon
                name={donorBack ? "arrow-left" : "chevron-left"}
                size={donorBack ? 20 : 24}
              />
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
          <Link href="/" className="logo">
            <Image src="/logo.svg" alt="Dono" width={96} height={32} />
          </Link>
        </nav>
      )}
      {children}
      <footer className="public-footer">
        <Link href="/register-association">Register an association</Link>
        <Link href="/company">Company donations</Link>
        <span>Track your donations in Dono.</span>
      </footer>
      {donor && (
        <nav className="donor-bottom-nav" aria-label="Donor navigation">
          <Link
            href="/donate"
            aria-current={path === "/donate" ? "page" : undefined}
          >
            <Icon name="scan" />
            Donate
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
            My donations
          </Link>
        </nav>
      )}
    </div>
  );
}
