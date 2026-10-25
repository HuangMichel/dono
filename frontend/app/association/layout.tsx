import type { ReactNode } from "react";
import { ConsoleShell } from "@/components/association/shell";
export default function AssociationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
