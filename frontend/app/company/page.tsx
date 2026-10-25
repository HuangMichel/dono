import { PublicShell } from "@/components/public-shell";
import { Card, PageHeading, LinkButton } from "@/components/ui";
export default function Company() {
  return (
    <PublicShell>
      <main id="main" className="container company-page">
        <PageHeading title="Company donations" />
        <Card className="stack">
          <p>
            Company donation accounts are not available yet. You can offer items
            as an individual using your donor account.
          </p>
          <p>
            Food must be unopened, non-perishable and stored at room
            temperature.
          </p>
          <LinkButton href="/donate" size="app">
            Prepare a donation
          </LinkButton>
        </Card>
      </main>
    </PublicShell>
  );
}
