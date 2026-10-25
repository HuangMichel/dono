"use client";
import { useId, useState } from "react";
import { useApiPage } from "@/lib/api-hooks";
import type { Capacity, IntakeQuota } from "@/lib/api-contracts";
import { Button, Chip, Field, LinkButton } from "@/components/ui";
import { CapacityMeter, CapacityRanges } from "@/components/ui/capacity-meter";
import { capacityUsage } from "@/components/ui/capacity-meter-model";
import { CATEGORY_LABELS } from "@/lib/labels";
import {
  ConsoleTitle,
  useAssociation,
  ResourceStatus,
  More,
} from "@/components/association/shell";
import {
  CommandForm,
  text,
  useCommand,
} from "@/components/association/command";
import "./capacity.css";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
type Budget = "storage" | "intake";

export default function CapacityPage() {
  const { id, membership, association } = useAssociation();
  const rangesId = useId();
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string | undefined>>({});
  const command = useCommand();
  const [budget, setBudget] = useState<Budget>("storage");
  const [day, setDay] = useState(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
      new Date(),
    ),
  );
  const storage = useApiPage<Capacity>(
    `/associations/${id}/capacity?limit=100`,
  );
  const quotas = useApiPage<IntakeQuota>(
    budget === "intake"
      ? `/associations/${id}/intake-quotas?from=${day}&to=${day}&limit=100`
      : null,
  );
  const admin = membership.role === "assoc_admin";
  const resource = budget === "storage" ? storage : quotas;
  return (
    <>
      <ConsoleTitle title="Capacity" />
      <div className="capacity-workspace">
        <section
          aria-label={
            budget === "storage" ? "Storage capacity" : "Daily intake capacity"
          }
          className="capacity-budgets"
        >
          <div className="capacity-toolbar">
            <div
              className="segmented"
              role="group"
              aria-label="Capacity budget"
            >
              <Button
                variant="soft"
                disabled={saving}
                aria-pressed={budget === "storage"}
                onClick={() => setBudget("storage")}
              >
                Storage
              </Button>
              <Button
                variant="soft"
                disabled={saving}
                aria-pressed={budget === "intake"}
                onClick={() => setBudget("intake")}
              >
                Daily intake
              </Button>
            </div>
            {budget === "intake" && (
              <Field
                label="Drop-off date (Paris time)"
                type="date"
                disabled={saving}
                value={day}
                onChange={(event) => {
                  if (event.target.value) setDay(event.target.value);
                }}
              />
            )}
          </div>
          <p className="console-meta capacity-budget-description">
            {budget === "storage"
              ? "Storage places include items in stock and reservations."
              : "Daily intake counts items booked and received on this date. It is separate from storage space."}
          </p>
          <ResourceStatus {...resource} />
          {!resource.loading && !resource.error && !resource.data.length && (
            <p className="capacity-empty">
              {budget === "storage"
                ? "No storage limits configured."
                : "No daily intake limits configured for this date."}
            </p>
          )}
          <ul className="capacity-category-list">
            {budget === "storage"
              ? storage.data.map((capacity) => (
                  <BudgetRow
                    key={`storage:${capacity.category}`}
                    category={capacity.category}
                    editing={editingKey === `storage:${capacity.category}`}
                    setEditing={(open) =>
                      setEditingKey(
                        open ? `storage:${capacity.category}` : null,
                      )
                    }
                    draft={drafts[`storage:${capacity.category}`]}
                    saveDraft={(value) =>
                      setDrafts((previous) => ({
                        ...previous,
                        [`storage:${capacity.category}`]: value,
                      }))
                    }
                    command={command}
                    revision={capacity.revision}
                    limit={String(capacity.limit_storage_units)}
                    used={String(capacity.computed.occupied_storage_units)}
                    held={String(capacity.computed.reserved_storage_units)}
                    available={String(
                      capacity.computed.available_storage_units,
                    )}
                    budget="storage"
                    admin={admin}
                    saving={saving}
                    onSavingChange={setSaving}
                    associationId={id}
                    day={day}
                    refresh={storage.refresh}
                    rangesId={rangesId}
                  />
                ))
              : quotas.data.map((quota) => (
                  <BudgetRow
                    key={`intake:${day}:${quota.category}`}
                    category={quota.category}
                    editing={editingKey === `intake:${day}:${quota.category}`}
                    setEditing={(open) =>
                      setEditingKey(
                        open ? `intake:${day}:${quota.category}` : null,
                      )
                    }
                    draft={drafts[`intake:${day}:${quota.category}`]}
                    saveDraft={(value) =>
                      setDrafts((previous) => ({
                        ...previous,
                        [`intake:${day}:${quota.category}`]: value,
                      }))
                    }
                    command={command}
                    revision={quota.revision}
                    limit={quota.limit_quantity}
                    used={quota.computed.received_quantity}
                    held={quota.computed.booked_quantity}
                    available={quota.computed.available_quantity}
                    budget="intake"
                    admin={admin}
                    saving={saving}
                    onSavingChange={setSaving}
                    associationId={id}
                    day={day}
                    refresh={quotas.refresh}
                    rangesId={rangesId}
                  />
                ))}
          </ul>
          {resource.data.length > 0 && <CapacityRanges id={rangesId} />}
          <More {...resource} />
        </section>
        <aside className="capacity-hours" aria-label="Opening hours">
          <h2>Opening hours</h2>
          <p className="console-meta">Paris time</p>
          {!association.opening_hours.length ? (
            <p className="capacity-empty">Opening hours are not configured.</p>
          ) : (
            <dl className="capacity-hours-list">
              {DAYS.map((dayName, index) => {
                const intervals = association.opening_hours
                  .filter((hours) => hours.weekday === index + 1)
                  .sort((a, b) => a.start_local.localeCompare(b.start_local));
                return (
                  <div key={dayName}>
                    <dt>{dayName}</dt>
                    <dd>
                      {intervals.length
                        ? intervals.map((hours, index) => (
                            <span key={`${hours.start_local}:${index}`}>
                              {hours.start_local} to {hours.end_local}
                            </span>
                          ))
                        : "Closed"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
          {admin && (
            <LinkButton href="/association/slots" variant="outline">
              Edit opening hours
            </LinkButton>
          )}
        </aside>
      </div>
    </>
  );
}

function BudgetRow({
  category,
  editing,
  setEditing,
  draft,
  saveDraft,
  command,
  revision,
  limit,
  used,
  held,
  available,
  budget,
  admin,
  saving,
  onSavingChange,
  associationId,
  day,
  refresh,
  rangesId,
}: {
  category: Capacity["category"];
  editing: boolean;
  setEditing: (editing: boolean) => void;
  draft?: string;
  saveDraft: (value?: string) => void;
  command: ReturnType<typeof useCommand>;
  revision: string;
  limit: string;
  used: string;
  held: string;
  available: string;
  budget: Budget;
  admin: boolean;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  associationId: string;
  day: string;
  refresh: () => Promise<void>;
  rangesId: string;
}) {
  const usage = capacityUsage(Number(used), Number(held), Number(limit));
  const status =
    usage.percentage === null
      ? usage.paused
        ? "No space"
        : "Unavailable"
      : Number(available) <= 0
        ? "Full"
        : usage.percentage > 85
          ? "Almost full"
          : usage.percentage > 60
            ? "Filling up"
            : "Available";
  const number = (value: string) =>
    new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 }).format(
      Number(value),
    );
  const description =
    budget === "storage"
      ? `${number(used)} occupied, ${number(held)} reserved, ${number(available)} of ${number(limit)} places available`
      : `${number(used)} received, ${number(held)} booked, ${number(available)} of ${number(limit)} items available`;
  return (
    <li className="capacity-category-row">
      <div className="capacity-category-summary">
        <h2>{CATEGORY_LABELS[category]}</h2>
      </div>
      <div className="capacity-category-meter">
        {budget === "intake" && usage.paused ? (
          <p className="console-meta">No daily intake available.</p>
        ) : (
          <CapacityMeter
            label={`${CATEGORY_LABELS[category]} ${budget === "storage" ? "storage" : "daily intake"}`}
            inStock={used}
            reserved={held}
            limit={limit}
            description={description}
            rangesId={rangesId}
          />
        )}
      </div>
      <div className="capacity-category-actions">
        <Chip variant={usage.tone}>
          {budget === "intake" && usage.paused ? "No intake" : status}
        </Chip>
        {admin && (
          <Button
            variant="outline"
            disabled={saving}
            aria-expanded={editing}
            aria-label={`Edit ${CATEGORY_LABELS[category]} ${budget === "storage" ? "storage" : "daily intake"} limit`}
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Close editor" : "Edit limit"}
          </Button>
        )}
      </div>
      {admin && editing && (
        <div className="capacity-limit-editor">
          <CommandForm
            key={revision}
            submit="Save limit"
            submitDisabled={saving}
            successMessage="Capacity limit saved."
            onSubmit={async (data) => {
              const value = text(data, "limit");
              if (Number(value) === Number(limit)) {
                saveDraft(undefined);
                setEditing(false);
                return false;
              }
              if (saving) return false;
              saveDraft(value);
              onSavingChange(true);
              try {
                await command(
                  budget === "storage"
                    ? `/associations/${associationId}/capacity/${category}`
                    : `/associations/${associationId}/intake-quotas/${category}/${day}`,
                  budget === "storage"
                    ? {
                        expected_revision: revision,
                        storage_unit: "item_slot",
                        limit_storage_units: Number(value),
                      }
                    : {
                        expected_revision: revision,
                        unit: "item",
                        limit_quantity: value,
                      },
                  "PUT",
                );
                saveDraft(undefined);
                setEditing(false);
              } finally {
                try {
                  await refresh();
                } finally {
                  onSavingChange(false);
                }
              }
            }}
          >
            <Field
              label={`${CATEGORY_LABELS[category]}: maximum ${budget === "storage" ? "places" : "items on this date"}`}
              name="limit"
              type="number"
              disabled={saving}
              min={0}
              step={1}
              required
              defaultValue={draft ?? limit}
            />
          </CommandForm>
        </div>
      )}
    </li>
  );
}
