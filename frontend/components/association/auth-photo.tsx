"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Photo } from "@/lib/api-contracts";
import { apiBlob } from "@/lib/api";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";

export function AuthPhoto({
  photo,
  alt,
  size = 160,
}: {
  photo: Pick<Photo, "content_url">;
  alt: string;
  size?: number;
}) {
  const { user } = useAuth();
  return (
    <PhotoContent
      key={`${user?.id ?? "signed-out"}:${photo.content_url}`}
      photo={photo}
      alt={alt}
      size={size}
      authenticated={!!user}
    />
  );
}

function PhotoContent({
  photo,
  alt,
  authenticated,
  size,
}: {
  photo: Pick<Photo, "content_url">;
  alt: string;
  authenticated: boolean;
  size: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const retry = useRef<() => void>(() => {});
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!authenticated || !container.current) return;
    let disposed = false;
    let nearViewport = false;
    let objectUrl = "";
    let pending: AbortController | null = null;
    function load() {
      if (disposed || !nearViewport || objectUrl || pending) return;
      const controller = new AbortController();
      pending = controller;
      setLoading(true);
      setError("");
      apiBlob(photo.content_url.replace(/^\/api\/v1/, ""), {
        signal: controller.signal,
      })
        .then((blob) => {
          if (disposed || controller.signal.aborted) return;
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        })
        .catch(() => {
          if (!disposed && !controller.signal.aborted)
            setError("Photo unavailable.");
        })
        .finally(() => {
          if (pending === controller) {
            pending = null;
            if (!disposed) setLoading(false);
          }
        });
    }
    retry.current = load;
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              nearViewport = entries.some((entry) => entry.isIntersecting);
              if (nearViewport) load();
              else if (pending) {
                pending.abort();
                pending = null;
                setLoading(false);
              }
            },
            { rootMargin: "200px" },
          );
    observer?.observe(container.current);
    // Older browsers retain access through an explicit load button.
    if (!observer) {
      nearViewport = true;
      retry.current = load;
    }
    return () => {
      disposed = true;
      observer?.disconnect();
      pending?.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      retry.current = () => {};
    };
  }, [photo.content_url, authenticated]);
  return (
    <div
      ref={container}
      className={size <= 64 ? "auth-photo-thumbnail" : undefined}
      style={{ width: size, minHeight: size }}
    >
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <Image
            unoptimized
            className="console-photo"
            src={url}
            alt={alt}
            width={size}
            height={size}
          />
        </a>
      ) : error ? (
        <>
          <p role="alert" className={size <= 64 ? "sr-only" : undefined}>
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => retry.current()}
            aria-label={`Retry photo: ${alt}`}
          >
            {size <= 64 ? "Retry" : "Retry photo"}
          </Button>
        </>
      ) : loading ? (
        <p role="status">
          {size <= 64 ? (
            <span aria-label="Loading photo">…</span>
          ) : (
            "Loading photo…"
          )}
        </p>
      ) : authenticated ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => retry.current()}
          aria-label={`Load photo: ${alt}`}
        >
          {size <= 64 ? "Load" : "Load photo"}
        </Button>
      ) : (
        <p>Sign in to view this photo.</p>
      )}
    </div>
  );
}
