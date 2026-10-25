"use client";
import { indicatorLabel } from "@/lib/ui-text";

import Image from "next/image";
import { useState } from "react";
import { useDemo } from "@/lib/demo-context";
import {
  CATEGORY_LABELS,
  DEMO_ASSOCIATION_ID,
  DEMO_STAFF_ID,
  STATUS_LABELS,
} from "@/lib/demo-store";
import type { Donation, IntakeChecks } from "@/lib/contracts";
import { Button, Chip, EmptyState } from "@/components/ui";
import { ConsoleTitle, Feedback, Notice } from "@/components/association/shell";
import { Evidence, instant, itemName } from "@/components/association/evidence";

export default function ReviewPage() {
  const { state } = useDemo();
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState("");
  const [history, setHistory] = useState(false);
  const donations = state.donations.filter(
    (d) =>
      d.association_id === DEMO_ASSOCIATION_ID &&
      d.status !== "draft" &&
      (history || d.status === "offered") &&
      (category === "all" || d.category === category),
  );
  const donation = donations.find((d) => d.id === selected) ?? donations[0];
  return (
    <div className="console-review">
      <section className="console-review-queue">
        <div className="console-review-queue-header">
          <ConsoleTitle title="To review" detail={String(donations.length)} />
          <div
            className="console-filter-strip console-category-tabs"
            aria-label="Review category"
          >
            {[
              ["all", "All"],
              ["food", "Food"],
              ["clothes", "Clothes"],
              ["para", "Hygiene & care"],
              ["shoes", "Shoes"],
              ["furniture", "Small furniture"],
            ].map(([value, label]) => (
              <Button
                key={value}
                variant="soft"
                size="sm"
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <details style={{ marginTop: 12 }}>
            <summary className="console-meta">More filters</summary>
            <div className="console-stack" style={{ marginTop: 12 }}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={history}
                  onChange={(e) => setHistory(e.target.checked)}
                />
                Include reviewed offers
              </label>
            </div>
          </details>
        </div>
        <div className="console-review-list">
          {donations.map((d) => {
            const photo = state.photos.find((p) => p.donation_id === d.id);
            const analysis = state.analyses.find(
              (a) => a.id === d.basis_analysis_id,
            );
            const indicator = analysis?.indicators[0];
            const corrected = state.expiry_facts.some(
              (f) => f.donation_id === d.id && f.edited_by,
            );
            return (
              <Button
                key={d.id}
                variant="soft"
                aria-pressed={donation?.id === d.id}
                onClick={() => setSelected(d.id)}
              >
                {photo && (
                  <Image
                    unoptimized
                    className="console-photo"
                    src={photo.content_url}
                    alt=""
                    width={40}
                    height={40}
                  />
                )}
                <span>
                  <strong>
                    {itemName(d)} × {d.quantity}
                  </strong>
                  <span className="console-meta" style={{ display: "block" }}>
                    {d.company_name ??
                      (d.category
                        ? CATEGORY_LABELS[d.category]
                        : "Individual donor")}
                  </span>
                  {corrected ? (
                    <Chip variant="caution">Date changed</Chip>
                  ) : indicator ? (
                    <Chip
                      variant={
                        indicator.level === "high" ? "danger" : "warning"
                      }
                    >
                      {indicatorLabel(indicator.key)}
                      {indicator.probability !== undefined
                        ? ` ${new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 2 }).format(indicator.probability)}`
                        : ""}
                    </Chip>
                  ) : (
                    <Chip variant="caution">{STATUS_LABELS[d.status]}</Chip>
                  )}
                </span>
              </Button>
            );
          })}
        </div>
        {!donations.length && <EmptyState title="No offers match this view" />}
      </section>
      {donation ? (
        <ReviewDetail key={donation.id} donation={donation} />
      ) : (
        <section className="console-review-body">
          <EmptyState title="Review queue clear" />
        </section>
      )}
    </div>
  );
}

function ReviewDetail({ donation }: { donation: Donation }) {
  const { dispatch } = useDemo();
  const [revision, setRevision] = useState(donation.revision);
  const [checks, setChecks] = useState<IntakeChecks>({
    not_medicine: null,
    food_nonperishable_room_temperature: null,
    packaged_unopened: null,
  });
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState(false);
  const food = donation.category === "food";
  const packaged = food || donation.category === "para";
  const canApprove =
    checks.not_medicine === true &&
    (!food || checks.food_nonperishable_room_temperature === true) &&
    (!packaged || checks.packaged_unopened === true);
  const stale = revision !== donation.revision;
  function decide(decision: "approved" | "refused") {
    try {
      dispatch({
        type: "decision",
        id: donation.id,
        decision,
        checks,
        expected_revision: revision,
      });
      setError(false);
      setFeedback(`Offer ${decision} by Léa Martin.`);
    } catch (cause) {
      setError(true);
      setFeedback(
        cause instanceof Error
          ? cause.message
          : "The decision could not be saved.",
      );
    }
  }
  function checkbox(key: keyof IntakeChecks, label: string) {
    return (
      <label className="check">
        <input
          type="checkbox"
          checked={checks[key] === true}
          onChange={(event) =>
            setChecks({ ...checks, [key]: event.target.checked ? true : null })
          }
          disabled={donation.status !== "offered"}
        />
        {label}
      </label>
    );
  }
  return (
    <section className="console-review-detail">
      <div className="console-review-body">
        <h2 className="console-item-title">
          {itemName(donation)} × {donation.quantity}
        </h2>
        <p className="console-meta" style={{ marginTop: 4, marginBottom: 20 }}>
          {donation.category
            ? CATEGORY_LABELS[donation.category]
            : "Unknown category"}
          , {donation.company_name ?? "individual donor"}
        </p>
        <Feedback message={feedback} error={error} />
        {stale && donation.status === "offered" && (
          <Notice>
            This offer changed.{" "}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRevision(donation.revision);
                setChecks({
                  not_medicine: null,
                  food_nonperishable_room_temperature: null,
                  packaged_unopened: null,
                });
                setFeedback("");
              }}
            >
              Refresh offer
            </Button>
          </Notice>
        )}
        <Evidence donation={donation} />
        {donation.status === "offered" && (
          <fieldset className="console-checks">
            <legend>Review checklist</legend>
            {checkbox("not_medicine", "I confirm this item is not a medicine.")}
            {food &&
              checkbox(
                "food_nonperishable_room_temperature",
                "I confirm the food is non-perishable and stored at room temperature.",
              )}
            {packaged &&
              checkbox(
                "packaged_unopened",
                "I confirm the original packaging is unopened.",
              )}
          </fieldset>
        )}
      </div>
      <div className="console-decision">
        {donation.status === "offered" ? (
          <>
            <p className="console-meta">Staff decision</p>
            <div className="console-actions" style={{ marginTop: 8 }}>
              <Button
                variant="soft"
                disabled={stale}
                onClick={() => decide("refused")}
              >
                Refuse
              </Button>
              <Button
                disabled={!canApprove || stale}
                onClick={() => decide("approved")}
              >
                Approve
              </Button>
              {!canApprove && (
                <span className="console-meta">
                  Complete all intake checks.
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <Chip
              variant={donation.decision === "refused" ? "danger" : "success"}
            >
              {STATUS_LABELS[donation.status]}
            </Chip>
            {donation.decided_by && (
              <p className="console-meta" style={{ marginTop: 8 }}>
                Human decision by{" "}
                {donation.decided_by === DEMO_STAFF_ID
                  ? "Léa Martin"
                  : "association staff"}
                {donation.decided_at ? `, ${instant(donation.decided_at)}` : ""}
                .
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
