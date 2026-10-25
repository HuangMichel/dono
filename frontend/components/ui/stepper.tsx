type StepperProps = {
  labels: readonly string[];
  currentStep: number;
  label: string;
};

/** Read-only progress. The caller owns the current form phase. */
export function Stepper({ labels, currentStep, label }: StepperProps) {
  return (
    <div className="steps" role="list" aria-label={label}>
      {labels.map((step, index) => (
        <span
          key={step}
          role="listitem"
          className={index === currentStep ? "active" : undefined}
          aria-current={index === currentStep ? "step" : undefined}
        >
          <b className="step-marker">{index + 1}</b>
          {step}
        </span>
      ))}
    </div>
  );
}
