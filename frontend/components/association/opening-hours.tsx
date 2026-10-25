"use client";
import { useState } from "react";
import type { HoursInterval } from "@/lib/api-contracts";
import { Button, Field, SelectField } from "@/components/ui";
export function OpeningHours({ initial }: { initial: HoursInterval[] }) {
  const [hours, setHours] = useState(initial);
  return (
    <fieldset>
      <legend>Weekly opening hours (Europe/Paris)</legend>
      <input type="hidden" name="hours" value={JSON.stringify(hours)} />
      {hours.map((h, i) => (
        <div className="row wrap" key={i}>
          <SelectField
            label="Day"
            value={h.weekday}
            onChange={(e) =>
              setHours(
                hours.map((row, j) =>
                  j === i ? { ...row, weekday: Number(e.target.value) } : row,
                ),
              )
            }
          >
            {[
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ].map((d, index) => (
              <option value={index + 1} key={d}>
                {d}
              </option>
            ))}
          </SelectField>
          <Field
            label="Opens"
            type="time"
            required
            value={h.start_local}
            onChange={(e) =>
              setHours(
                hours.map((row, j) =>
                  j === i ? { ...row, start_local: e.target.value } : row,
                ),
              )
            }
          />
          <Field
            label="Closes"
            type="time"
            required
            value={h.end_local}
            onChange={(e) =>
              setHours(
                hours.map((row, j) =>
                  j === i ? { ...row, end_local: e.target.value } : row,
                ),
              )
            }
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setHours(hours.filter((_, j) => j !== i))}
          >
            Remove opening time {i + 1}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="soft"
        onClick={() =>
          setHours([
            ...hours,
            { weekday: 1, start_local: "09:00", end_local: "12:00" },
          ])
        }
      >
        Add opening time
      </Button>
    </fieldset>
  );
}
