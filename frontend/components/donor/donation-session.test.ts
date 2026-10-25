import { beforeEach, expect, it, vi } from "vitest";
import { DonationSession } from "./donation-session";
import type { Donation, Facts } from "./api-donation";

const facts: Facts = {
  category: "clothes",
  attributes: {},
  quantity: "1",
  unit: "item",
  expiry: {},
};
function item(
  revision = "1",
  factsRevision = revision,
  status = "draft",
  quantity = "1",
) {
  return {
    id: "item",
    revision,
    facts_revision: factsRevision,
    status,
    facts: { ...facts, quantity },
    computed: { active_offer_id: null },
  } as Donation;
}
function photo(name = "front.jpg") {
  return new File(["image"], name, { type: "image/jpeg" });
}
const api = vi.fn(),
  apiPage = vi.fn();
let session: DonationSession;
beforeEach(async () => {
  api.mockReset();
  apiPage.mockReset();
  session = new DonationSession({ api, apiPage }, "donor");
  await session.start();
  session.setFiles([photo()]);
  session.setStep(1);
});
it("requires a hydrated account before starting any mutation", async () => {
  const guest = new DonationSession({ api, apiPage }, null);
  await guest.start();
  await guest.run(guest.save);
  await expect(guest.save()).rejects.toThrow("Sign in");
  expect(api).not.toHaveBeenCalled();
});
it("preserves manual facts and photos when saving fails, without publishing", async () => {
  const files = session.getSnapshot().files;
  session.setFacts((f) => ({ ...f, quantity: "7" }));
  api
    .mockResolvedValueOnce(item())
    .mockResolvedValueOnce({ id: "photo" })
    .mockResolvedValueOnce(item("2"))
    .mockRejectedValueOnce(Error("Cannot save"));
  await session.run(session.save);
  expect(session.getSnapshot()).toMatchObject({
    facts: { quantity: "7" },
    files,
    error: "Cannot save",
    step: 1,
  });
  expect(api.mock.calls[3][1].body.facts.quantity).toBe("7");
  expect(api.mock.calls.some(([path]) => path.endsWith("/publication"))).toBe(
    false,
  );
});
it("uploads on the manual path and skips publication of a ready item", async () => {
  api
    .mockResolvedValueOnce(item("1", "1", "ready"))
    .mockResolvedValueOnce({ id: "photo" })
    .mockResolvedValueOnce(item("2", "2", "ready"))
    .mockResolvedValueOnce(item("3", "3", "ready"));
  await session.run(session.save);
  expect(api.mock.calls[1][0]).toBe("/donations/item/photos");
  expect(api.mock.calls[1][1].body).toBeInstanceOf(FormData);
  expect(api.mock.calls[3][1].body.expected_revision).toBe("2");
  expect(api).toHaveBeenCalledTimes(4);
  expect(session.getSnapshot().step).toBe(2);
});
it("rejects a concurrent change after upload and preserves the entries", async () => {
  session.setFacts((f) => ({ ...f, quantity: "9" }));
  api
    .mockResolvedValueOnce(item())
    .mockResolvedValueOnce({ id: "photo" })
    .mockResolvedValueOnce(item("3"));
  await session.run(session.save);
  expect(api).toHaveBeenCalledTimes(3);
  expect(session.getSnapshot()).toMatchObject({
    facts: { quantity: "9" },
    error: expect.stringContaining("saved item details changed"),
  });
});
it("counts two inserted photos in both exact bigint revisions before editing and publishing", async () => {
  session.setFiles([photo(), photo("label.jpg")]);
  api
    .mockResolvedValueOnce(item("9007199254740993"))
    .mockResolvedValueOnce({ id: "a" })
    .mockResolvedValueOnce({ id: "b" })
    .mockResolvedValueOnce(item("9007199254740995"))
    .mockResolvedValueOnce(item("9007199254740996"))
    .mockResolvedValueOnce(
      item("9007199254740997", "9007199254740996", "ready"),
    );
  await session.run(session.save);
  expect(api.mock.calls[4][1].body.expected_revision).toBe("9007199254740995");
  expect(api.mock.calls[5][1].body.expected_revision).toBe("9007199254740996");
  expect(session.getSnapshot().step).toBe(2);
});
it("reuses an upload command after a lost response and counts the photo only once", async () => {
  api
    .mockResolvedValueOnce(item())
    .mockRejectedValueOnce(Error("Response lost"));
  await session.run(session.save);
  api
    .mockResolvedValueOnce({ id: "photo" })
    .mockResolvedValueOnce(item("2"))
    .mockResolvedValueOnce(item("3"))
    .mockResolvedValueOnce(item("4", "3", "ready"));
  await session.run(session.save);
  expect(api.mock.calls[1][1].idempotencyKey).toBe(
    api.mock.calls[2][1].idempotencyKey,
  );
  expect(api.mock.calls[4][1].body.expected_revision).toBe("2");
  expect(session.getSnapshot().step).toBe(2);
});
it.each(["PATCH", "publication"] as const)(
  "replays a committed %s using the same body/key before any other request",
  async (stage) => {
    api
      .mockResolvedValueOnce(item())
      .mockResolvedValueOnce({ id: "photo" })
      .mockResolvedValueOnce(item("2"));
    if (stage === "publication") api.mockResolvedValueOnce(item("3"));
    api.mockRejectedValueOnce(Error("Response lost after commit"));
    await session.run(session.save);
    const lost = api.mock.calls.at(-1);
    const replayIndex = api.mock.calls.length;
    if (stage === "PATCH") api.mockResolvedValueOnce(item("3"));
    api.mockResolvedValueOnce(item("4", "3", "ready"));
    await session.run(session.save);
    expect(api.mock.calls[replayIndex]).toEqual(lost);
    expect(api).toHaveBeenCalledTimes(6);
    expect(session.getSnapshot().step).toBe(2);
  },
);
it("does not overwrite entries when replay exposes a later external edit", async () => {
  api
    .mockResolvedValueOnce(item())
    .mockResolvedValueOnce({ id: "photo" })
    .mockResolvedValueOnce(item("2"))
    .mockRejectedValueOnce(Error("Response lost"));
  await session.run(session.save);
  api.mockResolvedValueOnce(item("4", "4", "draft", "8"));
  await session.run(session.save);
  expect(session.getSnapshot()).toMatchObject({
    facts: { quantity: "1" },
    error: expect.stringContaining("changed after this request"),
  });
  expect(api.mock.calls.some(([path]) => path.endsWith("/publication"))).toBe(
    false,
  );
});
it.each(["PATCH", "publication"] as const)(
  "preserves newly selected files and edits when recovering a lost %s",
  async (stage) => {
    api
      .mockResolvedValueOnce(item())
      .mockResolvedValueOnce({ id: "photo" })
      .mockResolvedValueOnce(item("2"));
    if (stage === "publication") api.mockResolvedValueOnce(item("3"));
    api.mockRejectedValueOnce(Error("Response lost"));
    await session.run(session.save);
    const changedFiles = [photo("replacement.jpg")];
    session.setFiles(changedFiles);
    session.setFacts((f) => ({ ...f, quantity: "7" }));
    const recovered = stage === "PATCH" ? item("3") : item("4", "3", "ready");
    const uploaded = stage === "PATCH" ? item("4") : item("5", "4", "ready");
    const edited =
      stage === "PATCH"
        ? item("5", "5", "draft", "7")
        : item("6", "5", "ready", "7");
    api
      .mockResolvedValueOnce(recovered)
      .mockResolvedValueOnce({ id: "replacement" })
      .mockResolvedValueOnce(uploaded)
      .mockResolvedValueOnce(edited);
    if (stage === "PATCH")
      api.mockResolvedValueOnce(item("6", "5", "ready", "7"));
    await session.run(session.save);
    expect(session.getSnapshot()).toMatchObject({
      facts: { quantity: "7" },
      files: changedFiles,
      error: "",
      step: 2,
    });
    expect(
      api.mock.calls
        .filter(([, options]) => options?.method === "PATCH")
        .at(-1)?.[1].body.facts.quantity,
    ).toBe("7");
  },
);
it("discards late responses and prevents follow-up mutations after disposal", async () => {
  let resolve!: (value: Donation) => void;
  api.mockImplementationOnce(
    () =>
      new Promise<Donation>((done) => {
        resolve = done;
      }),
  );
  const saving = session.run(session.save);
  const before = session.getSnapshot();
  session.stop();
  resolve(item());
  await saving;
  expect(session.getSnapshot()).toBe(before);
  expect(api).toHaveBeenCalledTimes(1);
  expect(api.mock.calls[0][1].signal.aborted).toBe(true);
});
it("restores saved photos and analysis and opens a ready donation at matching", async () => {
  const saved = item("8", "7", "ready");
  const analysis = { id: "basis" };
  api.mockResolvedValueOnce({ ...saved, basis_analysis_id: "basis" });
  apiPage
    .mockResolvedValueOnce({ data: [{ id: "saved-photo" }] })
    .mockResolvedValueOnce({ data: [{ id: "older" }, analysis] });
  const restored = new DonationSession({ api, apiPage }, "donor", "item");
  await restored.start();
  expect(restored.getSnapshot()).toMatchObject({
    donation: { id: "item" },
    persistedPhotos: [{ id: "saved-photo" }],
    analysis,
    step: 2,
    busy: false,
  });
});
it("moves from analysis to matching and a staff-review offer without an AI decision", async () => {
  const analysis = { id: "analysis", indicators: [] };
  api
    .mockResolvedValueOnce(item())
    .mockResolvedValueOnce({ id: "photo" })
    .mockResolvedValueOnce({ analysis })
    .mockResolvedValueOnce(item("3"));
  await session.run(session.analyse);
  expect(session.getSnapshot()).toMatchObject({ analysis, step: 1 });
  session.setAddress("  Paris  ");
  apiPage.mockResolvedValueOnce({
    data: [{ need_id: "need", association: { id: "association" } }],
  });
  await session.run(session.findMatches);
  expect(apiPage.mock.calls[0][0]).toBe("/donations/item/matches?limit=100");
  expect(apiPage.mock.calls[0][1].body).toEqual({ address: "Paris" });
  api.mockResolvedValueOnce({ id: "offer", decision: null });
  await session.run(session.sendOffer);
  expect(api.mock.calls.at(-1)?.[1].body).toEqual({
    expected_donation_revision: "3",
    association_id: "association",
    need_id: "need",
  });
  expect(session.getSnapshot().step).toBe(3);
  session.setAddress("Lyon");
  expect(session.getSnapshot()).toMatchObject({ selected: "", matches: [] });
});
it("carries public intent into preparation and only selects a validated intended match", async () => {
  const intent = {
    need: "wanted",
    category: "food" as const,
    location: "Paris",
  };
  const draft = new DonationSession({ api, apiPage }, "donor", null, intent);
  await draft.start();
  expect(draft.getSnapshot()).toMatchObject({
    facts: { category: "food" },
    address: "Paris",
    selected: "",
    matches: [],
  });
  const restored = new DonationSession(
    { api, apiPage },
    "donor",
    "item",
    intent,
  );
  api.mockResolvedValueOnce(item());
  apiPage
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ data: [] });
  await restored.start();
  expect(restored.getSnapshot().address).toBe("Paris");
  apiPage.mockClear();
  apiPage
    .mockResolvedValueOnce({
      data: [{ need_id: "other" }],
      page: { has_more: true, next_cursor: "next" },
    })
    .mockResolvedValueOnce({
      data: [{ need_id: "wanted" }],
      page: { has_more: false, next_cursor: null },
    });
  await restored.run(restored.findMatches);
  expect(restored.getSnapshot().selected).toBe("wanted");
  expect(apiPage.mock.calls[1][0]).toContain("cursor=next");
});
it("does not silently retarget an unavailable intended need", async () => {
  const restored = new DonationSession({ api, apiPage }, "donor", "item", {
    need: "gone",
  });
  api.mockResolvedValueOnce(item());
  apiPage
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ data: [] });
  await restored.start();
  apiPage.mockResolvedValueOnce({
    data: [{ need_id: "other" }],
    page: { has_more: false, next_cursor: null },
  });
  await restored.run(restored.findMatches);
  expect(restored.getSnapshot()).toMatchObject({
    selected: "",
    error: expect.stringContaining("Choose another association"),
  });
  await expect(restored.sendOffer()).rejects.toThrow("Choose an association");
});
it("uploads label photos as labels and locks attempted files for safe retries", async () => {
  const file = photo("label.jpg");
  session.setFiles([file]);
  session.setPhotoKind(file, "label");
  api.mockImplementation(async (path, options) => {
    if (path === "/donations") return item();
    if (path.endsWith("/photos")) {
      expect(options.body.get("kind")).toBe("label");
      throw Error("Response lost");
    }
    throw Error("Unexpected request");
  });
  await session.run(session.analyse);
  expect(session.getSnapshot().lockedFiles).toContain(file);
});
it("never creates a replacement when an existing draft fails to load, and retries the read", async () => {
  const existing = new DonationSession({ api, apiPage }, "donor", "existing");
  api.mockRejectedValueOnce(Error("Cannot load draft"));
  apiPage.mockResolvedValue({
    data: [],
    page: { has_more: false, next_cursor: null },
  });
  await existing.start();
  expect(existing.getSnapshot().donation).toBeNull();
  await existing.run(existing.save);
  expect(
    api.mock.calls.some(
      ([path, options]) => path === "/donations" && options?.method === "POST",
    ),
  ).toBe(false);
  api.mockResolvedValueOnce({ ...item(), id: "existing" });
  await existing.start();
  expect(existing.getSnapshot().donation?.id).toBe("existing");
  expect(existing.getSnapshot().error).toBe("");
});
