import { PublicShell } from "@/components/public-shell";
import { Chip, Icon, LinkButton } from "@/components/ui";
import { IndicatorRow } from "@/components/donor/indicator-row";
const impact = [
  {
    step: "Easy to donate",
    dono: "Photograph an item to see condition indicators and label dates before you offer it.",
    figure: "30%",
    fact: "of the clothes sorted at a Croix-Rouge unit in Gironde are resold. The rest is often holed, stained or damaged.",
    source: "TF1 Info, 6 Dec 2024",
    href: "https://www.tf1info.fr/environnement-ecologie/reportage-video-qu-on-nous-prenne-pas-pour-une-dechetterie-les-associations-submergees-par-les-dons-de-vetements-de-mauvaise-qualite-2338092.html",
  },
  {
    step: "The right association",
    dono: "Offers only reach associations that need the item and have space. Staff approve before you drop it off.",
    figure: "€46,000",
    fact: "was the waste bill of Emmaüs Catalogne in 2025, as more donations it cannot use end up in the bin.",
    source: "L'Indépendant, 29 Aug 2026",
    href: "https://www.lindependant.fr/2026/08/29/rentree-scolaire-2026-la-seconde-main-chez-emmaus-catalogne-impactee-par-des-dons-en-baisse-et-submergee-par-des-vetements-de-pietre-qualite-un-defi-13514466.php",
  },
  {
    step: "Less waste",
    dono: "Offer unopened, non-perishable food to an association before it goes to waste.",
    figure: "0.5 million tonnes",
    fact: "of food still in its packaging was thrown away by French households in 2024.",
    source: "SDES, French government statistics, 29 Sep 2026",
    href: "https://www.statistiques.developpement-durable.gouv.fr/dechets-et-gaspillage-alimentaires-en-france-en-2024-le-gaspillage-domicile-toujours-preponderant",
  },
];
export default function Home() {
  return (
    <PublicShell>
      <main id="main">
        <div className="landing-split">
          <section className="hero">
            <h1>Give what associations actually need.</h1>
            <p>
              Find what nearby associations need, prepare your item and send an
              offer for staff to review.
            </p>
            <LinkButton href="/needs" size="app">
              Browse nearby needs <Icon name="arrow-right" />
            </LinkButton>
            <p className="meta">
              Browse needs without an account. Sign in to offer an item.
            </p>
            <figure className="hero-example">
              <figcaption className="sr-only">
                Example: photos of a coat show visible stains as likely, 61%,
                and a medicine as unlikely, 2%. The offer then waits for
                association staff to review it.
              </figcaption>
              <div className="hero-example-card" aria-hidden="true">
                <div className="row between">
                  <Chip>Example</Chip>
                  <Chip variant="caution">Waiting for review</Chip>
                </div>
                <div className="hero-example-item">
                  <span className="hero-example-photo">
                    <Icon name="package" size={24} />
                  </span>
                  <span>
                    <strong>Coat, 8 years</strong>
                    <span className="meta muted block">
                      Category confidence 94%
                    </span>
                  </span>
                </div>
                <IndicatorRow
                  indicator={{
                    key: "stains_visible",
                    probability: 0.61,
                    level: "medium",
                  }}
                />
                <IndicatorRow
                  indicator={{
                    key: "looks_like_medicine",
                    probability: 0.02,
                    level: "low",
                  }}
                />
                <span className="meta muted">
                  Association staff make the donation decision.
                </span>
              </div>
            </figure>
          </section>
          <ol className="process" aria-label="How Dono works">
            {[
              [
                "Take photos",
                "Show the whole item. For food and care products, add a close-up of the label.",
              ],
              [
                "Check the item details",
                "Check the details read from your photos and any warning indicators. Correct missing or incorrect details.",
              ],
              [
                "Choose an association",
                "Find an association with a matching need and available capacity.",
              ],
              [
                "Book your drop-off after approval",
                "Association staff review your offer. If approved, choose a drop-off time and show your QR code when you arrive.",
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
        <section className="impact" aria-labelledby="impact-title">
          <h2 id="impact-title">Why it matters</h2>
          <ol className="impact-chain">
            {impact.map((item, i) => (
              <li key={item.step}>
                <span className="step-number">{i + 1}</span>
                <h3>{item.step}</h3>
                <p>{item.dono}</p>
                <figure className="impact-evidence">
                  <p>
                    <strong className="num">{item.figure}</strong> {item.fact}
                  </p>
                  <figcaption className="meta">
                    Source: <a href={item.href}>{item.source}</a>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ol>
        </section>
        <section className="category-strip">
          <div className="row wrap">
            <span className="muted">Donation categories</span>
            {[
              "Clothes",
              "Shoes",
              "Non-perishable food",
              "Hygiene & care",
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
