import type { OfferIntent } from "@/lib/offer-intent";
import type { ApiOptions } from "@/lib/api";
import type { Page, Photo } from "@/lib/api-contracts";
import {
  createCommandKeys,
  validatePhotoFiles,
  type Donation,
  type Facts,
  type Analysis,
  type Match,
} from "./api-donation";

type PendingSave = {
  kind: "edit" | "publication";
  before: Donation;
  formFacts: Facts;
  files: File[];
  path: string;
  body: unknown;
  method: "PATCH" | "POST";
  key: string;
};
export type DonationSessionState = {
  donation: Donation | null;
  facts: Facts;
  step: number;
  files: File[];
  lockedFiles: File[];
  persistedPhotos: Photo[];
  analysis: Analysis | null;
  address: string;
  matches: Match[];
  matchesSearched: boolean;
  selected: string;
  sentTo: string;
  busy: boolean;
  error: string;
};
export type DonationSessionApi = {
  api: <T>(path: string, options?: ApiOptions) => Promise<T>;
  apiPage: <T>(path: string, options?: ApiOptions) => Promise<Page<T>>;
};
export class DonationSession {
  private state: DonationSessionState = {
    donation: null,
    facts: {
      category: "clothes",
      attributes: {},
      quantity: "1",
      unit: "item",
      expiry: {},
    },
    step: 0,
    files: [],
    lockedFiles: [],
    persistedPhotos: [],
    analysis: null,
    address: "",
    matches: [],
    matchesSearched: false,
    selected: "",
    sentTo: "",
    busy: false,
    error: "",
  };
  private listeners = new Set<() => void>();
  private lifecycle: AbortController | null = null;
  private commandKey = createCommandKeys();
  private pendingSave: PendingSave | null = null;
  private createKey: string | null = null;
  private photoKinds = new Map<File, "item" | "label">();
  private uploaded = new Map<File, string>();
  private observedPhotoIds = new Set<string>();
  constructor(
    private backend: DonationSessionApi,
    private accountId: string | null,
    private donationId: string | null = null,
    private intent: OfferIntent = {},
  ) {
    this.state = {
      ...this.state,
      facts: donationId
        ? this.state.facts
        : { ...this.state.facts, category: intent.category ?? "clothes" },
      address: intent.location ?? "",
    };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<DonationSessionState>) {
    if (this.lifecycle?.signal.aborted || !this.lifecycle) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  setFacts = (next: Facts | ((facts: Facts) => Facts)) => {
    this.update({
      facts: typeof next === "function" ? next(this.state.facts) : next,
    });
  };
  setStep = (step: number) => this.update({ step });
  setFiles = (files: File[]) => {
    for (const file of this.photoKinds.keys()) {
      if (!files.includes(file) && !this.state.lockedFiles.includes(file))
        this.photoKinds.delete(file);
    }
    this.update({ files });
  };
  getPhotoKind = (file: File) => this.photoKinds.get(file) ?? "item";
  setPhotoKind = (file: File, kind: "item" | "label") => {
    if (!this.state.lockedFiles.includes(file)) this.photoKinds.set(file, kind);
  };
  setError = (error: string) => this.update({ error });
  setAddress = (address: string) =>
    this.update({ address, matches: [], selected: "", matchesSearched: false });
  setSelected = (selected: string) => this.update({ selected });
  private setDonation = (donation: Donation) => this.update({ donation });
  private setAnalysis = (analysis: Analysis | null) =>
    this.update({ analysis });
  private setMatches = (matches: Match[]) => this.update({ matches });
  private async call<T>(request: (signal: AbortSignal) => Promise<T>) {
    const signal = this.lifecycle?.signal;
    if (!this.accountId || !signal || signal.aborted)
      throw Error("Sign in to prepare a donation.");
    const result = await request(signal);
    if (signal.aborted)
      throw Error(
        "This donation is no longer open. Return to My donations to continue.",
      );
    return result;
  }
  private request<T>(path: string, options?: ApiOptions) {
    return this.call((signal) =>
      this.backend.api<T>(path, { ...options, signal }),
    );
  }
  private page<T>(path: string, options?: ApiOptions) {
    return this.call((signal) =>
      this.backend.apiPage<T>(path, { ...options, signal }),
    );
  }
  async start() {
    const id = this.donationId;
    this.lifecycle?.abort();
    this.lifecycle = new AbortController();
    this.update({ busy: false });
    const signal = this.lifecycle.signal;
    if (!id || !this.accountId) return;
    await this.run(async () => {
      const [item, photos, analyses] = await Promise.all([
        this.request<Donation>(`/donations/${id}`),
        this.page<Photo>(`/donations/${id}/photos`),
        this.page<Analysis>(`/donations/${id}/analyses`),
      ]);
      if (signal.aborted) return;
      this.observedPhotoIds = new Set(photos.data.map((photo) => photo.id));
      this.update({
        donation: item,
        facts: item.facts,
        persistedPhotos: photos.data,
        analysis:
          analyses.data.find((a) => a.id === item.basis_analysis_id) ??
          analyses.data[0] ??
          null,
        step: item.status === "ready" ? 2 : 0,
      });
    });
  }
  stop() {
    this.lifecycle?.abort();
  }
  run = async (action: () => Promise<void>) => {
    const signal = this.lifecycle?.signal;
    if (!this.accountId || !signal || signal.aborted || this.state.busy) return;
    this.update({ busy: true, error: "" });
    try {
      await action();
    } catch (error) {
      if (!signal.aborted)
        this.setError(
          error instanceof Error
            ? error.message
            : "We could not complete this action. Please try again.",
        );
    } finally {
      if (!signal.aborted) this.update({ busy: false });
    }
  };
  private async ensureDonation() {
    if (this.state.donation) return this.state.donation;
    if (this.donationId)
      throw Error("Load your saved donation before making changes.");
    this.createKey ??= crypto.randomUUID();
    const item = await this.request<Donation>("/donations", {
      method: "POST",
      body: {},
      idempotencyKey: this.createKey,
    });
    this.setDonation(item);
    return item;
  }
  private async ensureUploadedPhotos(item: Donation) {
    validatePhotoFiles(this.state.files);
    if (!this.state.files.length) {
      if (!this.state.persistedPhotos.length)
        throw Error("Choose an item photo first.");
      return this.state.persistedPhotos.slice(0, 3).map((photo) => photo.id);
    }
    if (this.state.persistedPhotos.length + this.state.files.length > 3)
      throw Error("Choose at most three photos, including saved photos.");
    const photoIds: string[] = this.state.persistedPhotos.map(
      (photo) => photo.id,
    );
    for (const file of this.state.files) {
      let photoId = this.uploaded.get(file);
      if (!photoId) {
        this.update({
          lockedFiles: [...new Set([...this.state.lockedFiles, file])],
        });
        const body = new FormData();
        body.append("file", file);
        body.append("kind", this.photoKinds.get(file) ?? "item");
        const result = await this.request<{ id: string }>(
          `/donations/${item.id}/photos`,
          { method: "POST", body, idempotencyKey: this.commandKey(file) },
        );
        photoId = result.id;
        this.uploaded.set(file, photoId);
      }
      photoIds.push(photoId);
    }
    return photoIds;
  }
  analyse = async () => {
    const item = await this.ensureDonation();
    const photoIds = await this.ensureUploadedPhotos(item);
    const result = await this.request<{ analysis: Analysis }>(
      `/donations/${item.id}/analyses`,
      {
        method: "POST",
        body: { photo_ids: photoIds, category_hint: this.state.facts.category },
        idempotencyKey: this.commandKey(
          JSON.stringify([item.id, photoIds, this.state.facts.category]),
        ),
      },
    );
    const current = await this.request<Donation>(`/donations/${item.id}`);
    this.observedPhotoIds = new Set([
      ...this.observedPhotoIds,
      ...this.uploaded.values(),
    ]);
    this.setDonation(current);
    this.setFacts(current.facts);
    this.setAnalysis(result.analysis);
    this.setStep(1);
  };
  private async replayPendingSave() {
    const pending = this.pendingSave;
    if (!pending) throw Error("There are no unsaved changes to retry.");
    let item: Donation;
    try {
      item = await this.request<Donation>(pending.path, {
        method: pending.method,
        body: pending.body,
        idempotencyKey: pending.key,
      });
    } catch (error) {
      // Definitive client/domain failures can be corrected. Network and server
      // failures keep the original command so a retry can discover its outcome.
      const status = (error as { status?: number })?.status;
      if (status && status >= 400 && status < 500) this.pendingSave = null;
      throw error;
    }
    this.pendingSave = null;
    const expectedRevision = BigInt(pending.before.revision) + 1n;
    const expectedFactsRevision =
      BigInt(pending.before.facts_revision) +
      (pending.kind === "edit" ? 1n : 0n);
    if (
      BigInt(item.revision) !== expectedRevision ||
      BigInt(item.facts_revision) !== expectedFactsRevision
    ) {
      throw Error(
        "The saved item changed after this request. Your entries are preserved. Reload the saved donation before editing again.",
      );
    }
    this.setDonation(item);
    return { item, pending };
  }
  private async publishSavedItem(item: Donation) {
    if (item.status === "ready") return item;
    const path = `/donations/${item.id}/publication`;
    this.pendingSave = {
      kind: "publication",
      before: item,
      formFacts: item.facts,
      files: [...this.state.files],
      path,
      body: { expected_revision: item.revision },
      method: "POST",
      key: this.commandKey(JSON.stringify(["publish", item.id, item.revision])),
    };
    return (await this.replayPendingSave()).item;
  }
  save = async () => {
    let current: Donation;
    if (this.pendingSave) {
      const recovered = await this.replayPendingSave();
      current = recovered.item;
      if (
        JSON.stringify(this.state.facts) ===
          JSON.stringify(recovered.pending.formFacts) &&
        this.state.files.length === recovered.pending.files.length &&
        this.state.files.every(
          (file, index) => file === recovered.pending.files[index],
        )
      ) {
        this.setFacts(current.facts);
        current = await this.publishSavedItem(current);
        this.setDonation(current);
        this.setStep(2);
        return;
      }
    } else {
      current = await this.ensureDonation();
    }
    await this.ensureUploadedPhotos(current);
    const observed = current;
    const ownNewPhotoIds = new Set(
      [...this.uploaded.values()].filter(
        (photoId) => !this.observedPhotoIds.has(photoId),
      ),
    );
    current = await this.request<Donation>(`/donations/${current.id}`);
    // dono_photo increments both versions once for each inserted photo. A replay
    // returns the same photo ID without incrementing either version.
    const ownPhotoIncrements = BigInt(ownNewPhotoIds.size);
    if (
      BigInt(current.facts_revision) !==
        BigInt(observed.facts_revision) + ownPhotoIncrements ||
      BigInt(current.revision) !==
        BigInt(observed.revision) + ownPhotoIncrements
    ) {
      throw Error(
        "The saved item details changed. Your entries are preserved. Reload the saved donation before editing again.",
      );
    }
    this.observedPhotoIds = new Set([
      ...this.observedPhotoIds,
      ...ownNewPhotoIds,
    ]);
    this.setDonation(current);
    this.pendingSave = {
      kind: "edit",
      before: current,
      formFacts: this.state.facts,
      files: [...this.state.files],
      path: `/donations/${current.id}`,
      method: "PATCH",
      body: { expected_revision: current.revision, facts: this.state.facts },
      key: this.commandKey(
        JSON.stringify([
          "edit",
          current.id,
          current.revision,
          this.state.facts,
        ]),
      ),
    };
    current = (await this.replayPendingSave()).item;
    this.setFacts(current.facts);
    current = await this.publishSavedItem(current);
    this.setDonation(current);
    this.setStep(2);
  };
  findMatches = async () => {
    if (!this.state.donation) return;
    this.setMatches([]);
    this.setSelected("");
    const matches: Match[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | null = null;
    do {
      const page: Page<Match> = await this.page<Match>(
        `/donations/${this.state.donation.id}/matches?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        { method: "POST", body: { address: this.state.address.trim() } },
      );
      matches.push(
        ...page.data.filter(
          (match) =>
            !matches.some((existing) => existing.need_id === match.need_id),
        ),
      );
      cursor = page.page?.has_more ? page.page.next_cursor : null;
      if (
        !this.intent.need ||
        matches.some((match) => match.need_id === this.intent.need)
      )
        break;
      if (cursor && seenCursors.has(cursor))
        throw Error("Available associations changed. Search again.");
      if (cursor) seenCursors.add(cursor);
    } while (cursor);
    this.update({ matches, matchesSearched: true });
    if (this.intent.need) {
      const intended = matches.find(
        (match) => match.need_id === this.intent.need,
      );
      this.setSelected(intended?.need_id ?? "");
      if (!intended)
        this.setError(
          "The selected need is no longer available for this item. Choose another association or browse nearby needs.",
        );
    } else {
      this.setSelected(matches[0]?.need_id ?? "");
    }
  };
  sendOffer = async () => {
    const match = this.state.matches.find(
      (m) => m.need_id === this.state.selected,
    );
    if (!this.state.donation || !match) throw Error("Choose an association.");
    await this.request(`/donations/${this.state.donation.id}/offers`, {
      idempotencyKey: this.commandKey(
        JSON.stringify([
          "offer",
          this.state.donation.id,
          this.state.donation.revision,
          this.state.selected,
        ]),
      ),
      method: "POST",
      body: {
        expected_donation_revision: this.state.donation.revision,
        association_id: match.association.id,
        need_id: match.need_id,
      },
    });
    // Keep the recipient with the sent screen even if the match list is cleared.
    this.update({ sentTo: match.association.name });
    this.setStep(3);
  };
}
