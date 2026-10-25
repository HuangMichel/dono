"use client";
import { CATEGORY_LABELS } from "@/lib/labels";
import { categoryFields } from "@/lib/category-fields";
import { factLabel, enumLabel } from "@/lib/ui-text";
import { useState } from "react";
import { useApiPage } from "@/lib/api-hooks";
import type { Need } from "@/lib/api-contracts";
import { DataTable } from "@/components/ui/data-table";
import {
  NeedParser,
  ParsedNeedConfirmation,
  type ParsedNeed,
} from "@/components/association/need-parser";
import { Button, SelectField } from "@/components/ui";
import {
  ConsoleTitle,
  CategorySelect,
  useAssociation,
  ResourceStatus,
  More,
  NumberInput,
} from "@/components/association/shell";
import {
  NeedFields,
  needAttributes,
} from "@/components/association/need-fields";
import {
  CommandForm,
  text,
  useCommand,
} from "@/components/association/command";
function needDetails(n: Need) {
  return Object.entries(n.attributes)
    .filter(([, v]) => v != null)
    .map(
      ([k, v]) =>
        `${factLabel(k)}: ${typeof v === "boolean" ? (v ? "Yes" : "No") : typeof v === "string" && categoryFields[n.category][k]?.includes(v) ? enumLabel(v) : v}`,
    )
    .join(", ");
}
export default function Needs() {
  const { id, membership } = useAssociation();
  const resource = useApiPage<Need>(`/associations/${id}/needs`);
  const [editing, setEditing] = useState<Need | null>(null);
  const [category, setCategory] = useState("clothes");
  const [parsed, setParsed] = useState<{
    result: ParsedNeed;
    source: string;
    key: number;
  } | null>(null);
  const command = useCommand();
  const admin = membership.role === "assoc_admin";
  const openCount = resource.data.filter((need) => need.active).length;
  const pausedCount = resource.data.length - openCount;
  return (
    <>
      <ConsoleTitle
        title="Needs"
        detail={
          resource.loading
            ? undefined
            : `${openCount} open, ${pausedCount} paused${resource.hasMore ? ", more available" : ""}`
        }
      />
      <div className="console-columns">
        <div className="console-stack">
          <ResourceStatus {...resource} empty={!resource.data.length} />
          <DataTable
            rows={resource.data}
            pageSize={25}
            getRowId={(n) => n.id}
            getRowLabel={(n) => `${CATEGORY_LABELS[n.category]} need`}
            searchText={(n) =>
              `${n.category} ${Object.values(n.attributes).join(" ")}`
            }
            searchLabel="Search loaded needs"
            columns={[
              {
                id: "item",
                label: "Need",
                width: "34%",
                cell: (n) => (
                  <>
                    <strong>{CATEGORY_LABELS[n.category]}</strong>
                    <p className="console-meta">{needDetails(n)}</p>
                  </>
                ),
              },
              {
                id: "target",
                label: "Items needed",
                numeric: true,
                cell: (n) => n.target_quantity,
              },
              {
                id: "held",
                label: "Reserved",
                numeric: true,
                cell: (n) => n.computed.held_quantity,
              },
              {
                id: "fulfilled",
                label: "Received",
                numeric: true,
                cell: (n) => n.computed.fulfilled_quantity,
              },
              {
                id: "available",
                label: "Still needed",
                numeric: true,
                cell: (n) => n.computed.available_quantity,
              },
              {
                id: "storage",
                label: "Places per item",
                numeric: true,
                cell: (n) => n.storage_units_per_item,
              },
              {
                id: "active",
                label: "Status",
                cell: (n) => (n.active ? "Active" : "Paused"),
              },
              ...(admin
                ? [
                    {
                      id: "actions",
                      label: "Actions",
                      cell: (n: Need) => (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setParsed(null);
                            setEditing(n);
                            setCategory(n.category);
                          }}
                        >
                          Edit need
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
            renderMobileRow={(n) => (
              <>
                <strong>{CATEGORY_LABELS[n.category]}</strong>
                <p className="console-meta">{needDetails(n)}</p>
                <p>
                  {n.computed.available_quantity} still needed of{" "}
                  {n.target_quantity} target items
                </p>
                {admin && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setParsed(null);
                      setEditing(n);
                      setCategory(n.category);
                    }}
                  >
                    Edit need
                  </Button>
                )}
              </>
            )}
            emptyMessage="No needs found."
          />
          <More {...resource} />
        </div>
        <div className="console-stack">
          {admin && !editing && (
            <NeedParser
              id={id}
              onDraft={(result, source) => {
                setCategory(result.draft.category ?? "");
                setParsed({ result, source, key: Date.now() });
              }}
            />
          )}
          {admin ? (
            <section className="card">
              <h2>
                {editing
                  ? "Edit need"
                  : parsed
                    ? "Review need draft"
                    : "Create need"}
              </h2>
              <CommandForm
                key={
                  editing
                    ? `${editing.id}:${editing.revision}`
                    : `new:${parsed?.key ?? 0}`
                }
                submit="Save need"
                successMessage="Need saved."
                onSubmit={async (data) => {
                  if (parsed && data.get("confirm_draft") !== "on")
                    throw new Error(
                      "Review and confirm the need draft before saving.",
                    );
                  if (!category)
                    throw new Error("Select a category before saving.");
                  const attributes = needAttributes(
                    data,
                    category,
                    editing?.attributes ??
                      (category === parsed?.result.draft.category
                        ? parsed.result.draft.attributes
                        : undefined),
                  );
                  const common = {
                    attributes,
                    seasons: data.getAll("seasons"),
                    target_quantity: text(data, "target"),
                    storage_units_per_item: Number(text(data, "storage")),
                    active: text(data, "active") === "true",
                  };
                  await command(
                    `/associations/${id}/needs${editing ? `/${editing.id}` : ""}`,
                    editing
                      ? { ...common, expected_revision: editing.revision }
                      : {
                          ...common,
                          category,
                          unit: "item",
                          ...(parsed ? { source_text: parsed.source } : {}),
                        },
                    editing ? "PATCH" : "POST",
                  );
                  setEditing(null);
                  setParsed(null);
                  await resource.refresh();
                }}
              >
                {parsed && (
                  <ParsedNeedConfirmation warnings={parsed.result.warnings} />
                )}
                {!editing && (
                  <CategorySelect value={category} onChange={setCategory} />
                )}
                <NeedFields
                  category={category}
                  attributes={
                    editing?.attributes ??
                    (category === parsed?.result.draft.category
                      ? parsed.result.draft.attributes
                      : undefined)
                  }
                />
                <NumberInput
                  label="Target items"
                  name="target"
                  min={1}
                  value={
                    editing?.target_quantity ??
                    parsed?.result.draft.target_quantity
                  }
                />
                <NumberInput
                  label="Storage places per item"
                  name="storage"
                  min={1}
                  value={
                    editing?.storage_units_per_item ?? (parsed ? undefined : 1)
                  }
                />
                <SelectField
                  label="Status"
                  name="active"
                  defaultValue={String(editing?.active ?? true)}
                >
                  <option value="true">Active</option>
                  <option value="false">Paused</option>
                </SelectField>
                <fieldset className="console-checkbox-group">
                  <legend>
                    Seasons (leave all unchecked for year-round needs)
                  </legend>
                  {["spring", "summer", "autumn", "winter"].map((s) => (
                    <label key={s} className="check">
                      <input
                        type="checkbox"
                        name="seasons"
                        value={s}
                        defaultChecked={(
                          editing?.seasons ??
                          parsed?.result.draft.seasons ??
                          []
                        ).includes(s as never)}
                      />
                      {enumLabel(s)}
                    </label>
                  ))}
                </fieldset>
              </CommandForm>
              {editing && (
                <Button
                  variant="soft"
                  onClick={() => {
                    setEditing(null);
                    setParsed(null);
                  }}
                >
                  Create another need
                </Button>
              )}
            </section>
          ) : (
            <p>Only association administrators can change needs.</p>
          )}
        </div>
      </div>
    </>
  );
}
