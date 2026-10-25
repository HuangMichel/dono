"use client";
import { useState } from "react";
import { useApiPage } from "@/lib/api-hooks";
import type { Offer } from "@/lib/api-contracts";
import { Button, Chip, Field, SelectField } from "@/components/ui";
import {
  ConsoleTitle,
  useAssociation,
  ResourceStatus,
  More,
} from "@/components/association/shell";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/labels";
import { timeAgo } from "@/lib/ui-text";
import { AuthPhoto } from "@/components/association/auth-photo";
import { Evidence, itemName } from "@/components/association/evidence";
import { ExpiryChip, StateChip } from "@/components/association/status";
import {
  CommandForm,
  text,
  useCommand,
} from "@/components/association/command";
import {
  CHECK_LABELS,
  requiredReviewChecks,
  reviewChecks,
} from "@/components/association/review-policy";
export default function Review() {
  const { id } = useAssociation();
  const [status, setStatus] = useState("pending_review");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const resource = useApiPage<Offer>(
    `/associations/${id}/offers?effective_state=${status}${category ? `&category=${category}` : ""}`,
  );
  const [selected, setSelected] = useState("");
  const offers = resource.data.filter((o) =>
    `${itemName(o)} ${CATEGORY_LABELS[o.category]}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const offer = offers.find((o) => o.id === selected) ?? offers[0];
  return (
    <div className="console-review restored-review">
      <section className="console-review-queue" aria-label="Offer queue">
        <div className="console-review-queue-header">
          <ConsoleTitle
            title={
              status === "pending_review"
                ? "Waiting for review"
                : "Offer history"
            }
          />
          <div className="console-stack">
            <div
              className="console-filter-strip restored-review-categories"
              role="group"
              aria-label="Review category"
            >
              {[["", "All"], ...Object.entries(CATEGORY_LABELS)].map(
                ([key, label]) => (
                  <Button
                    key={key}
                    type="button"
                    variant="soft"
                    size="sm"
                    aria-pressed={category === key}
                    onClick={() => {
                      setCategory(key);
                      setSelected("");
                    }}
                  >
                    {label}
                  </Button>
                ),
              )}
            </div>
            <Field
              label="Search loaded offers"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <details>
              <summary className="console-meta">Review history</summary>
              <SelectField
                label="Status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setSelected("");
                }}
              >
                {[
                  "pending_review",
                  "approved",
                  "refused",
                  "cancelled",
                  "expired",
                  "fulfilled",
                  "withdrawn",
                ].map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </SelectField>
            </details>
          </div>
          <ResourceStatus {...resource} />
        </div>
        <div className="console-review-list">
          {offers.map((o) => (
            <div
              key={o.id}
              className={`restored-review-row${offer?.id === o.id ? " is-selected" : ""}`}
            >
              <div className="restored-review-thumbnail">
                {o.evidence_snapshot.photos[0] ? (
                  <AuthPhoto
                    photo={{
                      content_url: `/api/v1/photos/${encodeURIComponent(o.evidence_snapshot.photos[0].photo_id)}/content`,
                    }}
                    alt={`Photo included in the offer for ${itemName(o)}`}
                    size={40}
                  />
                ) : (
                  <span
                    className="restored-review-photo-empty"
                    aria-hidden="true"
                  />
                )}
              </div>
              <Button
                variant="soft"
                aria-pressed={offer?.id === o.id}
                onClick={() => setSelected(o.id)}
              >
                <span>
                  <strong>
                    {itemName(o)} × {Number(o.quantity)}
                  </strong>
                  <span className="console-meta restored-review-meta">
                    {CATEGORY_LABELS[o.category]}
                    {o.created_at ? `, ${timeAgo(o.created_at)}` : ""}
                  </span>
                  <span className="restored-review-chips">
                    {o.computed.manual_review_required && (
                      <Chip variant="caution">Manual review required</Chip>
                    )}
                    {o.computed.category_mismatch && (
                      <Chip variant="warning">Category differs</Chip>
                    )}
                    <ExpiryChip expiry={o.computed.expiry} />
                  </span>
                </span>
              </Button>
            </div>
          ))}
        </div>
        {!resource.loading && !resource.error && !offers.length && (
          <p className="restored-review-empty">
            {query
              ? "No loaded offers match your search."
              : "No offers in this view."}
          </p>
        )}
        <div className="console-review-queue-header">
          <More {...resource} />
        </div>
      </section>
      {offer ? (
        <ReviewDetail
          key={offer.id + offer.revision}
          offer={offer}
          refresh={resource.refresh}
        />
      ) : (
        <section className="console-review-body">
          <p className="console-meta">
            {resource.loading
              ? "Loading offers…"
              : resource.error
                ? "Offers could not be loaded."
                : "No offers in this view."}
          </p>
        </section>
      )}
    </div>
  );
}
function ReviewDetail({
  offer,
  refresh,
}: {
  offer: Offer;
  refresh: () => Promise<void>;
}) {
  const command = useCommand();
  const [decision, setDecision] = useState("approved");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const required = requiredReviewChecks(offer);
  return (
    <section className="console-review-detail restored-review-detail">
      <div className="restored-review-heading">
        <h2 className="console-item-title">
          {itemName(offer)} × {Number(offer.quantity)}
        </h2>
        <StateChip state={offer.computed.effective_state} />
      </div>
      <Evidence offer={offer} />
      {offer.computed.effective_state === "pending_review" && (
        <div className="console-decision">
          <h2>Staff decision</h2>
          <CommandForm
            submit="Record staff decision"
            successMessage="Staff decision recorded."
            submitDisabled={
              decision === "approved" && required.some((key) => !checks[key])
            }
            onSubmit={async (data) => {
              const decision = text(data, "decision");
              if (
                decision === "approved" &&
                required.some((key) => !checks[key])
              )
                throw new Error(
                  "Complete each required staff check before approval.",
                );
              await command(`/offers/${offer.id}/decision`, {
                expected_revision: offer.revision,
                decision,
                ...(decision === "approved"
                  ? { intake_checks: reviewChecks(checks) }
                  : {}),
                ...(text(data, "reason")
                  ? { reason: text(data, "reason") }
                  : {}),
              });
              await refresh();
            }}
          >
            <SelectField
              label="Staff decision"
              name="decision"
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
            >
              <option value="approved">Approve</option>
              <option value="refused">Refuse</option>
            </SelectField>
            {[...required, "date_label_correction_confirmed"].map((key) => (
              <label className="check" key={key}>
                <input
                  type="checkbox"
                  checked={!!checks[key]}
                  onChange={(e) =>
                    setChecks({ ...checks, [key]: e.target.checked })
                  }
                />{" "}
                {CHECK_LABELS[key] ?? key}
              </label>
            ))}
            <Field
              label="Reason (required for manual review, date checks or label correction)"
              name="reason"
              maxLength={240}
            />
          </CommandForm>
        </div>
      )}
      {offer.computed.effective_state === "approved" && (
        <CommandForm
          submit="Cancel this offer"
          successMessage="Offer cancelled."
          onSubmit={async (data) => {
            await command(`/offers/${offer.id}/cancellation`, {
              expected_revision: offer.revision,
              reason: text(data, "reason"),
            });
            await refresh();
          }}
        >
          <Field
            label="Cancellation reason"
            name="reason"
            required
            maxLength={240}
          />
        </CommandForm>
      )}
    </section>
  );
}
