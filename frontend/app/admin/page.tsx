"use client";
import { useState } from "react";
import { useApiPage } from "@/lib/api-hooks";
import type { Association } from "@/lib/api-contracts";
import { Button, Chip, Field } from "@/components/ui";
import { DataTable } from "@/components/ui/data-table";
import {
  ConsoleTitle,
  More,
  ResourceStatus,
} from "@/components/association/shell";
import {
  CommandForm,
  text,
  useCommand,
} from "@/components/association/command";
function submittedLabel(association: Association) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(association.created_at));
}
export default function Approvals() {
  const [status, setStatus] = useState("pending");
  const [selected, setSelected] = useState<string | null>(null);
  const resource = useApiPage<Association>(
    `/admin/associations?approval_status=${status}&limit=100`,
  );
  const command = useCommand();
  const association =
    resource.data.find((a) => a.id === selected) ?? resource.data[0] ?? null;
  const statusFilters = (
    <div className="segmented" role="group" aria-label="Approval status">
      {[
        ["pending", "Pending"],
        ["approved", "Approved"],
      ].map(([key, label]) => (
        <Button
          key={key}
          type="button"
          variant="soft"
          aria-pressed={status === key}
          onClick={() => {
            setStatus(key);
            setSelected(null);
          }}
        >
          {label}
        </Button>
      ))}
    </div>
  );
  return (
    <>
      <ConsoleTitle title="Association approvals" />
      <div className="console-columns">
        <div className="console-stack">
          <ResourceStatus
            {...resource}
            empty={!resource.loading && !resource.data.length}
          />
          <DataTable
            rows={resource.data}
            getRowId={(a) => a.id}
            getRowLabel={(a) => a.name}
            searchLabel="Search associations"
            searchText={(a) =>
              `${a.name} ${a.rna ?? ""} ${a.siret ?? ""} ${a.display_address ?? ""}`
            }
            filters={statusFilters}
            emptyMessage="No associations in this view."
            selectedRowId={selected}
            onSelectionChange={setSelected}
            columns={[
              {
                id: "name",
                label: "Association",
                sortValue: (a) => a.name,
                cell: (a) => <strong>{a.name}</strong>,
              },
              {
                id: "identifier",
                label: "Registration",
                cell: (a) => (
                  <span className="num">
                    {a.rna ?? a.siret ?? "Not provided"}
                  </span>
                ),
              },
              {
                id: "submitted",
                label: "Submitted",
                sortValue: (a) => Date.parse(a.created_at),
                cell: submittedLabel,
              },
              {
                id: "status",
                label: "Status",
                cell: (a) => (
                  <Chip
                    variant={
                      a.approval_status === "approved" ? "success" : "caution"
                    }
                  >
                    {a.approval_status === "approved" ? "Approved" : "Pending"}
                  </Chip>
                ),
              },
            ]}
            renderMobileRow={(a) => (
              <>
                <strong>{a.name}</strong>
                <p className="meta muted">
                  {a.rna ?? a.siret ?? "No identifier"}, {submittedLabel(a)}
                </p>
                <Chip
                  variant={
                    a.approval_status === "approved" ? "success" : "caution"
                  }
                >
                  {a.approval_status === "approved" ? "Approved" : "Pending"}
                </Chip>
              </>
            )}
          />
          <More
            hasMore={resource.hasMore}
            loadMore={resource.loadMore}
            loading={resource.loading}
          />
        </div>
        {association ? (
          <section className="card console-stack">
            <h2>{association.name}</h2>
            <dl className="console-evidence-facts">
              <div>
                <dt>RNA</dt>
                <dd className="num">{association.rna ?? "Not provided"}</dd>
              </div>
              <div>
                <dt>SIRET</dt>
                <dd className="num">{association.siret ?? "Not provided"}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{association.display_address ?? "No site configured"}</dd>
              </div>
              <div>
                <dt>Timezone</dt>
                <dd>{association.timezone}</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{submittedLabel(association)}</dd>
              </div>
            </dl>
            <p className="notice">
              Check the RNA or SIRET in the public register before approving.
            </p>
            {association.approval_status === "pending" ? (
              <CommandForm
                key={association.id + association.revision}
                submit="Approve association"
                successMessage="Association approved."
                onSubmit={async () => {
                  await command(
                    `/admin/associations/${association.id}/approval`,
                    {
                      expected_revision: association.revision,
                    },
                  );
                  await resource.refresh();
                }}
              >
                <label className="check">
                  <input type="checkbox" required /> I manually verified this
                  association and its registration identifier.
                </label>
              </CommandForm>
            ) : (
              <details>
                <summary>
                  Restore the original applicant as administrator
                </summary>
                <p>
                  Restore access only when the association has no active
                  administrator with an enabled account.
                </p>
                <CommandForm
                  key={association.id + association.revision}
                  submit="Restore administrator access"
                  successMessage="Administrator access restored."
                  onSubmit={async (data) => {
                    await command(
                      `/admin/associations/${association.id}/admin-recovery`,
                      {
                        expected_revision: association.revision,
                        reason: text(data, "reason"),
                      },
                    );
                    await resource.refresh();
                  }}
                >
                  <label className="check">
                    <input type="checkbox" required /> I manually verified that
                    no active administrator with an enabled account remains.
                  </label>
                  <Field
                    label="Reason for restoring access after manual verification"
                    name="reason"
                    required
                    maxLength={240}
                  />
                </CommandForm>
              </details>
            )}
          </section>
        ) : (
          <p className="console-meta">
            Select an association to verify and approve it.
          </p>
        )}
      </div>
    </>
  );
}
