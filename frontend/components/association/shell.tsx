"use client";
import { CATEGORY_LABELS } from "@/lib/labels";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useApiResource } from "@/lib/api-hooks";
import type { Association, Membership } from "@/lib/api-contracts";
import { Button, Field, Icon, PageHeading, SelectField } from "@/components/ui";
import { useNotifications } from "@/components/ui/notifications";
import "./console.css";
const AssociationContext = createContext<{
  id: string;
  membership: Membership;
  association: Association;
  refresh: () => Promise<void>;
} | null>(null);
export function useAssociation() {
  const value = useContext(AssociationContext);
  if (!value) throw new Error("Association workspace required");
  return value;
}
const routes = [
  ["", "Dashboard", "dashboard"],
  ["/review", "Review", "review"],
  ["/reception", "Reception", "reception"],
  ["/inventory", "Stock", "inventory"],
  ["/needs", "Needs", "needs"],
  ["/capacity", "Capacity and intake", "capacity"],
  ["/slots", "Site and appointments", "calendar"],
  ["/images", "Photos", "images"],
];
export function ConsoleShell({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const auth = useAuth();
  const path = usePathname();
  const [selected, setSelected] = useState("");
  const [menu, setMenu] = useState(false);
  const { notify } = useNotifications();
  const memberships = auth.memberships.filter((m) => m.active);
  const membership =
    memberships.find((m) => m.association_id === selected) ?? memberships[0];
  const [associationNames, setAssociationNames] = useState<
    Record<string, string>
  >({});
  useEffect(() => {
    const activeMemberships = auth.memberships.filter((m) => m.active);
    if (admin || activeMemberships.length < 2) return;
    let current = true;
    void Promise.all(
      activeMemberships.map((m) =>
        api<Association>(`/associations/${m.association_id}`)
          .then((association) => [m.association_id, association.name] as const)
          .catch(() => [m.association_id, ""] as const),
      ),
    ).then((entries) => {
      if (current) setAssociationNames(Object.fromEntries(entries));
    });
    return () => {
      current = false;
    };
  }, [admin, auth.memberships]);
  const resource = useApiResource<Association>(
    !admin && membership ? `/associations/${membership.association_id}` : null,
  );
  if (auth.loading)
    return (
      <main id="main" className="console-main" role="status">
        Loading workspace…
      </main>
    );
  if (auth.error)
    return (
      <main id="main" className="console-main">
        <ResourceStatus
          loading={false}
          error={auth.error}
          refresh={auth.refresh}
        />
      </main>
    );
  if (!auth.user)
    return (
      <main id="main" className="console-main">
        <PageHeading title="Sign in required" />
        <Link href="/login">Sign in</Link>
      </main>
    );
  if (admin ? auth.profile?.platform_role !== "platform_admin" : !membership)
    return (
      <main id="main" className="console-main">
        <PageHeading
          title={
            admin ? "Platform access required" : "Association access required"
          }
        />
        <p>
          {admin
            ? "Your account does not have platform access."
            : "You need an active staff membership in an approved association."}
        </p>
        <Link href="/register-association">Association registration</Link>
      </main>
    );
  if (!admin && (resource.loading || !resource.data))
    return (
      <main id="main" className="console-main">
        <ResourceStatus {...resource} />
      </main>
    );
  if (!admin && resource.data?.approval_status !== "approved")
    return (
      <main id="main" className="console-main">
        Your association is waiting for platform approval.
      </main>
    );
  const content = <>{children}</>;
  return (
    <div className="console">
      <header className="console-header">
        <Button
          variant="soft"
          aria-label="Toggle navigation"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <Icon name="menu" />
        </Button>
        <span>
          {auth.profile?.display_name ?? auth.user.email ?? "Your account"}
        </span>
        <Link href="/">Dono home</Link>
        <Button
          variant="soft"
          onClick={() => {
            void auth.signOut().catch((error) =>
              notify({
                message:
                  error instanceof Error
                    ? error.message
                    : "Sign out failed. Try again.",
                tone: "error",
              }),
            );
          }}
        >
          Sign out
        </Button>
      </header>
      <aside
        id="console-sidebar"
        className={`console-sidebar ${menu ? "is-open" : ""}`}
      >
        <div className="console-organization">
          <strong>
            {admin ? "Platform administration" : resource.data?.name}
          </strong>
        </div>
        {!admin && memberships.length > 1 && (
          <SelectField
            label="Association"
            value={membership?.association_id}
            onChange={(e) => setSelected(e.target.value)}
          >
            {memberships.map((m) => (
              <option key={m.association_id} value={m.association_id}>
                {associationNames[m.association_id] || m.association_id}
              </option>
            ))}
          </SelectField>
        )}
        <nav
          aria-label={admin ? "Platform navigation" : "Association navigation"}
        >
          {(admin ? [["", "Approvals", "review"]] : routes).map(
            ([route, label, icon]) => (
              <Link
                key={route}
                href={admin ? "/admin" : `/association${route}`}
                aria-current={
                  path === (admin ? "/admin" : `/association${route}`)
                    ? "page"
                    : undefined
                }
                onClick={() => setMenu(false)}
              >
                <Icon name={icon} />
                <span className="console-nav-text">{label}</span>
              </Link>
            ),
          )}
        </nav>
      </aside>
      <main id="main" className="console-main">
        {admin ? (
          content
        ) : (
          <AssociationContext.Provider
            key={membership!.association_id}
            value={{
              id: membership!.association_id,
              membership: membership!,
              association: resource.data!,
              refresh: resource.refresh,
            }}
          >
            {content}
          </AssociationContext.Provider>
        )}
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
  return <PageHeading title={title} description={detail} />;
}
export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice console-notice">{children}</div>;
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
      onChange={(e) => onChange(e.target.value)}
    >
      {all ? (
        <option value="">All categories</option>
      ) : (
        <option value="">Choose category</option>
      )}
      {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </SelectField>
  );
}
export function ResourceStatus({
  loading,
  error,
  refresh,
  empty,
}: {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  empty?: boolean;
}) {
  return (
    <>
      {loading && <p role="status">Loading…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <Button variant="outline" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      )}
      {!loading && !error && empty && <p>No results.</p>}
    </>
  );
}
export function More({
  hasMore,
  loadMore,
  loading,
}: {
  hasMore: boolean;
  loadMore: () => Promise<void>;
  loading: boolean;
}) {
  return hasMore ? (
    <Button
      variant="outline"
      disabled={loading}
      onClick={() => void loadMore()}
    >
      Load more
    </Button>
  ) : null;
}
export function NumberInput({
  label,
  name,
  value,
  min = 0,
}: {
  label: string;
  name: string;
  value?: string | number;
  min?: number;
}) {
  return (
    <Field
      label={label}
      name={name}
      type="number"
      step="1"
      min={min}
      required
      defaultValue={value}
    />
  );
}
