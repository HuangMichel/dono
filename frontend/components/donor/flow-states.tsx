import Image from "next/image";
import { Button, Chip, Icon, LinkButton } from "@/components/ui";
import { useDemo } from "@/lib/demo-context";
export function AnalysisState({ photo }: { photo: string }) {
  return (
    <section className="flow-state" role="status">
      <Image
        width={300}
        height={180}
        unoptimized
        className="flow-photo"
        src={photo || "/item-clothes.svg"}
        alt="Item preview"
      />
      <h1>Checking your item</h1>
      <div className="indicator-list" aria-hidden="true">
        {[65, 85, 45].map((width, i) => (
          <div key={i} className="indicator-row">
            <span className="skeleton-line" style={{ width: width + "%" }} />
          </div>
        ))}
      </div>

      <Button size="app" disabled>
        Find an association
        <Icon name="arrow-right" />
      </Button>
    </section>
  );
}
export function PhotoProblem({
  photo,
  unclear,
  retry,
  replace,
}: {
  photo: string;
  unclear: boolean;
  retry: () => void;
  replace: () => void;
}) {
  return (
    <section className="flow-state">
      <Image
        width={300}
        height={180}
        unoptimized
        className="flow-photo"
        src={photo || "/item-clothes.svg"}
        alt="Your preserved item preview"
      />
      <h1>
        {unclear ? "Photo not clear enough" : "Couldn't analyse the photo"}
      </h1>
      {unclear ? (
        <ol className="photo-tips">
          {[
            "Put the whole item in the frame",
            "Use daylight, without flash",
            "Add a close-up of the details",
          ].map((tip, i) => (
            <li key={tip}>
              <span className="step-number">{i + 1}</span>
              {tip}
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">
          The analysis failed. Your draft and photo are preserved.
        </p>
      )}

      <Button size="app" onClick={unclear ? replace : retry}>
        {unclear && <Icon name="arrow-left" />}
        {unclear ? "Choose another photo" : "Try again"}
        {!unclear && <Icon name="arrow-right" />}
      </Button>
      {!unclear && (
        <Button variant="outline" onClick={replace}>
          <Icon name="arrow-left" />
          Back to photos
        </Button>
      )}
    </section>
  );
}
export function SafetyWarning({
  medicine,
  review,
  back,
}: {
  medicine: boolean;
  review: () => void;
  back: () => void;
}) {
  return (
    <section className="flow-state">
      <span className="state-icon warning">
        <Icon name="warning" size={28} />
      </span>
      <h1>
        {medicine
          ? "Medicines cannot be donated"
          : "Possible refrigeration concern"}
      </h1>
      <p>
        {medicine
          ? "Return medicines to a pharmacy. Dono cannot take this item."
          : "Only unopened, non-perishable food stored at room temperature can follow this donation journey."}
      </p>
      {medicine && (
        <div className="notice">
          <strong>Pharmacy take-back</strong>
          <p className="meta muted">
            Ask a local pharmacy about returning your medicines. Live pharmacy
            locations are unavailable.
          </p>
        </div>
      )}
      <p className="meta muted">
        The original indicator remains visible after category corrections.
      </p>
      <Button size="app" variant="outline" onClick={review}>
        Review item indicators
        <Icon name="arrow-right" />
      </Button>
      <Button size="app" onClick={back}>
        <Icon name="arrow-left" />
        Back to photos
      </Button>
    </section>
  );
}
export function OfferSent() {
  const { storageError } = useDemo();
  return (
    <section className="flow-state">
      <span className="state-icon">
        <Icon name="check" size={28} />
      </span>
      <h1>Offer sent</h1>
      <Chip variant="caution">Waiting for review</Chip>
      <p>
        The association will review your offer. You can book a drop-off after
        staff approval.
      </p>
      <p className="meta muted">
        {storageError
          ? "Your offer is available for this session. It is not saved in this browser."
          : "Your offer is saved in this browser."}
      </p>
      <LinkButton href="/donations" size="app">
        My donations
        <Icon name="arrow-right" />
      </LinkButton>
      <LinkButton href="/login" variant="outline">
        Switch to association demo
      </LinkButton>
    </section>
  );
}
