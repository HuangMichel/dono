"use client";
import { useEffect, useRef } from "react";
import type { Category, Season } from "@/lib/api-contracts";
import { api } from "@/lib/api";
import { TextareaField } from "@/components/ui";
import { CommandForm, text } from "./command";
export type ParsedNeed = {
  draft: {
    category?: Category;
    attributes: Record<string, unknown>;
    seasons?: Season[];
    target_quantity?: string;
    unit?: "item";
  };
  warnings: string[];
};
export function prepareNeedDraft(
  id: string,
  source: string,
  signal?: AbortSignal,
) {
  return api<ParsedNeed>(`/associations/${id}/needs/parse`, {
    method: "POST",
    body: { text: source },
    ...(signal ? { signal } : {}),
  });
}
export async function prepareNeedForReview(
  id: string,
  source: string,
  onDraft: (result: ParsedNeed, source: string) => void,
  signal: AbortSignal,
) {
  const result = await prepareNeedDraft(id, source, signal);
  if (!signal.aborted) onDraft(result, source);
}
export function NeedParser({
  id,
  onDraft,
}: {
  id: string;
  onDraft: (result: ParsedNeed, source: string) => void;
}) {
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current?.abort();
  }, []);
  return (
    <NeedParserForm
      id={id}
      onDraft={onDraft}
      getSignal={() => controller.current!.signal}
    />
  );
}
export function NeedParserForm({
  id,
  onDraft,
  getSignal,
}: {
  id: string;
  onDraft: (result: ParsedNeed, source: string) => void;
  getSignal: () => AbortSignal;
}) {
  return (
    <section className="console-panel card">
      <h2>Describe a need</h2>
      <CommandForm
        submit="Prepare draft"
        successMessage="Draft prepared. Review and confirm it below."
        onSubmit={async (data) => {
          await prepareNeedForReview(
            id,
            text(data, "source"),
            onDraft,
            getSignal(),
          );
        }}
      >
        <TextareaField
          label="What does your association need?"
          name="source"
          required
          maxLength={2000}
        />
      </CommandForm>
    </section>
  );
}
export function ParsedNeedConfirmation({ warnings }: { warnings: string[] }) {
  return (
    <div className="console-stack">
      <p role="status">
        This draft is not saved. Review the fields and enter the storage places
        per item.
      </p>
      {warnings.length > 0 && (
        <ul>
          {warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      )}
      <label className="check">
        <input name="confirm_draft" type="checkbox" required /> I checked and
        confirmed the need details.
      </label>
    </div>
  );
}
