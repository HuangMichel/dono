// @vitest-environment jsdom
import React, { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
const mock = vi.hoisted(() => ({
  replace: vi.fn(),
  auth: {
    sessionUser: null,
    user: null as { id: string; email: string } | null,
    profile: null,
    memberships: [],
    loading: false,
    error: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    refresh: vi.fn(),
  },
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ replace: mock.replace }),
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => mock.auth }));
vi.mock("@/components/public-shell", () => ({
  PublicShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
import Login from "@/app/login/page";
import Signup from "@/app/signup/page";
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.signIn.mockResolvedValue(undefined);
  mock.auth.signUp.mockResolvedValue({ confirmationRequired: true });
});
function fill(host: HTMLElement, password = " secret password ") {
  host.querySelector<HTMLInputElement>('input[type="email"]')!.value =
    "donor@test.invalid";
  host.querySelector<HTMLInputElement>('input[type="password"]')!.value =
    password;
}
async function submit(host: HTMLElement) {
  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
it("offers only email and password login, preserving a short existing password", async () => {
  const { container } = await render(<Login />);
  expect(container.textContent).not.toContain("Google");
  expect(
    container.querySelector('input[autocomplete="current-password"]'),
  ).not.toBeNull();
  fill(container, "short");
  await submit(container);
  expect(mock.auth.signIn).toHaveBeenCalledWith("donor@test.invalid", "short");
  expect(container.querySelector('a[href="/signup"]')).not.toBeNull();
});
it("preserves credentials and shows a recoverable wrong-password error", async () => {
  mock.auth.signIn.mockRejectedValueOnce(
    new Error("Invalid login credentials"),
  );
  const { container } = await render(<Login />);
  fill(container);
  await submit(container);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Invalid login credentials",
  );
  expect(
    container.querySelector<HTMLInputElement>('input[type="password"]')!.value,
  ).toBe(" secret password ");
  await submit(container);
  expect(mock.auth.signIn).toHaveBeenCalledTimes(2);
});
it("blocks duplicate requests while sign-in is pending", async () => {
  let finish!: () => void;
  mock.auth.signIn.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { container } = await render(<Login />);
  fill(container);
  await submit(container);
  await submit(container);
  expect(mock.auth.signIn).toHaveBeenCalledOnce();
  expect(
    container.querySelector<HTMLButtonElement>('button[type="submit"]')
      ?.disabled,
  ).toBe(true);
  await act(async () => finish());
});
it("requires a valid email and an eight-character signup password before calling Auth", async () => {
  const { container } = await render(<Signup />);
  fill(container, "short");
  await submit(container);
  expect(mock.auth.signUp).not.toHaveBeenCalled();
  fill(container);
  container.querySelector<HTMLInputElement>('input[type="email"]')!.value =
    "invalid";
  await submit(container);
  expect(mock.auth.signUp).not.toHaveBeenCalled();
});
it("shows email confirmation after signup without exposing account links", async () => {
  const { container } = await render(<Signup />);
  expect(
    container.querySelector('input[autocomplete="new-password"]'),
  ).not.toBeNull();
  fill(container);
  await submit(container);
  expect(mock.auth.signUp).toHaveBeenCalledWith(
    "donor@test.invalid",
    " secret password ",
  );
  expect(container.querySelector('[role="status"]')?.textContent).toContain(
    "Check your email",
  );
  expect(container.querySelector('a[href="/donations"]')).toBeNull();
  expect(container.querySelector('input[type="password"]')).toBeNull();
  expect(container.querySelector('a[href="/login"]')).not.toBeNull();
});

afterEach(() => {
  window.history.replaceState({}, "", "/");
  mock.auth.user = null;
});
it("preserves selected need through signup confirmation and login links", async () => {
  const next = "/donate?need=n1&category=food&location=Paris";
  window.history.replaceState(
    {},
    "",
    `/signup?${new URLSearchParams({ next })}`,
  );
  const { container } = await render(<Signup />);
  fill(container);
  await submit(container);
  expect(mock.auth.signUp).toHaveBeenCalledWith(
    "donor@test.invalid",
    " secret password ",
    next,
  );
  expect(
    container.querySelector(`a[href^="/login?next="]`)?.getAttribute("href"),
  ).toBe(`/login?${new URLSearchParams({ next })}`);
});
it("continues only after the authenticated application account has loaded", async () => {
  const next = "/donate?need=n1&category=food";
  window.history.replaceState(
    {},
    "",
    `/login?${new URLSearchParams({ next })}`,
  );
  const { rerender } = await render(<Login />);
  expect(mock.replace).not.toHaveBeenCalled();
  mock.auth.user = { id: "donor", email: "donor@test.invalid" };
  await rerender(<Login />);
  expect(mock.replace).toHaveBeenCalledWith(next);
});
it("does not redirect to an untrusted return URL", async () => {
  window.history.replaceState({}, "", "/login?next=https://evil.test");
  mock.auth.user = { id: "donor", email: "donor@test.invalid" };
  await render(<Login />);
  expect(mock.replace).not.toHaveBeenCalled();
});
