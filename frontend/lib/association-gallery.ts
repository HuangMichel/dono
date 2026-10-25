import type { DemoState } from "./demo-store";

type GallerySource = Pick<
  DemoState,
  "donations" | "analyses" | "photos" | "expiry_facts"
>;

export function associationGallery(
  state: GallerySource,
  associationId: string,
) {
  const donations = state.donations.filter(
    (donation) =>
      donation.association_id === associationId && donation.status !== "draft",
  );
  const basisIds = new Set(
    donations.map((donation) => donation.basis_analysis_id),
  );
  const analysisById = new Map<string, DemoState["analyses"][number]>();
  const photoByDonationId = new Map<string, DemoState["photos"][number]>();
  const expiryByDonationId = new Map<
    string,
    DemoState["expiry_facts"][number]
  >();
  const keys = new Set<string>();
  for (const analysis of state.analyses) {
    // Preserve Array.find semantics when evidence contains duplicate IDs.
    if (!analysisById.has(analysis.id)) analysisById.set(analysis.id, analysis);
    if (basisIds.has(analysis.id)) {
      for (const indicator of analysis.indicators) keys.add(indicator.key);
    }
  }
  for (const photo of state.photos) {
    if (!photoByDonationId.has(photo.donation_id))
      photoByDonationId.set(photo.donation_id, photo);
  }
  for (const facts of state.expiry_facts) {
    if (!expiryByDonationId.has(facts.donation_id))
      expiryByDonationId.set(facts.donation_id, facts);
  }
  return {
    donations,
    keys: [...keys],
    analysisById,
    photoByDonationId,
    expiryByDonationId,
  };
}

export function filterGalleryDonations(
  gallery: ReturnType<typeof associationGallery>,
  category: string,
  indicator: string,
  level: string,
) {
  return gallery.donations.filter((donation) => {
    if (category !== "all" && donation.category !== category) return false;
    if (!indicator && !level) return true;
    const analysis =
      donation.basis_analysis_id === null
        ? undefined
        : gallery.analysisById.get(donation.basis_analysis_id);
    return (
      analysis?.indicators.some(
        (item) =>
          (!indicator || item.key === indicator) &&
          (!level || item.level === level),
      ) ?? false
    );
  });
}
