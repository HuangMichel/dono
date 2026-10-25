"use client";
import { ConsoleTitle } from "@/components/association/shell";
import { Card, LinkButton } from "@/components/ui";
export default function PostedOffers() {
  return (
    <>
      <ConsoleTitle
        title="Posted offers"
        detail="Browsing unmatched posted items is a future design and is not available yet."
      />
      <Card className="stack">
        <p>
          Dono shows only offers that donors send directly to your association.
        </p>
        <LinkButton href="/association/review">
          Review offers addressed to your association
        </LinkButton>
      </Card>
    </>
  );
}
