import type { Category } from "@/lib/api-contracts";
import { CATEGORY_LABELS } from "@/lib/labels";
import { categoryFields } from "@/lib/category-fields";
import { dateLabel } from "./evidence-format";
import { enumLabel, factLabel, formatCount } from "@/lib/ui-text";
export const isMissing = (value: unknown) => value == null || value === "";
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
type Fact = { path: string; key: string; value: unknown };

function flattenFacts(facts: Record<string, unknown>, prefix = ""): Fact[] {
  return Object.entries(facts).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return isRecord(value) && Object.keys(value).length > 0
      ? flattenFacts(value, path)
      : [{ path, key, value }];
  });
}
export function displayFact(
  key: string,
  value: unknown,
  category: Category,
): string {
  if (value === undefined) return "Not recorded";
  if (isMissing(value)) return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value))
    return value.length
      ? value
          .map((part) =>
            isRecord(part)
              ? Object.entries(part)
                  .map(
                    ([name, content]) =>
                      `${factLabel(name)}: ${displayFact(name, content, category)}`,
                  )
                  .join(", ")
              : String(part),
          )
          .join("; ")
      : "None recorded";
  if (isRecord(value)) return "None recorded";
  if (
    key === "category" &&
    typeof value === "string" &&
    value in CATEGORY_LABELS
  )
    return CATEGORY_LABELS[value as Category];
  if (key === "quantity") return formatCount(String(value));
  if (typeof value === "string") {
    if (["expiry_date", "opened_on"].includes(key)) return dateLabel(value);
    if (
      ["date_type", "date_precision", "readability"].includes(key) ||
      categoryFields[category][key]?.includes(value)
    )
      return enumLabel(value);
  }
  return String(value);
}
export function FactList({
  facts,
  category,
}: {
  facts: Fact[];
  category: Category;
}) {
  return (
    <dl className="console-evidence-facts evidence-fact-list">
      {facts.map((fact) => (
        <div key={fact.path}>
          <dt>{factLabel(fact.key)}</dt>
          <dd>{displayFact(fact.key, fact.value, category)}</dd>
        </div>
      ))}
    </dl>
  );
}
export function sourceFacts(facts: Record<string, unknown>) {
  return flattenFacts(facts).filter((fact) => fact.path !== "schema_version");
}
