"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useDemo } from "@/lib/demo-context";
import {
  DEMO_ASSOCIATION_ID,
  getInventory,
  getPostedOffers,
} from "@/lib/demo-store";
import { DemoTools } from "@/components/public-shell";
import { Button, Chip, Icon, PageHeading, SelectField } from "@/components/ui";
import "./console.css";

const routes = [
  ["", "Dashboard", "dashboard"],
  ["/review", "Review", "review"],
  ["/offers", "Offers nearby", "offers"],
  ["/reception", "Reception", "reception"],
  ["/inventory", "Stock", "inventory"],
  ["/needs", "Needs", "needs"],
  ["/capacity", "Capacity", "capacity"],
  ["/slots", "Slots", "calendar"],
  ["/images", "Images", "images"],
];

export function ConsoleShell({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const { state, ready } = useDemo();
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const allowed = admin
    ? state.role === "platform_admin"
    : state.role === "assoc_admin";
  const association = state.associations.find(
    (a) => a.id === DEMO_ASSOCIATION_ID,
  );
  if (!ready)
    return (
      <div className="console">
        <main id="main" className="console-main" role="status">
          Loading workspace…
        </main>
      </div>
    );
  if (!allowed)
    return (
      <div className="console">
        <main id="main" className="console-main">
          <PageHeading
            title={
              admin ? "Platform access required" : "Association access required"
            }
            description={`Select the ${admin ? "platform admin" : "association"} demo persona.`}
          />
          <Link href="/login">Choose a demo persona →</Link>
        </main>
      </div>
    );
  const reviewCount = state.donations.filter(
    (d) => d.association_id === DEMO_ASSOCIATION_ID && d.status === "offered",
  ).length;
  const receptionCount = state.bookings.filter(
    (booking) =>
      booking.association_id === DEMO_ASSOCIATION_ID &&
      state.donations.some(
        (donation) =>
          donation.id === booking.donation_id && donation.status === "booked",
      ),
  ).length;
  const activeNeeds = state.needs.filter(
    (need) => need.association_id === DEMO_ASSOCIATION_ID && need.active,
  ).length;
  const stockQuantity = getInventory(state)
    .filter((item) => item.donation.association_id === DEMO_ASSOCIATION_ID)
    .reduce((quantity, item) => quantity + Number(item.remaining_quantity), 0);
  const counts: Record<string, { value: number; description: string }> = {
    "/offers": {
      value: getPostedOffers(state).length,
      description: "available offers",
    },
    "/review": { value: reviewCount, description: "waiting for review" },
    "/reception": { value: receptionCount, description: "expected drop-offs" },
    "/needs": { value: activeNeeds, description: "active needs" },
    "/inventory": { value: stockQuantity, description: "items remaining" },
  };
  const pendingApprovals = state.associations.filter(
    (item) => item.approval_status === "pending",
  ).length;
  return (
    <div className={`console ${navCollapsed ? "is-nav-collapsed" : ""}`}>
      <header className="console-header">
        <div className="console-profile">
          <Button
            variant="soft"
            className="console-nav-toggle-desktop"
            aria-label={
              navCollapsed ? "Expand navigation" : "Collapse navigation"
            }
            aria-expanded={!navCollapsed}
            aria-controls="console-sidebar"
            onClick={() => setNavCollapsed(!navCollapsed)}
          >
            <Icon name={navCollapsed ? "chevron-right" : "chevron-left"} />
          </Button>
          <Button
            variant="soft"
            className="console-nav-toggle-mobile"
            aria-label={menuOpen ? "Hide navigation" : "Show navigation"}
            aria-expanded={menuOpen}
            aria-controls="console-sidebar"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? "close" : "menu"} />
          </Button>
          <details className="console-account" key={path}>
            <summary>
              <span className="console-avatar" aria-hidden="true">
                {admin ? "NF" : "LM"}
              </span>
              <span>
                <strong>{admin ? "N. Farhi" : "Léa Martin"}</strong>
                <span className="console-meta">
                  {admin ? "Platform admin" : "Association admin"}
                </span>
              </span>
              <Icon name="chevron-down" size={16} />
            </summary>
            <div className="console-account-menu">
              <Link href="/">Dono home</Link>
              <Link href="/login">Switch demo persona</Link>
            </div>
          </details>
        </div>
        <Chip>Demo</Chip>
      </header>
      <aside
        id="console-sidebar"
        className={`console-sidebar ${menuOpen ? "is-open" : ""}`}
      >
        <div className="console-organization">
          <strong>
            {admin
              ? "Platform administration"
              : (association?.name ?? "Association")}
          </strong>
        </div>
        <nav
          id="console-navigation"
          aria-label={admin ? "Platform navigation" : "Association navigation"}
        >
          {admin ? (
            <Link
              href="/admin"
              aria-current="page"
              aria-label={`Approvals, ${pendingApprovals} pending`}
              title={`Approvals, ${pendingApprovals} pending`}
            >
              <Icon name="review" />
              <span className="console-nav-text">
                <span className="console-nav-label">Approvals</span>
                <Chip>{pendingApprovals}</Chip>
              </span>
            </Link>
          ) : (
            routes.map(([route, name, icon]) => {
              const count = counts[route];
              const accessibleLabel = count
                ? `${name}, ${count.value} ${count.description}`
                : name;
              return (
                <Link
                  key={route}
                  href={`/association${route}`}
                  aria-label={accessibleLabel}
                  title={accessibleLabel}
                  aria-current={
                    path === `/association${route}` ? "page" : undefined
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon name={icon} />
                  <span className="console-nav-text">
                    <span className="console-nav-label">{name}</span>
                    {count && <Chip>{count.value}</Chip>}
                  </span>
                </Link>
              );
            })
          )}
        </nav>
        <DemoTools>
          <p className="console-meta">
            No live API or signed QR. Expiry and matching policies remain
            unresolved.
          </p>
        </DemoTools>
      </aside>
      <main
        id="main"
        className={`console-main ${path === "/association/review" ? "console-main-review" : ""}`}
      >
        {children}
      </main>
    </div>
  );
}

export function ConsoleTitle({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <PageHeading title={title}>
      {detail && <span className="console-meta">{detail}</span>}
    </PageHeading>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice console-notice">{children}</div>;
}
export function Feedback({
  message,
  error,
}: {
  message: string;
  error?: boolean;
}) {
  return message ? (
    <div
      role={error ? "alert" : "status"}
      className={`notice ${error ? "error" : "success"} console-feedback`}
    >
      {message}
    </div>
  ) : null;
}
export function CategorySelect({
  value,
  onChange,
  all = false,
}: {
  value: string;
  onChange: (value: string) => void;
  all?: boolean;
}) {
  return (
    <SelectField
      label="Category"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {all && <option value="all">All categories</option>}
      <option value="clothes">Clothes</option>
      <option value="shoes">Shoes</option>
      <option value="food">Food</option>
      <option value="para">Hygiene & care</option>
      <option value="furniture">Small furniture</option>
    </SelectField>
  );
}
