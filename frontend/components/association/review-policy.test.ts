import { describe, expect, it } from "vitest";
import { requiredReviewChecks, reviewChecks } from "./review-policy";
describe("staff review assertions", () => {
  it("requires food and manual evidence review in addition to medicine check", () => {
    expect(
      requiredReviewChecks({
        category: "food",
        computed: {
          manual_review_required: true,
          expiry: { required_date_checks: ["ddm_passed_ack"] },
        },
      }),
    ).toEqual([
      "not_medicine",
      "eligible_individual_food",
      "analysis_unavailable_ack",
      "ddm_passed_ack",
    ]);
  });
  it("never converts unchecked assertions into true", () => {
    expect(reviewChecks({ not_medicine: true, ddm_passed_ack: false })).toEqual(
      { not_medicine: true },
    );
  });
});
