// @vitest-environment jsdom
import { act, StrictMode, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  donationId: null as string | null,
  api: vi.fn(),
  apiPage: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () =>
    new URLSearchParams(mocks.donationId ? { id: mocks.donationId } : {}),
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: mocks.user, loading: false }),
}));
vi.mock("@/lib/api", () => ({ api: mocks.api, apiPage: mocks.apiPage }));
vi.mock("@/components/public-shell", () => ({
  PublicShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
import Donate from "@/app/donate/page";
import { useDonationSession } from "./donation-session-hook";
beforeEach(() => {
  mocks.user = null;
  mocks.donationId = null;
  mocks.api.mockReset();
  mocks.apiPage.mockReset();
});
it("requires sign-in before exposing photo or offer controls", async () => {
  const screen = await render(<Donate />);
  expect(screen.container.textContent).toContain(
    "Create an account or sign in to prepare a donation.",
  );
  expect(screen.container.querySelector('input[type="file"]')).toBeNull();
  expect(
    screen.container.querySelector('a[href^="/signup?next="]'),
  ).not.toBeNull();
  expect(
    screen.container.querySelector('a[href^="/login?next="]'),
  ).not.toBeNull();
  expect(mocks.api).not.toHaveBeenCalled();
});
it("keeps valid photos when an oversized selection is rejected before any request", async () => {
  mocks.user = { id: "donor" };
  const screen = await render(<Donate />);
  const input = screen.container.querySelector<HTMLInputElement>("#photos")!;
  const selectFiles = async (files: File[]) => {
    await act(async () => {
      Object.defineProperty(input, "files", {
        configurable: true,
        value: files,
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  };
  const exact = new File([new Uint8Array(4_194_304)], "exact.jpg", {
    type: "image/jpeg",
  });
  await selectFiles([exact]);
  expect(screen.container.textContent).toContain("exact.jpg");
  await selectFiles([
    new File([new Uint8Array(4_194_305)], "large.jpg", { type: "image/jpeg" }),
  ]);
  expect(
    screen.container.querySelector('[role="alert"]')?.textContent,
  ).toContain("Each photo must be at most 4 MiB.");
  expect(screen.container.textContent).toContain("exact.jpg");
  expect(screen.container.textContent).not.toContain("large.jpg");
  expect(mocks.api).not.toHaveBeenCalled();
  expect(mocks.apiPage).not.toHaveBeenCalled();
});
it("resets private form entries when the account changes", async () => {
  mocks.user = { id: "one" };
  const screen = await render(<Donate />);
  const manual = () =>
    [...screen.container.querySelectorAll("button")]
      .find((button) => button.textContent === "Enter details manually")!
      .click();
  await act(async () => {
    manual();
  });
  const quantity =
    screen.container.querySelector<HTMLInputElement>("#quantity")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(quantity, "7");
    quantity.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(
    screen.container.querySelector<HTMLInputElement>("#quantity")?.value,
  ).toBe("7");
  mocks.user = { id: "two" };
  await screen.rerender(<Donate />);
  expect(screen.container.querySelector("#quantity")).toBeNull();
  await act(async () => {
    manual();
  });
  expect(
    screen.container.querySelector<HTMLInputElement>("#quantity")?.value,
  ).toBe("1");
});
it("aborts old donation reads and ignores their late completion", async () => {
  const pending = new Map<string, (value: unknown) => void>();
  mocks.api.mockImplementation(
    (path: string) => new Promise((resolve) => pending.set(path, resolve)),
  );
  mocks.apiPage.mockResolvedValue({ data: [], meta: { next_cursor: null } });
  function Probe({ id }: { id: string }) {
    const { state } = useDonationSession("donor", id);
    return <p>{state.donation?.id ?? "Loading"}</p>;
  }
  const screen = await render(<Probe id="old" />);
  const oldSignal = mocks.api.mock.calls[0][1].signal;
  await screen.rerender(<Probe id="new" />);
  expect(oldSignal.aborted).toBe(true);
  const facts = {
    category: "clothes",
    attributes: {},
    quantity: "1",
    unit: "item",
    expiry: {},
  };
  await act(async () => {
    pending.get("/donations/new")!({ id: "new", facts, status: "draft" });
  });
  expect(screen.container.textContent).toBe("new");
  await act(async () => {
    pending.get("/donations/old")!({ id: "old", facts, status: "draft" });
  });
  expect(screen.container.textContent).toBe("new");
  await screen.unmount();
  expect(mocks.api.mock.calls[1][1].signal.aborted).toBe(true);
});
it("finishes hydration after Strict Mode effect replay", async () => {
  mocks.api.mockResolvedValue({
    id: "saved",
    facts: {
      category: "clothes",
      attributes: {},
      quantity: "1",
      unit: "item",
      expiry: {},
    },
    status: "ready",
  });
  mocks.apiPage.mockResolvedValue({ data: [], meta: { next_cursor: null } });
  function Probe() {
    const { state } = useDonationSession("donor", "saved");
    return <p>{state.busy ? "Loading" : state.donation?.id}</p>;
  }
  const screen = await render(
    <StrictMode>
      <Probe />
    </StrictMode>,
  );
  expect(screen.container.textContent).toBe("saved");
});
it("keeps item and label previews separate and supports local replacement and removal", async () => {
  mocks.user = { id: "donor" };
  const screen = await render(<Donate />);
  async function select(selector: string, name: string) {
    const input = screen.container.querySelector<HTMLInputElement>(selector)!;
    await act(async () => {
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [new File(["photo"], name, { type: "image/jpeg" })],
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
    });
  }
  await select("#photos", "front.jpg");
  await select("#label-photos", "date.jpg");
  expect(screen.container.querySelectorAll("img")).toHaveLength(2);
  expect(
    screen.container.querySelector('[aria-labelledby="label-photos-title"]')
      ?.textContent,
  ).toContain("date.jpg");
  await act(async () => {
    screen.container
      .querySelector<HTMLButtonElement>(
        '[aria-label="Replace front.jpg, photo 1"]',
      )!
      .click();
  });
  await select('input[aria-label="Replace item photos"]', "side.jpg");
  expect(screen.container.textContent).not.toContain("front.jpg");
  expect(screen.container.textContent).toContain("side.jpg");
  await act(async () => {
    screen.container
      .querySelector<HTMLButtonElement>(
        '[aria-label="Remove date.jpg, photo 1"]',
      )!
      .click();
  });
  expect(screen.container.textContent).not.toContain("date.jpg");
  expect(screen.container.querySelectorAll("img")).toHaveLength(1);
  expect(mocks.api).not.toHaveBeenCalled();
});
it("applies the three-photo budget across item and label panels", async () => {
  mocks.user = { id: "donor" };
  const screen = await render(<Donate />);
  async function select(id: string, names: string[]) {
    const input = screen.container.querySelector<HTMLInputElement>(id)!;
    await act(async () => {
      Object.defineProperty(input, "files", {
        configurable: true,
        value: names.map(
          (name) => new File(["photo"], name, { type: "image/jpeg" }),
        ),
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  await select("#photos", ["front.jpg", "side.jpg"]);
  await select("#label-photos", ["date.jpg"]);
  await select("#photos", ["fourth.jpg"]);
  expect(
    screen.container.querySelector('[role="alert"]')?.textContent,
  ).toContain("Choose at most three photos.");
  expect(screen.container.textContent).not.toContain("fourth.jpg");
  expect(screen.container.textContent).toContain("date.jpg");
  expect(mocks.api).not.toHaveBeenCalled();
});
it("hides edit controls after a saved draft load failure and retries the actual read", async () => {
  mocks.user = { id: "donor" };
  mocks.donationId = "existing";
  mocks.api.mockRejectedValueOnce(Error("Draft unavailable"));
  mocks.apiPage.mockResolvedValue({
    data: [],
    page: { has_more: false, next_cursor: null },
  });
  const screen = await render(<Donate />);
  expect(screen.container.querySelector('input[type="file"]')).toBeNull();
  expect(screen.container.textContent).toContain("Draft unavailable");
  mocks.api.mockResolvedValueOnce({
    id: "existing",
    status: "draft",
    facts: {
      category: "clothes",
      attributes: {},
      quantity: "1",
      unit: "item",
      expiry: {},
    },
    computed: { active_offer_id: null },
  });
  await act(async () => {
    [...screen.container.querySelectorAll("button")]
      .find((button) => button.textContent === "Retry loading donation")!
      .click();
  });
  expect(screen.container.textContent).not.toContain("Draft unavailable");
  expect(screen.container.querySelector("#photos")).not.toBeNull();
  expect(mocks.api.mock.calls.map(([path]) => path)).toEqual([
    "/donations/existing",
    "/donations/existing",
  ]);
});
