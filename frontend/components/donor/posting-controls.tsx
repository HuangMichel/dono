"use client";
import { useRef, useState } from "react";
import { Button, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { AuthPhoto } from "@/components/association/auth-photo";
import type { Donation, Photo } from "@/lib/api-contracts";
import { createCommandKeys } from "./api-donation";

export function PostingControls({
  donation,
  onChanged,
  allowPosting = false,
  photos = [],
}: {
  donation: Donation;
  onChanged: (donation: Donation) => void | Promise<void>;
  allowPosting?: boolean;
  photos?: Photo[];
}) {
  const [location, setLocation] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const pending = useRef(false);
  const keys = useRef(createCommandKeys());
  const posted = !!donation.posting;
  if (
    !posted &&
    (!allowPosting ||
      donation.status !== "ready" ||
      donation.computed.active_offer_id ||
      donation.computed.inventory_state !== "unreceived")
  )
    return null;
  async function command() {
    if (pending.current || (!posted && (!consent || !location.trim()))) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const action = posted ? "unposting" : "posting";
    const body = {
      expected_revision: donation.revision,
      ...(!posted ? { location: location.trim() } : {}),
    };
    try {
      const result = await api<Donation>(
        `/donations/${donation.id}/${action}`,
        {
          method: "POST",
          body,
          idempotencyKey: keys.current(
            JSON.stringify([action, donation.id, body]),
          ),
        },
      );
      await onChanged(result);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not change the posting. Check the current status and try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function checkStatus() {
    if (pending.current) return;
    pending.current = true;
    setChecking(true);
    try {
      const current = await api<Donation>(`/donations/${donation.id}`);
      await onChanged(current);
      setError("");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not check the posting. Try again.",
      );
    } finally {
      pending.current = false;
      setChecking(false);
    }
  }
  return (
    <section className="stack-sm donation-posting" aria-label="Nearby posting">
      {posted ? (
        <>
          <h2>Posted for nearby associations</h2>
          <p>
            Association staff can view your item in {donation.posting!.locality}
            .
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy || checking}
            onClick={() => void command()}
          >
            {busy ? "Removing posting…" : "Remove posting"}
          </Button>
        </>
      ) : (
        <>
          <h2>Post for nearby associations</h2>
          <p>
            Share your item photos, details and town with association staff.
            Your identity and private address stay hidden. Posting does not
            arrange a donation or drop-off.
          </p>
          <div
            className="console-photos"
            aria-label="Item photos shared with associations"
          >
            {photos
              .filter((photo) => photo.kind === "item")
              .map((photo) => (
                <AuthPhoto
                  key={photo.id}
                  photo={photo}
                  alt="Item photo shared with association staff"
                  size={160}
                />
              ))}
          </div>
          <form
            className="stack-sm"
            onSubmit={(event) => {
              event.preventDefault();
              void command();
            }}
          >
            <Field
              label="Town or postcode"
              name="posting-location"
              value={location}
              required
              minLength={3}
              maxLength={200}
              disabled={busy || checking}
              onChange={(event) => setLocation(event.target.value)}
            />
            <label className="row">
              <input
                type="checkbox"
                checked={consent}
                disabled={busy || checking}
                onChange={(event) => setConsent(event.target.checked)}
              />
              I agree to share these item photos, details and town with
              association staff.
            </label>
            <Button
              type="submit"
              disabled={
                busy || checking || !consent || location.trim().length < 3
              }
            >
              {busy ? "Posting item…" : "Post item nearby"}
            </Button>
          </form>
        </>
      )}
      {error && (
        <div role="alert" className="stack-sm">
          <p>{error}</p>
          <Button
            type="button"
            variant="outline"
            disabled={busy || checking}
            onClick={() => void checkStatus()}
          >
            {checking ? "Checking…" : "Check current posting"}
          </Button>
        </div>
      )}
    </section>
  );
}
