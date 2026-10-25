"use client";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { MAX_PHOTO_BYTES } from "@/lib/photo-limits";
import "./camera-capture.css";

type Props = {
  label: string;
  description: string;
  onCapture: (file: File) => void;
  onClose: () => void;
  onChooseFile: () => void;
};
function cameraError(error: unknown) {
  const name =
    error instanceof Error || error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera access was denied. Allow camera access in your browser settings, then try again, or choose a photo.";
  if (name === "NotFoundError")
    return "No camera was found. Connect a camera or choose a photo.";
  return "The camera could not start. Close other apps using it, then try again, or choose a photo.";
}
function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(Error("Could not capture the photo. Try again.")),
      "image/jpeg",
      quality,
    ),
  );
}

/** Captures locally. Only Use photo passes a File to the existing upload flow. */
export function CameraCapture({
  label,
  description,
  onCapture,
  onClose,
  onChooseFile,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const titleId = useId();
  const descriptionId = useId();
  const [session, setSession] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const stop = useCallback(() => {
    generation.current++;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);
  const close = () => {
    stop();
    dialog.current?.close();
    onClose();
  };

  useEffect(() => {
    const previousFocus = document.activeElement;
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, []);
  useEffect(() => {
    if (photo) return;
    const request = ++generation.current;
    let disposed = false;
    async function start() {
      try {
        if (!window.isSecureContext) {
          setError(
            "The camera needs a secure connection. Open this page with HTTPS or choose a photo.",
          );
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          setError(
            "This browser cannot open the camera. Choose a photo or use a browser with camera support.",
          );
          return;
        }
        const next = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 2560 },
            height: { ideal: 1920 },
          },
        });
        if (disposed || request !== generation.current) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = next;
        video.current!.srcObject = next;
        await video.current!.play();
      } catch (cause) {
        if (!disposed && request === generation.current) {
          stop();
          setReady(false);
          setError(cameraError(cause));
        }
      }
    }
    void start();
    return () => {
      disposed = true;
      stop();
    };
  }, [session, photo, stop]);
  useEffect(() => {
    if (photo)
      dialog.current
        ?.querySelector<HTMLButtonElement>("[data-confirm-photo]")
        ?.focus();
  }, [photo]);
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.url);
    },
    [photo],
  );

  async function takePhoto() {
    const source = video.current;
    if (!ready || busy || !source?.videoWidth || !source.videoHeight) return;
    const request = generation.current;
    setBusy(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(
        1,
        2560 / Math.max(source.videoWidth, source.videoHeight),
      );
      canvas.width = Math.round(source.videoWidth * scale);
      canvas.height = Math.round(source.videoHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) throw Error("Could not capture the photo. Try again.");
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      let blob = await encode(canvas, 0.9);
      if (blob.size > MAX_PHOTO_BYTES) blob = await encode(canvas, 0.8);
      if (blob.size > MAX_PHOTO_BYTES)
        throw Error(
          "This photo is too large. Retake it or choose a smaller photo.",
        );
      if (request !== generation.current) return;
      const file = new File([blob], `photo-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      const url = URL.createObjectURL(blob);
      setBusy(false);
      stop();
      setReady(false);
      setPhoto({ file, url });
    } catch (cause) {
      if (request === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not capture the photo. Try again.",
        );
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  function retry() {
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    setError("");
    setReady(false);
    setPhoto(null);
    setSession((value) => value + 1);
  }
  return (
    <dialog
      ref={dialog}
      className="camera-capture"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="camera-capture-content">
        <header className="camera-capture-header">
          <h2 id={titleId}>
            {photo
              ? "Check your photo"
              : label === "Label close-up"
                ? "Photograph the label"
                : "Photograph your item"}
          </h2>
          <Button
            type="button"
            variant="soft"
            aria-label="Close camera"
            onClick={close}
          >
            <Icon name="close" />
          </Button>
        </header>
        <p id={descriptionId} className="muted">
          {photo
            ? "Check that the details are clear and in focus."
            : description}
        </p>
        <div className="camera-capture-viewfinder">
          {photo ? (
            <Image
              src={photo.url}
              alt={`${label} capture preview`}
              width={960}
              height={720}
              unoptimized
            />
          ) : (
            <video
              ref={video}
              muted
              autoPlay
              playsInline
              aria-label={`${label} camera preview`}
              onLoadedData={() => {
                if (video.current?.videoWidth && video.current?.videoHeight)
                  setReady(true);
              }}
              onError={() => {
                stop();
                setReady(false);
                setError(
                  "The camera preview stopped. Try again or choose a photo.",
                );
              }}
            />
          )}
        </div>
        {!photo && !error && (
          <p role="status" className="meta muted">
            {busy
              ? "Preparing photo…"
              : ready
                ? "Keep the item steady, then take a photo."
                : "Waiting for camera access…"}
          </p>
        )}
        {error && (
          <p role="alert" className="camera-capture-error">
            {error}
          </p>
        )}
        <div className="camera-capture-actions">
          {photo ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="app"
                onClick={retry}
              >
                Retake
              </Button>
              <Button
                type="button"
                size="app"
                data-confirm-photo
                onClick={() => {
                  stop();
                  dialog.current?.close();
                  onCapture(photo.file);
                }}
              >
                Use photo
              </Button>
            </>
          ) : (
            <>
              {error && !ready ? (
                <Button type="button" size="app" onClick={retry}>
                  Try camera again
                </Button>
              ) : (
                <Button
                  type="button"
                  size="app"
                  disabled={!ready || busy}
                  onClick={() => void takePhoto()}
                >
                  Take photo
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="app"
                onClick={() => {
                  stop();
                  dialog.current?.close();
                  onChooseFile();
                }}
              >
                Choose a photo
              </Button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
