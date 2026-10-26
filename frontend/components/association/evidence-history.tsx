import type { Category, DonationEdit } from "@/lib/api-contracts";
import { CATEGORY_LABELS } from "@/lib/labels";
import { enumLabel, factLabel } from "@/lib/ui-text";
import { instant } from "./evidence-format";
import { isRecord, sourceFacts, FactList, displayFact } from "./evidence-facts";
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return (
      a.length === b.length &&
      a.every((value, index) => sameValue(value, b[index]))
    );
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => Object.hasOwn(b, key) && sameValue(a[key], b[key]))
    );
  }
  return false;
}
function snapshotCategory(
  snapshot: Record<string, unknown>,
  fallback: Category,
): Category {
  return typeof snapshot.category === "string" &&
    snapshot.category in CATEGORY_LABELS
    ? (snapshot.category as Category)
    : fallback;
}
function ChangedFacts({
  edit,
  category,
}: {
  edit: DonationEdit;
  category: Category;
}) {
  const comparable = (snapshot: Record<string, unknown>) =>
    sourceFacts(snapshot).map((fact) => ({
      ...fact,
      path: fact.path.replace(/^dates\./, "expiry."),
    }));
  const before = comparable(edit.before_snapshot);
  const after = comparable(edit.after_snapshot);
  const previous = new Map(before.map((fact) => [fact.path, fact]));
  const next = new Map(after.map((fact) => [fact.path, fact]));
  const paths = [...new Set([...previous.keys(), ...next.keys()])];
  const empty = (value: unknown) =>
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (isRecord(value) && Object.keys(value).length === 0);
  const changes = paths.filter((path) => {
    const oldValue = previous.get(path)?.value;
    const newValue = next.get(path)?.value;
    if (empty(oldValue) && empty(newValue)) return false;
    return !sameValue(oldValue, newValue);
  });
  return changes.length > 0 ? (
    <dl className="evidence-changes">
      {changes.map((path) => {
        const oldFact = previous.get(path);
        const newFact = next.get(path);
        const key = (newFact ?? oldFact)!.key;
        return (
          <div key={path}>
            <dt>{factLabel(key)}</dt>
            <dd>
              <span>
                <small>Previous</small>
                {oldFact
                  ? displayFact(
                      key,
                      oldFact.value,
                      snapshotCategory(edit.before_snapshot, category),
                    )
                  : "Not recorded"}
              </span>
              <span>
                <small>New</small>
                {newFact
                  ? displayFact(
                      key,
                      newFact.value,
                      snapshotCategory(edit.after_snapshot, category),
                    )
                  : "Removed"}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  ) : (
    <p className="console-meta">No item details changed.</p>
  );
}
export function ItemHistory({
  edits,
  category,
}: {
  edits: DonationEdit[];
  category: Category;
}) {
  return (
    <details className="evidence-disclosure evidence-history">
      <summary>Item changes before this offer · {edits.length}</summary>
      <ol>
        {edits.map((edit) => (
          <li key={edit.id}>
            <div className="evidence-history-event">
              <strong>
                {edit.change_kind === "created"
                  ? "Item created"
                  : enumLabel(edit.change_kind)}
              </strong>
              <time dateTime={edit.created_at}>{instant(edit.created_at)}</time>
            </div>
            {edit.change_kind !== "created" && (
              <ChangedFacts edit={edit} category={category} />
            )}
            {edit.from_state !== edit.to_state && edit.to_state && (
              <p className="console-meta">
                Item status:{" "}
                {edit.from_state ? `${enumLabel(edit.from_state)} to ` : ""}
                {enumLabel(edit.to_state)}
              </p>
            )}
            <details className="evidence-disclosure">
              <summary>Full snapshots</summary>
              {Object.keys(edit.before_snapshot).length > 0 && (
                <section>
                  <h3>Before change</h3>
                  <FactList
                    facts={sourceFacts(edit.before_snapshot)}
                    category={snapshotCategory(edit.before_snapshot, category)}
                  />
                </section>
              )}
              <section>
                <h3>After change</h3>
                <FactList
                  facts={sourceFacts(edit.after_snapshot)}
                  category={snapshotCategory(edit.after_snapshot, category)}
                />
              </section>
            </details>
          </li>
        ))}
      </ol>
    </details>
  );
}
