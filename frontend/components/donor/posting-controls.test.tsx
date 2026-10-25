// @vitest-environment jsdom
import React, { act } from "react";
import { expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { Donation } from "@/lib/api-contracts";
const { command } = vi.hoisted(() => ({ command: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: command }));
vi.mock("@/components/association/auth-photo", () => ({
  AuthPhoto: () => <span>Shared item photo</span>,
}));
import { PostingControls } from "./posting-controls";
it("posts only with explicit consent and preserves the command key and town on retry", async () => {
  const donation = {
    id: "item",
    revision: "2",
    status: "ready",
    posting: null,
    computed: { active_offer_id: null, inventory_state: "unreceived" },
  } as Donation;
  command
    .mockRejectedValueOnce(Error("Check current status before trying again."))
    .mockResolvedValueOnce({
      ...donation,
      revision: "3",
      posting: { locality: "Mulhouse", posted_at: "2026-10-25T12:00:00Z" },
    });
  const changed = vi.fn();
  const view = await render(
    <PostingControls donation={donation} onChanged={changed} allowPosting />,
  );
  const input = view.container.querySelector<HTMLInputElement>(
    'input[name="posting-location"]',
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "68100");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const checkbox = view.container.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  )!;
  const submit = () =>
    view.container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  expect(submit().disabled).toBe(true);
  await act(async () => checkbox.click());
  await act(async () =>
    view.container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(view.container.textContent).toContain("Check current status");
  expect(input.value).toBe("68100");
  await act(async () =>
    view.container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(command.mock.calls[0][1].body).toEqual({
    expected_revision: "2",
    location: "68100",
  });
  expect(command.mock.calls[0][1].idempotencyKey).toBe(
    command.mock.calls[1][1].idempotencyKey,
  );
  expect(changed).toHaveBeenCalled();
});
it("removes a posting without offering a new posting from the management view", async () => {
  const donation = {
    id: "posted",
    revision: "4",
    status: "ready",
    posting: { locality: "Mulhouse", posted_at: "2026-10-25T12:00:00Z" },
    computed: { active_offer_id: null, inventory_state: "unreceived" },
  } as Donation;
  command.mockReset();
  command.mockResolvedValue({ ...donation, posting: null });
  const changed = vi.fn();
  const view = await render(
    <PostingControls donation={donation} onChanged={changed} />,
  );
  expect(view.container.querySelector("form")).toBeNull();
  expect(view.container.textContent).toContain("Mulhouse");
  await act(async () =>
    view.container.querySelector<HTMLButtonElement>("button")!.click(),
  );
  expect(command.mock.calls[0][0]).toBe("/donations/posted/unposting");
  expect(command.mock.calls[0][1].body).toEqual({ expected_revision: "4" });
  expect(changed).toHaveBeenCalled();
});
it("shows item photos before consent and excludes label photos", async () => {
  const donation = {
    id: "item",
    revision: "2",
    status: "ready",
    posting: null,
    computed: { active_offer_id: null, inventory_state: "unreceived" },
  } as Donation;
  const photos = [
    { id: "item-photo", kind: "item" },
    { id: "label-photo", kind: "label" },
  ] as import("@/lib/api-contracts").Photo[];
  const view = await render(
    <PostingControls
      donation={donation}
      onChanged={vi.fn()}
      allowPosting
      photos={photos}
    />,
  );
  expect(
    view.container.querySelector(
      '[aria-label="Item photos shared with associations"]',
    )?.textContent,
  ).toBe("Shared item photo");
});
