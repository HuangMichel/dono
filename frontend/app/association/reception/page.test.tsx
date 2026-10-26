// @vitest-environment jsdom
import { NotificationProvider } from "@/components/ui/notifications";
import { act } from "react";
import { expect, it, vi } from "vitest";
import { render } from "@/test/render";
const mocks = vi.hoisted(() => ({ api: vi.fn(), arrivals: [] as unknown[] }));
vi.mock("@/lib/api", () => ({ api: mocks.api }));
vi.mock("@/components/association/shell", () => ({
  ConsoleTitle: () => null,
  useAssociation: () => ({ id: "association" }),
  ResourceStatus: () => null,
  More: () => null,
  Feedback: ({ message }: { message: string }) => <p>{message}</p>,
}));
vi.mock("@/lib/api-hooks", () => ({
  useApiPage: () => ({
    data: mocks.arrivals,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));
vi.mock("@/components/association/evidence", () => ({
  Evidence: () => <p>Verified evidence</p>,
  itemName: () => "Rice",
  instant: (value: string) => value,
}));
vi.mock("@/components/association/date-checks", () => ({
  DateChecks: () => null,
  dateCommand: () => ({}),
}));
vi.mock("@/components/association/qr-scanner", () => ({
  QrScanner: ({
    onScan,
    onStart,
  }: {
    onScan: (value: string) => void;
    onStart: () => void;
  }) => (
    <button
      onClick={() => {
        onStart();
        onScan("camera-signed-qr");
      }}
    >
      Simulate live scan
    </button>
  ),
}));
import Reception from "./page";
it("counts only booked appointments as expected drop-offs", async () => {
  const arrival = (id: string, state: string) => ({
    booking: {
      id,
      computed: { effective_state: state, starts_at: "2026-10-25T14:00:00Z" },
    },
    offer: {
      quantity: "1",
      computed: { expiry: { bucket: "not_applicable" } },
    },
  });
  mocks.arrivals = [
    arrival("a", "booked"),
    arrival("b", "booked"),
    arrival("c", "received"),
    arrival("d", "cancelled"),
  ];
  const screen = await render(
    <NotificationProvider>
      <Reception />
    </NotificationProvider>,
  );
  mocks.arrivals = [];
  expect(screen.container.textContent).toContain("2 expected drop-offs");
  expect(screen.container.textContent).not.toContain("4 expected drop-offs");
});
it("does not restore verification after the signed content changes during a request", async () => {
  let resolve!: (result: unknown) => void;
  mocks.api.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const screen = await render(
    <NotificationProvider>
      <Reception />
    </NotificationProvider>,
  );
  const input = screen.container.querySelector<HTMLInputElement>(
    'input:not([type="date"])',
  )!;
  async function change(value: string) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  await change("signed-one");
  await act(async () => {
    screen.container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await change("signed-two");
  await act(async () =>
    resolve({
      booking: { id: "booking" },
      offer: { quantity: "3", computed: { expiry: {} } },
      receivable: true,
      blocking_codes: [],
    }),
  );
  expect(screen.container.textContent).not.toContain("Verified evidence");
  expect(screen.container.textContent).not.toContain("Receive all");
  expect(screen.container.textContent).not.toContain(
    "QR verification complete.",
  );
});
it("receives the verified booking with its signed payload and full-lot confirmation", async () => {
  mocks.api
    .mockReset()
    .mockResolvedValueOnce({
      booking: {
        id: "booking",
        revision: "revision",
        computed: {
          effective_state: "booked",
          starts_at: "2026-10-25T12:00:00Z",
        },
      },
      offer: { quantity: "3", computed: { expiry: {} } },
      receivable: true,
      blocking_codes: [],
    })
    .mockResolvedValueOnce({});
  const screen = await render(
    <NotificationProvider>
      <Reception />
    </NotificationProvider>,
  );
  const input = screen.container.querySelector<HTMLInputElement>(
    'input:not([type="date"])',
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "signed-real-qr");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    screen.container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(screen.container.textContent).toContain("Verified evidence");
  expect(mocks.api).toHaveBeenNthCalledWith(
    1,
    "/associations/association/qr/resolve",
    { method: "POST", body: { payload: "signed-real-qr" } },
  );
  const receive = [...screen.container.querySelectorAll("form")].find((form) =>
    form.textContent?.includes("Receive all"),
  )!;
  await act(async () =>
    receive.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    ),
  );
  expect(mocks.api).toHaveBeenNthCalledWith(
    2,
    "/bookings/booking/reception",
    expect.objectContaining({
      body: {
        expected_revision: "revision",
        payload: "signed-real-qr",
        confirm_full_received: true,
      },
    }),
  );
  expect(screen.container.textContent).not.toContain("Verified evidence");
  expect(input.value).toBe("");
});

it("automatically resolves a camera scan without recording reception", async () => {
  mocks.api.mockReset().mockResolvedValueOnce({
    booking: {
      id: "booking",
      revision: "revision",
      computed: {
        effective_state: "booked",
        starts_at: "2026-10-25T12:00:00Z",
      },
    },
    offer: { quantity: "3", computed: { expiry: {} } },
    receivable: true,
    blocking_codes: [],
  });
  const screen = await render(
    <NotificationProvider>
      <Reception />
    </NotificationProvider>,
  );
  await act(async () => screen.container.querySelector("button")!.click());
  expect(mocks.api).toHaveBeenCalledExactlyOnceWith(
    "/associations/association/qr/resolve",
    { method: "POST", body: { payload: "camera-signed-qr" } },
  );
  expect(screen.container.textContent).toContain("Verified evidence");
  expect(screen.container.textContent).toContain(
    "Receive all 3 items into stock",
  );
});
