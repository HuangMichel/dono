"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { NotificationProvider } from "@/components/ui/notifications";

export function AppNotifications({ children }: { children: ReactNode }) {
  const { sessionUser } = useAuth();
  return (
    <NotificationProvider key={sessionUser?.id ?? "guest"}>
      {children}
    </NotificationProvider>
  );
}
