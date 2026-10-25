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
  TextareaField,
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
import { useNotifications } from "@/components/ui/notifications";
import { useApiPage } from "@/lib/api-hooks";
import { useDonationSession } from "@/components/donor/donation-session-hook";
import {
  categoryFields,
  parseAttributeInput,
  requiredDonationAttributes,
} from "@/lib/category-fields";
import {
  daysLeftText,
  enumLabel,
  expiryTone,
  factLabel,
  formatCount,
  indicatorTone,
  rankIndicators,
  safetyWarnings,
} from "@/lib/ui-text";
import type { Indicator } from "@/lib/api-contracts";
import { PostingControls } from "@/components/donor/posting-controls";
import { IndicatorRow } from "@/components/donor/indicator-row";
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
  type Facts,
  type RedirectPoint,
} from "@/components/donor/api-donation";

export default function Donate() {
  return (
    <Suspense fallback={<p>Loading donation…</p>}>
      <DonationRoute />
    </Suspense>
  );
}
function ItemIdentityFields({
  facts,
  disabled,
  onChange,
}: {
  facts: Facts;
  disabled: boolean;
  onChange: (patch: Pick<Facts, "name" | "description">) => void;
}) {
  return (
    <>
      <Field
        id="item-name"
        label="Item name (required)"
        required
        maxLength={120}
        pattern={".*\\S.*"}
        value={facts.name ?? ""}
        disabled={disabled}
        onChange={(event) => onChange({ name: event.target.value })}
      />
      <TextareaField
        id="item-description"
        label="Description (optional)"
        maxLength={2000}
        rows={3}
        placeholder="Condition, visible defects or useful details"
        value={facts.description ?? ""}
        disabled={disabled}
        onChange={(event) => onChange({ description: event.target.value })}
      />
    </>
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
  const { notify } = useNotifications();
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
  async function saveDetails() {
    const result = await run(save);
    if (!result) return;
    if (result.error) {
      setError("");
      notify({ message: result.error, tone: "error" });
    } else {
      notify({ message: "Item details saved.", tone: "success" });
    }
  }
  const dated = category === "food" || category === "para";
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
            ? `, ${daysLeftText(expiryView.days_left)}`
            : ""
        }`
      : ""
  }`;
  return (
    <PublicShell>
      <main
        id="main"
        className={`container donation-flow donation-step-${step}`}
        aria-busy={busy}
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
              <div
                className="donation-working"
                role="status"
                aria-live="polite"
              >
                {analysing ? (
                  <svg
                    className="donation-analysis-spinner"
                    viewBox="0 0 32 32"
                    aria-hidden="true"
                  >
                    <circle
                      cx="16"
                      cy="16"
                      r="13"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="60 22"
                    />
                  </svg>
                ) : (
                  <Icon name="camera" size={28} />
                )}
                <strong>
                  {analysing
                    ? "Analysing your product…"
                    : "Saving or loading your donation…"}
                </strong>
                <p className="meta muted">
                  {analysing
                    ? "Checking your photos and item details. Keep this page open."
                    : "Keep this page open."}
                </p>
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
                  <form
                    id="donation-photos"
                    className="stack donation-scan"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!event.currentTarget.reportValidity()) return;
                      setAnalysing(true);
                      try {
                        await run(analyse);
                      } finally {
                        setAnalysing(false);
                      }
                    }}
                  >
                    <p className="muted">
                      Add one type of item per donation. If you have several,
                      they must have the same details and printed date.
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
                    <ItemIdentityFields
                      facts={facts}
                      disabled={busy}
                      onChange={(patch) =>
                        setFacts((f) => ({ ...f, ...patch }))
                      }
                    />
                    <DonationPhotos
                      files={files}
                      savedCount={persistedPhotos.length}
                      locked={lockedFiles.length > 0}
                      disabled={busy}
                      showLabel={
                        dated ||
                        files.some(
                          (file) => session.getPhotoKind(file) === "label",
                        ) ||
                        persistedPhotos.some((photo) => photo.kind === "label")
                      }
                      onChange={setFiles}
                      onKind={session.setPhotoKind}
                      getKind={session.getPhotoKind}
                      onError={setError}
                    />
                    {(persistedPhotos.length > 0 || lockedFiles.length > 0) && (
                      <p className="notice">
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
                    {dated && (
                      <p className="meta muted">
                        Keep dates in focus and avoid reflections.
                      </p>
                    )}
                  </form>
                )}
                {step === 0 && !analysing && (
                  <StepActions>
                    <Button
                      size="app"
                      type="submit"
                      form="donation-photos"
                      disabled={
                        busy || (!files.length && !persistedPhotos.length)
                      }
                    >
                      Analyse photos
                      <Icon name="arrow-right" />
                    </Button>
                    <Button
                      size="app"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        const form = document.getElementById(
                          "donation-photos",
                        ) as HTMLFormElement | null;
                        if (form?.reportValidity()) setStep(1);
                      }}
                    >
                      Enter details manually
                    </Button>
                  </StepActions>
                )}
                {step === 1 && (
                  <div className="stack">
                    {analysis && (
                      <SafetyWarnings indicators={analysis.indicators} />
                    )}
                    {donation?.computed.expiry?.effective_expiry_date &&
                      JSON.stringify(facts.expiry) ===
                        JSON.stringify(donation.facts.expiry) && (
                        <section
                          className={`donation-expiry tone-${expiryTone(donation.computed.expiry.bucket)}`}
                          aria-label="Saved expiry date"
                        >
                          <strong>
                            {donation.computed.expiry.expired ||
                            donation.computed.expiry.days_left == null
                              ? "Date passed"
                              : sentenceCase(
                                  daysLeftText(
                                    donation.computed.expiry.days_left,
                                  ),
                                )}
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
                        <PhotoIndicators indicators={analysis.indicators} />
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
                        if (!e.currentTarget.reportValidity()) return;
                        void saveDetails();
                      }}
                    >
                      <SelectField
                        id="category"
                        label="Category (required)"
                        required
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
                      <ItemIdentityFields
                        facts={facts}
                        disabled={busy}
                        onChange={(patch) =>
                          setFacts((f) => ({ ...f, ...patch }))
                        }
                      />
                      <Field
                        label="Number of identical items (required)"
                        id="quantity"
                        type="number"
                        min="1"
                        max="999999999"
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
                        ([key, options]) => {
                          const required =
                            requiredDonationAttributes[category].includes(key);
                          const label = `${factLabel(key)}${required ? " (required)" : ""}`;
                          return options ? (
                            <SelectField
                              key={key}
                              id={key}
                              label={label}
                              required={required}
                              value={String(facts.attributes[key] ?? "")}
                              disabled={busy}
                              onChange={(e) =>
                                attribute(
                                  key,
                                  parseAttributeInput(key, e.target.value),
                                )
                              }
                            >
                              <option value="">
                                {required ? "Select an option" : "Unknown"}
                              </option>
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
                              label={label}
                              required={required}
                              pattern={required ? ".*\\S.*" : undefined}
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
                          );
                        },
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
                      {category === "food" && (
                        <p className="notice">
                          Food must be unopened, non-perishable and stored at
                          room temperature.
                        </p>
                      )}
                      {category === "para" && (
                        <p className="notice">Medicines go to a pharmacy.</p>
                      )}
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
                        {facts.description && (
                          <p className="item-description">
                            {facts.description}
                          </p>
                        )}
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
                            ? "No matching association available"
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
                              No association near this location has a matching
                              need and space right now. Try another location or
                              browse nearby needs.
                            </p>
                            {donation && (
                              <PostingControls
                                key={donation.id}
                                donation={donation}
                                photos={persistedPhotos}
                                onChanged={session.setDonation}
                                allowPosting
                              />
                            )}
                            <NoMatchDropoffs category={category} />
                            <LinkButton href="/donate" size="app">
                              Donate another item
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
                      {facts.description && (
                        <div>
                          <dt>Description</dt>
                          <dd className="item-description">
                            {facts.description}
                          </dd>
                        </div>
                      )}
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
                      Donate another item
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
function PhotoIndicators({ indicators }: { indicators: Indicator[] }) {
  const ranked = rankIndicators(indicators);
  const raised = ranked.filter(
    (i) => indicatorTone(i.key, i.level) !== "neutral",
  );
  const rest = ranked.filter((i) => !raised.includes(i));
  return (
    <>
      {raised.length ? (
        raised.map((i) => <IndicatorRow key={i.key} indicator={i} />)
      ) : (
        <p>No check is estimated likely.</p>
      )}
      {rest.length > 0 && (
        <details className="donation-indicator-more">
          <summary>
            {raised.length
              ? `Show ${rest.length} more ${rest.length === 1 ? "check" : "checks"}`
              : `Show all ${rest.length} checks`}
          </summary>
          <div className="donation-indicator-more-list">
            {rest.map((i) => (
              <IndicatorRow key={i.key} indicator={i} />
            ))}
          </div>
        </details>
      )}
    </>
  );
}
const REDIRECT_KIND_LABELS: Record<string, string> = {
  pharmacy: "Pharmacy",
  textile_bin: "Textile bin",
  repair_cafe: "Repair café",
};
const DROPOFF_KINDS: Record<Category, RedirectPoint["kind"][]> = {
  clothes: ["textile_bin", "repair_cafe"],
  shoes: ["textile_bin", "repair_cafe"],
  furniture: ["repair_cafe"],
  food: [],
  para: [],
};
function sentenceCase(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function RedirectPoints({
  label,
  points,
}: {
  label: string;
  points: ReturnType<typeof useApiPage<RedirectPoint>>;
}) {
  return (
    <>
      {points.loading && (
        <p className="meta muted" role="status">
          Loading {label.toLowerCase()}…
        </p>
      )}
      {points.error && (
        <p className="meta muted">{label} are unavailable right now.</p>
      )}
      {!points.loading && !points.error && !points.data.length && (
        <p className="meta muted">No {label.toLowerCase()} are listed yet.</p>
      )}
      {points.data.length > 0 && (
        <ul className="donation-redirect-list">
          {points.data.map((point) => (
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
    </>
  );
}
function NoMatchDropoffs({ category }: { category: Category }) {
  const kinds = DROPOFF_KINDS[category];
  const points = useApiPage<RedirectPoint>(
    kinds.length ? "/redirect-points" : null,
  );
  if (!kinds.length) return null;
  return (
    <section
      className="stack-sm donation-redirect"
      aria-label="Other drop-off points"
    >
      <h3>Other drop-off points</h3>
      <RedirectPoints
        label="Drop-off points"
        points={{
          ...points,
          data: points.data.filter((point) => kinds.includes(point.kind)),
        }}
      />
    </section>
  );
}
function SafetyWarnings({ indicators }: { indicators: Indicator[] }) {
  const warnings = safetyWarnings(indicators);
  const medicine = warnings.some((w) => w.key === "looks_like_medicine");
  const pharmacies = useApiPage<RedirectPoint>(
    medicine ? "/redirect-points?kind=pharmacy" : null,
  );
  if (!warnings.length) return null;
  return (
    <>
      {warnings.map((warning) => {
        const isMedicine = warning.key === "looks_like_medicine";
        return (
          <section
            key={warning.key}
            className="warning-panel"
            aria-label={
              isMedicine ? "Medicine warning" : "Chilled food warning"
            }
          >
            <div className="row between">
              <strong>
                {isMedicine
                  ? "This looks like a medicine"
                  : "This looks like chilled or frozen food"}
              </strong>
              <span className="num">
                Likely, {Math.round((warning.probability ?? 0) * 100)}%
              </span>
            </div>
            <p>
              {isMedicine
                ? "Medicines can't be donated through Dono. Take them to a pharmacy. If it isn't a medicine, you can continue and staff will check it."
                : "Individuals can only give food stored at room temperature. If it doesn't need the fridge or freezer, you can continue and staff will check it."}
            </p>
          </section>
        );
      })}
      {medicine && (
        <section className="stack-sm donation-redirect" aria-label="Pharmacies">
          <h3>Pharmacies</h3>
          <RedirectPoints
            label="Pharmacies"
            points={{
              ...pharmacies,
              data: pharmacies.data.filter(
                (point) => point.kind === "pharmacy",
              ),
            }}
          />
        </section>
      )}
    </>
  );
}
/** Shown when a donor returns to a donation that already has an active offer. */
function ActiveOfferReview({ donation }: { donation: Donation }) {
  const { status, effective, latest } = useDonationStatus(donation);
  const approved = effective === "approved";
  const closed = ["refused", "cancelled", "expired", "withdrawn"].includes(
    effective ?? "",
  );
  const pending = !status.loading && effective === "pending_review";
  return (
    <Card className="stack donation-sent donation-offer-review">
      <span
        className={`donation-sent-icon ${approved ? "" : pending ? "tone-caution" : "tone-neutral"}`}
      >
        <Icon
          name={approved ? "check" : closed ? "close" : "clock"}
          size={28}
        />
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
            {donation.facts.description && (
              <div>
                <dt>Description</dt>
                <dd className="item-description">
                  {donation.facts.description}
                </dd>
              </div>
            )}
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
              ? `Association staff will review your offer${
                  latest?.review_deadline
                    ? ` by ${new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "short",
                        timeZone: "Europe/Paris",
                      }).format(new Date(latest.review_deadline))}`
                    : ""
                }. Check its status in My donations.`
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
