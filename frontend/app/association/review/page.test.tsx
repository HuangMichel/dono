// @vitest-environment jsdom
import { NotificationProvider } from "@/components/ui/notifications";
import React, { act } from "react";
import { render } from "@/test/render";
import { expect, it, vi } from "vitest";
const { page, command } = vi.hoisted(() => ({
  page: vi.fn(),
  command: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api: command }));
vi.mock("@/lib/api-hooks", () => ({
  useApiPage: page,
  useApiResource: () => ({
    data: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
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
  const food = Array.from(
    view.container.querySelectorAll<HTMLButtonElement>(
      '[aria-label="Review category"] button',
    ),
  ).find((b) => b.textContent === "Food")!;
  await act(async () => food.click());
  expect(food.getAttribute("aria-pressed")).toBe("true");
  expect(page.mock.lastCall?.[0]).toContain("&category=food");
  const coat = Array.from(view.container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Coat"),
  )!;
  await act(async () => coat.click());
  expect(coat.getAttribute("aria-pressed")).toBe("true");
  expect(
    view.container.querySelector(
      '[aria-label="Review category"] button[aria-pressed="true"]',
    ),
  ).not.toBeNull();
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
