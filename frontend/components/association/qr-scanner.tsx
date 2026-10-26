"use client";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Button, Icon } from "@/components/ui";

/** Reads live frames locally; only the decoded signed payload leaves this component. */
export function QrScanner({
  onScan,
  onStart,
}: {
  onScan: (payload: string) => void;
  onStart: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const [detected, setDetected] = useState(false);
  const callback = useRef(onScan);
  useEffect(() => {
    callback.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const source = video.current!;
    const stop = () => {
      disposed = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      source.srcObject = null;
    };
    const fail = (message: string) => {
      stop();
      setError(message);
      setActive(false);
    };
    const hidden = () => {
      if (document.hidden) {
        stop();
        setActive(false);
      }
    };
    document.addEventListener("visibilitychange", hidden);
    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          fail(
            "Camera unavailable. Use HTTPS and a browser with camera support, or enter the QR code content below.",
          );
          return;
        }
        const next = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
        });
        if (disposed) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = next;
        source.srcObject = next;
        await source.play();
        if (disposed) return;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          fail("Camera scanning unavailable. Enter the QR code content below.");
          return;
        }
        const scan = () => {
          if (disposed) return;
          try {
            if (
              source.readyState >= 2 &&
              source.videoWidth &&
              source.videoHeight
            ) {
              const side = Math.min(source.videoWidth, source.videoHeight);
              canvas.width = canvas.height = Math.min(side, 960);
              context.drawImage(
                source,
                (source.videoWidth - side) / 2,
                (source.videoHeight - side) / 2,
                side,
                side,
                0,
                0,
                canvas.width,
                canvas.height,
              );
              const frame = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
              );
              const code = jsQR(frame.data, frame.width, frame.height);
              if (code?.data) {
                stop();
                setActive(false);
                setDetected(true);
                callback.current(code.data);
                return;
              }
            }
            timer = setTimeout(scan, 100);
          } catch {
            fail(
              "Scanning stopped. Try the camera again or enter the QR code content below.",
            );
          }
        };
        scan();
      } catch (cause) {
        if (disposed) return;
        const denied =
          cause instanceof DOMException && cause.name === "NotAllowedError";
        fail(
          denied
            ? "Camera access was denied. Allow access in your browser settings and try again, or enter the QR code content below."
            : "The camera could not start. Check your camera and try again, or enter the QR code content below.",
        );
      }
    }
    void start();
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      stop();
    };
  }, [active]);

  return (
    <div className="console-stack">
      <div className="reception-camera">
        <video
          ref={video}
          muted
          autoPlay
          playsInline
          aria-label="Live QR scanner"
          hidden={!active}
          onError={() => {
            setActive(false);
            setError(
              "Camera preview stopped. Try again or enter the QR code content below.",
            );
          }}
        />
        {!active && (
          <div className="reception-camera-idle">
            <Icon name="scan" size={48} />
            <span>{detected ? "QR code detected" : "Scan donor QR code"}</span>
          </div>
        )}
        {active && (
          <div className="reception-camera-guide" aria-hidden="true" />
        )}
      </div>
      <p role="status" className="console-meta">
        {active
          ? "Hold the QR code inside the square. Scanning stops automatically."
          : detected
            ? "Camera stopped. Check the appointment details before receiving items."
            : "Use your camera to check the appointment."}
      </p>
      {error && <p role="alert">{error}</p>}
      <Button
        type="button"
        variant={active ? "soft" : "primary"}
        onClick={() => {
          if (active) {
            setActive(false);
            return;
          }
          onStart();
          setError("");
          setDetected(false);
          setActive(true);
        }}
      >
        {active
          ? "Stop camera"
          : detected
            ? "Scan another QR code"
            : "Start camera"}
      </Button>
    </div>
  );
}
