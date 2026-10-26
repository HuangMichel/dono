import type { Analysis, Indicator } from "@/lib/api-contracts";
import { categoryFields } from "@/lib/category-fields";
import { Chip } from "@/components/ui";
import {
  enumLabel,
  indicatorLabel,
  indicatorTone,
  rankIndicators,
} from "@/lib/ui-text";
import { probabilityLabel } from "./evidence-format";
import { CategoryComparison } from "./category-comparison";
import {
  isMissing,
  sourceFacts,
  FactList,
  displayFact,
} from "./evidence-facts";

const PROVIDERS: Record<string, string> = {
  openai: "OpenAI",
  jev: "Jev",
  hybrid: "OpenAI and Jev",
};
const FACT_ROOTS = new Set([
  "name",
  "description",
  "category",
  "quantity",
  "unit",
  "attributes",
  "dates",
  "expiry",
  "expiry_date",
  "date_type",
  "raw_label",
  "pao_months",
  "opened_on",
  "readability",
  "date_precision",
]);
function isItemFact(path: string, analysis: Analysis) {
  const root = path.split(".")[0];
  return (
    FACT_ROOTS.has(root) ||
    Object.hasOwn(categoryFields[analysis.category], root)
  );
}
function ExtractedFacts({
  analysis,
  dateRelevant,
}: {
  analysis: Analysis;
  dateRelevant: boolean;
}) {
  const facts = sourceFacts(analysis.extracted).filter((fact) =>
    isItemFact(fact.path, analysis),
  );
  // Date readability and precision describe uncertainty, even without a date value.
  const actualDate = facts.some(
    (fact) =>
      ["expiry_date", "opened_on", "raw_label", "pao_months"].includes(
        fact.key,
      ) && !isMissing(fact.value),
  );
  const unavailable = (fact: (typeof facts)[number]) =>
    isMissing(fact.value) ||
    (!dateRelevant &&
      !actualDate &&
      ["readability", "date_precision"].includes(fact.key) &&
      fact.value === "unknown");
  const available = facts.filter((fact) => !unavailable(fact));
  const missing = facts.filter(unavailable);
  const uncertainDate =
    (dateRelevant || actualDate) &&
    available.some(
      (fact) =>
        ["readability", "date_precision"].includes(fact.key) &&
        ["unknown", "unreadable"].includes(String(fact.value)),
    );
  return (
    <section className="evidence-extracted">
      <h3>Information extracted</h3>
      {uncertainDate && (
        <p className="notice caution">
          The printed date is unclear or incomplete. Check the label photo.
        </p>
      )}
      {available.length ? (
        <FactList facts={available} category={analysis.category} />
      ) : (
        <p className="console-meta">
          No information extracted. Review the photos manually.
        </p>
      )}
      {missing.length > 0 && (
        <details className="evidence-disclosure">
          <summary>Information not extracted · {missing.length}</summary>
          <FactList facts={missing} category={analysis.category} />
        </details>
      )}
    </section>
  );
}
function isAssessed(indicator: Indicator) {
  return (
    !isMissing(indicator.value) ||
    indicator.probability != null ||
    indicator.level != null
  );
}
function assessment(indicator: Indicator) {
  const parts: string[] = [];
  if (indicator.level) parts.push(`${enumLabel(indicator.level)} likelihood`);
  if (indicator.probability != null)
    parts.push(probabilityLabel(indicator.probability));
  if (parts.length) return parts.join(" · ");
  if (typeof indicator.value === "boolean")
    return indicator.value ? "Yes" : "No";
  return enumLabel(String(indicator.value));
}
export function AnalysisDetails({
  analysis,
  dateRelevant,
}: {
  analysis: Analysis;
  dateRelevant: boolean;
}) {
  const assessed = rankIndicators(analysis.indicators).filter(isAssessed);
  const unassessed = analysis.indicators.filter(
    (indicator) => !isAssessed(indicator),
  );
  return (
    <>
      <CategoryComparison extracted={analysis.extracted} />
      {assessed.length > 0 ? (
        <ul
          className="console-evidence-indicators"
          aria-label="Indicators returned"
        >
          {assessed.map((indicator, index) => (
            <li key={index}>
              <span>{indicatorLabel(indicator.key)}</span>
              <Chip variant={indicatorTone(indicator.key, indicator.level)}>
                {assessment(indicator)}
              </Chip>
            </li>
          ))}
        </ul>
      ) : (
        <p className="console-meta">
          No indicators assessed. Review the item manually.
        </p>
      )}
      {unassessed.length > 0 && (
        <details className="evidence-disclosure">
          <summary>Not assessed · {unassessed.length}</summary>
          <p className="console-meta">
            These indicators have no result. This does not mean that no issue
            was detected.
          </p>
          <ul className="evidence-unassessed">
            {unassessed.map((indicator, index) => (
              <li key={index}>{indicatorLabel(indicator.key)}</li>
            ))}
          </ul>
        </details>
      )}
      <ExtractedFacts analysis={analysis} dateRelevant={dateRelevant} />
      <details className="evidence-disclosure evidence-technical">
        <summary>Analysis technical details</summary>
        <dl className="console-evidence-facts evidence-fact-list">
          <div>
            <dt>Provider</dt>
            <dd>{PROVIDERS[analysis.provider] ?? analysis.provider}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{analysis.model}</dd>
          </div>
        </dl>
        <FactList
          facts={sourceFacts(analysis.extracted).filter(
            (fact) => !isItemFact(fact.path, analysis),
          )}
          category={analysis.category}
        />
        {analysis.indicators.length > 0 && (
          <ul className="evidence-raw-indicators">
            {analysis.indicators.map((indicator, index) => (
              <li key={index}>
                <strong>{indicatorLabel(indicator.key)}</strong>
                <span>
                  Raw value:{" "}
                  {displayFact("value", indicator.value, analysis.category)}
                </span>
                <span>
                  Probability:{" "}
                  {indicator.probability == null
                    ? "Not assessed"
                    : probabilityLabel(indicator.probability)}
                </span>
                <span>
                  Level:{" "}
                  {indicator.level
                    ? enumLabel(indicator.level)
                    : "Not assessed"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </>
  );
}
