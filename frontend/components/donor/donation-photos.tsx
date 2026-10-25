"use client";
import { useEffect, useRef, useState } from "react";
import { FileUpload } from "@/components/ui/file-upload";
import { validatePhotoFiles } from "./api-donation";

type Kind = "item" | "label";
export function DonationPhotos({
  files,
  savedCount,
  locked,
  disabled,
  onChange,
  onKind,
  getKind,
  onError,
}: {
  files: File[];
  savedCount: number;
  locked: boolean;
  disabled: boolean;
  onChange: (files: File[]) => void;
  getKind: (file: File) => Kind;
  onKind: (file: File, kind: Kind) => void;
  onError: (error: string) => void;
}) {
  const [previews, setPreviews] = useState(new Map<File, string>());
  const previewCache = useRef(new Map<File, string>());
  useEffect(() => {
    for (const file of previewCache.current.keys()) {
      if (!files.includes(file)) previewCache.current.delete(file);
    }
    let disposed = false;
    const readers = files
      .filter((file) => !previewCache.current.has(file))
      .map((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (!disposed) {
            previewCache.current.set(file, String(reader.result));
            setPreviews((previous) =>
              new Map(previous).set(file, String(reader.result)),
            );
          }
        };
        reader.onerror = () => {
          if (!disposed)
            onError(
              `Could not preview ${file.name}. Remove it and choose it again.`,
            );
        };
        reader.readAsDataURL(file);
        return reader;
      });
    return () => {
      disposed = true;
      readers.forEach((reader) => {
        if (reader.readyState === FileReader.LOADING) reader.abort();
      });
    };
  }, [files, onError]);
  function change(next: File[], kind: Kind, newFiles: File[]) {
    try {
      validatePhotoFiles(next);
      if (next.length + savedCount > 3)
        throw Error("Choose at most three photos, including saved photos.");
      newFiles.forEach((file) => {
        onKind(file, kind);
      });
      setPreviews(
        (previous) =>
          new Map([...previous].filter(([file]) => next.includes(file))),
      );
      onChange(next);
      onError("");
    } catch (error) {
      onError((error as Error).message);
    }
  }
  return (
    <div className="donation-photo-panels">
      {(["item", "label"] as const).map((kind) => (
        <FileUpload
          key={kind}
          id={kind === "item" ? "photos" : "label-photos"}
          label={kind === "item" ? "Item photos" : "Label close-up"}
          description={
            kind === "item"
              ? "Show the whole item in good light."
              : "Photograph the printed date and product details."
          }
          optional={kind === "label"}
          multiple={kind === "item"}
          disabled={disabled || locked}
          photos={files.flatMap((file, index) =>
            getKind(file) === kind
              ? [
                  {
                    id: String(index),
                    name: file.name,
                    src: previews.get(file) ?? "",
                    loading: !previews.has(file),
                  },
                ]
              : [],
          )}
          onFilesChange={(added) => change([...files, ...added], kind, added)}
          onReplace={(id, file) =>
            change(
              files.map((old, index) => (index === Number(id) ? file : old)),
              kind,
              [file],
            )
          }
          onRemove={(id) =>
            change(
              files.filter((_, index) => index !== Number(id)),
              kind,
              [],
            )
          }
        />
      ))}
    </div>
  );
}
