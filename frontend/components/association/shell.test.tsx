// @vitest-environment jsdom
import React, { act } from "react";
import { expect, it, vi } from "vitest";
import { render } from "@/test/render";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    loading: false,
    error: null,
    user: { email: "admin@example.com" },
    profile: { platform_role: "platform_admin" },
    memberships: [],
    signOut: vi.fn(),
  }),
}));
vi.mock("@/lib/api-hooks", () => ({
  useApiResource: () => ({ loading: false, data: null, error: null }),
}));
vi.mock("@/components/ui/notifications", () => ({
  useNotifications: () => ({ notify: vi.fn() }),
}));
import { ConsoleShell } from "./shell";

it("lets staff hide and show the sidebar without removing the workspace", async () => {
  const { container } = await render(
    <ConsoleShell admin>
      <p>Approval workspace</p>
    </ConsoleShell>,
  );
  const toggle = () =>
    container.querySelector<HTMLButtonElement>(".console-sidebar-toggle")!;
  expect(toggle()?.getAttribute("aria-label")).toBe("Hide sidebar");
  expect(toggle().getAttribute("aria-expanded")).toBe("true");
  await act(async () => toggle().click());
  expect(toggle().getAttribute("aria-label")).toBe("Show sidebar");
  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  expect(container.querySelector(".console.is-nav-hidden")).not.toBeNull();
  expect(container.querySelector("main")?.textContent).toContain(
    "Approval workspace",
  );
  await act(async () => toggle().click());
  expect(toggle().getAttribute("aria-expanded")).toBe("true");
  expect(container.querySelector(".console.is-nav-hidden")).toBeNull();
});
