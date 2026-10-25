import type {
  Category,
  Donation,
  DonationPatch,
  ExpiryInput,
} from "@/lib/contracts";

export type WorkingDetails = {
  product: string;
  category: Category;
  quantity: string;
  size: string;
  expiry: string;
  paoMonths: string;
  dateType: "DLC" | "DDM" | "expiry" | "PAO";
};

export function hydrateWorkingDetails(
  donation?: Pick<Donation, "category" | "quantity" | "attributes">,
  facts?: Pick<ExpiryInput, "expiry_date" | "date_type" | "pao_months">,
): WorkingDetails {
  return {
    product: String(donation?.attributes.product ?? "Winter coat"),
    category: donation?.category ?? "clothes",
    quantity: donation?.quantity ?? "1",
    size: String(donation?.attributes.size ?? "M"),
    expiry: facts?.expiry_date ?? "",
    paoMonths: facts?.pao_months?.toString() ?? "",
    dateType: facts?.date_type ?? "DDM",
  };
}

export function workingDetailsPatch({
  product,
  category,
  quantity,
  size,
  expiry,
  paoMonths,
  dateType,
}: WorkingDetails): Omit<DonationPatch, "expected_revision"> {
  return {
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
          } satisfies ExpiryInput,
        }
      : {}),
  };
}
