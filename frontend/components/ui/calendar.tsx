"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button, Icon } from "@/components/ui";
import { parisDay } from "@/lib/booking-availability";
import { calendarMonth, shiftDay, shiftMonth } from "./calendar-model";
import "./calendar.css";

// An empty initial snapshot keeps server markup and the first browser render identical.
export function useParisClock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return { now, today: now === null ? "" : parisDay(new Date(now)) };
}
export function Calendar({
  selected,
  onSelect,
  today,
  label = "Choose a date",
  renderDay,
  dayDescription,
  month: controlledMonth,
  onMonthChange,
}: {
  month?: string;
  onMonthChange?: (month: string) => void;
  selected: string;
  onSelect: (date: string) => void;
  today: string;
  label?: string;
  renderDay?: (date: string) => ReactNode;
  dayDescription?: (date: string) => string;
}) {
  const [view, setView] = useState("");
  const [focusDay, setFocusDay] = useState("");
  const heading = useId();
  const help = useId();
  const root = useRef<HTMLDivElement>(null);
  const month =
    controlledMonth || view || selected.slice(0, 7) || today.slice(0, 7);
  function changeMonth(next: string) {
    setView(next);
    if (next !== month) onMonthChange?.(next);
  }
  if (!month) return <p aria-busy="true">Loading calendar…</p>;
  const [year, index] = month.split("-").map(Number);
  const cells = calendarMonth(year, index - 1);
  const dateLabel = (day: string) =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${day}T12:00:00Z`));
  const activeDay = focusDay.startsWith(month)
    ? focusDay
    : selected.startsWith(month)
      ? selected
      : `${month}-01`;
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, day: string) {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    let next: string;
    if (event.key in offsets) next = shiftDay(day, offsets[event.key]);
    else if (event.key === "Home" || event.key === "End") {
      const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
      next = shiftDay(day, event.key === "Home" ? -weekday : 6 - weekday);
    } else return;
    event.preventDefault();
    setFocusDay(next);
    changeMonth(next.slice(0, 7));
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)
        ?.focus(),
    );
  }
  return (
    <section className="shared-calendar" aria-label={label} ref={root}>
      <div className="shared-calendar-header">
        <h2 id={heading} aria-live="polite">
          {new Intl.DateTimeFormat("en-GB", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(Date.UTC(year, index - 1, 1)))}
        </h2>
        <div className="shared-calendar-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Previous month"
            onClick={() => {
              changeMonth(shiftMonth(month, -1));
              setFocusDay("");
            }}
          >
            <Icon name="chevron-left" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              changeMonth(today.slice(0, 7));
              setFocusDay(today);
              onSelect(today);
            }}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Next month"
            onClick={() => {
              changeMonth(shiftMonth(month, 1));
              setFocusDay("");
            }}
          >
            <Icon name="chevron-right" />
          </Button>
        </div>
      </div>
      <div
        className="shared-calendar-grid"
        role="group"
        aria-labelledby={heading}
        aria-describedby={help}
      >
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span
            className="shared-calendar-weekday"
            aria-hidden="true"
            key={day}
          >
            {day}
          </span>
        ))}
        {cells.map((day, i) =>
          day ? (
            <button
              type="button"
              key={day}
              data-day={day}
              className="shared-calendar-day"
              aria-current={day === today ? "date" : undefined}
              aria-pressed={day === selected}
              aria-label={`${dateLabel(day)}${dayDescription ? `, ${dayDescription(day)}` : ""}`}
              tabIndex={day === activeDay ? 0 : -1}
              onFocus={() => setFocusDay(day)}
              onClick={() => onSelect(day)}
              onKeyDown={(event) => keyboard(event, day)}
            >
              <span>{Number(day.slice(-2))}</span>
              {renderDay && (
                <span className="shared-calendar-detail" aria-hidden="true">
                  {renderDay(day)}
                </span>
              )}
            </button>
          ) : (
            <span key={`empty-${i}`} aria-hidden="true" />
          ),
        )}
      </div>
      <p id={help} className="sr-only">
        Use arrow keys to move between dates. Press Enter to select.
      </p>
    </section>
  );
}
