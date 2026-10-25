import { factLabel, enumLabel } from "@/lib/ui-text";
import { Field, SelectField } from "@/components/ui";
import { fieldsForCategory, parseAttributeInput } from "@/lib/category-fields";
export function NeedFields({
  category,
  attributes = {},
}: {
  category: string;
  attributes?: Record<string, unknown>;
}) {
  return (
    <>
      {Object.entries(fieldsForCategory(category)).map(([key, options]) =>
        options ? (
          <SelectField
            key={category + key}
            name={`attribute_${key}`}
            label={factLabel(key)}
            defaultValue={
              attributes[key] == null ? "" : String(attributes[key])
            }
          >
            <option value="">Any</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o === "true" ? "Yes" : o === "false" ? "No" : enumLabel(o)}
              </option>
            ))}
          </SelectField>
        ) : (
          <Field
            key={category + key}
            name={`attribute_${key}`}
            label={`${factLabel(key)} (leave blank for any)`}
            defaultValue={
              attributes[key] == null ? "" : String(attributes[key])
            }
          />
        ),
      )}
    </>
  );
}
export function needAttributes(
  data: FormData,
  category: string,
  previous: Record<string, unknown> = {},
) {
  const attrs = { ...previous };
  for (const key of Object.keys(fieldsForCategory(category))) {
    const value = String(data.get(`attribute_${key}`) ?? "").trim();
    attrs[key] = parseAttributeInput(key, value);
  }
  return attrs;
}
