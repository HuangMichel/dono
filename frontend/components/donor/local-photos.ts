export const DEMO_ITEM_PHOTO_LIMIT = 6;
export type PhotoKind = "item" | "label";
export type LocalPhoto = {
  id: string;
  kind: PhotoKind;
  name: string;
  src: string;
  loading: boolean;
  version: number;
};
export type PhotoSnapshot = { photos: LocalPhoto[]; errors: string[] };
export function photoFileError(
  file: Pick<File, "type" | "size">,
): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return "Choose a JPEG, PNG or WebP image.";
  if (file.size > 5 * 1024 * 1024) return "Choose an image up to 5 MB.";
  return null;
}
export function photoSignatureMatches(
  type: string,
  bytes: Uint8Array,
): boolean {
  if (type === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216;
  if (type === "image/png")
    return bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78;
  return (
    type === "image/webp" &&
    bytes[0] === 82 &&
    bytes[1] === 73 &&
    bytes[8] === 87 &&
    bytes[9] === 69
  );
}
async function readPhoto(file: File): Promise<string> {
  const invalid = photoFileError(file);
  if (invalid) throw Error(invalid);
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!photoSignatureMatches(file.type, bytes))
    throw Error("This file does not match its image type.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(Error("Could not read this image. Choose it again."));
    reader.onabort = () =>
      reject(Error("Reading was interrupted. Choose the image again."));
    reader.readAsDataURL(file);
  });
}
/** Local preview ownership. IDs and versions prevent removed/replaced reads from returning. */
export function createPhotoController(
  publish: (snapshot: PhotoSnapshot) => void,
  read: (file: File) => Promise<string> = readPhoto,
  makeId: () => string = () => crypto.randomUUID(),
) {
  let photos: LocalPhoto[] = [];
  let errors: string[] = [];
  let epoch = 0;
  function emit() {
    publish({ photos: [...photos], errors: [...errors] });
  }
  function failFile(name: string, message: string) {
    errors = [...errors, `${name}: ${message}`];
    emit();
  }
  async function finish(file: File, id: string, version: number) {
    const started = epoch;
    try {
      const src = await read(file);
      if (
        started !== epoch ||
        !photos.some((p) => p.id === id && p.version === version)
      )
        return;
      photos = photos.map((p) =>
        p.id === id ? { ...p, src, name: file.name, loading: false } : p,
      );
      emit();
    } catch (cause) {
      if (
        started !== epoch ||
        !photos.some((p) => p.id === id && p.version === version)
      )
        return;
      photos = photos.flatMap((p) =>
        p.id !== id ? [p] : p.src ? [{ ...p, loading: false }] : [],
      );
      failFile(
        file.name,
        cause instanceof Error ? cause.message : "Could not read this image.",
      );
    }
  }
  function addFiles(files: readonly File[], kind: PhotoKind) {
    errors = [];
    for (const file of files) {
      const invalid = photoFileError(file);
      if (invalid) {
        failFile(file.name, invalid);
        continue;
      }
      const limit = kind === "item" ? DEMO_ITEM_PHOTO_LIMIT : 1;
      if (photos.filter((p) => p.kind === kind).length >= limit) {
        failFile(
          file.name,
          kind === "item"
            ? `Demo limit: ${limit} item photos. Remove a photo first.`
            : "Replace the existing label photo instead.",
        );
        continue;
      }
      const entry: LocalPhoto = {
        id: makeId(),
        kind,
        name: file.name,
        src: "",
        loading: true,
        version: 1,
      };
      photos = [...photos, entry];
      emit();
      void finish(file, entry.id, entry.version);
    }
    emit();
  }
  function replace(id: string, file: File) {
    const previous = photos.find((p) => p.id === id);
    if (!previous) return;
    errors = [];
    const version = previous.version + 1;
    const invalid = photoFileError(file);
    if (invalid) {
      photos = photos.flatMap((photo) =>
        photo.id !== id
          ? [photo]
          : photo.src
            ? [{ ...photo, version, loading: false }]
            : [],
      );
      failFile(file.name, invalid);
      return;
    }
    photos = photos.map((p) =>
      p.id === id ? { ...p, version, loading: true } : p,
    );
    emit();
    void finish(file, id, version);
  }
  function remove(id: string) {
    photos = photos.filter((p) => p.id !== id);
    emit();
  }
  function makePrimary(id: string) {
    const photo = photos.find(
      (p) => p.id === id && p.kind === "item" && p.src && !p.loading,
    );
    if (photo) {
      photos = [photo, ...photos.filter((p) => p.id !== id)];
      emit();
    }
  }
  function addSamples(category: string) {
    errors = [];
    const sideSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180"><rect width="240" height="180" fill="#f9f9f8"/><path d="m94 35 38 12 22 26-14 14-13-12 8 76-36 2 7-80-13 18-14-13 18-31z" fill="#e9e8e6" stroke="#63635e"/><path d="m111 45 5 105m2-79 23 11" fill="none" stroke="#63635e"/><text x="120" y="171" text-anchor="middle" font-size="12" fill="#63635e">Illustration only</text></svg>';
    const samples = [
      { name: "Sample illustration 1", src: `/item-${category}.svg` },
      {
        name: "Sample illustration 2",
        src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sideSvg)}`,
      },
    ];
    for (const sample of samples) {
      if (
        photos.filter((p) => p.kind === "item").length >= DEMO_ITEM_PHOTO_LIMIT
      ) {
        failFile(
          sample.name,
          `Demo limit: ${DEMO_ITEM_PHOTO_LIMIT} item photos.`,
        );
        continue;
      }
      photos = [
        ...photos,
        { ...sample, id: makeId(), kind: "item", loading: false, version: 1 },
      ];
    }
    emit();
  }
  function dispose() {
    ++epoch;
    photos = [];
    errors = [];
  }
  return { addFiles, replace, remove, makePrimary, addSamples, dispose };
}
