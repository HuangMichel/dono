// @vitest-environment jsdom
import React, { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";

const mock = vi.hoisted(() => ({
  push: vi.fn(),
  auth: {
    sessionUser: null as { email: string } | null,
    user: null as { email: string } | null,
    loading: false,
    error: null as string | null,
    signIn: vi.fn(),
    refresh: vi.fn(),
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mock.push }),
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => mock.auth }));
import { DemoWorkspace } from "./demo-workspace";

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mock.auth, {
    sessionUser: null,
    user: null,
    loading: false,
    error: null,
  });
  mock.auth.signIn.mockResolvedValue(undefined);
  mock.auth.refresh.mockResolvedValue(undefined);
});

async function click(container: HTMLElement) {
  await act(async () => container.querySelector("button")!.click());
}

it("opens the demo only after a click and loaded demo account access", async () => {
  const { container, rerender } = await render(<DemoWorkspace />);
  expect(mock.auth.signIn).not.toHaveBeenCalled();
  expect(mock.push).not.toHaveBeenCalled();
  await click(container);
  expect(mock.auth.signIn).toHaveBeenCalledWith("demo@example.com", "demoabcde");
  expect(mock.push).not.toHaveBeenCalled();
  mock.auth.sessionUser = { email: "demo@example.com" };
  mock.auth.loading = true;
  await rerender(<DemoWorkspace />);
  expect(mock.push).not.toHaveBeenCalled();
  mock.auth.user = { email: "demo@example.com" };
  mock.auth.loading = false;
  await rerender(<DemoWorkspace />);
  expect(mock.push).toHaveBeenCalledExactlyOnceWith("/association");
});

it("keeps the landing page until an already signed-in demo user clicks", async () => {
  mock.auth.sessionUser = { email: "demo@example.com" };
  mock.auth.user = { email: "demo@example.com" };
  const { container } = await render(<DemoWorkspace />);
  expect(mock.push).not.toHaveBeenCalled();
  await click(container);
  expect(mock.auth.signIn).not.toHaveBeenCalled();
  expect(mock.push).toHaveBeenCalledExactlyOnceWith("/association");
});

it("makes switching accounts explicit and does not enter the previous user's workspace", async () => {
  mock.auth.sessionUser = { email: "staff@example.com" };
  mock.auth.user = { email: "staff@example.com" };
  const { container } = await render(<DemoWorkspace />);
  expect(container.querySelector("button")?.textContent).toContain(
    "Switch to demo workspace",
  );
  expect(container.textContent).toContain("switches your signed-in account");
  await click(container);
  expect(mock.auth.signIn).toHaveBeenCalledOnce();
  expect(mock.push).not.toHaveBeenCalled();
});

it("blocks repeated clicks during sign-in and while access is loading", async () => {
  let finish!: () => void;
  mock.auth.signIn.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { container } = await render(<DemoWorkspace />);
  await act(async () => {
    container.querySelector("button")!.click();
    container.querySelector("button")!.click();
  });
  expect(mock.auth.signIn).toHaveBeenCalledOnce();
  expect(container.querySelector("button")!.disabled).toBe(true);
  await act(async () => finish());
  await click(container);
  expect(mock.auth.signIn).toHaveBeenCalledOnce();
  expect(container.querySelector('[role="status"]')).not.toBeNull();
});

it("allows another sign-in attempt after failure", async () => {
  mock.auth.signIn.mockRejectedValueOnce(
    new Error("Invalid login credentials"),
  );
  const { container } = await render(<DemoWorkspace />);
  await click(container);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Invalid login credentials",
  );
  expect(container.querySelector("button")!.disabled).toBe(false);
  expect(mock.push).not.toHaveBeenCalled();
  await click(container);
  expect(mock.auth.signIn).toHaveBeenCalledTimes(2);
});

it("retries failed account access without repeating demo authentication", async () => {
  const { container, rerender } = await render(<DemoWorkspace />);
  await click(container);
  mock.auth.sessionUser = { email: "demo@example.com" };
  mock.auth.error = "Account memberships unavailable";
  await rerender(<DemoWorkspace />);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Demo access could not load",
  );
  expect(mock.push).not.toHaveBeenCalled();
  await click(container);
  expect(mock.auth.refresh).toHaveBeenCalledOnce();
  expect(mock.auth.signIn).toHaveBeenCalledOnce();
  mock.auth.error = null;
  mock.auth.user = { email: "demo@example.com" };
  await rerender(<DemoWorkspace />);
  expect(mock.push).toHaveBeenCalledExactlyOnceWith("/association");
});

it("waits for initial account restoration before allowing a switch", async () => {
  mock.auth.loading = true;
  const { container } = await render(<DemoWorkspace />);
  await click(container);
  expect(container.querySelector("button")!.disabled).toBe(true);
  expect(mock.auth.signIn).not.toHaveBeenCalled();
});
