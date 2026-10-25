"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./notifications.css";

type NotificationInput = {
  message: string;
  tone?: "success" | "error" | "info";
};
type Notification = NotificationInput & {
  id: number;
  tone: "success" | "error" | "info";
};
const NotificationContext = createContext<{
  notify: (input: NotificationInput) => void;
} | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("NotificationProvider required");
  return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const sequence = useRef(0);
  const notify = useCallback(
    ({ message, tone = "success" }: NotificationInput) => {
      const notification = { id: ++sequence.current, message, tone };
      setNotifications((current) => [...current, notification].slice(-3));
    },
    [],
  );
  const dismiss = useCallback((id: number) => {
    setNotifications((current) =>
      current.filter((notification) => notification.id !== id),
    );
  }, []);
  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <section className="notifications" aria-label="Notifications">
        {notifications.map((notification) => (
          <NotificationPopup
            key={notification.id}
            notification={notification}
            dismiss={dismiss}
          />
        ))}
      </section>
    </NotificationContext.Provider>
  );
}

function NotificationPopup({
  notification,
  dismiss,
}: {
  notification: Notification;
  dismiss: (id: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(6000);
  const paused = hovered || focused;
  useEffect(() => {
    if (notification.tone === "error" || paused) return;
    const started = Date.now();
    const timeout = window.setTimeout(
      () => dismiss(notification.id),
      remaining.current,
    );
    return () => {
      window.clearTimeout(timeout);
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - started),
      );
    };
  }, [notification.id, notification.tone, paused, dismiss]);
  return (
    <div
      className={`notification notification-${notification.tone}`}
      role={notification.tone === "error" ? "alert" : "status"}
      aria-atomic="true"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <svg
        className="notification-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        {notification.tone === "success" ? (
          <path d="m8 12 3 3 5-6" />
        ) : (
          <>
            <path d="M12 7v6" />
            <path d="M12 16v1" />
          </>
        )}
      </svg>
      <p>{notification.message}</p>
      <button
        className="notification-dismiss"
        type="button"
        aria-label={`Dismiss notification: ${notification.message}`}
        onClick={() => dismiss(notification.id)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <path d="m6 6 12 12M6 18 18 6" />
        </svg>
      </button>
    </div>
  );
}
