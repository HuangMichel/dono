// @vitest-environment jsdom
import React, { act } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
const mock = vi.hoisted(() => ({ page: vi.fn() }));
vi.mock("@/lib/api", () => ({ publicNeedsPage: mock.page }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/components/public-shell", () => ({
  PublicShell: ({ children }: { children: React.ReactNode }) => children,
}));
import Needs from "./page";
const need = (id = "one") => ({
  id,
  association: {
    id: "association",
    name: `Association ${id}`,
    display_address: "Paris",
  },
  category: "food",
  attributes: { product: "rice" },
  seasons: [],
  target_quantity: "20",
  available_quantity: "10",
  unit: "item",
  distance_km: null,
});
const page = (id = "one", cursor: string | null = null) => ({
  data: [need(id)],
  page: { has_more: !!cursor, next_cursor: cursor },
  meta: {},
});
beforeEach(() => {
  mock.page.mockReset();
  mock.page.mockResolvedValue(page());
});
it("lets a signed-out visitor inspect real needs and asks for an account only to offer", async () => {
  const { container } = await render(<Needs />);
  expect(container.textContent).toContain("Association one");
  expect(container.querySelector("aside")?.textContent).toContain("rice");
  expect(container.textContent).not.toContain("null km");
  const offer = Array.from(container.querySelectorAll("button")).find(
    (a) => a.textContent === "Offer an item",
  )!;
  await act(async () => offer.click());
  expect(container.querySelector('a[href^="/signup?next="]')).not.toBeNull();
  expect(container.querySelector('a[href^="/login?next="]')).not.toBeNull();
});
it("paginates in bounded pages and resets the cursor on category changes", async () => {
  mock.page
    .mockResolvedValueOnce(page("one", "next"))
    .mockResolvedValueOnce(page("two"));
  const { container } = await render(<Needs />);
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "Next")!
      .click(),
  );
  expect(mock.page.mock.calls[1][0]).toContain("cursor=next");
  expect(container.textContent).toContain("Association two");
  expect(container.textContent).not.toContain("Association one");
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "Clothes")!
      .click(),
  );
  expect(mock.page.mock.lastCall![0]).toContain("category=clothes");
  expect(mock.page.mock.lastCall![0]).not.toContain("cursor");
});

it.each(["location", "category"])(
  "selects the first result after the %s search changes",
  async (filter) => {
    mock.page.mockResolvedValue({
      ...page(),
      data: [need("one"), need("two")],
    });
    const { container } = await render(<Needs />);
    await act(async () =>
      container.querySelectorAll<HTMLButtonElement>(".need-row")[1].click(),
    );
    expect(container.querySelector("aside")?.textContent).toContain(
      "Association two",
    );

    await act(async () => {
      if (filter === "location") {
        container.querySelector<HTMLInputElement>(
          'input[name="location"]',
        )!.value = "Paris";
        container.querySelector("form")!.requestSubmit();
      } else {
        Array.from(container.querySelectorAll("button"))
          .find((button) => button.textContent === "Food")!
          .click();
      }
    });

    expect(container.querySelector("aside")?.textContent).toContain(
      "Association one",
    );
    expect(
      container.querySelector(".need-row[aria-pressed='true']")?.textContent,
    ).toContain("Association one");
  },
);

