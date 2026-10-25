export function normalizeSiret(value: string): string {
  return value.replace(/\s/g, "");
}

function passesLuhn(value: string): boolean {
  const digits = [...value].reverse();
  return (
    digits.reduce((sum, digit, index) => {
      let number = Number(digit) * (index % 2 === 1 ? 2 : 1);
      if (number > 9) number -= 9;
      return sum + number;
    }, 0) %
      10 ===
    0
  );
}

// Syntax/checksum only. This does not query the SIRENE register.
export function isValidSiret(value: string): boolean {
  const normalized = normalizeSiret(value);
  if (!/^\d{14}$/.test(normalized) || /^0+$/.test(normalized)) return false;
  const siren = normalized.slice(0, 9);
  if (passesLuhn(siren) && passesLuhn(normalized)) return true;
  return (
    siren === "356000000" &&
    [...normalized].reduce((sum, digit) => sum + Number(digit), 0) % 5 === 0
  );
}

export type RegistrationIdentityErrors = Partial<
  Record<"name" | "rna" | "siret", string>
>;
export function validateRegistrationIdentity(
  name: string,
  rna: string,
  siret: string,
): RegistrationIdentityErrors {
  const errors: RegistrationIdentityErrors = {};
  if (!name.trim()) errors.name = "Enter your association name.";
  const normalized = normalizeSiret(siret);
  if (!rna.trim() && !normalized) {
    errors.rna = "Enter your association's RNA or SIRET number.";
    errors.siret = "Enter your association's RNA or SIRET number.";
  } else if (normalized && !isValidSiret(normalized)) {
    errors.siret = "Check the SIRET number. It must contain 14 valid digits.";
  }
  return errors;
}
