"use client";
import { useEffect, useRef, useState } from "react";
import { PublicShell, DemoTools } from "@/components/public-shell";
import { Button, Card, Field, Chip, LinkButton, Icon } from "@/components/ui";
import { StepActions } from "@/components/ui/step-actions";
import {
  normalizeSiret,
  validateRegistrationIdentity,
} from "@/lib/registration-validation";
import { Stepper } from "@/components/ui/stepper";
import { useDemo } from "@/lib/demo-context";
const registrationSteps = ["Identity", "Donation address", "Review"];
export default function Register() {
  const { state, dispatch, storageError } = useDemo();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [rna, setRna] = useState("");
  const [siret, setSiret] = useState("");
  const [address, setAddress] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [identityAttempted, setIdentityAttempted] = useState(false);
  const [siretTouched, setSiretTouched] = useState(false);
  const checkedIdentity = validateRegistrationIdentity(name, rna, siret);
  const identityErrors = identityAttempted
    ? checkedIdentity
    : siretTouched
      ? { siret: checkedIdentity.siret }
      : {};
  const titleRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) titleRef.current?.focus();
    mounted.current = true;
  }, [step, sent]);
  function goTo(next: number) {
    setError("");

    setStep(next);
  }
  function validateIdentity() {
    setIdentityAttempted(true);
    const errors = validateRegistrationIdentity(name, rna, siret);
    const firstInvalid = errors.name
      ? "association-name"
      : errors.rna
        ? "registration-rna"
        : errors.siret
          ? "registration-siret"
          : null;
    if (!firstInvalid) return true;
    setError("Check the highlighted identity fields.");
    setStep(0);
    requestAnimationFrame(() => document.getElementById(firstInvalid)?.focus());
    return false;
  }
  function continueOrSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (step === 0 && !validateIdentity()) return;
    if (step < 2) {
      goTo(step + 1);
      return;
    }
    if (!validateIdentity()) return;
    if (!state.role) {
      setError("Choose the donor demo role below before submitting.");
      return;
    }
    try {
      dispatch({
        type: "register",
        name,
        rna,
        siret,
        display_address: address,
      });
      setError("");
      setSent(true);
    } catch (error) {
      setError((error as Error).message);
    }
  }
  const title = sent
    ? storageError
      ? "Registration kept for this session"
      : "Registration saved"
    : step === 0
      ? "Register your association"
      : step === 1
        ? "Where can donors bring items?"
        : "Review your registration";
  return (
    <PublicShell>
      <main id="main" className="container registration-page">
        {!sent && (
          <Stepper
            labels={registrationSteps}
            currentStep={step}
            label="Registration progress"
          />
        )}
        <header className="page-heading">
          <div>
            <h1 ref={titleRef} tabIndex={-1}>
              {title}
            </h1>
            <p className="muted">
              {sent
                ? "Your association is waiting for platform review."
                : step === 0
                  ? "Tell us who you are. Provide at least one legal reference."
                  : step === 1
                    ? "Add an optional donation address, or skip this step."
                    : "Check your details before submitting this demo registration."}
            </p>
          </div>
        </header>
        {sent ? (
          <Card className="stack">
            <Chip variant="caution">Pending platform review</Chip>
            <h2>{name.trim()}</h2>
            <p>
              You can configure categories, capacity and drop-off slots after
              activation.
            </p>
            <LinkButton href="/login" variant="outline">
              <Icon name="arrow-left" />
              Back to demo account
            </LinkButton>
            <DemoTools>
              <p className="meta muted">
                {storageError
                  ? "This registration is available for this session only. Retry saving with the browser storage notice."
                  : "This registration is saved only in this browser."}{" "}
                No membership or real access is granted.
              </p>
            </DemoTools>
          </Card>
        ) : (
          <>
            <form
              id="association-registration"
              noValidate
              onSubmit={continueOrSubmit}
              className="stack"
            >
              {error && (
                <p
                  id="registration-error"
                  className="notice error"
                  role="alert"
                >
                  {error}
                </p>
              )}
              {step === 0 && (
                <section className="stack">
                  <Field
                    label="Association name"
                    id="association-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    error={identityErrors.name}
                  />
                  <div className="registration-identifiers">
                    <Field
                      label="RNA reference"
                      id="registration-rna"
                      value={rna}
                      onChange={(e) => setRna(e.target.value)}
                      required={!normalizeSiret(siret)}
                      error={identityErrors.rna}
                      aria-describedby="identifier-help"
                    />
                    <Field
                      label="SIRET reference"
                      id="registration-siret"
                      value={siret}
                      onChange={(e) => setSiret(e.target.value)}
                      required={!rna.trim()}
                      error={identityErrors.siret}
                      aria-describedby="identifier-help siret-help"
                      onBlur={() => setSiretTouched(true)}
                    />
                  </div>
                  <p id="identifier-help" className="meta muted">
                    Provide an RNA reference, a SIRET reference, or both.
                  </p>
                  <p id="siret-help" className="meta muted">
                    SIRET syntax and checksums are checked here. This does not
                    verify registration in the SIRENE register.
                  </p>
                </section>
              )}
              {step === 1 && (
                <section className="stack-sm">
                  <Field
                    label="Donation address (optional)"
                    id="donation-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    autoComplete="street-address"
                    placeholder="Street, postcode and town"
                  />
                  <p className="meta muted">
                    Use the address where donors can bring their donations.
                  </p>
                </section>
              )}
              {step === 2 && (
                <>
                  <dl className="facts-list registration-review">
                    <div>
                      <dt>Association</dt>
                      <dd>{name.trim()}</dd>
                    </div>
                    <div>
                      <dt>RNA</dt>
                      <dd>{rna.trim() || "Not provided"}</dd>
                    </div>
                    <div>
                      <dt>SIRET</dt>
                      <dd>{normalizeSiret(siret) || "Not provided"}</dd>
                    </div>
                    <div>
                      <dt>Donation address</dt>
                      <dd>{address.trim() || "Not provided"}</dd>
                    </div>
                  </dl>
                  {!state.role && (
                    <Card className="stack-sm">
                      <h2>Choose a demo role to submit</h2>
                      <p className="meta muted">
                        Continue as the donor demo persona. Your registration
                        details stay on this page.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          dispatch({ type: "role", role: "donor" });
                          setError("");
                        }}
                      >
                        Use donor demo role
                      </Button>
                    </Card>
                  )}
                </>
              )}
              <DemoTools>
                <p className="meta muted">
                  Registration uses fictional local data. SIRENE registry lookup
                  and address geocoding are not connected. Submission keeps the
                  association pending review.
                </p>
              </DemoTools>
            </form>
            <StepActions
              onBack={step > 0 ? () => goTo(step - 1) : undefined}
              backHref={step === 0 ? "/login" : undefined}
            >
              {step === 1 && (
                <Button
                  type="button"
                  variant="soft"
                  onClick={() => {
                    setAddress("");
                    goTo(2);
                  }}
                >
                  Skip address
                  <Icon name="arrow-right" />
                </Button>
              )}
              {step < 2 ? (
                <Button
                  type="submit"
                  form="association-registration"
                  size="app"
                >
                  {step === 1 ? "Review registration" : "Continue"}
                  <Icon name="arrow-right" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  form="association-registration"
                  size="app"
                  disabled={!state.role}
                >
                  Submit demo registration
                  <Icon name="arrow-right" />
                </Button>
              )}
            </StepActions>
          </>
        )}
      </main>
    </PublicShell>
  );
}
