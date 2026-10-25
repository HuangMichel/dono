"use client";
import { useState } from "react";
import { useApiPage } from "@/lib/api-hooks";
import type { Capacity, IntakeQuota } from "@/lib/api-contracts";
import { Field } from "@/components/ui";
import { CapacityMeter } from "@/components/ui/capacity-meter";
import { CATEGORY_LABELS } from "@/lib/labels";
import {
  ConsoleTitle,
  useAssociation,
  ResourceStatus,
  More,
  NumberInput,
} from "@/components/association/shell";
import {
  CommandForm,
  text,
  useCommand,
} from "@/components/association/command";
import "./capacity.css";
export default function CapacityPage() {
  const { id, membership } = useAssociation();
  const [day, setDay] = useState(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Paris",
    }).format(new Date()),
  );
  const storage = useApiPage<Capacity>(
    `/associations/${id}/capacity?limit=100`,
  );
  const quotas = useApiPage<IntakeQuota>(
    `/associations/${id}/intake-quotas?from=${day}&to=${day}&limit=100`,
  );
  const command = useCommand();
  const admin = membership.role === "assoc_admin";
  return (
    <>
      <ConsoleTitle title="Storage and daily intake" />
      <section className="card">
        <h2>Storage capacity</h2>
        <ResourceStatus {...storage} />
        {!storage.loading && !storage.error && !storage.data.length && (
          <p>No storage limits configured.</p>
        )}
        <ul className="capacity-category-list">
          {storage.data.map((capacity) => (
            <li key={capacity.category}>
              <CapacityMeter
                label={CATEGORY_LABELS[capacity.category]}
                inStock={String(capacity.computed.occupied_storage_units)}
                reserved={String(capacity.computed.reserved_storage_units)}
                limit={String(capacity.limit_storage_units)}
                description={`${capacity.computed.occupied_storage_units} occupied, ${capacity.computed.reserved_storage_units} reserved, ${capacity.computed.available_storage_units} available places`}
              />
              {admin && (
                <CommandForm
                  key={capacity.category + capacity.revision}
                  submit="Save storage limit"
                  successMessage="Storage limit saved."
                  onSubmit={async (data) => {
                    await command(
                      `/associations/${id}/capacity/${capacity.category}`,
                      {
                        expected_revision: capacity.revision,
                        storage_unit: "item_slot",
                        limit_storage_units: Number(text(data, "limit")),
                      },
                      "PUT",
                    );
                    await storage.refresh();
                  }}
                >
                  <NumberInput
                    label="Maximum storage places"
                    name="limit"
                    value={capacity.limit_storage_units}
                  />
                </CommandForm>
              )}
            </li>
          ))}
        </ul>
        <More {...storage} />
      </section>
      <section className="card">
        <h2>Daily intake</h2>
        <p className="console-meta">
          Daily intake is a separate budget from storage places.
        </p>
        <Field
          label="Drop-off date (Europe/Paris)"
          type="date"
          value={day}
          onChange={(e) => {
            if (e.target.value) setDay(e.target.value);
          }}
        />
        <ResourceStatus {...quotas} />
        {!quotas.loading && !quotas.error && !quotas.data.length && (
          <p>No daily intake limits configured for this date.</p>
        )}
        <ul className="capacity-category-list">
          {quotas.data.map((quota) => (
            <li key={quota.category}>
              <p>
                <strong>{CATEGORY_LABELS[quota.category]}</strong>
              </p>
              <p className="console-meta">
                Booked {quota.computed.booked_quantity}, received{" "}
                {quota.computed.received_quantity}, available{" "}
                {quota.computed.available_quantity} items of{" "}
                {quota.limit_quantity}
              </p>
              {admin && (
                <CommandForm
                  key={quota.category + day + quota.revision}
                  submit="Save daily intake limit"
                  successMessage="Daily intake limit saved."
                  onSubmit={async (data) => {
                    await command(
                      `/associations/${id}/intake-quotas/${quota.category}/${day}`,
                      {
                        expected_revision: quota.revision,
                        unit: "item",
                        limit_quantity: text(data, "limit"),
                      },
                      "PUT",
                    );
                    await quotas.refresh();
                  }}
                >
                  <NumberInput
                    label="Maximum items on this date"
                    name="limit"
                    value={quota.limit_quantity}
                  />
                </CommandForm>
              )}
            </li>
          ))}
        </ul>
        <More {...quotas} />
      </section>
    </>
  );
}
