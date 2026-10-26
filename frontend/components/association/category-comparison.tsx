import type { Category } from "@/lib/api-contracts";
import { CATEGORY_LABELS } from "@/lib/labels";
import { probabilityLabel } from "./evidence-format";
import "./category-comparison.css";

type Score = { category: Category; value: number };
const ITEM_FACT_ROOTS = new Set(["attributes", "dates", "expiry"]);
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function categoryScores(extracted: Record<string, unknown>): Score[] | null {
  const candidates: Score[][] = [];
  function visit(value: Record<string, unknown>) {
    const entries = Object.entries(value);
    const validMap =
      entries.length >= 2 &&
      entries.every(
        ([key, score]) =>
          Object.hasOwn(CATEGORY_LABELS, key) &&
          typeof score === "number" &&
          Number.isFinite(score) &&
          score >= 0 &&
          score <= 1,
      );
    if (validMap) {
      candidates.push(
        entries.map(([category, score]) => ({
          category: category as Category,
          value: score as number,
        })),
      );
      return;
    }
    for (const [key, child] of entries) {
      if (ITEM_FACT_ROOTS.has(key)) continue;
      if (isRecord(child)) visit(child);
    }
  }
  visit(extracted);
  if (candidates.length !== 1) return null;
  return candidates[0].sort((a, b) => b.value - a.value);
}

/** Only returned, unambiguous category maps are charted. Scores are never normalised. */
export function CategoryComparison({
  extracted,
}: {
  extracted: Record<string, unknown>;
}) {
  const scores = categoryScores(extracted);
  if (!scores) return null;
  return (
    <figure className="category-comparison">
      <figcaption>Category comparison</figcaption>
      <ul aria-label="Returned category suggestions">
        {scores.map(({ category, value }) => (
          <li key={category}>
            <div className="category-comparison-label">
              <span>{CATEGORY_LABELS[category]}</span>
              <span>{probabilityLabel(value)}</span>
            </div>
            <div className="category-comparison-track" aria-hidden="true">
              <span style={{ width: `${value * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="console-meta">
        These are category suggestions, not approval decisions.
      </p>
    </figure>
  );
}
