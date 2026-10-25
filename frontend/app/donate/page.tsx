"use client";
import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PublicShell, DemoTools } from "@/components/public-shell";
import {
  Button,
  Card,
  Chip,
  Field,
  SelectField,
  PageHeading,
  Icon,
  LinkButton,
} from "@/components/ui";
import { useDemo } from "@/lib/demo-context";
import { StepActions } from "@/components/ui/step-actions";
import { Stepper } from "@/components/ui/stepper";
import { FileUpload } from "@/components/ui/file-upload";
import {
  createPhotoController,
  DEMO_ITEM_PHOTO_LIMIT,
  type PhotoSnapshot,
} from "@/components/donor/local-photos";
import {
  CATEGORY_LABELS,
  isPostedOffer,
  DEMO_DONOR_ID,
  getMatches,
  getWarnings,
  getExpiry,
} from "@/lib/demo-store";
import {
  AnalysisState,
  PhotoProblem,
  SafetyWarning,
  OfferSent,
} from "@/components/donor/flow-states";
import { DonationHome } from "@/components/donor/donation-home";
import type { Category } from "@/lib/contracts";
export default function Donate() {
  return (
    <Suspense fallback={<p>Loading donation…</p>}>
      <DonationRoute />
    </Suspense>
  );
}
function DonationRoute() {
  const params = useSearchParams();
  const donationId = params.get("id");
  const scenario = params.get("scenario");
  const initialScenario = (
    scenario &&
    [
      "clothes",
      "shoes",
      "food",
      "para",
      "furniture",
      "medicine",
      "cold",
    ].includes(scenario)
      ? scenario
      : "clothes"
  ) as Category | "medicine" | "cold";
  return (
    <DonationFlow
      key={donationId ?? "new"}
      donationId={donationId}
      initialScenario={initialScenario}
    />
  );
}
function DonationFlow({
  donationId,
  initialScenario,
}: {
  donationId: string | null;
  initialScenario: Category | "medicine" | "cold";
}) {
  const { state, dispatch, ready } = useDemo(),
    router = useRouter(),
    [step, setStep] = useState(0),
    [scenario, setScenario] = useState<Category | "medicine" | "cold">(
      initialScenario,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [fail, setFail] = useState(false),
    [unclear, setUnclear] = useState(false),
    [photoProblem, setPhotoProblem] = useState<"failed" | "unclear" | null>(
      null,
    ),
    [reviewWarning, setReviewWarning] = useState(false),
    [product, setProduct] = useState("Winter coat"),
    [category, setCategory] = useState<Category>("clothes"),
    [quantity, setQuantity] = useState("1"),
    [size, setSize] = useState("M"),
    [expiry, setExpiry] = useState(""),
    [paoMonths, setPaoMonths] = useState(""),
    [dateType, setDateType] = useState<"DLC" | "DDM" | "expiry" | "PAO">("DDM"),
    [location, setLocation] = useState("Paris 11e (fixture location)"),
    [selected, setSelected] = useState("");
  const [photoState, setPhotoState] = useState<PhotoSnapshot>({
    photos: [],
    errors: [],
  });
  const [photoController] = useState(() =>
    createPhotoController(setPhotoState),
  );
  const itemPhotos = photoState.photos.filter((photo) => photo.kind === "item");
  const labelPhotos = photoState.photos.filter(
    (photo) => photo.kind === "label",
  );
  const mainPhoto = itemPhotos.find((photo) => photo.src);
  const photo = mainPhoto?.src ?? "";
  const readingPhotos = photoState.photos.some((photo) => photo.loading);
  useEffect(() => () => photoController.dispose(), [photoController]);
  const correctionSheet = useRef<HTMLDialogElement>(null);
  const correctionSnapshot = useRef<{
    product: string;
    category: Category;
    quantity: string;
    size: string;
    expiry: string;
    paoMonths: string;
    dateType: typeof dateType;
  } | null>(null);
  const alert = useRef<HTMLDivElement>(null),
    sheetAlert = useRef<HTMLDivElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const donation = state.donations.find((d) => d.id === donationId),
    analysis = state.analyses.find((a) => a.id === donation?.basis_analysis_id),
    matches = donation ? getMatches(state, donation) : [];
  const expiryRead = donation ? getExpiry(state, donation.id) : null;
  const hydratedId = useRef<string | null>(null);
  useEffect(() => {
    if (!donation || hydratedId.current === donation.id) return;
    hydratedId.current = donation.id;
    const facts = state.expiry_facts.find((f) => f.donation_id === donation.id);
    // Hydrate once per draft; later local edits belong to this form until saved.
    setCategory(donation.category ?? "clothes");
    setScenario((current) =>
      current === "medicine" || current === "cold"
        ? current
        : (donation.category ?? "clothes"),
    );
    setQuantity(donation.quantity ?? "1");
    setProduct(String(donation.attributes.product ?? "Winter coat"));
    setSize(String(donation.attributes.size ?? "M"));
    setExpiry(facts?.expiry_date ?? "");
    setDateType(facts?.date_type ?? "DDM");
    setPaoMonths(facts?.pao_months?.toString() ?? "");
  }, [donation, state.expiry_facts]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function showError(e: unknown) {
    setError(e instanceof Error ? e.message : String(e));
    setTimeout(
      () =>
        (correctionSheet.current?.open
          ? sheetAlert.current
          : alert.current
        )?.focus(),
      0,
    );
  }
  function initialize() {
    try {
      if (donation) {
        setCategory(donation.category ?? "clothes");
        setProduct(String(donation.attributes.product ?? ""));
        setQuantity(donation.quantity ?? "1");
        setStep(analysis ? 1 : 0);
        return;
      }
      const next = crypto.randomUUID();
      dispatch({
        type: "create",
        id: next,
        input: {
          category:
            scenario === "medicine"
              ? "para"
              : scenario === "cold"
                ? "food"
                : scenario,
          quantity: "1",
          unit: "item",
        },
      });
      router.replace("/donate?id=" + next + "&scenario=" + scenario);
    } catch (e) {
      showError(e);
    }
  }
  function analyse(forceSuccess = false) {
    if (!donation) return;
    setBusy(true);
    setPhotoProblem(null);
    setError("");
    timer.current = setTimeout(() => {
      setBusy(false);
      if (!forceSuccess && (fail || unclear)) {
        setPhotoProblem(unclear ? "unclear" : "failed");
        return;
      }
      try {
        dispatch({
          type: "analyse",
          id: donation.id,
          scenario,
          expected_revision: donation.revision,
        });
        const cat =
          scenario === "medicine"
            ? "para"
            : scenario === "cold"
              ? "food"
              : scenario;
        if (!donation.basis_analysis_id) {
          setCategory(cat);
          if (!donation.attributes.product)
            setProduct(
              cat === "food"
                ? "Sealed pasta, 500 g"
                : cat === "clothes"
                  ? "Winter coat"
                  : "Demo item",
            );
        }
        setStep(1);
      } catch (e) {
        showError(e);
      }
    }, 650);
  }
  function openCorrections() {
    correctionSnapshot.current = {
      product,
      category,
      quantity,
      size,
      expiry,
      paoMonths,
      dateType,
    };
    setError("");
    correctionSheet.current?.showModal();
  }
  function discardCorrections() {
    const original = correctionSnapshot.current;
    if (!original) return;
    setProduct(original.product);
    setCategory(original.category);
    setQuantity(original.quantity);
    setSize(original.size);
    setExpiry(original.expiry);
    setPaoMonths(original.paoMonths);
    setDateType(original.dateType);
    setError("");
    correctionSnapshot.current = null;
  }
  function dismissCorrections() {
    discardCorrections();
    correctionSheet.current?.close();
  }
  function save() {
    if (!donation) return;
    try {
      if (!product.trim()) {
        document.getElementById("working-product")?.focus();
        throw Error("Enter a product description.");
      }
      dispatch({
        type: "patch",
        id: donation.id,
        expected_revision: donation.revision,
        patch: {
          category,
          quantity,
          attributes: { product, ...(category === "clothes" ? { size } : {}) },
          ...(["food", "para"].includes(category)
            ? {
                expiry: {
                  expiry_date: dateType === "PAO" ? null : expiry || null,
                  date_type: dateType,
                  pao_months:
                    dateType === "PAO" && paoMonths ? Number(paoMonths) : null,
                  date_precision: expiry ? "day" : "unknown",
                  raw_label: expiry || null,
                  readability: expiry ? "readable" : "unknown",
                },
              }
            : {}),
        },
      });
      setError("");
      correctionSnapshot.current = null;
      correctionSheet.current?.close();
      setStep(2);
    } catch (e) {
      showError(e);
    }
  }
  function offer() {
    if (!donation) return;
    try {
      if (!location.trim()) throw Error("Enter a location.");
      dispatch({
        type: "offer",
        id: donation.id,
        need_id: selected || matches[0]?.need_id || "",
        expected_revision: donation.revision,
      });
      setStep(3);
      setError("");
    } catch (e) {
      showError(e);
    }
  }
  if (!ready)
    return (
      <PublicShell>
        <main id="main" className="container narrow" aria-busy="true">
          Loading your demo draft…
        </main>
      </PublicShell>
    );
  if (state.role !== "donor")
    return (
      <PublicShell>
        <main id="main" className="container narrow">
          <Card className="stack">
            <h1>Prepare a useful donation</h1>
            <p>Choose the donor role to create and track an offer.</p>
            <Link href="/login" className="button button-primary">
              Choose donor demo
            </Link>
          </Card>
        </main>
      </PublicShell>
    );
  if (donation && donation.donor_id !== DEMO_DONOR_ID)
    return (
      <PublicShell>
        <main id="main" className="container narrow">
          <h1>Donation unavailable</h1>
          <LinkButton href="/donations">My donations</LinkButton>
        </main>
      </PublicShell>
    );
  if (donation && isPostedOffer(state, donation.id))
    return (
      <PublicShell>
        <main id="main" className="container narrow state-container">
          <section className="flow-state stack">
            <Chip>Posted</Chip>
            <h1>Your offer is posted</h1>
            <p>
              {String(donation.attributes.product)}, {donation.quantity} units
            </p>
            <p className="muted">
              Associations can browse your item in Offers nearby.
            </p>
            <p className="meta muted">
              Withdraw the post to change the item details.
            </p>
            {error && (
              <div
                role="alert"
                tabIndex={-1}
                ref={alert}
                className="notice danger"
              >
                {error}
              </div>
            )}
            <LinkButton href="/donations" size="app">
              View my donations
            </LinkButton>
            <Button
              variant="outline"
              size="app"
              onClick={() => {
                try {
                  dispatch({
                    type: "withdrawOffer",
                    id: donation.id,
                    expected_revision: donation.revision,
                  });
                  setStep(1);
                  setError("");
                } catch (e) {
                  showError(e);
                }
              }}
            >
              Withdraw post
            </Button>
          </section>
        </main>
      </PublicShell>
    );
  if (donation && donation.status !== "draft" && step !== 3)
    return (
      <PublicShell>
        <main id="main" className="container narrow">
          <Card className="stack">
            <h1>This donation has already been offered</h1>
            <p>Working facts are locked after offering.</p>
            <Link href="/donations" className="button button-primary">
              View my donations
            </Link>
          </Card>
        </main>
      </PublicShell>
    );
  const warningKeys = donation ? getWarnings(state, donation.id) : [];
  const warningScreen = step === 1 && warningKeys.length > 0 && !reviewWarning;
  const homeScreen = !donation && step === 0;
  const noMatch = step === 2 && matches.length === 0;
  const dedicatedState =
    busy || photoProblem || warningScreen || noMatch || step === 3;
  const pageBack =
    step === 0 && !dedicatedState
      ? {
          href: donation ? "/donate" : "/",
          label: donation ? "Back to donation home" : "Back to Dono home",
        }
      : undefined;
  return (
    <PublicShell donorBack={pageBack}>
      <main
        id="main"
        className={`container narrow donation-flow ${dedicatedState ? "state-container" : ""} ${step === 2 && !noMatch ? "matching-page" : ""} ${homeScreen ? "home-screen" : ""} ${step === 0 && donation && !dedicatedState ? "photograph-screen" : ""}`}
      >
        {pageBack && (
          <LinkButton
            href={pageBack.href}
            variant="outline"
            className="donation-page-back"
            aria-label={pageBack.label}
            title={pageBack.label}
          >
            <Icon name="arrow-left" size={20} />
          </LinkButton>
        )}
        {!dedicatedState && !homeScreen && (
          <PageHeading
            title={
              step === 0
                ? "Photograph your item"
                : step === 1
                  ? "Check your item details"
                  : step === 2
                    ? `${matches.length} association${matches.length === 1 ? "" : "s"} need${matches.length === 1 ? "s" : ""} this`
                    : "Your offer is sent"
            }
            description={
              step === 0
                ? "One product type per donation. Identical units share the same details and date."
                : undefined
            }
          />
        )}
        {!dedicatedState && !homeScreen && step < 3 && (
          <Stepper
            labels={["Photos", "Check details", "Match & offer"]}
            currentStep={step}
            label="Donation progress"
          />
        )}
        {error && (
          <div
            ref={alert}
            tabIndex={-1}
            role="alert"
            className="notice error"
            style={{ marginBottom: 24 }}
          >
            {error}
          </div>
        )}
        {busy && <AnalysisState photo={photo} />}
        {!busy && photoProblem && (
          <PhotoProblem
            photo={photo}
            unclear={photoProblem === "unclear"}
            retry={() => {
              setFail(false);
              setUnclear(false);
              analyse(true);
            }}
            replace={() => {
              setPhotoProblem(null);
              setUnclear(false);
              setFail(false);
            }}
          />
        )}
        {warningScreen && (
          <SafetyWarning
            medicine={warningKeys.includes("medicine_concern")}
            review={() => setReviewWarning(true)}
            back={() => {
              setStep(0);
              setReviewWarning(false);
            }}
          />
        )}
        {step === 0 && !busy && !photoProblem && (
          <div className="stack">
            {!donation ? (
              <DonationHome
                scan={initialize}
                scenario={scenario}
                setScenario={setScenario}
              />
            ) : (
              <>
                <form
                  id="donation-photo-step"
                  className="stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (photo && !busy && !readingPhotos) analyse();
                  }}
                >
                  {photoState.errors.length > 0 && (
                    <div className="notice error" role="alert">
                      <ul>
                        {photoState.errors.map((message, index) => (
                          <li key={`${index}-${message}`}>{message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="scan-grid">
                    <FileUpload
                      id="item-photo"
                      label="Item photos"
                      description="Add front, back or side photos of the same item."
                      photos={itemPhotos}
                      multiple
                      primaryId={mainPhoto?.id}
                      disabled={busy}
                      onFilesChange={(files) =>
                        photoController.addFiles(files, "item")
                      }
                      onReplace={photoController.replace}
                      onRemove={photoController.remove}
                      onPrimary={photoController.makePrimary}
                      onUseSample={() => {
                        photoController.addSamples(
                          scenario === "medicine"
                            ? "para"
                            : scenario === "cold"
                              ? "food"
                              : scenario,
                        );
                        setError("");
                      }}
                    />
                    <FileUpload
                      id="label-photo"
                      label="Label close-up"
                      description="Show the printed date and product details."
                      photos={labelPhotos}
                      optional
                      disabled={busy}
                      onFilesChange={(files) =>
                        photoController.addFiles(files, "label")
                      }
                      onReplace={photoController.replace}
                      onRemove={photoController.remove}
                    />
                  </div>
                  <p className="meta muted">
                    Demo limit: {DEMO_ITEM_PHOTO_LIMIT} item photos and one
                    label photo. Samples demonstrate the gallery only.
                  </p>
                  <DemoTools>
                    <div className="stack-sm" style={{ marginTop: 16 }}>
                      <label className="field-label">
                        Fixture scenario
                        <select
                          value={scenario}
                          onChange={(e) =>
                            setScenario(e.target.value as typeof scenario)
                          }
                        >
                          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                          <option value="medicine">Medicine warning</option>
                          <option value="cold">Chilled food warning</option>
                        </select>
                      </label>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={fail}
                          onChange={(e) => setFail(e.target.checked)}
                        />
                        Simulate analysis failure
                      </label>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={unclear}
                          onChange={(e) => setUnclear(e.target.checked)}
                        />
                        Simulate unclear photo
                      </label>
                    </div>
                    <p className="meta muted">
                      Photos stay in this tab. Sample analysis does not inspect
                      your image. Preview limit: 5 MB.
                    </p>
                  </DemoTools>
                </form>
                <StepActions backHref="/donate" backLabel="Back">
                  <Button
                    type="submit"
                    form="donation-photo-step"
                    size="app"
                    disabled={!photo || busy || readingPhotos}
                  >
                    {readingPhotos
                      ? "Reading photos…"
                      : busy
                        ? "Checking your item…"
                        : "Analyse"}
                    <Icon name="arrow-right" />
                  </Button>
                </StepActions>
              </>
            )}
          </div>
        )}
        {step === 1 && donation && !warningScreen && (
          <div className="stack">
            <div className="details-summary">
              <div className="row">
                <Image
                  width={72}
                  height={72}
                  className="item-image"
                  src={photo || "/item-" + donation.category + ".svg"}
                  alt="Sample item preview"
                  unoptimized
                />
                <div>
                  <strong>{product}</strong>
                  <p className="meta muted">
                    {CATEGORY_LABELS[category]}, {quantity} units
                  </p>
                  {expiry && (
                    <p className="meta">
                      {dateType === "DLC" ? "Use by" : "Best before"}{" "}
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(expiry + "T12:00:00Z"))}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {expiryRead?.days_left !== null &&
              expiryRead?.days_left !== undefined && (
                <section className="expiry-summary">
                  <span className="expiry-days num">
                    {expiryRead.days_left}
                  </span>
                  <div>
                    <p>days left</p>
                    <p className="meta">
                      From the printed date, computed for{" "}
                      {expiryRead.reference_date}, Europe/Paris.
                    </p>
                    <p className="meta">
                      Expiry status and intake policy remain unresolved.
                    </p>
                  </div>
                </section>
              )}
            <section className="indicator-list">
              <div className="row between">
                <h2>Indicators</h2>
                <span className="meta muted">
                  Confidence {Math.round((analysis?.confidence ?? 0) * 100)}%
                </span>
              </div>
              {analysis?.indicators.map((i) => (
                <div className="indicator-row" key={i.key}>
                  <div className="row between">
                    <span>
                      {i.key === "looks_like_medicine"
                        ? "Medicine-like appearance"
                        : i.key === "cold_food"
                          ? "Chilled food concern"
                          : "Stains likely"}
                    </span>
                    <span className="num">
                      {i.probability !== undefined
                        ? new Intl.NumberFormat("en", {
                            style: "percent",
                            maximumFractionDigits: 1,
                          }).format(i.probability)
                        : i.value}
                    </span>
                  </div>
                  {i.probability !== undefined && (
                    <div
                      className={`progress-track ${i.level === "high" ? "warning" : ""}`}
                    >
                      <span style={{ width: i.probability * 100 + "%" }} />
                    </div>
                  )}
                </div>
              ))}
              <p className="meta muted">
                Estimates only. Association staff decide.
              </p>
            </section>
            <Button variant="outline" onClick={openCorrections}>
              Correct details
            </Button>
            <details className="demo-tools">
              <summary>Original sample evidence</summary>
              <p className="meta muted">
                {analysis?.model}. Original facts and indicators remain
                unchanged.
              </p>
              <pre>{JSON.stringify(analysis?.extracted, null, 2)}</pre>
            </details>
            {getWarnings(state, donation.id).map((w) => (
              <section key={w} className="warning-panel">
                <span className="state-icon warning">
                  <Icon name="warning" size={28} />
                </span>
                <strong>
                  {w === "medicine_concern"
                    ? "Medicines cannot be donated. Return them to a pharmacy."
                    : "Chilled or frozen food cannot follow this donation journey."}
                </strong>
                <p>
                  Changing the category keeps the original warning. The demo
                  cannot send this item.
                </p>
              </section>
            ))}
            <dialog
              ref={correctionSheet}
              className="correction-dialog"
              aria-labelledby="correction-title"
              onCancel={discardCorrections}
            >
              <div className="dialog-heading">
                <h2 id="correction-title">Correct item details</h2>
                <button
                  type="button"
                  aria-label="Close corrections"
                  onClick={dismissCorrections}
                >
                  <Icon name="close" />
                </button>
              </div>
              {error && (
                <div
                  ref={sheetAlert}
                  role="alert"
                  tabIndex={-1}
                  className="notice error"
                >
                  {error}
                </div>
              )}
              <form
                id="donation-corrections"
                className="stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  save();
                }}
              >
                <Field
                  id="working-product"
                  required
                  label="Product"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                />
                <div className="grid-two">
                  <SelectField
                    label="Category"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </SelectField>
                  <Field
                    id="working-quantity"
                    required
                    label="Identical units"
                    type="number"
                    min="1"
                    max="999999999"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                {category === "clothes" && (
                  <Field
                    id="working-size"
                    label="Size"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                  />
                )}{" "}
                {["food", "para"].includes(category) && (
                  <>
                    <SelectField
                      label="Printed date type"
                      required
                      value={dateType}
                      onChange={(e) => {
                        setDateType(e.target.value as typeof dateType);
                        if (e.target.value === "PAO") setExpiry("");
                      }}
                    >
                      <option value="DLC">Use by</option>
                      <option value="DDM">Best before</option>
                      <option value="expiry">Expiry</option>
                      <option>PAO</option>
                    </SelectField>
                    {dateType !== "PAO" ? (
                      <Field
                        id="working-expiry"
                        label="Printed date, if readable"
                        type="date"
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                      />
                    ) : (
                      <>
                        <Field
                          id="pao-months"
                          label="Printed PAO months, if readable"
                          type="number"
                          min="1"
                          max="120"
                          value={paoMonths}
                          onChange={(e) => setPaoMonths(e.target.value)}
                        />
                        <p className="notice">
                          PAO is preserved as evidence. No opening date or
                          after-opening expiry is calculated. Opened products
                          are ineligible.
                        </p>
                      </>
                    )}
                    <p className="meta muted">
                      Unclear date? Leave it blank. Expiry buckets and final
                      intake policy remain unresolved.
                    </p>
                  </>
                )}{" "}
                {analysis?.category !== category && (
                  <p className="notice warning">
                    Working category differs from the original analysis. The
                    original evidence remains unchanged. Reanalysis rules are
                    unresolved.
                  </p>
                )}
              </form>
              <StepActions onBack={dismissCorrections} backLabel="Back">
                <Button type="submit" form="donation-corrections" size="app">
                  Save details and continue
                  <Icon name="arrow-right" />
                </Button>
              </StepActions>
            </dialog>
            <form
              id="donation-review-step"
              onSubmit={(event) => {
                event.preventDefault();
                save();
              }}
            />
            <StepActions onBack={() => setStep(0)} backLabel="Back to photos">
              <Button
                type="submit"
                form="donation-review-step"
                size="app"
                disabled={getWarnings(state, donation.id).length > 0}
              >
                Find associations that need it
                <Icon name="arrow-right" />
              </Button>
            </StepActions>
          </div>
        )}
        {step === 2 &&
          donation &&
          (noMatch ? (
            <section className="flow-state">
              <h1>No current match</h1>
              <p className="meta muted">
                {String(donation.attributes.product)}, {donation.quantity} units
              </p>
              <p>Post your item so associations can find it.</p>
              {warningKeys.length > 0 && (
                <p className="notice warning">
                  This item has a safety warning and cannot be posted. Check the
                  item details.
                </p>
              )}
              <StepActions onBack={() => setStep(1)} backLabel="Edit details">
                <Button
                  size="app"
                  disabled={warningKeys.length > 0 || !analysis}
                  onClick={() => {
                    try {
                      dispatch({
                        type: "postOffer",
                        id: donation.id,
                        expected_revision: donation.revision,
                      });
                      setError("");
                    } catch (e) {
                      showError(e);
                    }
                  }}
                >
                  Post offer
                  <Icon name="arrow-right" />
                </Button>
              </StepActions>
            </section>
          ) : (
            <div className="stack">
              <form
                id="donation-match-step"
                className="stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  offer();
                }}
              >
                <p className="muted">
                  {String(donation.attributes.product)}, {donation.quantity}{" "}
                  identical units
                </p>
                <Field
                  id="match-location"
                  required
                  label="Your area, used for this search only"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <div className="match-layout">
                  <fieldset className="match-list">
                    <legend className="sr-only">Choose an association</legend>
                    {matches.map((m) => (
                      <label className="choice" key={m.need_id}>
                        <span className="match-content">
                          <strong>{m.association.name}</strong>
                          <span className="meta muted block">
                            0.8 km example distance
                          </span>
                          <span className="row wrap" style={{ marginTop: 8 }}>
                            <Chip variant="success">Need matches</Chip>
                            <Chip>Has capacity</Chip>
                          </span>
                        </span>
                        <input
                          type="radio"
                          name="match"
                          value={m.need_id}
                          checked={
                            (selected || matches[0]?.need_id) === m.need_id
                          }
                          onChange={() => setSelected(m.need_id)}
                        />
                      </label>
                    ))}
                  </fieldset>
                  <Card className="stack-sm">
                    <h2>Why this match?</h2>
                    <p className="meta muted">
                      Your item matches a local demo need with available
                      capacity.
                    </p>
                    <dl className="facts-list">
                      <div>
                        <dt>Your offer</dt>
                        <dd>{donation.quantity} units</dd>
                      </div>
                      <div>
                        <dt>Active offers</dt>
                        <dd>One per item</dd>
                      </div>
                    </dl>
                    <Button size="app" type="submit" disabled={!matches.length}>
                      Send offer
                      <Icon name="arrow-right" />
                    </Button>
                  </Card>
                </div>
              </form>
              <StepActions onBack={() => setStep(1)} backLabel="Edit details">
                <span />
              </StepActions>
              <DemoTools>
                <p className="meta muted">
                  Matching checks local needs and capacity. Distance is a fixed
                  0.8 km example. Live geocoding, season and radius policy are
                  unavailable.
                </p>
              </DemoTools>
            </div>
          ))}
        {step === 3 && <OfferSent />}
      </main>
    </PublicShell>
  );
}
