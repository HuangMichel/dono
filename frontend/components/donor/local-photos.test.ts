import { describe, it, expect } from "vitest";
import {
  createPhotoController,
  photoSignatureMatches,
  ITEM_PHOTO_LIMIT,
  type PhotoSnapshot,
} from "./local-photos";
function fixture() {
  let snapshot: PhotoSnapshot = { photos: [], errors: [] };
  let count = 0;
  const pending = new Map<
    string,
    { resolve: (value: string) => void; reject: (error: Error) => void }
  >();
  const manager = createPhotoController(
    (value) => {
      snapshot = value;
    },
    (file) =>
      new Promise((resolve, reject) =>
        pending.set(file.name, { resolve, reject }),
      ),
    () => `photo-${++count}`,
  );
  const file = (name: string, type = "image/jpeg", size = 10) =>
    ({ name, type, size }) as File;
  return {
    manager,
    file,
    pending,
    get snapshot() {
      return snapshot;
    },
  };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
describe("local multi-photo lifecycle", () => {
  it("reads an exact 4 MiB image but rejects one extra byte before reading", () => {
    const f = fixture();
    f.manager.addFiles(
      [
        f.file("exact.jpg", "image/jpeg", 4_194_304),
        f.file("large.jpg", "image/jpeg", 4_194_305),
      ],
      "item",
    );
    expect(f.pending.has("exact.jpg")).toBe(true);
    expect(f.pending.has("large.jpg")).toBe(false);
    expect(f.snapshot.photos.map((photo) => photo.name)).toEqual(["exact.jpg"]);
    expect(f.snapshot.errors).toEqual([
      "large.jpg: Choose a photo up to 4 MiB.",
    ]);
  });
  it("appends batches and reports each invalid file without losing good images", async () => {
    const f = fixture();
    f.manager.addFiles(
      [
        f.file("front.jpg"),
        f.file("bad.txt", "text/plain"),
        f.file("huge.jpg", "image/jpeg", 6 * 1024 * 1024),
      ],
      "item",
    );
    f.manager.addFiles([f.file("side.jpg")], "item");
    f.pending.get("side.jpg")!.resolve("side");
    f.pending.get("front.jpg")!.resolve("front");
    await settle();
    expect(f.snapshot.photos.map((p) => p.name)).toEqual([
      "front.jpg",
      "side.jpg",
    ]);
    expect(f.snapshot.photos.map((p) => p.src)).toEqual(["front", "side"]);
  });
  it("reports mixed batch errors per filename", () => {
    const f = fixture();
    f.manager.addFiles(
      [
        f.file("valid.jpg"),
        f.file("bad.txt", "text/plain"),
        f.file("large.jpg", "image/jpeg", 6 * 1024 * 1024),
      ],
      "item",
    );
    expect(f.snapshot.photos).toHaveLength(1);
    expect(f.snapshot.errors).toHaveLength(2);
    expect(f.snapshot.errors[0]).toContain("bad.txt");
    expect(f.snapshot.errors[1]).toContain("large.jpg");
  });
  it("does not resurrect removed photos or allow older replacements to win", async () => {
    const f = fixture();
    f.manager.addFiles([f.file("removed.jpg"), f.file("old.jpg")], "item");
    const [removed, old] = f.snapshot.photos;
    f.manager.remove(removed.id);
    f.manager.replace(old.id, f.file("new.jpg"));
    f.pending.get("new.jpg")!.resolve("new");
    f.pending.get("old.jpg")!.resolve("old");
    f.pending.get("removed.jpg")!.resolve("removed");
    await settle();
    expect(f.snapshot.photos).toMatchObject([
      { id: old.id, name: "new.jpg", src: "new" },
    ]);
  });
  it("preserves a good photo if replacement fails and ignores reads after disposal", async () => {
    const f = fixture();
    f.manager.addFiles([f.file("front.jpg")], "item");
    f.pending.get("front.jpg")!.resolve("front");
    await settle();
    const id = f.snapshot.photos[0].id;
    f.manager.replace(id, f.file("invalid.jpg"));
    f.pending.get("invalid.jpg")!.reject(Error("Type mismatch"));
    await settle();
    expect(f.snapshot.photos[0]).toMatchObject({
      id,
      name: "front.jpg",
      src: "front",
      loading: false,
    });
    f.manager.addFiles([f.file("later.jpg")], "item");
    f.manager.dispose();
    const previous = f.snapshot;
    f.pending.get("later.jpg")!.resolve("late");
    await settle();
    expect(f.snapshot).toBe(previous);
  });
  it("cancels an older pending replacement when a newer file is rejected", async () => {
    const f = fixture();
    f.manager.addFiles([f.file("original.jpg")], "item");
    f.pending.get("original.jpg")!.resolve("original");
    await settle();
    const id = f.snapshot.photos[0].id;
    f.manager.replace(id, f.file("older.jpg"));
    f.manager.replace(id, f.file("invalid.txt", "text/plain"));
    f.pending.get("older.jpg")!.resolve("older");
    await settle();
    expect(f.snapshot.photos[0]).toMatchObject({
      id,
      name: "original.jpg",
      src: "original",
      loading: false,
    });
  });
  it("bounds pending item reads and keeps the label separate", () => {
    const f = fixture();
    f.manager.addFiles(
      Array.from({ length: ITEM_PHOTO_LIMIT + 1 }, (_, i) =>
        f.file(`item${i}.jpg`),
      ),
      "item",
    );
    f.manager.addFiles([f.file("label.jpg")], "label");
    expect(f.snapshot.photos.filter((p) => p.kind === "item")).toHaveLength(
      ITEM_PHOTO_LIMIT,
    );
    expect(f.snapshot.photos.filter((p) => p.kind === "label")).toHaveLength(1);
  });
  it("checks JPEG, PNG and WebP signatures", () => {
    expect(
      photoSignatureMatches("image/jpeg", new Uint8Array([255, 216])),
    ).toBe(true);
    expect(
      photoSignatureMatches("image/png", new Uint8Array([137, 80, 78])),
    ).toBe(true);
    expect(
      photoSignatureMatches(
        "image/webp",
        new Uint8Array([82, 73, 0, 0, 0, 0, 0, 0, 87, 69]),
      ),
    ).toBe(true);
    expect(photoSignatureMatches("image/png", new Uint8Array([255, 216]))).toBe(
      false,
    );
  });
});
