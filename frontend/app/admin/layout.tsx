import type { ReactNode } from "react";
import { ConsoleShell } from "@/components/association/shell";
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <ConsoleShell admin>{children}</ConsoleShell>;
}
