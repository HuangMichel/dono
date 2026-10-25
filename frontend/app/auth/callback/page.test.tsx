// @vitest-environment jsdom
import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
const mock = vi.hoisted(() => ({
  replace: vi.fn(),
  next: "",
  auth: {
    user: null as { id: string } | null,
    loading: false,
    error: null as string | null,
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mock.replace }),
  useSearchParams: () => new URLSearchParams({ next: mock.next }),
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => mock.auth }));
vi.mock("@/components/public-shell", () => ({
  PublicShell: ({ children }: { children: React.ReactNode }) => children,
}));
import Callback from "./page";
beforeEach(() => {
  mock.replace.mockReset();
  mock.auth = { user: null, loading: false, error: null };
  mock.next = "/donate?need=n1&category=food";
});
it("continues email confirmation to the selected donation after account hydration", async () => {
  const { container, rerender } = await render(<Callback />);
  expect(container.querySelector('a[href^="/login?next="]')).not.toBeNull();
  expect(mock.replace).not.toHaveBeenCalled();
  mock.auth.user = { id: "donor" };
  await rerender(<Callback />);
  expect(mock.replace).toHaveBeenCalledWith(mock.next);
});
it("keeps account failures recoverable and rejects external callback destinations", async () => {
  mock.auth.error = "Account unavailable";
  mock.auth.user = { id: "donor" };
  const { container, rerender } = await render(<Callback />);
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    "Account unavailable",
  );
  expect(mock.replace).not.toHaveBeenCalled();
  mock.auth.error = null;
  mock.next = "//evil.test";
  await rerender(<Callback />);
  expect(mock.replace).toHaveBeenCalledWith("/donations");
});
