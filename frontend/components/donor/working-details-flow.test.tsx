// @vitest-environment jsdom
import { act, StrictMode, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { NotificationProvider } from "@/components/ui/notifications";
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
async function chooseCategory(container: HTMLElement, category: string) {
  const select = container.querySelector<HTMLSelectElement>("#category-hint")!;
  await act(async () => {
    select.value = category;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function enterName(container: HTMLElement, value = "Winter coat") {
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>("#item-name")!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("blocks both continuation actions on a blank or whitespace-only name and focuses the field", async () => {
  mocks.user = { id: "donor" };
  const screen = await render(
    <NotificationProvider>
      <Donate />
    </NotificationProvider>,
  );
  const manual = [...screen.container.querySelectorAll("button")].find(
    (b) => b.textContent === "Enter details manually",
  )!;
  for (const value of ["", "   "]) {
    await enterName(screen.container, value);
    await act(async () => manual.click());
    expect(screen.container.querySelector("#donation-details")).toBeNull();
    expect(
      screen.container.querySelector("#item-name-error")?.textContent,
    ).toBe("Enter item name.");
    expect(document.activeElement?.id).toBe("item-name");
    expect(
      (
        screen.container.querySelector("#donation-photos") as HTMLFormElement
      ).checkValidity(),
    ).toBe(false);
  }
  expect(mocks.api).not.toHaveBeenCalled();
});
it("collects item identity before photos and retains it when changing category and entering details", async () => {
  mocks.user = { id: "donor" };
  const screen = await render(
    <NotificationProvider>
      <Donate />
    </NotificationProvider>,
  );
  const input = screen.container.querySelector<HTMLInputElement>("#item-name")!;
  expect(input).not.toBeNull();
  expect(input.required).toBe(true);
  expect(input.maxLength).toBe(120);
  const description =
    screen.container.querySelector<HTMLTextAreaElement>("#item-description")!;
  expect(description.required).toBe(false);
  expect(description.maxLength).toBe(2000);
  expect(
    input.compareDocumentPosition(screen.container.querySelector("#photos")!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "Blue coat");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(description, "Inside pocket torn.");
    description.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await chooseCategory(screen.container, "furniture");
  await act(async () => {
    [...screen.container.querySelectorAll("button")]
      .find((b) => b.textContent === "Enter details manually")!
      .click();
  });
  expect(
    screen.container.querySelector<HTMLInputElement>("#item-name")!.value,
  ).toBe("Blue coat");
  expect(
    screen.container.querySelector<HTMLTextAreaElement>("#item-description")!
      .value,
  ).toBe("Inside pocket torn.");
  await act(async () => {
    const name =
      screen.container.querySelector<HTMLInputElement>("#item-name")!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(name, "   ");
    name.dispatchEvent(new Event("input", { bubbles: true }));
    name.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
  expect(
    screen.container.querySelector("#item-name-error")?.textContent,
  ).toContain("Enter");
  expect(mocks.api).not.toHaveBeenCalled();
});
it("offers the label close-up only for dated categories", async () => {
  mocks.user = { id: "donor" };
  const screen = await render(
    <NotificationProvider>
      <Donate />
    </NotificationProvider>,
  );
  expect(screen.container.querySelector("#label-photos")).toBeNull();
  await chooseCategory(screen.container, "food");
  expect(screen.container.querySelector("#label-photos")).not.toBeNull();
  await chooseCategory(screen.container, "para");
  expect(screen.container.querySelector("#label-photos")).not.toBeNull();
});
it("requires sign-in before exposing photo or offer controls", async () => {
  const screen = await render(
    <NotificationProvider>
      <Donate />
    </NotificationProvider>,
  );
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
  const screen = await render(
    <NotificationProvider>
      <Donate />
    </NotificationProvider>,
  );
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
  ).toContain("Each photo must be at most 4 MB.");
  expect(screen.container.textContent).toContain("exact.jpg");
  expect(screen.container.textContent).not.toContain("large.jpg");
  expect(mocks.api).not.toHaveBeenCalled();
  expect(mocks.apiPage).not.toHaveBeenCalled();
});
it("resets private form entries when the account changes", async () => {
  mocks.user = { id: "one" };
  const screen = await render(
    <NotificationProvider>
      <Donate />
    </NotificationProvider>,
  );
  const manual = () =>
    [...screen.container.querySelectorAll("button")]
      .find((button) => button.textContent === "Enter details manually")!
      .click();
  await enterName(screen.container);
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
  await screen.rerender(
    <NotificationProvider>
      <Donate />
    </NotificationProvider>,
  );
  expect(screen.container.querySelector("#quantity")).toBeNull();
  expect(
    screen.container.querySelector<HTMLInputElement>("#item-name")?.value,
  ).toBe("");
  await enterName(screen.container, "Another coat");
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
      name: "Winter coat",
      description: null,
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
  const screen = await render(
    <NotificationProvider>
      <Donate />
    </NotificationProvider>,
  );
  await chooseCategory(screen.container, "food");
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
  const screen = await render(
    <NotificationProvider>
      <Donate />
    </NotificationProvider>,
  );
  await chooseCategory(screen.container, "food");
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
  const screen = await render(
    <NotificationProvider>
      <Donate />
    </NotificationProvider>,
  );
  expect(screen.container.querySelector('input[type="file"]')).toBeNull();
  expect(screen.container.textContent).toContain("Draft unavailable");
  mocks.api.mockResolvedValueOnce({
    id: "existing",
    status: "draft",
    facts: {
      name: "Winter coat",
      description: null,
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

it.each(["success", "failure"])(
  "shows analysis loading until %s and then restores the flow",
  async (outcome) => {
    mocks.user = { id: "donor" };
    mocks.donationId = "existing";
    const item = {
      id: "existing",
      status: "draft",
      revision: "1",
      facts_revision: "1",
      facts: {
        name: "Winter coat",
        description: null,
        category: "clothes",
        attributes: {},
        quantity: "1",
        unit: "item",
        expiry: {},
      },
      computed: { active_offer_id: null },
    };
    let resolveAnalysis!: (value: unknown) => void;
    let rejectAnalysis!: (reason: Error) => void;
    const pending = new Promise((resolve, reject) => {
      resolveAnalysis = resolve;
      rejectAnalysis = reject;
    });
    mocks.api.mockResolvedValue(item);
    mocks.apiPage.mockImplementation(async (path: string) => ({
      data: path.endsWith("/photos") ? [{ id: "photo", kind: "item" }] : [],
      page: { has_more: false, next_cursor: null },
    }));
    const screen = await render(
      <NotificationProvider>
        <Donate />
      </NotificationProvider>,
    );
    mocks.api.mockImplementation((path: string) =>
      path.endsWith("/analyses") ? pending : Promise.resolve(item),
    );
    await act(async () => {
      [...screen.container.querySelectorAll("button")]
        .find((button) => button.textContent?.startsWith("Analyse photos"))!
        .click();
    });
    expect(
      screen.container.querySelector('[role="status"]')?.textContent,
    ).toContain("Analysing your product");
    expect(
      screen.container.querySelector("main")?.getAttribute("aria-busy"),
    ).toBe("true");
    expect(screen.container.querySelector("#photos")).toBeNull();
    expect(screen.container.textContent).not.toContain(
      "Enter details manually",
    );
    await act(async () => {
      if (outcome === "failure") rejectAnalysis(Error("Analysis unavailable"));
      else
        resolveAnalysis({
          analysis: {
            confidence: 0.9,
            indicators: [],
            computed: { manual_review_required: false },
          },
        });
    });
    expect(
      screen.container.querySelector("main")?.getAttribute("aria-busy"),
    ).toBe("false");
    expect(screen.container.textContent).not.toContain(
      "Analysing your product",
    );
    expect(screen.container.textContent).toContain(
      outcome === "failure"
        ? "Analysis unavailable"
        : "Check your item details",
    );
    if (outcome === "failure")
      expect(screen.container.textContent).toContain("Analyse photos");
  },
);

it.each(["manual", "analysis"])(
  "saves the displayed category after %s entry of an uncategorised draft",
  async (entry) => {
    mocks.user = { id: "donor" };
    mocks.donationId = "existing";
    let item = {
      id: "existing",
      status: "draft",
      revision: "3",
      facts_revision: "3",
      facts: {
        name: "Winter coat",
        description: null,
        category: null as string | null,
        attributes: {
          size: "DEMO / M",
          type: "shirt",
          audience: "adult",
          seasons: ["winter"],
        },
        quantity: "1.000",
        unit: "item",
        expiry: {},
      },
      computed: { active_offer_id: null },
    };
    const attributes = item.facts.attributes;
    mocks.apiPage.mockImplementation(async (path: string) => ({
      data: path.endsWith("/photos") ? [{ id: "photo", kind: "item" }] : [],
      page: { has_more: false, next_cursor: null },
    }));
    mocks.api.mockImplementation(async (path, options) => {
      if (path.endsWith("/analyses"))
        return {
          analysis: {
            confidence: 0.9,
            indicators: [],
            computed: { manual_review_required: false },
          },
        };
      if (options?.method === "PATCH") {
        if (!options.body.facts.category)
          throw Error("Attributes need a category.");
        item = {
          ...item,
          facts: options.body.facts,
          revision: "4",
          facts_revision: "4",
        };
      }
      if (path.endsWith("/publication"))
        item = { ...item, status: "ready", revision: "5" };
      return item;
    });
    const screen = await render(
      <NotificationProvider>
        <Donate />
      </NotificationProvider>,
    );
    await act(async () => {
      [...screen.container.querySelectorAll("button")]
        .find((button) =>
          entry === "manual"
            ? button.textContent === "Enter details manually"
            : button.textContent?.startsWith("Analyse photos"),
        )!
        .click();
    });
    expect(
      screen.container.querySelector<HTMLSelectElement>("#category")?.value,
    ).toBe("clothes");
    await act(async () => {
      screen.container
        .querySelector("#donation-details")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    const patch = mocks.api.mock.calls.find(
      ([, options]) => options?.method === "PATCH",
    );
    expect(patch?.[1].body.facts).toEqual({
      name: "Winter coat",
      description: null,
      category: "clothes",
      attributes,
      quantity: "1.000",
      unit: "item",
      expiry: {},
    });
    expect(
      screen.container.querySelector(".notification-success")?.textContent,
    ).toContain("Item details saved.");
    expect(screen.container.querySelector("#donation-details")).toBeNull();
  },
);

it("uses the shared notification for item-detail save failures and successful retries", async () => {
  mocks.user = { id: "donor" };
  mocks.donationId = "existing";
  const item = {
    id: "existing",
    status: "ready",
    revision: "1",
    facts_revision: "1",
    facts: {
      name: "Winter coat",
      description: null,
      category: "clothes",
      attributes: { type: "coat" },
      quantity: "2",
      unit: "item",
      expiry: {},
    },
    computed: { active_offer_id: null },
  };
  mocks.api.mockResolvedValue(item);
  mocks.apiPage.mockImplementation(async (path: string) => ({
    data: path.endsWith("/photos") ? [{ id: "photo", kind: "item" }] : [],
    page: { has_more: false, next_cursor: null },
  }));
  const screen = await render(
    <NotificationProvider>
      <Donate />
    </NotificationProvider>,
  );
  await act(async () => {
    [...screen.container.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Edit details"))!
      .click();
  });
  mocks.api.mockImplementation(async (_path, options) => {
    if (options?.method === "PATCH")
      throw Error("Could not save item details.");
    return item;
  });
  const submit = () =>
    screen.container
      .querySelector("#donation-details")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await act(async () => {
    submit();
  });
  expect(
    screen.container.querySelector(".notification-error")?.textContent,
  ).toContain("Could not save item details.");
  expect(screen.container.querySelector('main [role="alert"]')).toBeNull();
  expect(
    screen.container.querySelector<HTMLInputElement>("#quantity")?.value,
  ).toBe("2");
  expect(screen.container.querySelector(".notification-success")).toBeNull();
  await act(async () => {
    screen.container
      .querySelector<HTMLButtonElement>(
        '[aria-label="Dismiss notification: Could not save item details."]',
      )!
      .click();
  });
  mocks.api.mockImplementation(async (_path, options) =>
    options?.method === "PATCH"
      ? { ...item, revision: "2", facts_revision: "2" }
      : item,
  );
  await act(async () => {
    submit();
  });
  expect(
    screen.container.querySelector(".notification-success")?.textContent,
  ).toContain("Item details saved.");
  expect(screen.container.querySelector("#donation-details")).toBeNull();
});

it.each([
  ["clothes", ["type"]],
  ["shoes", ["type"]],
  [
    "food",
    ["product", "storage_condition", "non_perishable", "packaging_state"],
  ],
  ["para", ["product"]],
  ["furniture", ["type"]],
] as const)(
  "requires publication details for %s before sending a request",
  async (category, requiredAttributes) => {
    mocks.user = { id: "donor" };
    const screen = await render(
      <NotificationProvider>
        <Donate />
      </NotificationProvider>,
    );
    await chooseCategory(screen.container, category);
    await enterName(screen.container);
    await act(async () => {
      [...screen.container.querySelectorAll("button")]
        .find((button) => button.textContent === "Enter details manually")!
        .click();
    });
    await act(async () => {
      screen.container
        .querySelector<HTMLButtonElement>('button[form="donation-details"]')!
        .click();
    });
    expect(mocks.api).not.toHaveBeenCalled();
    for (const id of ["category", "quantity", ...requiredAttributes]) {
      const field = screen.container.querySelector<
        HTMLInputElement | HTMLSelectElement
      >(`#${id}`)!;
      expect(field.required).toBe(true);
      expect(
        screen.container.querySelector(`#${id}-label`)?.textContent,
      ).toContain("(required)");
    }
    for (const id of requiredAttributes) {
      expect(
        screen.container.querySelector(`#${id}`)?.getAttribute("aria-invalid"),
      ).toBe("true");
      expect(
        screen.container.querySelector(`#${id}-error`)?.textContent,
      ).toBeTruthy();
    }
    expect(
      screen.container.querySelector<HTMLInputElement>("#expiry")?.required ??
        false,
    ).toBe(false);
    expect(
      screen.container.querySelector<HTMLInputElement>("#brand")?.required ??
        false,
    ).toBe(false);
  },
);
