// @vitest-environment jsdom
import { NotificationProvider } from "@/components/ui/notifications";
import React, { act } from "react";
import { render } from "@/test/render";
import { expect, it, vi } from "vitest";
const { page, command, evidence } = vi.hoisted(() => ({
  page: vi.fn(),
  command: vi.fn(),
  evidence: vi.fn(() => ({
    data: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
  })),
}));
vi.mock("@/lib/api", () => ({ api: command }));
vi.mock("@/lib/api-hooks", () => ({
  useApiPage: page,
  useApiResource: evidence,
}));
vi.mock("@/components/association/shell", () => ({
  ConsoleTitle: ({ title }: { title: string }) => <h1>{title}</h1>,
  useAssociation: () => ({ id: "association" }),
  ResourceStatus: () => null,
  More: () => null,
  Feedback: ({ message }: { message: string }) => <p>{message}</p>,
}));
vi.mock("@/components/association/evidence", () => ({
  Evidence: () => <p>Frozen item evidence</p>,
  itemName: (o: { id: string }) => o.id,
  labelCorrectionApplies: () => false,
  probabilityLabel: (value: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(value),
}));
vi.mock("@/components/association/auth-photo", () => ({
  AuthPhoto: ({
    photo,
    alt,
    size,
  }: {
    photo: { content_url: string };
    alt: string;
    size: number;
  }) => (
    <a href={photo.content_url} aria-label={alt} data-thumbnail-size={size}>
      Photo
    </a>
  ),
}));
import Review from "./page";
it("opens the first offer and lets staff switch while preserving approval checks", async () => {
  page.mockReturnValue({
    data: ["Rice", "Coat"].map((id) => ({
      id,
      revision: "1",
      category: "clothes",
      quantity: "1",
      evidence_snapshot: {
        photos:
          id === "Rice" ? [{ photo_id: "frozen-rice", sha256: "digest" }] : [],
      },
      computed: {
        effective_state: "pending_review",
        manual_review_required: false,
        expiry: {
          bucket: "not_applicable",
          days_left: null,
          required_date_checks: [],
        },
      },
    })),
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  const view = await render(
    <NotificationProvider>
      <Review />
    </NotificationProvider>,
  );
  expect(view.container.textContent).toContain("Frozen item evidence");
  const first = view.container.querySelector<HTMLButtonElement>(
    '.console-review-list button[aria-pressed="true"]',
  );
  expect(first?.textContent).toContain("Rice");
  const thumbnail = view.container.querySelector('a[data-thumbnail-size="40"]');
  expect(thumbnail?.getAttribute("href")).toBe(
    "/api/v1/photos/frozen-rice/content",
  );
  expect(thumbnail?.closest("button")).toBeNull();
  expect(
    view.container.querySelectorAll('a[data-thumbnail-size="40"]').length,
  ).toBe(1);
  const category = view.container.querySelector<HTMLSelectElement>("select")!;
  await act(async () => {
    category.value = "food";
    category.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(category.value).toBe("food");
  expect(page.mock.lastCall?.[0]).toContain("&category=food");
  const coat = Array.from(view.container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Coat"),
  )!;
  await act(async () => coat.click());
  expect(coat.getAttribute("aria-pressed")).toBe("true");
  expect(view.container.querySelector<HTMLSelectElement>("select")?.value).toBe(
    "food",
  );
  expect(
    view.container
      .querySelector(".review-workspace")
      ?.classList.contains("review-detail-visible"),
  ).toBe(true);
  const back = view.container.querySelector<HTMLButtonElement>(
    ".review-back-button",
  )!;
  await act(async () => back.click());
  expect(
    view.container
      .querySelector(".review-workspace")
      ?.classList.contains("review-detail-visible"),
  ).toBe(false);
  const approve = () =>
    view.container.querySelector<HTMLButtonElement>(
      'button[value="approved"]',
    )!;
  const refuse = () =>
    view.container.querySelector<HTMLButtonElement>('button[value="refused"]')!;
  expect(view.container.querySelector('select[name="decision"]')).toBeNull();
  expect(approve().disabled).toBe(true);
  expect(refuse().disabled).toBe(false);
  expect(view.container.textContent).toContain(
    "Complete the checks above to approve.",
  );
  const check = view.container.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  )!;
  await act(async () => check.click());
  expect(approve().disabled).toBe(false);
});

it("requires every manual and date check before approval", async () => {
  page.mockReturnValue({
    data: [
      {
        id: "Food",
        revision: "1",
        category: "food",
        quantity: "1",
        evidence_snapshot: { photos: [] },
        computed: {
          effective_state: "pending_review",
          manual_review_required: true,
          expiry: {
            bucket: "unknown",
            days_left: null,
            required_date_checks: ["date_review_ack"],
          },
        },
      },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  const view = await render(
    <NotificationProvider>
      <Review />
    </NotificationProvider>,
  );
  const checks = Array.from(
    view.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  );
  const approve = () =>
    view.container.querySelector<HTMLButtonElement>(
      'button[value="approved"]',
    )!;
  expect(checks).toHaveLength(4);
  expect(approve().disabled).toBe(true);
  for (const checkbox of checks.slice(0, 3))
    await act(async () => checkbox.click());
  expect(approve().disabled).toBe(true);
  await act(async () => checks[3].click());
  expect(approve().disabled).toBe(true);
  expect(view.container.textContent).toContain("Add a reason to approve.");
  const reason = view.container.querySelector<HTMLInputElement>(
    'input[name="reason"]',
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(reason, "Label checked against the item");
    reason.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(approve().disabled).toBe(false);
});

it("keeps approval blocked by evidence errors and expiry restrictions", async () => {
  const offer = {
    id: "Restricted food",
    revision: "1",
    category: "food",
    quantity: "1",
    evidence_snapshot: { photos: [] },
    computed: {
      effective_state: "pending_review",
      manual_review_required: false,
      expiry: {
        bucket: "expired",
        days_left: -1,
        required_date_checks: [],
        distribution_restriction: "expired_use_by",
      },
    },
  };
  page.mockReturnValue({
    data: [offer],
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  const view = await render(
    <NotificationProvider>
      <Review />
    </NotificationProvider>,
  );
  for (const check of view.container.querySelectorAll<HTMLInputElement>(
    'input[type="checkbox"]',
  ))
    await act(async () => check.click());
  expect(
    view.container.querySelector<HTMLButtonElement>('button[value="approved"]')
      ?.disabled,
  ).toBe(true);
  expect(
    view.container.querySelector<HTMLButtonElement>('button[value="refused"]')
      ?.disabled,
  ).toBe(false);
  expect(view.container.textContent).toContain("Approval is unavailable");
  evidence.mockReturnValue({
    data: null,
    loading: false,
    error: "Evidence unavailable" as never,
    refresh: vi.fn(),
  });
  await view.rerender(
    <NotificationProvider>
      <Review />
    </NotificationProvider>,
  );
  expect(view.container.textContent).toContain(
    "Load the evidence before approving",
  );
  expect(
    view.container.querySelector<HTMLButtonElement>('button[value="approved"]')
      ?.disabled,
  ).toBe(true);
});

it("keeps the queue reachable when the selected offer disappears during refresh", async () => {
  page.mockReturnValue({
    data: [
      {
        id: "Coat",
        revision: "1",
        category: "clothes",
        quantity: "1",
        evidence_snapshot: { photos: [] },
        computed: {
          effective_state: "pending_review",
          manual_review_required: false,
          expiry: { bucket: "not_applicable", required_date_checks: [] },
        },
      },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  const view = await render(
    <NotificationProvider>
      <Review />
    </NotificationProvider>,
  );
  await act(async () =>
    view.container
      .querySelector<HTMLButtonElement>(".console-review-list button")!
      .click(),
  );
  page.mockReturnValue({
    data: [],
    loading: false,
    error: "Could not refresh",
    refresh: vi.fn(),
  });
  await view.rerender(
    <NotificationProvider>
      <Review />
    </NotificationProvider>,
  );
  expect(view.container.textContent).toContain("Offers could not be loaded.");
  const back = view.container.querySelector<HTMLButtonElement>(
    ".review-back-button",
  );
  expect(back).not.toBeNull();
  await act(async () => back!.click());
  expect(
    view.container
      .querySelector(".review-workspace")
      ?.classList.contains("review-detail-visible"),
  ).toBe(false);
});

it("puts returned category confidence beside the mismatch warning", async () => {
  page.mockReturnValue({
    data: [
      {
        id: "Remote",
        revision: "1",
        category: "clothes",
        quantity: "1",
        evidence_snapshot: { photos: [] },
        computed: {
          effective_state: "pending_review",
          manual_review_required: true,
          category_mismatch: true,
          expiry: { bucket: "not_applicable", required_date_checks: [] },
        },
      },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  evidence.mockReturnValue({
    data: {
      category_mismatch: true,
      analyses: [{ category: "furniture", confidence: 0.28, indicators: [] }],
    } as never,
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  const { container } = await render(
    <NotificationProvider>
      <Review />
    </NotificationProvider>,
  );
  const warning = container.querySelector(
    '[aria-label="Category needs checking"]',
  );
  expect(warning?.textContent).toContain("Small furniture (28% confidence)");
  expect(warning?.textContent).toContain("The donor selected Clothes");
});
