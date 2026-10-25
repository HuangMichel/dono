"use client";
import { PostingControls } from "./posting-controls";
import { useRef, useState } from "react";
import { Button, Card, Chip, LinkButton } from "@/components/ui";
import { api } from "@/lib/api";
import { useApiPage, useApiResource } from "@/lib/api-hooks";
import { formatCount } from "@/lib/ui-text";
import { useNotifications } from "@/components/ui/notifications";
import {
  createCommandKeys,
  type Donation,
  type Offer,
  type OfferEvent,
  itemName,
  categories,
  statusLabel,
} from "./api-donation";

/** One fetch per donation shows the current human state without loading history. */
export function useDonationStatus(donation: Donation) {
  const activeOfferId = donation.computed.active_offer_id;
  const activeOffer = useApiResource<Offer>(
    activeOfferId ? `/offers/${activeOfferId}` : null,
  );
  const summary = useApiPage<Offer>(
    activeOfferId ? null : `/donations/${donation.id}/offers?limit=1`,
  );
  const latest = activeOfferId ? activeOffer.data : summary.data[0];
  const status = activeOfferId ? activeOffer : summary;
  return {
    latest,
    status,
    effective: latest?.computed.effective_state,
    received: donation.computed.inventory_state !== "unreceived",
  };
}
export function DonationStatusChip({ donation }: { donation: Donation }) {
  const { status, effective, received } = useDonationStatus(donation);
  if (donation.posting) return <Chip>Posted nearby</Chip>;
  if (status.loading) return <span className="meta muted">Checking…</span>;
  if (status.error)
    return <span className="meta muted">Status unavailable</span>;
  return (
    <Chip
      variant={
        effective === "pending_review"
          ? "caution"
          : effective === "refused"
            ? "danger"
            : effective === "approved" || received
              ? "success"
              : "neutral"
      }
    >
      {statusLabel(
        received
          ? donation.computed.inventory_state
          : (effective ?? donation.status),
      )}
    </Chip>
  );
}
export function donationNextStep(
  donation: Donation,
): { label: string; href: string } | null {
  if (donation.computed.inventory_state !== "unreceived") return null;
  if (donation.status === "draft")
    return { label: "Continue draft", href: `/donate?id=${donation.id}` };
  if (donation.status === "withdrawn") return null;
  if (donation.computed.active_offer_id)
    return { label: "View offer", href: `/donate?id=${donation.id}` };
  return { label: "Find an association", href: `/donate?id=${donation.id}` };
}
function decisionNote(events: OfferEvent[], offerId: string | undefined) {
  const note = events.find(
    (event) =>
      event.offer_id === offerId &&
      (event.reason === "human_approved" || event.reason === "human_refused") &&
      event.note,
  );
  return note?.note ?? null;
}
export function DonationRow({
  donation,
  refresh,
  compact = false,
}: {
  donation: Donation;
  refresh: () => Promise<void>;
  compact?: boolean;
}) {
  const { notify } = useNotifications();
  const commandKey = useRef(createCommandKeys());
  const [historyOpen, setHistoryOpen] = useState(false);
  const { latest, status, effective, received } = useDonationStatus(donation);
  const offers = useApiPage<Offer>(
    historyOpen ? `/donations/${donation.id}/offers` : null,
  );
  const events = useApiPage<OfferEvent>(
    historyOpen && latest ? `/offers/${latest.id}/events?limit=10` : null,
  );
  const [busy, setBusy] = useState(false);
  async function refreshOffers() {
    await Promise.all([
      status.refresh(),
      ...(historyOpen ? [offers.refresh()] : []),
      ...(historyOpen && latest ? [events.refresh()] : []),
    ]);
  }
  async function withdraw() {
    setBusy(true);
    try {
      await api(`/donations/${donation.id}/withdrawal`, {
        method: "POST",
        body: { expected_revision: donation.revision },
        idempotencyKey: commandKey.current(
          JSON.stringify(["withdraw", donation.id, donation.revision]),
        ),
      });
      notify({ message: "Donation withdrawn.", tone: "success" });
      await refresh();
      await refreshOffers();
    } catch (e) {
      notify({
        message:
          e instanceof Error
            ? e.message
            : "Could not withdraw the donation. Try again.",
        tone: "error",
      });
      await Promise.allSettled([refresh(), refreshOffers()]);
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    setBusy(true);
    try {
      await api(`/donations/${donation.id}/restoration`, {
        method: "POST",
        body: { expected_revision: donation.revision },
        idempotencyKey: commandKey.current(
          JSON.stringify(["restore", donation.id, donation.revision]),
        ),
      });
      notify({ message: "Donation restored.", tone: "success" });
      await refresh();
      await refreshOffers();
    } catch (e) {
      notify({
        message:
          e instanceof Error
            ? e.message
            : "Could not restore the donation. Try again.",
        tone: "error",
      });
      await Promise.allSettled([refresh(), refreshOffers()]);
    } finally {
      setBusy(false);
    }
  }
  const note = decisionNote(events.data, latest?.id);
  return (
    <Card className="stack-sm donation-tracking-row">
      {!compact && (
        <div className="donation-row-summary">
          <div>
            <h2>{itemName(donation.facts)}</h2>
            <p className="meta muted">
              {formatCount(donation.facts.quantity)},{" "}
              {categories[donation.facts.category!]}
              {donation.facts.attributes.size
                ? `, size ${donation.facts.attributes.size}`
                : ""}
            </p>
          </div>
          <Chip
            variant={
              effective === "pending_review"
                ? "caution"
                : effective === "refused"
                  ? "danger"
                  : effective === "approved" || received
                    ? "success"
                    : "neutral"
            }
          >
            {statusLabel(
              received
                ? donation.computed.inventory_state
                : (effective ?? donation.status),
            )}
          </Chip>
        </div>
      )}
      {donation.facts.description && (
        <p className="item-description">{donation.facts.description}</p>
      )}

      {donation.posting && (
        <PostingControls
          donation={donation}
          onChanged={async () => {
            await refresh();
          }}
        />
      )}
      {status.loading && <p role="status">Loading offer status…</p>}
      {status.error && (
        <p role="alert">
          {status.error}{" "}
          <Button variant="outline" onClick={() => void refreshOffers()}>
            Retry status
          </Button>
        </p>
      )}
      {!status.loading && !status.error && latest?.decision && (
        <p className="notice">
          {latest.decision === "approved" ? "Approved" : "Refused"} by
          association staff
          {latest.decided_at
            ? `, ${new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Europe/Paris",
              }).format(new Date(latest.decided_at))}`
            : ""}
          .{" "}
          {latest.computed.effective_state === "approved"
            ? "Book your drop-off to finish the donation."
            : "The item stays in your donations, and you can offer it again."}
        </p>
      )}
      {note && <p className="notice">Staff note: {note}</p>}
      <div className="row wrap">
        {!status.loading &&
          !status.error &&
          !donation.computed.active_offer_id &&
          !received &&
          ["draft", "ready"].includes(donation.status) && (
            <LinkButton href={`/donate?id=${donation.id}`}>
              {donation.status === "draft"
                ? "Continue draft"
                : "Find another association"}
            </LinkButton>
          )}
        {donation.computed.active_offer_id && effective === "approved" && (
          <LinkButton href={`/booking/${donation.computed.active_offer_id}`}>
            Manage drop-off
          </LinkButton>
        )}
        {!received && donation.status !== "withdrawn" && (
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => void withdraw()}
          >
            Withdraw donation
          </Button>
        )}
        {donation.status === "withdrawn" && (
          <Button disabled={busy} onClick={() => void restore()}>
            Restore donation
          </Button>
        )}
      </div>
      {(latest || historyOpen) && (
        <details onToggle={(event) => setHistoryOpen(event.currentTarget.open)}>
          <summary>Offer history</summary>
          {historyOpen && (
            <>
              {offers.loading && <p role="status">Loading offer history…</p>}
              {offers.error && (
                <p role="alert">
                  {offers.error}{" "}
                  <Button
                    variant="outline"
                    onClick={() => void offers.refresh()}
                  >
                    Retry history
                  </Button>
                </p>
              )}
              {offers.data.map((o) => (
                <p key={o.id}>
                  {statusLabel(o.computed.effective_state)}
                  {o.decision
                    ? `, staff decision: ${statusLabel(o.decision)}`
                    : ""}
                </p>
              ))}
              {offers.hasMore && (
                <Button
                  variant="outline"
                  disabled={offers.loading}
                  onClick={() => void offers.loadMore()}
                >
                  Load earlier offers
                </Button>
              )}
            </>
          )}
        </details>
      )}
    </Card>
  );
}
