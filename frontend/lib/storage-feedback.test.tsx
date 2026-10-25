import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const session = vi.hoisted(() => ({ storageError: null as string | null }));
vi.mock("@/lib/demo-context", () => ({ useDemo: () => session }));
vi.mock("@/components/ui", () => ({
  Button: "button",
  Chip: "span",
  Icon: () => null,
  LinkButton: "a",
}));
vi.mock("../components/ui", () => ({ Button: "button" }));
import { OfferSent } from "../components/donor/flow-states";
import { StorageNotice } from "../components/storage-notice";
import { STORAGE_WRITE_ERROR } from "./demo-persistence";

describe("storage feedback", () => {
  it("shows an accessible warning and retry while the offer avoids a saved claim", () => {
    session.storageError = STORAGE_WRITE_ERROR;
    const notice = renderToStaticMarkup(
      <StorageNotice error={session.storageError} retry={() => {}} />,
    );
    expect(notice).toContain('role="alert"');
    expect(notice).toContain("may be lost on reload");
    expect(notice).toContain("Retry saving");
    const offer = renderToStaticMarkup(<OfferSent />);
    expect(offer).toContain("not saved in this browser");
    expect(offer).not.toContain("Your offer is saved in this browser");
  });
  it("removes the notice and restores saved copy after persistence succeeds", () => {
    session.storageError = null;
    expect(
      renderToStaticMarkup(<StorageNotice error={null} retry={() => {}} />),
    ).toBe("");
    expect(renderToStaticMarkup(<OfferSent />)).toContain(
      "Your offer is saved in this browser.",
    );
  });
});
