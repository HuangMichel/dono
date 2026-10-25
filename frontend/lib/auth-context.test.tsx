// @vitest-environment jsdom
import React, { act, useLayoutEffect } from "react";
import { render } from "@/test/render";
import { beforeEach, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

const mock = vi.hoisted(() => ({
  session: null as { user: User } | null,
  callback: null as
    null | ((event: string, session: { user: User } | null) => void),
  api: vi.fn(),
  page: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("./supabase/client", () => ({
  getSupabase: () => ({
    auth: {
      getSession: async () => ({
        data: { session: mock.session },
        error: null,
      }),
      onAuthStateChange: (callback: typeof mock.callback) => {
        mock.callback = callback;
        callback?.("INITIAL_SESSION", mock.session);
        return { data: { subscription: { unsubscribe: mock.unsubscribe } } };
      },
      signOut: mock.signOut,
      signInWithPassword: mock.signInWithPassword,
      signUp: mock.signUp,
    },
  }),
}));
vi.mock("./api", () => ({ api: mock.api, apiPage: mock.page }));
vi.mock("@/components/public-shell", () => ({
  PublicShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/components/auth/auth-layout", () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => (
    <section>{children}</section>
  ),
}));
import { AuthProvider, useAuth } from "./auth-context";
import Login from "../app/login/page";
import { useApiResource } from "./api-hooks";

let host: HTMLDivElement;
let auth: ReturnType<typeof useAuth>;
function Probe() {
  const current = useAuth();
  useApiResource("/business");
  useLayoutEffect(() => {
    auth = current;
  });
  return <Login />;
}
const user = (id: string) => ({ id, email: `${id}@test.invalid` }) as User;
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.session = { user: user("a") };
  mock.api.mockResolvedValue({ display_name: "A" });
  mock.page.mockResolvedValue({ data: [], page: { has_more: false } });
  mock.signOut.mockResolvedValue({ error: null });
  mock.signInWithPassword.mockResolvedValue({
    data: { session: null },
    error: null,
  });
  mock.signUp.mockResolvedValue({ data: { session: null }, error: null });
});
async function mount() {
  const mounted = await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  host = mounted.container;
  await flush();
}
it.each(["profile", "membership"])(
  "keeps SDK sign-out available after %s failure and recovers on retry",
  async (failure) => {
    (failure === "profile" ? mock.api : mock.page).mockRejectedValueOnce(
      new Error("Backend unavailable"),
    );
    await mount();
    expect(mock.api.mock.calls.some(([path]) => path === "/business")).toBe(
      false,
    );
    expect(auth.user).toBeNull();
    expect(auth.sessionUser?.id).toBe("a");
    expect(auth.profile).toBeNull();
    expect(auth.memberships).toEqual([]);
    expect(host.textContent).toContain("Sign out");
    expect(host.querySelector('a[href="/donations"]')).toBeNull();
    await act(async () => auth.refresh());
    expect(auth.user?.id).toBe("a");
    expect(auth.error).toBeNull();
    await act(async () =>
      Array.from(host.querySelectorAll("button"))
        .find((button) => button.textContent === "Sign out")!
        .click(),
    );
    expect(mock.signOut).toHaveBeenCalledOnce();
    expect(auth.sessionUser).toBeNull();
  },
);
it("rejects old account hydration and ignores same-account token refresh", async () => {
  let resolveOld!: (value: unknown) => void;
  mock.api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  await mount();
  mock.session = { user: user("b") };
  await act(async () => mock.callback!("SIGNED_IN", mock.session));
  await flush();
  expect(auth.user?.id).toBe("b");
  await act(async () => resolveOld({ display_name: "Old" }));
  expect(auth.user?.id).toBe("b");
  expect(auth.profile?.display_name).toBe("A");
  const calls = mock.api.mock.calls.length;
  await act(async () => mock.callback!("TOKEN_REFRESHED", mock.session));
  expect(auth.user?.id).toBe("b");
  expect(mock.api).toHaveBeenCalledTimes(calls);
});

it("signs in with email and password and keeps access gated until SDK hydration", async () => {
  mock.session = null;
  await mount();
  await act(async () => auth.signIn("  donor@test.invalid  ", " password "));
  expect(mock.signInWithPassword).toHaveBeenCalledWith({
    email: "donor@test.invalid",
    password: " password ",
  });
  expect(auth.user).toBeNull();
  expect(mock.api).not.toHaveBeenCalled();
  mock.session = { user: user("new") };
  await act(async () => mock.callback!("SIGNED_IN", mock.session));
  await flush();
  expect(auth.user?.id).toBe("new");
});
it("propagates a wrong password without granting application access", async () => {
  mock.session = null;
  mock.signInWithPassword.mockResolvedValueOnce({
    error: new Error("Invalid login credentials"),
  });
  await mount();
  await expect(auth.signIn("donor@test.invalid", "wrong")).rejects.toThrow(
    "Invalid login credentials",
  );
  expect(auth.user).toBeNull();
  expect(mock.api).not.toHaveBeenCalled();
});
it("returns confirmation-required signup without bootstrapping a profile", async () => {
  mock.session = null;
  await mount();
  const result = await auth.signUp(" donor@test.invalid ", " password ");
  expect(mock.signUp).toHaveBeenCalledWith({
    email: "donor@test.invalid",
    password: " password ",
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  expect(result).toEqual({ confirmationRequired: true });
  expect(auth.sessionUser).toBeNull();
  expect(mock.api).not.toHaveBeenCalled();
});
it("returns immediate-session signup and hydrates through the SDK event", async () => {
  mock.session = null;
  mock.signUp.mockImplementationOnce(async () => {
    mock.session = { user: user("created") };
    mock.callback!("SIGNED_IN", mock.session);
    return { data: { session: mock.session }, error: null };
  });
  await mount();
  let result;
  await act(async () => {
    result = await auth.signUp("donor@test.invalid", "password");
  });
  expect(result).toEqual({ confirmationRequired: false });
  await flush();
  expect(auth.user?.id).toBe("created");
});

it("waits for both profile and memberships before exposing application links", async () => {
  let finishMemberships!: (value: unknown) => void;
  mock.page.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishMemberships = resolve;
      }),
  );
  await mount();
  expect(auth.loading).toBe(true);
  expect(auth.user).toBeNull();
  expect(host.querySelector('a[href="/donations"]')).toBeNull();
  await act(async () =>
    finishMemberships({ data: [], page: { has_more: false } }),
  );
  expect(auth.loading).toBe(false);
  expect(auth.user?.id).toBe("a");
  expect(host.querySelector('a[href="/donations"]')).not.toBeNull();
});

it("puts a safe donation continuation in the confirmation email callback", async () => {
  mock.session = null;
  await mount();
  const next = "/donate?need=n1&category=food&location=Paris";
  await auth.signUp("donor@test.invalid", "password", next);
  const callback = new URL(
    mock.signUp.mock.lastCall![0].options.emailRedirectTo,
  );
  expect(callback.pathname).toBe("/auth/callback");
  expect(callback.searchParams.get("next")).toBe(next);
  await auth.signUp("donor@test.invalid", "password", "https://evil.test");
  expect(mock.signUp.mock.lastCall![0].options.emailRedirectTo).toBe(
    `${window.location.origin}/auth/callback`,
  );
});
