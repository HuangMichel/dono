"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import {
  Button,
  Card,
  Chip,
  Field,
  SelectField,
  PageHeading,
  LinkButton,
  Icon,
} from "@/components/ui";
import {
  accountHref,
  donationHref,
  offerIntent,
  safeOfferReturn,
} from "@/lib/offer-intent";
import { Stepper } from "@/components/ui/stepper";
import { StepActions } from "@/components/ui/step-actions";
import { useAuth } from "@/lib/auth-context";
import { useApiPage } from "@/lib/api-hooks";
import { useDonationSession } from "@/components/donor/donation-session-hook";
import { categoryFields, parseAttributeInput } from "@/lib/category-fields";
import {
  enumLabel,
  factLabel,
  formatCount,
  indicatorLabel,
  indicatorTone,
} from "@/lib/ui-text";
import { AuthPhoto } from "@/components/association/auth-photo";
import { DonationPhotos } from "@/components/donor/donation-photos";
import { useDonationStatus } from "@/components/donor/donation-row";
import "@/components/donor/donation-flow.css";
import {
  categories,
  changeCategory,
  itemName,
  statusLabel,
  type Category,
  type Donation,
  type RedirectPoint,
} from "@/components/donor/api-donation";

export default function Donate() {
  return (
    <Suspense fallback={<p>Loading donation…</p>}>
      <DonationRoute />
    </Suspense>
  );
}
function DonationRoute() {
  const params = useSearchParams(),
    auth = useAuth();
  const id = params.get("id");
  const continuation =
    safeOfferReturn(`/donate?${params}`) ??
    donationHref(offerIntent(new URLSearchParams(params.toString())));
  return (
    <DonationFlow
      key={`${auth.user?.id ?? "guest"}:${id ?? "new"}`}
      id={id}
      continuation={continuation}
    />
  );
}
function DonationFlow({
  id,
  continuation,
}: {
  id: string | null;
  continuation: string;
}) {
  const [analysing, setAnalysing] = useState(false);
  const auth = useAuth();
  const { state, session } = useDonationSession(
    auth.user?.id ?? null,
    id,
    continuation.split("?")[1] ?? "",
  );
  const {
    donation,
    facts,
    step,
    files,
    persistedPhotos,
    lockedFiles,
    analysis,
    address,
    matches,
    matchesSearched,
    selected,
    sentTo,
    busy,
    error,
  } = state;
  const {
    setFacts,
    setStep,
    setFiles,
    setError,
    setAddress,
    setSelected,
    run,
    analyse,
    save,
    findMatches,
    sendOffer,
  } = session;
  const category = facts.category ?? "clothes";
  function attribute(key: string, value: unknown) {
    setFacts((f) => ({ ...f, attributes: { ...f.attributes, [key]: value } }));
  }
  function date(key: string, value: unknown) {
    setFacts((f) => ({ ...f, expiry: { ...f.expiry, [key]: value } }));
  }
  const active = donation?.computed.active_offer_id;
  const expiryView = donation?.computed.expiry;
  const chosen = matches.find((match) => match.need_id === selected);
  const itemSubtitle = `${itemName(facts)} × ${facts.quantity ?? ""}${
    expiryView?.effective_expiry_date
      ? `, ${
          facts.expiry.date_type === "DLC"
            ? "use by"
            : facts.expiry.date_type === "PAO"
              ? "period after opening ends"
              : "best before"
        } ${new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${expiryView.effective_expiry_date}T00:00:00Z`))}${
          expiryView.days_left != null
            ? `, ${expiryView.days_left} days left`
            : ""
        }`
      : ""
  }`;
  return (
    <PublicShell>
      <main
        id="main"
        className={`container donation-flow donation-step-${step}`}
      >
        <PageHeading
          title={
            active && step !== 3
              ? "Your offer"
              : step === 3
                ? "Your offer is sent"
                : step === 2
                  ? matches.length
                    ? `${matches.length} ${matches.length === 1 ? "association needs" : "associations need"} this`
                    : "Choose an association"
                  : step === 1
                    ? "Check your item details"
                    : "Take photos of your item"
          }
          description={
            active && step !== 3
              ? "This donation already has an active offer."
              : step === 2 && matches.length
                ? itemSubtitle
                : step === 1
                  ? `${itemName(facts)}, ${categories[category]}, ${formatCount(facts.quantity)}`
                  : undefined
          }
        />
        {auth.loading ? (
          <p role="status">Loading your account…</p>
        ) : !auth.user ? (
          <Card className="stack-sm">
            <p>Create an account or sign in to prepare a donation.</p>
            <LinkButton href={accountHref("signup", continuation)}>
              Create an account
            </LinkButton>
            <LinkButton
              href={accountHref("login", continuation)}
              variant="outline"
            >
              Sign in
            </LinkButton>
          </Card>
        ) : (
          <>
            {error && (
              <p role="alert" className="notice danger">
                {error}{" "}
                <Button
                  variant="outline"
                  onClick={() => {
                    if (id && !donation) void session.start();
                    else setError("");
                  }}
                >
                  {id && !donation ? "Retry loading donation" : "Dismiss"}
                </Button>
              </p>
            )}
            {busy && (
              <div className="donation-working" role="status">
                <Icon name="camera" size={28} />
                <strong>
                  {analysing
                    ? "Checking your item"
                    : "Saving or loading your donation…"}
                </strong>
                <p className="meta muted">Keep this page open.</p>
              </div>
            )}
            {id && !donation ? (
              <Card className="stack">
                <p>
                  {busy
                    ? "Loading your saved donation…"
                    : "Your saved donation has not loaded."}
                </p>
              </Card>
            ) : active && step !== 3 ? (
              <ActiveOfferReview donation={donation!} />
            ) : (
              <>
                {step < 3 && (
                  <Stepper
                    labels={[
                      "Photos",
                      "Check details",
                      "Choose an association",
                    ]}
                    currentStep={step}
                    label="Donation progress"
                  />
                )}
                {step === 0 && !analysing && (
                  <div className="stack donation-scan">
                    <p className="muted">
                      Add one type of item per donation. If you have several,
                      they must have the same details and printed date.
                    </p>
                    <DonationPhotos
                      files={files}
                      savedCount={persistedPhotos.length}
                      locked={lockedFiles.length > 0}
                      disabled={busy}
                      onChange={setFiles}
                      onKind={session.setPhotoKind}
                      getKind={session.getPhotoKind}
                      onError={setError}
                    />
                    {(persistedPhotos.length > 0 || lockedFiles.length > 0) && (
                      <p className="notice caution">
                        Uploaded photos stay with this draft. Start a new
                        donation to use different photos.
                      </p>
                    )}
                    {persistedPhotos.length > 0 && (
                      <section className="stack-sm" aria-label="Saved photos">
                        <h2>Saved photos</h2>
                        <div className="row wrap">
                          {persistedPhotos.map((photo) => (
                            <div key={photo.id} className="stack-sm">
                              <AuthPhoto
                                photo={photo}
                                alt={`Saved ${photo.kind} photo`}
                              />
                              <Chip>
                                {photo.kind === "label"
                                  ? "Label close-up"
                                  : "Item photo"}
                              </Chip>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                    <p className="meta muted">
                      Up to three photos in total. Keep dates in focus and avoid
                      reflections.
                    </p>
                    <SelectField
                      id="category-hint"
                      label="Category"
                      value={category}
                      disabled={busy}
                      onChange={(e) =>
                        setFacts((f) =>
                          changeCategory(f, e.target.value as Category),
                        )
                      }
                    >
                      {Object.entries(categories).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                )}
                {step === 0 && !analysing && (
                  <StepActions>
                    <Button
                      size="app"
                      disabled={
                        busy || (!files.length && !persistedPhotos.length)
                      }
                      onClick={async () => {
                        setAnalysing(true);
                        try {
                          await run(analyse);
                        } finally {
                          setAnalysing(false);
                        }
                      }}
                    >
                      Analyse photos
                      <Icon name="arrow-right" />
                    </Button>
                    <Button
                      size="app"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setStep(1)}
                    >
                      Enter details manually
                    </Button>
                  </StepActions>
                )}
                {step === 1 && (
                  <div className="stack">
                    {donation?.computed.expiry?.effective_expiry_date &&
                      JSON.stringify(facts.expiry) ===
                        JSON.stringify(donation.facts.expiry) && (
                        <section
                          className={`donation-expiry ${donation.computed.expiry.expired ? "expired" : (donation.computed.expiry.days_left ?? 90) < 7 ? "urgent" : ""}`}
                          aria-label="Saved expiry date"
                        >
                          <strong>
                            {donation.computed.expiry.expired
                              ? "Date passed"
                              : `${donation.computed.expiry.days_left} days left`}
                          </strong>
                          <p className="meta">
                            Saved date:{" "}
                            {new Intl.DateTimeFormat("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              timeZone: "UTC",
                            }).format(
                              new Date(
                                `${donation.computed.expiry.effective_expiry_date}T00:00:00Z`,
                              ),
                            )}
                          </p>
                        </section>
                      )}
                    {analysis && (
                      <Card className="stack-sm donation-indicators">
                        <h2>Photo indicators</h2>
                        <p className="meta muted">
                          Category confidence{" "}
                          {Math.round(analysis.confidence * 100)}%
                        </p>
                        {analysis.indicators.map((i) => (
                          <div key={i.key} className="donation-indicator">
                            <div className="row between">
                              <span>{indicatorLabel(i.key)}</span>
                              <strong>
                                {i.probability == null
                                  ? (i.value ?? "Unknown")
                                  : `${Math.round(i.probability * 100)}% likely`}
                              </strong>
                            </div>
                            {i.probability != null && (
                              <span
                                className={`donation-indicator-track ${indicatorTone(i.key, i.level)}`}
                                role="progressbar"
                                aria-label={`${indicatorLabel(i.key)} probability`}
                                aria-valuenow={Math.round(i.probability * 100)}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              >
                                <span
                                  style={{
                                    width: `${Math.round(i.probability * 100)}%`,
                                  }}
                                />
                              </span>
                            )}
                          </div>
                        ))}
                        {analysis.computed.manual_review_required && (
                          <p className="notice caution">
                            Staff will need to check uncertain or conflicting
                            photo details.
                          </p>
                        )}
                        <p className="meta muted">
                          Association staff make the donation decision.
                        </p>
                      </Card>
                    )}
                    <form
                      id="donation-details"
                      className="donation-details-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(save);
                      }}
                    >
                      <SelectField
                        id="category"
                        label="Category"
                        value={category}
                        disabled={busy}
                        onChange={(e) =>
                          setFacts((f) =>
                            changeCategory(f, e.target.value as Category),
                          )
                        }
                      >
                        {Object.entries(categories).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </SelectField>
                      <Field
                        label="Number of identical items"
                        id="quantity"
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={facts.quantity ?? ""}
                        disabled={busy}
                        onChange={(e) =>
                          setFacts((f) => ({
                            ...f,
                            quantity: e.target.value,
                            unit: "item",
                          }))
                        }
                      />
                      {Object.entries(categoryFields[category]).map(
                        ([key, options]) =>
                          options ? (
                            <SelectField
                              key={key}
                              id={key}
                              label={factLabel(key)}
                              value={String(facts.attributes[key] ?? "")}
                              disabled={busy}
                              onChange={(e) =>
                                attribute(
                                  key,
                                  parseAttributeInput(key, e.target.value),
                                )
                              }
                            >
                              <option value="">Unknown</option>
                              {options.map((value) => (
                                <option key={value} value={value}>
                                  {value === "true"
                                    ? "Yes"
                                    : value === "false"
                                      ? "No"
                                      : enumLabel(value)}
                                </option>
                              ))}
                            </SelectField>
                          ) : (
                            <Field
                              key={key}
                              id={key}
                              label={factLabel(key)}
                              value={String(facts.attributes[key] ?? "")}
                              maxLength={key === "size" ? 40 : 120}
                              disabled={busy}
                              onChange={(e) =>
                                attribute(
                                  key,
                                  parseAttributeInput(key, e.target.value),
                                )
                              }
                            />
                          ),
                      )}
                      {category === "clothes" && (
                        <fieldset>
                          <legend>Seasons</legend>
                          {["spring", "summer", "autumn", "winter"].map(
                            (season) => (
                              <label key={season} className="check">
                                <input
                                  type="checkbox"
                                  disabled={busy}
                                  checked={
                                    Array.isArray(facts.attributes.seasons) &&
                                    facts.attributes.seasons.includes(season)
                                  }
                                  onChange={(e) => {
                                    const seasons = Array.isArray(
                                      facts.attributes.seasons,
                                    )
                                      ? (facts.attributes.seasons as string[])
                                      : [];
                                    attribute(
                                      "seasons",
                                      e.target.checked
                                        ? [...seasons, season]
                                        : seasons.filter((s) => s !== season),
                                    );
                                  }}
                                />
                                {enumLabel(season)}
                              </label>
                            ),
                          )}
                        </fieldset>
                      )}
                      {["food", "para"].includes(category) && (
                        <>
                          <SelectField
                            id="date-type"
                            label="Date type"
                            disabled={busy}
                            value={String(facts.expiry.date_type ?? "")}
                            onChange={(e) => {
                              const value = e.target.value as
                                "DLC" | "DDM" | "expiry" | "PAO" | "";
                              setFacts((f) => ({
                                ...f,
                                expiry: {
                                  ...f.expiry,
                                  date_type: value || null,
                                  ...(value === "PAO"
                                    ? {
                                        expiry_date: null,
                                        date_precision: "unknown",
                                        readability: "unknown",
                                      }
                                    : { pao_months: null, opened_on: null }),
                                },
                              }));
                            }}
                          >
                            <option value="">Unknown</option>
                            {(category === "food"
                              ? ["DLC", "DDM"]
                              : ["expiry", "PAO"]
                            ).map((v) => (
                              <option key={v} value={v}>
                                {v === "DLC"
                                  ? "Use by"
                                  : v === "DDM"
                                    ? "Best before"
                                    : v === "PAO"
                                      ? "Period after opening"
                                      : "Expiry date"}
                              </option>
                            ))}
                          </SelectField>
                          {facts.expiry.date_type === "PAO" ? (
                            <>
                              <Field
                                id="pao"
                                label="Months after opening"
                                type="number"
                                min="1"
                                max="120"
                                value={String(facts.expiry.pao_months ?? "")}
                                disabled={busy}
                                onChange={(e) =>
                                  date(
                                    "pao_months",
                                    e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  )
                                }
                              />
                              <Field
                                id="opened"
                                label="Opened on"
                                type="date"
                                value={String(facts.expiry.opened_on ?? "")}
                                disabled={busy}
                                onChange={(e) =>
                                  date("opened_on", e.target.value || null)
                                }
                              />
                            </>
                          ) : (
                            <Field
                              id="expiry"
                              label="Printed date"
                              type="date"
                              value={String(facts.expiry.expiry_date ?? "")}
                              disabled={busy}
                              onChange={(e) =>
                                setFacts((f) => ({
                                  ...f,
                                  expiry: {
                                    ...f.expiry,
                                    expiry_date: e.target.value || null,
                                    date_precision: e.target.value
                                      ? "day"
                                      : "unknown",
                                    readability: e.target.value
                                      ? "readable"
                                      : "unknown",
                                  },
                                }))
                              }
                            />
                          )}
                          <Field
                            id="label"
                            label="Printed date label"
                            value={String(facts.expiry.raw_label ?? "")}
                            maxLength={240}
                            disabled={busy}
                            onChange={(e) =>
                              date("raw_label", e.target.value || null)
                            }
                          />
                        </>
                      )}
                      <p className="notice caution">
                        Medicines go to a pharmacy. Food must be unopened,
                        non-perishable and stored at room temperature.
                      </p>
                    </form>
                    <StepActions
                      onBack={() => setStep(0)}
                      backLabel="Edit photos"
                    >
                      <Button
                        type="submit"
                        form="donation-details"
                        size="app"
                        disabled={busy}
                      >
                        Save details and continue
                        <Icon name="arrow-right" />
                      </Button>
                    </StepActions>
                  </div>
                )}
                {step === 2 && (
                  <div className="stack donation-matching">
                    <Card className="donation-item-summary">
                      <Icon name="package" size={24} />
                      <div>
                        <strong>{itemName(facts)}</strong>
                        <p className="meta muted">
                          {formatCount(facts.quantity)}, {categories[category]}
                        </p>
                      </div>
                    </Card>
                    <form
                      className="donation-match-search"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(findMatches);
                      }}
                    >
                      <Field
                        id="address"
                        label="Your address or town"
                        required
                        maxLength={240}
                        value={address}
                        disabled={busy}
                        onChange={(e) => {
                          setAddress(e.target.value);
                        }}
                      />
                      <Button disabled={busy}>Find associations</Button>
                    </form>
                    {!busy && matches.length === 0 && (
                      <Card className="stack-sm donation-match-empty">
                        <Icon name="package" size={28} />
                        <h2>
                          {matchesSearched
                            ? "No association needs this right now"
                            : "Find an association near you"}
                        </h2>
                        <p className="muted">
                          {matchesSearched
                            ? itemSubtitle
                            : "Search using your address or town."}
                        </p>
                        {matchesSearched && (
                          <>
                            <p className="muted">
                              Try another location or browse nearby needs.
                            </p>
                            <NoMatchDropoffs />
                            <LinkButton href="/donate" size="app">
                              Scan another item
                            </LinkButton>
                            <LinkButton href="/needs" variant="outline">
                              Nearby needs
                            </LinkButton>
                          </>
                        )}
                      </Card>
                    )}
                    {matches.length > 0 && (
                      <div className="donation-match-layout">
                        <fieldset className="donation-match-list">
                          <legend>Choose an association</legend>
                          {matches.map((match) => (
                            <label
                              key={match.need_id}
                              className={`donation-match-row ${selected === match.need_id ? "selected" : ""}`}
                            >
                              <span className="check">
                                <input
                                  name="match"
                                  type="radio"
                                  checked={selected === match.need_id}
                                  disabled={busy}
                                  onChange={() => setSelected(match.need_id)}
                                />
                                <strong>{match.association.name}</strong>
                              </span>
                              <span className="meta muted">
                                {match.distance_km.toFixed(1)} km away, needs{" "}
                                {match.budgets.demand_available} more
                              </span>
                              {match.reasons.map((reason) => (
                                <Chip key={reason}>{enumLabel(reason)}</Chip>
                              ))}
                            </label>
                          ))}
                        </fieldset>
                        <Card className="stack-sm donation-match-aside">
                          <h2>Why these associations?</h2>
                          <p className="meta muted">
                            Sorted by need, capacity, season and distance.
                          </p>
                          {chosen && (
                            <dl className="donation-summary">
                              <div>
                                <dt>Your offer</dt>
                                <dd>{facts.quantity}</dd>
                              </div>
                              <div>
                                <dt>Need</dt>
                                <dd>{chosen.budgets.demand_available} more</dd>
                              </div>
                              <div>
                                <dt>Storage</dt>
                                <dd>
                                  {chosen.budgets.storage_available} places free
                                </dd>
                              </div>
                              <div>
                                <dt>Active offers</dt>
                                <dd>One per item</dd>
                              </div>
                            </dl>
                          )}
                        </Card>
                      </div>
                    )}
                    <StepActions
                      onBack={() => setStep(1)}
                      backLabel="Edit details"
                    >
                      <Button
                        size="app"
                        disabled={busy || !selected}
                        onClick={() => run(sendOffer)}
                      >
                        Send offer for staff review
                        <Icon name="arrow-right" />
                      </Button>
                    </StepActions>
                  </div>
                )}
                {step === 3 && (
                  <Card className="stack donation-sent">
                    <span className="donation-sent-icon">
                      <Icon name="check" size={28} />
                    </span>
                    <h2>
                      {sentTo ||
                        matches.find((match) => match.need_id === selected)
                          ?.association.name ||
                        "The association"}
                    </h2>
                    <dl className="donation-summary">
                      <div>
                        <dt>Item</dt>
                        <dd>{itemName(facts)}</dd>
                      </div>
                      <div>
                        <dt>Quantity</dt>
                        <dd>{facts.quantity}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>
                          <Chip variant="caution">Waiting for review</Chip>
                        </dd>
                      </div>
                    </dl>
                    <p>
                      Association staff will review your offer. Check its status
                      in My donations.
                    </p>
                    <LinkButton href="/donate" size="app">
                      Scan another item
                    </LinkButton>
                    <LinkButton href="/donations" variant="outline">
                      My donations
                    </LinkButton>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </main>
    </PublicShell>
  );
}
const REDIRECT_KIND_LABELS: Record<string, string> = {
  pharmacy: "Pharmacy",
  textile_bin: "Textile bin",
  repair_cafe: "Repair café",
};
function NoMatchDropoffs() {
  const points = useApiPage<RedirectPoint>("/redirect-points");
  const dropoffs = points.data.filter((point) => point.kind !== "pharmacy");
  return (
    <section
      className="stack-sm donation-redirect"
      aria-label="Drop-off points"
    >
      <h3>Drop-off points nearby</h3>
      {points.loading && (
        <p className="meta muted" role="status">
          Loading drop-off points…
        </p>
      )}
      {points.error && (
        <p className="meta muted">Drop-off points are unavailable right now.</p>
      )}
      {!points.loading && !points.error && !dropoffs.length && (
        <p className="meta muted">No drop-off points are listed yet.</p>
      )}
      {dropoffs.length > 0 && (
        <ul className="donation-redirect-list">
          {dropoffs.map((point) => (
            <li key={point.id}>
              <span>
                <strong>{point.name}</strong>
                <span className="meta muted block">{point.address}</span>
              </span>
              <Chip>{REDIRECT_KIND_LABELS[point.kind] ?? point.kind}</Chip>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
/** Shown when a donor returns to a donation that already has an active offer. */
function ActiveOfferReview({ donation }: { donation: Donation }) {
  const { status, effective } = useDonationStatus(donation);
  const approved = effective === "approved";
  const closed = ["refused", "cancelled", "expired", "withdrawn"].includes(
    effective ?? "",
  );
  return (
    <Card className="stack donation-sent donation-offer-review">
      <span className="donation-sent-icon">
        <Icon name={approved ? "check" : "clock"} size={28} />
      </span>
      <h2>
        {status.loading
          ? "Checking your offer…"
          : effective === "pending_review"
            ? "Your offer is sent"
            : effective === "approved"
              ? "Approved by association staff"
              : effective === "refused"
                ? "Not accepted this time"
                : statusLabel(effective ?? "Offer")}
      </h2>
      {status.error && (
        <p role="alert">
          {status.error}{" "}
          <Button variant="outline" onClick={() => void status.refresh()}>
            Retry
          </Button>
        </p>
      )}
      {!status.loading && !status.error && (
        <>
          <dl className="donation-summary">
            <div>
              <dt>Item</dt>
              <dd>{itemName(donation.facts)}</dd>
            </div>
            <div>
              <dt>Quantity</dt>
              <dd>{donation.facts.quantity}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <Chip
                  variant={
                    approved
                      ? "success"
                      : effective === "refused"
                        ? "danger"
                        : "caution"
                  }
                >
                  {statusLabel(effective ?? "")}
                </Chip>
              </dd>
            </div>
          </dl>
          <p>
            {effective === "pending_review"
              ? "Association staff will review your offer. Check its status in My donations."
              : approved
                ? "Book a drop-off time and show your QR code when you arrive."
                : closed
                  ? "This offer is closed. The item stays in your donations, and you can offer it again."
                  : "Check the current status in My donations."}
          </p>
        </>
      )}
      {approved && (
        <LinkButton
          href={`/booking/${donation.computed.active_offer_id}`}
          size="app"
        >
          Manage drop-off
        </LinkButton>
      )}
      <LinkButton href="/donations" variant={approved ? "outline" : "primary"}>
        My donations
      </LinkButton>
    </Card>
  );
}
