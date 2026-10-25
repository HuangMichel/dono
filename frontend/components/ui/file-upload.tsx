"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CameraCapture } from "./camera-capture";
import { Button, Card, Chip, Icon } from "@/components/ui";
import "./file-upload.css";
import { MAX_PHOTO_SIZE_LABEL } from "@/lib/photo-limits";
type UploadPhoto = { id: string; name: string; src: string; loading: boolean };
type FileUploadProps = {
  id: string;
  label: string;
  description: string;
  photos: readonly UploadPhoto[];
  multiple?: boolean;
  optional?: boolean;
  disabled?: boolean;
  primaryId?: string;
  onFilesChange: (files: File[]) => void;
  onReplace: (id: string, file: File) => void;
  onRemove: (id: string) => void;
  onPrimary?: (id: string) => void;
};
/** File bytes and validation stay with the caller; this component presents local previews. */
export function FileUpload({
  id,
  label,
  description,
  photos,
  multiple = false,
  optional = false,
  disabled = false,
  primaryId,
  onFilesChange,
  onReplace,
  onRemove,
  onPrimary,
}: FileUploadProps) {
  const [camera, setCamera] = useState<{ replacementId: string | null } | null>(
    null,
  );
  const available = useRef(!disabled);
  useEffect(() => {
    available.current = !disabled;
  }, [disabled]);
  const input = useRef<HTMLInputElement>(null),
    replacement = useRef<HTMLInputElement>(null),
    replacementId = useRef<string | null>(null);
  // A lock change cancels the session rather than reopening it when unlocked.
  if (disabled && camera) setCamera(null);
  return (
    <Card
      className={`file-upload ${multiple ? "file-upload-multiple" : "file-upload-single"}`}
      aria-labelledby={`${id}-title`}
    >
      <div className="file-upload-heading">
        <h2 id={`${id}-title`}>{label}</h2>
        <Chip variant={photos.length ? "success" : "neutral"}>
          {photos.length
            ? `${photos.length} added`
            : optional
              ? "Optional"
              : "Required"}
        </Chip>
      </div>
      {photos.length ? (
        <ul className="file-upload-gallery">
          {photos.map((photo, index) => (
            <li key={photo.id} className="file-upload-photo">
              <div className="file-upload-thumbnail">
                {photo.src ? (
                  <Image
                    src={photo.src}
                    alt={`${photo.name}, ${label.toLowerCase()} ${index + 1}`}
                    width={180}
                    height={120}
                    unoptimized
                  />
                ) : (
                  <span className="meta muted" role="status">
                    Loading photo preview…
                  </span>
                )}
              </div>
              <p className="file-upload-filename" title={photo.name}>
                {photo.name}
              </p>
              <div className="file-upload-photo-status">
                {photo.loading ? (
                  <Chip>Loading preview…</Chip>
                ) : photo.id === primaryId ? (
                  <Chip variant="success">Main photo</Chip>
                ) : null}
              </div>
              <div className="file-upload-photo-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  aria-label={`Replace ${photo.name}, photo ${index + 1}`}
                  onClick={() => {
                    replacementId.current = photo.id;
                    replacement.current?.click();
                  }}
                >
                  Replace
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="soft"
                  disabled={disabled}
                  aria-label={`Remove ${photo.name}, photo ${index + 1}`}
                  onClick={() => onRemove(photo.id)}
                >
                  Remove
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  aria-label={`Retake ${photo.name}, photo ${index + 1}`}
                  onClick={() => setCamera({ replacementId: photo.id })}
                >
                  Retake
                </Button>
                {onPrimary && photo.id !== primaryId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="soft"
                    disabled={disabled || photo.loading}
                    aria-label={`Use ${photo.name}, photo ${index + 1}, as main photo`}
                    onClick={() => onPrimary(photo.id)}
                  >
                    Make main
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="file-upload-preview">
          <div>
            <Icon name="camera" size={28} />
            <p>{description}</p>
          </div>
        </div>
      )}
      <input
        ref={input}
        id={id}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-label={label}
        aria-describedby={`${id}-limits`}
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          onFilesChange(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={replacement}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-label={`Replace ${label.toLowerCase()}`}
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0],
            target = replacementId.current;
          if (file && target) onReplace(target, file);
          event.currentTarget.value = "";
          replacementId.current = null;
        }}
      />
      <div className="file-upload-actions">
        {(multiple || !photos.length) && (
          <Button
            type="button"
            disabled={disabled}
            aria-label={`Take ${label.toLowerCase()}`}
            onClick={() => setCamera({ replacementId: null })}
          >
            <Icon name="camera" /> Take photo
          </Button>
        )}
        {(multiple || !photos.length) && (
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={
              photos.length
                ? `Add ${label.toLowerCase()}`
                : `Choose ${label.toLowerCase()}`
            }
            onClick={() => input.current?.click()}
          >
            {photos.length
              ? "Add photos"
              : multiple
                ? "Choose photos"
                : "Choose photo"}
          </Button>
        )}
      </div>
      {camera && !disabled && (
        <CameraCapture
          label={label}
          description={description}
          onClose={() => setCamera(null)}
          onChooseFile={() => {
            const target = camera.replacementId;
            setCamera(null);
            if (!available.current) return;
            if (target) {
              replacementId.current = target;
              replacement.current?.click();
            } else input.current?.click();
          }}
          onCapture={(file) => {
            setCamera(null);
            if (!available.current) return;
            if (camera.replacementId) onReplace(camera.replacementId, file);
            else onFilesChange([file]);
          }}
        />
      )}
      <p id={`${id}-limits`} className="meta muted">
        JPEG, PNG or WebP, up to {MAX_PHOTO_SIZE_LABEL} each.
      </p>
      {optional ? (
        <p className="meta muted">
          Leave this empty if the item has no printed date.
        </p>
      ) : (
        <p className="meta muted">Add different angles of the same item.</p>
      )}
    </Card>
  );
}
