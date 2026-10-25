import type { ReactNode } from "react";
import { Button, Icon, LinkButton } from "@/components/ui";
export function StepActions({
  onBack,
  backHref,
  backLabel = "Back",
  children,
}: {
  onBack?: () => void;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <footer className="step-actions" aria-label="Step navigation">
      {onBack ? (
        <Button type="button" variant="outline" size="app" onClick={onBack}>
          <Icon name="arrow-left" />
          {backLabel}
        </Button>
      ) : backHref ? (
        <LinkButton href={backHref} variant="outline" size="app">
          <Icon name="arrow-left" />
          {backLabel}
        </LinkButton>
      ) : (
        <span />
      )}
      <div className="step-actions-next">{children}</div>
    </footer>
  );
}
