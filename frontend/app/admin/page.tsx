"use client";
import { DataTable } from "@/components/ui/data-table";

import { useState } from "react";
import { useDemo } from "@/lib/demo-context";
import { Button, Card, Chip, PageHeading } from "@/components/ui";
import { Feedback } from "@/components/association/shell";
import { instant } from "@/components/association/evidence";

export default function ApprovalsPage() {
  const { state, dispatch } = useDemo();
  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const associations = state.associations.filter(
    (a) => a.approval_status === filter,
  );
  const association = associations.find((a) => a.id === selected);
  function approve() {
    if (!association) return;
    try {
      dispatch({
        type: "approveAssociation",
        id: association.id,
        expected_revision: association.revision,
      });
      setError(false);
      setMessage(`${association.name} approved by N. Farhi.`);
    } catch (cause) {
      setError(true);
      setMessage(
        cause instanceof Error ? cause.message : "Approval could not be saved.",
      );
    }
  }
  return (
    <>
      <PageHeading title="Association approvals">
        <div
          className="console-filter-strip"
          aria-label="Association approval status"
        >
          {["pending", "approved"].map((status) => (
            <Button
              key={status}
              size="sm"
              variant="soft"
              aria-pressed={filter === status}
              onClick={() => {
                setFilter(status);
                setSelected(null);
              }}
            >
              {status === "pending" ? "Pending" : "Approved"}{" "}
              {
                state.associations.filter((a) => a.approval_status === status)
                  .length
              }
            </Button>
          ))}
        </div>
      </PageHeading>
      <Feedback message={message} error={error} />
      <div className="console-approval-layout">
        <div className="console-table-wrap">
          <DataTable
            rows={associations}
            getRowId={(a) => a.id}
            getRowLabel={(a) => a.name}
            searchLabel="Search associations"
            searchText={(a) =>
              `${a.name} ${a.rna ?? ""} ${a.siret ?? ""} ${a.approval_status}`
            }
            emptyMessage="No associations in this view."
            selectedRowId={selected}
            onSelectionChange={setSelected}
            columns={[
              {
                id: "name",
                label: "Association",
                sortValue: (a) => a.name,
                cell: (a) => (
                  <Button
                    variant="soft"
                    size="sm"
                    aria-pressed={association?.id === a.id}
                    onClick={() => setSelected(a.id)}
                  >
                    {a.name}
                  </Button>
                ),
              },
              {
                id: "legalReference",
                label: "RNA / SIRET",
                sortValue: (a) => a.rna ?? a.siret,
                cell: (a) => a.rna ?? a.siret ?? "Not provided",
              },
              {
                id: "created",
                label: "Submitted",
                sortValue: (a) => Date.parse(a.created_at),
                cell: (a) =>
                  new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Europe/Paris",
                    day: "numeric",
                    month: "short",
                  }).format(new Date(a.created_at)),
              },
              {
                id: "status",
                label: "Status",
                sortValue: (a) => a.approval_status,
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
          />
        </div>
        {association && (
          <aside>
            <Card className="console-panel console-stack">
              <h2>{association.name}</h2>
              <dl>
                <div>
                  <dt>RNA</dt>
                  <dd>{association.rna ?? "Not provided"}</dd>
                </div>
                <div>
                  <dt>SIRET</dt>
                  <dd>{association.siret ?? "Not provided"}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{association.display_address ?? "Not provided"}</dd>
                </div>
                {association.approved_at && (
                  <div>
                    <dt>Approved on</dt>
                    <dd>{instant(association.approved_at)}</dd>
                  </div>
                )}
              </dl>
              {association.approval_status === "pending" && (
                <>
                  <p className="console-meta">
                    Check the supplied legal reference before approval.
                  </p>
                  <Button onClick={approve}>Approve</Button>
                </>
              )}
            </Card>
          </aside>
        )}
      </div>
    </>
  );
}