it("ignores an old response after filters change", async () => {
  let finish!: (value: ReturnType<typeof page>) => void;
  mock.page.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { container } = await render(<Needs />);
  expect(container.querySelector('[role="status"]')?.textContent).toContain(
    "Loading",
  );
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "Clothes")!
      .click(),
  );
  await act(async () => finish(page("old")));
  expect(container.textContent).toContain("Association one");
  expect(container.textContent).not.toContain("Association old");
});
it("retries a failed search and renders an empty result without invented needs", async () => {
  mock.page
    .mockRejectedValueOnce(new Error("Cannot reach Dono"))
    .mockResolvedValueOnce({
      data: [],
      page: { has_more: false, next_cursor: null },
      meta: {},
    });
  const { container } = await render(<Needs />);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Cannot reach Dono",
  );
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "Retry")!
      .click(),
  );
  expect(container.querySelector('[role="status"]')?.textContent).toContain(
    "No open needs",
  );
  expect(container.querySelector("aside")).toBeNull();
});
it("submits a trimmed optional town without requiring authentication", async () => {
  const { container } = await render(<Needs />);
  container.querySelector<HTMLInputElement>('input[name="location"]')!.value =
    "  Paris  ";
  await act(async () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(mock.page.mock.lastCall![0]).toBe("limit=10&location=Paris");
});

it.each(["68", " 68 ", "!Paris"])(
  "keeps invalid location %s in the form without requesting geocoding",
  async (location) => {
    const { container } = await render(<Needs />);
    const input = container.querySelector<HTMLInputElement>(
      'input[name="location"]',
    )!;
    input.value = location;
    await act(async () =>
      container
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    expect(mock.page).toHaveBeenCalledTimes(1);
    expect(input.value).toBe(location);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(input);
    expect(container.textContent).toContain("68100");
  },
);

it("recovers after correcting the location and preserves the category", async () => {
  const { container } = await render(<Needs />);
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Clothes")!
      .click(),
  );
  const input = container.querySelector<HTMLInputElement>(
    'input[name="location"]',
  )!;
  const submit = () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  input.value = "68";
  await act(async () => {
    submit();
  });
  expect(input.getAttribute("aria-invalid")).toBe("true");
  input.value = "68100";
  await act(async () => {
    submit();
  });
  expect(mock.page.mock.lastCall![0]).toBe(
    "limit=10&location=68100&category=clothes",
  );
  expect(input.hasAttribute("aria-invalid")).toBe(false);
  expect(container.querySelector(".field-error")).toBeNull();
});

it.each(["", "  ", "68100", "Évry"])(
  "allows optional blank or valid location %s",
  async (location) => {
    const { container } = await render(<Needs />);
    container.querySelector<HTMLInputElement>('input[name="location"]')!.value =
      location;
    await act(async () =>
      container
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
    );
    const params = new URLSearchParams(mock.page.mock.lastCall![0]);
    expect(params.get("location")).toBe(location.trim() || null);
    expect(mock.page).toHaveBeenCalledTimes(2);
  },
);

it.each([
  {
    category: "food",
    attributes: {
      product: "rice_mix",
      brand: "true",
      storage_condition: "room_temperature",
      non_perishable: true,
    },
    title: "rice_mix, true, Room temperature",
    details: ["rice_mix", "true", "Room temperature", "Yes"],
  },
  {
    category: "para",
    attributes: {
      product: "Care_Gel",
      brand: "not_present",
      product_kind: "medical_device",
      seal_state: "not_present",
    },
    title: "Care_Gel, not_present, Medical device, No seal",
    details: ["Care_Gel", "not_present", "Medical device", "No seal"],
  },
  {
    category: "furniture",
    attributes: {
      type: "chair",
      size_class: "small",
      printed_dimensions: "60_x_80 cm",
    },
    title: "Chair, Small, 60_x_80 cm",
    details: ["Chair", "Small", "60_x_80 cm"],
  },
])(
  "formats $category need attributes without changing free text",
  async ({ category, attributes, title, details }) => {
    mock.page.mockResolvedValue({
      ...page(),
      data: [{ ...need(), category, attributes }],
    });
    const { container } = await render(<Needs />);
    expect(container.querySelector("aside h2")?.textContent).toBe(title);
    expect(container.querySelector(".need-row strong")?.textContent).toBe(
      title,
    );
    const displayed = Array.from(
      container.querySelectorAll("aside dd"),
      (element) => element.textContent,
    );
    for (const value of details) expect(displayed).toContain(value);
  },
);
