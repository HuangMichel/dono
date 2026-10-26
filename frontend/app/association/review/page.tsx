"use client";
import { useId, useRef, useState } from "react";
import { useApiPage, useApiResource } from "@/lib/api-hooks";
import type { Evidence as EvidenceDTO, Offer } from "@/lib/api-contracts";
import { Button, Chip, Field, SelectField } from "@/components/ui";
import {
  useAssociation,
  ResourceStatus,
  More,
} from "@/components/association/shell";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/labels";
import {
  enumLabel,
  indicatorLabel,
  indicatorTone,
  rankIndicators,
  safetyWarnings,
  timeAgo,
} from "@/lib/ui-text";
import { AuthPhoto } from "@/components/association/auth-photo";
import {
  Evidence,
  itemName,
  labelCorrectionApplies,
  probabilityLabel,
} from "@/components/association/evidence";
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
import "./review.css";
export default function Review() {
  const { id } = useAssociation();
  const [status, setStatus] = useState("pending_review");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const resource = useApiPage<Offer>(
    `/associations/${id}/offers?effective_state=${status}${category ? `&category=${category}` : ""}`,
  );
  const [selected, setSelected] = useState("");
  const [detailVisible, setDetailVisible] = useState(false);
  const queueHeading = useRef<HTMLHeadingElement>(null);
  const offers = resource.data.filter((o) =>
    `${itemName(o)} ${CATEGORY_LABELS[o.category]}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const offer = offers.find((o) => o.id === selected) ?? offers[0];
  return (
    <div
      className={`review-workspace${detailVisible ? " review-detail-visible" : ""}`}
    >
      <header className="review-page-heading">
        <h1>Review</h1>
        <p className="console-meta">Decisions are made by your team</p>
      </header>
      <div className="console-review restored-review review-layout">
        <section className="console-review-queue" aria-label="Offer queue">
          <div className="console-review-queue-header">
            <div className="review-queue-heading">
              <h2 ref={queueHeading} tabIndex={-1}>
                {status === "pending_review"
                  ? "Waiting for review"
                  : "Offer history"}
              </h2>
              <span className="console-meta">Newest first</span>
            </div>
            <div className="console-stack review-queue-controls">
              <SelectField
                label="Category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSelected("");
                }}
              >
                <option value="">All categories</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </SelectField>
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
                  onClick={() => {
                    setSelected(o.id);
                    setDetailVisible(true);
                    requestAnimationFrame(() =>
                      document.getElementById("review-offer-title")?.focus(),
                    );
                  }}
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
                      <QueueRisk offerId={o.id} />
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
            onBack={() => {
              setDetailVisible(false);
              requestAnimationFrame(() => queueHeading.current?.focus());
            }}
          />
        ) : (
          <section className="console-review-body console-review-detail">
            <Button
              type="button"
              variant="outline"
              className="review-back-button"
              onClick={() => {
                setDetailVisible(false);
                requestAnimationFrame(() => queueHeading.current?.focus());
              }}
            >
              ← Back to queue
            </Button>
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
    </div>
  );
}
function QueueRisk({ offerId }: { offerId: string }) {
  const evidence = useApiResource<EvidenceDTO>(`/offers/${offerId}/evidence`);
  const top = rankIndicators(
    evidence.data?.analyses.flatMap((analysis) => analysis.indicators) ?? [],
  ).find((i) => indicatorTone(i.key, i.level) !== "neutral");
  if (!top) return null;
  return (
    <Chip variant={indicatorTone(top.key, top.level)}>
      {indicatorLabel(top.key)} {Math.round((top.probability ?? 0) * 100)}%
    </Chip>
  );
}
function ReviewDetail({
  offer,
  refresh,
  onBack,
}: {
  offer: Offer;
  refresh: () => Promise<void>;
  onBack: () => void;
}) {
  const command = useCommand();
  const hintId = useId();
  const evidence = useApiResource<EvidenceDTO>(`/offers/${offer.id}/evidence`);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState("");
  const required = requiredReviewChecks(offer);
  const analyses = evidence.data?.analyses ?? [];
  const suggestedCategories = analyses
    .filter((analysis) => analysis.category !== offer.category)
    .map(
      (analysis) =>
        `${CATEGORY_LABELS[analysis.category]} (${probabilityLabel(analysis.confidence)} confidence)`,
    )
    .join(", ");
  const correctable = labelCorrectionApplies(offer, analyses);
  const restriction = offer.computed.expiry.distribution_restriction;
  const reasonRequired =
    offer.computed.manual_review_required ||
    offer.computed.expiry.required_date_checks.length > 0 ||
    safetyWarnings(analyses.flatMap((analysis) => analysis.indicators)).length >
      0 ||
    (correctable && !!checks.date_label_correction_confirmed);
  const blocker =
    evidence.loading || evidence.error
      ? "Load the evidence before approving this offer."
      : restriction
        ? `Approval is unavailable: ${enumLabel(restriction)}.`
        : required.some((key) => !checks[key])
          ? "Complete the checks above to approve."
          : reasonRequired && !reason.trim()
            ? "Add a reason to approve."
            : null;
  return (
    <section className="console-review-detail restored-review-detail">
      <Button
        type="button"
        variant="outline"
        className="review-back-button"
        onClick={onBack}
      >
        ← Back to queue
      </Button>
      <div className="restored-review-heading">
        <h2
          id="review-offer-title"
          tabIndex={-1}
          className="console-item-title"
        >
          {itemName(offer)} × {Number(offer.quantity)}
        </h2>
        <StateChip state={offer.computed.effective_state} />
      </div>
      {(offer.computed.category_mismatch ||
        evidence.data?.category_mismatch) && (
        <section
          className="notice warning review-category-alert"
          aria-label="Category needs checking"
        >
          <h3>The photo and category need checking</h3>
          <p>
            The donor selected {CATEGORY_LABELS[offer.category]}.{" "}
            {suggestedCategories
              ? `Suggested category: ${suggestedCategories}. `
              : "The analysis could not confirm this category. "}
            Check the item before making your decision.
          </p>
        </section>
      )}
      <Evidence offer={offer} resource={evidence} layout="review" />
      {offer.computed.effective_state === "pending_review" && (
        <div className="console-decision">
          <h2>Your decision</h2>
          <CommandForm
            successMessage="Staff decision recorded."
            actions={[
              { value: "refused", label: "Refuse offer", variant: "outline" },
              {
                value: "approved",
                label: "Approve offer",
                disabled: !!blocker,
                describedBy: blocker ? hintId : undefined,
              },
            ]}
            onSubmit={async (data) => {
              const decision = text(data, "intent");
              if (decision === "approved" && blocker) throw new Error(blocker);
              await command(`/offers/${offer.id}/decision`, {
                expected_revision: offer.revision,
                decision,
                ...(decision === "approved"
                  ? { intake_checks: reviewChecks(checks) }
                  : {}),
                ...(reason.trim() ? { reason: reason.trim() } : {}),
              });
              await refresh();
            }}
          >
            {[
              ...required,
              ...(correctable ? ["date_label_correction_confirmed"] : []),
            ].map((key) => (
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
              label={
                reasonRequired
                  ? "Reason (required to approve)"
                  : "Reason (optional)"
              }
              name="reason"
              maxLength={240}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {blocker && (
              <p id={hintId} className="console-meta">
                {blocker}
              </p>
            )}
          </CommandForm>
        </div>
      )}
      {offer.computed.effective_state === "approved" && (
        <CommandForm
          submit="Cancel this offer"
          submitVariant="danger"
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
