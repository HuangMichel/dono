// @vitest-environment jsdom
import React, { act, Suspense } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type {
  Booking as BookingData,
  Offer,
  SlotOption,
} from "@/lib/api-contracts";

const mock = vi.hoisted(() => ({
  api: vi.fn(),
  apiPage: vi.fn(),
  notify: vi.fn(),
  user: { id: "donor" },
}));
vi.mock("@/lib/api", () => ({ api: mock.api, apiPage: mock.apiPage }));
vi.mock("@/components/ui/notifications", () => ({
  useNotifications: () => ({ notify: mock.notify }),
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: mock.user, loading: false }),
}));
vi.mock("@/components/public-shell", () => ({
  PublicShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("qrcode", () => ({
  default: { toDataURL: async () => "data:image/png;base64,cXI=" },
}));
import Booking from "./page";

const offer = {
  id: "offer",
  revision: "4",
  quantity: "2",
  facts_snapshot: {
    category: "food",
    attributes: { product: "Rice" },
    quantity: "2",
    expiry: {},
  },
  computed: { effective_state: "approved" },
} as unknown as Offer;
const slots: SlotOption[] = [
  {
    id: "first",
    starts_at: "2030-03-20T09:00:00Z",
    ends_at: "2030-03-20T10:00:00Z",
    quota_date: "2030-03-20",
  },
  {
    id: "second",
    starts_at: "2030-03-21T13:00:00Z",
    ends_at: "2030-03-21T14:00:00Z",
    quota_date: "2030-03-21",
  },
];
const booking = {
  id: "booking",
  revision: "1",
  dropoff_address: "12 rue du Test, Paris",
  computed: {
    effective_state: "booked",
    starts_at: slots[1].starts_at,
    ends_at: slots[1].ends_at,
  },
} as BookingData;

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
}
function button(container: HTMLElement, label: string) {
  return [...container.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === label,
  )!;
}
beforeEach(() => {
  mock.api.mockReset();
  mock.apiPage.mockReset();
  mock.notify.mockReset();
  mock.apiPage.mockResolvedValue({
    data: slots,
    page: { has_more: false, next_cursor: null },
  });
  mock.api.mockImplementation(
    async (path: string, options?: { method?: string }) => {
      if (path === "/offers/offer") return offer;
      if (path === "/offers/offer/booking") throw { status: 404 };
      if (path === "/offers/offer/bookings" && options?.method === "POST")
        return booking;
      if (path === "/bookings/booking/qr")
        return { payload: "signed-test-payload" };
      throw Error(`Unexpected test request ${path}`);
    },
  );
});
it("selects a Paris date, keeps other dates out of its time list, and confirms the selected time", async () => {
  const params = Promise.resolve({ id: "offer" });
  const { container } = await render(
    <Suspense>
      <Booking params={params} />
    </Suspense>,
  );
  await settle();
  const calendar = container.querySelector(
    'section[aria-label="Drop-off date"]',
  );
  expect(calendar).not.toBeNull();
  expect(container.querySelectorAll('input[name="slot"]')).toHaveLength(1);
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[data-day="2030-03-21"]')!
      .click(),
  );
  expect(button(container, "Confirm appointment").disabled).toBe(true);
  const time = container.querySelector<HTMLInputElement>('input[name="slot"]')!;
  expect(time.closest("label")?.textContent).toContain("14:00");
  await act(async () => time.click());
  expect(
    container.querySelector('[aria-label="Appointment summary"]')?.textContent,
  ).toContain("21 Mar 2030");
  await act(async () => button(container, "Confirm appointment").click());
  expect(mock.api).toHaveBeenCalledWith(
    "/offers/offer/bookings",
    expect.objectContaining({
      body: { expected_offer_revision: "4", slot_id: "second" },
    }),
  );
  expect(container.textContent).toContain(booking.dropoff_address);
  expect(mock.notify).toHaveBeenCalledWith({
    message: "Appointment confirmed.",
    tone: "success",
  });
});

it("keeps a confirmed appointment visible when QR retrieval fails and retries only the QR", async () => {
  let reads = 0;
  mock.api.mockImplementation(async (path: string) => {
    if (path === "/offers/offer") return offer;
    if (path === "/offers/offer/booking") return booking;
    if (path === "/bookings/booking/qr") {
      if (reads++ === 0) throw Error("Connection interrupted");
      return { payload: "signed-test-payload" };
    }
    throw Error(`Unexpected test request ${path}`);
  });
  const { container } = await render(
    <Suspense>
      <Booking params={Promise.resolve({ id: "offer" })} />
    </Suspense>,
  );
  await settle();
  expect(container.textContent).toContain("QR code unavailable.");
  expect(container.textContent).toContain(booking.dropoff_address);
  await act(async () => button(container, "Reload QR code").click());
  expect(
    container.querySelector(
      'img[alt="QR code to show when you drop off your donation"]',
    ),
  ).not.toBeNull();
  expect(
    mock.api.mock.calls.some(([, options]) => options?.method === "POST"),
  ).toBe(false);
});
