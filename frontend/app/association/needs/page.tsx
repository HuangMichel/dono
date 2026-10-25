"use client";
import { enumLabel } from "@/lib/ui-text";
import { DataTable } from "@/components/ui/data-table";

import { Button, Chip, Field, SelectField } from "@/components/ui";

import { useRef, useState, type FormEvent } from "react";
import type {
  Category,
  Need,
  NeedInput,
  NeedDraft,
  Season,
} from "@/lib/contracts";
import { useDemo } from "@/lib/demo-context";
import { NeedVoiceInput } from "@/components/association/need-voice-input";
import {
  CATEGORY_LABELS,
  DEMO_ASSOCIATION_ID,
  isNeedCriteriaLocked,
  getNeeds,
} from "@/lib/demo-store";
import {
  CategorySelect,
  ConsoleTitle,
  Feedback,
} from "@/components/association/shell";

export default function NeedsPage() {
  const { state, dispatch } = useDemo();
  const [editing, setEditing] = useState<Need | null>(null);
  const [category, setCategory] = useState<Category>("clothes");
  const [item, setItem] = useState("");
  const [size, setSize] = useState("");
  const [target, setTarget] = useState("12");
  const [season, setSeason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState(false);
  const [draftSource, setDraftSource] = useState<string | null>(null);
  const [voiceStatusVersion, setVoiceStatusVersion] = useState(0);
  const formTitle = useRef<HTMLHeadingElement>(null);
  const needs = getNeeds(state, DEMO_ASSOCIATION_ID);
  const locked = editing ? isNeedCriteriaLocked(state, editing.id) : false;
  function resetForm() {
    setVoiceStatusVersion((current) => current + 1);
    setEditing(null);
    setCategory("clothes");
    setItem("");
    setSize("");
    setTarget("12");
    setSeason("");
    setDraftSource(null);
  }
  function loadDraft(result: NeedDraft) {
    resetForm();
    setCategory(result.draft.category ?? "clothes");
    setItem(String(result.draft.attributes?.product ?? ""));
    setSize(String(result.draft.attributes?.size ?? ""));
    setTarget(result.draft.target_quantity ?? "");
    setSeason(result.draft.seasons?.[0] ?? "");
    setDraftSource(result.source_text);
    setError(false);
    setFeedback("");
    requestAnimationFrame(() => formTitle.current?.focus());
  }
  function selectNeed(id: string | null) {
    if (!id) {
      resetForm();
      setFeedback("");
      return;
    }
    const need = needs.find((need) => need.id === id);
    if (need) edit(need);
  }
  function edit(need: Need) {
    setVoiceStatusVersion((current) => current + 1);
    setDraftSource(null);
    setError(false);
    setEditing(need);
    setCategory(need.category);
    setItem(String(need.attributes.type ?? need.attributes.product ?? ""));
    setSize(String(need.attributes.size ?? ""));
    setTarget(need.target_quantity);
    setSeason(need.seasons?.[0] ?? "");
    setFeedback("");
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (
        (!locked && !item.trim()) ||
        !/^\d+$/.test(target) ||
        Number(target) < 1 ||
        Number(target) > 999999999
      )
        throw new Error("Enter an item and a positive whole-number target.");
      const input: NeedInput = {
        category,
        attributes:
          locked && editing
            ? editing.attributes
            : {
                product: item.trim(),
                ...(size.trim() ? { size: size.trim() } : {}),
              },
        seasons:
          locked && editing
            ? editing.seasons
            : season
              ? [season as Season]
              : null,
        target_quantity: target,
        unit: "item",
        active: editing?.active ?? true,
        source_text: editing?.source_text ?? draftSource,
      };
      dispatch(
        editing
          ? {
              type: "need",
              id: editing.id,
              patch: { ...input, expected_revision: editing.revision },
            }
          : { type: "need", id: crypto.randomUUID(), input },
      );
      setError(false);
      setFeedback(
        editing ? "Need updated in the demo." : "Need published in the demo.",
      );
      resetForm();
    } catch (cause) {
      setError(true);
      setFeedback(
        cause instanceof Error ? cause.message : "The need could not be saved.",
      );
    }
  }
  function toggle(need: Need) {
    try {
      dispatch({
        type: "need",
        id: need.id,
        patch: { active: !need.active, expected_revision: need.revision },
      });
      // Rebase only our successful status change. Preserve the unsaved form values
      // and do not mask an edit that was already stale before this action.
      setEditing((current) =>
        current?.id === need.id && current.revision === need.revision
          ? {
              ...current,
              active: !need.active,
              revision: String(BigInt(need.revision) + 1n),
            }
          : current,
      );
      setError(false);
      setFeedback(need.active ? "Need paused." : "Need resumed.");
    } catch (cause) {
      setError(true);
      setFeedback(
        cause instanceof Error
          ? cause.message
          : "The need could not be changed.",
      );
    }
  }
  return (
    <>
      <ConsoleTitle
        title="Needs"
        detail={`${needs.filter((n) => n.active).length} open, ${needs.filter((n) => !n.active).length} paused`}
      />
      <Feedback message={feedback} error={error} />
      <NeedVoiceInput
        onDraft={loadDraft}
        disabled={!!editing}
        statusResetKey={voiceStatusVersion}
      />
      <div className="console-columns">
        <div className="console-table-wrap">
          <DataTable
            rows={needs}
            selectedRowId={editing?.id ?? null}
            onSelectionChange={selectNeed}
            getRowId={(need) => need.id}
            getRowLabel={(need) =>
              String(need.attributes.type ?? need.attributes.product ?? "Item")
            }
            searchLabel="Search needs"
            searchText={(need) =>
              `${need.attributes.type ?? ""} ${need.attributes.product ?? ""} ${need.attributes.size ?? ""} ${CATEGORY_LABELS[need.category]} ${need.active ? "Open" : "Paused"}`
            }
            emptyMessage="No needs match this view."
            columns={[
              {
                id: "item",
                label: "Need",
                sortValue: (need) =>
                  String(
                    need.attributes.type ?? need.attributes.product ?? "Item",
                  ),
                cell: (need) => {
                  const size = need.attributes.size
                    ? `Size ${need.attributes.size}`
                    : ["clothes", "shoes"].includes(need.category)
                      ? "Size not specified"
                      : null;
                  const description = [
                    size,
                    need.seasons?.map(enumLabel).join(", "),
                  ]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <>
                      <strong>
                        {String(
                          need.attributes.type ??
                            need.attributes.product ??
                            "Item",
                        )}
                      </strong>
                      {description && (
                        <p className="console-meta">{description}</p>
                      )}
                    </>
                  );
                },
              },
              {
                id: "category",
                label: "Category",
                sortValue: (need) => CATEGORY_LABELS[need.category],
                cell: (need) => CATEGORY_LABELS[need.category],
              },
              {
                id: "target",
                label: "Received / target",
                sortValue: (need) => Number(need.target_quantity),
                cell: (need) => (
                  <>
                    {need.computed.fulfilled} / {need.target_quantity}
                    <p className="console-meta">
                      {need.computed.pending_hold} reserved
                    </p>
                  </>
                ),
              },
              {
                id: "status",
                label: "Status",
                sortValue: (need) => (need.active ? "Open" : "Paused"),
                cell: (need) => (
                  <Chip variant={need.active ? "success" : "neutral"}>
                    {need.active ? "Open" : "Paused"}
                  </Chip>
                ),
              },
              {
                id: "actions",
                label: "Actions",
                cell: (need) => (
                  <div className="console-actions">
                    <Button variant="outline" onClick={() => toggle(need)}>
                      {need.active ? "Pause" : "Resume"}
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </div>
        <form className="card console-panel console-stack" onSubmit={save}>
          <h2 ref={formTitle} tabIndex={-1}>
            {editing
              ? "Edit need"
              : draftSource !== null
                ? "Review sample AI draft"
                : "Add a need"}
          </h2>
          {draftSource !== null && (
            <div className="need-draft-review">
              <Chip variant="caution">Sample draft, not live AI</Chip>
              <p className="console-meta">
                Review every field. Nothing is published until you confirm and
                submit.
              </p>
              <details>
                <summary>Source description</summary>
                <blockquote>{draftSource}</blockquote>
              </details>
            </div>
          )}
          <p className="console-meta">
            Matching criteria are locked after an approval or receipt. Pause the
            old need and create a new one to change them.
          </p>
          <fieldset
            disabled={!!locked}
            style={{ border: 0, padding: 0, margin: 0 }}
            className="console-stack"
          >
            <Field
              label="Item"
              required
              value={item}
              onChange={(e) => setItem(e.target.value)}
              maxLength={120}
            />
            <CategorySelect
              value={category}
              onChange={(value) => setCategory(value as Category)}
            />
            <Field
              label="Size, optional"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              maxLength={30}
            />
            <SelectField
              label="Season"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            >
              <option value="">All seasons</option>
              {["spring", "summer", "autumn", "winter"].map((s) => (
                <option key={s} value={s}>
                  {enumLabel(s)}
                </option>
              ))}
            </SelectField>
          </fieldset>
          <Field
            label="Target, items"
            required
            type="number"
            min="1"
            max="999999999"
            step="1"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <Button variant="primary" type="submit">
            {editing
              ? "Save need"
              : draftSource !== null
                ? "Confirm and publish need"
                : "Publish need"}
          </Button>
          {(editing || draftSource !== null) && (
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                resetForm();
                setFeedback("");
                setError(false);
              }}
            >
              {editing ? "Cancel editing" : "Discard sample draft"}
            </Button>
          )}
        </form>
      </div>
    </>
  );
}
