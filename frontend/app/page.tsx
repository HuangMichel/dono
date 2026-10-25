import { PublicShell } from "@/components/public-shell";
import { Chip, Icon, LinkButton } from "@/components/ui";
export default function Home() {
  return (
    <PublicShell>
      <main id="main">
        <div className="landing-split">
          <section className="hero">
            <h1>Give what associations actually need.</h1>
            <p>
              Associations receive unusable donations. Dono shows what nearby
              associations need and gives you item indicators before you send an
              offer.
            </p>
            <LinkButton href="/needs" size="app">
              See what is needed nearby <Icon name="arrow" />
            </LinkButton>
            <p className="meta">
              Browsing needs is public. Choose a demo role to send an offer.
            </p>
          </section>
          <ol className="process" aria-label="How Dono works">
            {[
              ["Scan", "Photograph the item and its label, if it has a date."],
              [
                "Check the indicators",
                "Review estimates and extracted facts. Correct the item details before continuing.",
              ],
              [
                "Match and offer",
                "Find an association with a matching need and available capacity.",
              ],
              [
                "Staff decide, you drop off",
                "On approval, book a slot and show your QR code at reception.",
              ],
            ].map(([title, text], i) => (
              <li key={title}>
                <span className="step-number">{i + 1}</span>
                <h2>{title}</h2>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
        <section className="category-strip">
          <div className="row wrap">
            <span className="muted">Donation categories</span>
            {[
              "Clothes",
              "Shoes",
              "Food, non-perishable",
              "Parapharmacy & hygiene",
              "Small furniture",
            ].map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
          </div>
          <p className="meta muted">
            Medicines go to a pharmacy. Food must be unopened, non-perishable
            and stored at room temperature.
          </p>
        </section>
      </main>
    </PublicShell>
  );
}
