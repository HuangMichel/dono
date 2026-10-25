import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/ui", () => ({
  Button: (props: import("react").ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} />
  ),
  Icon: () => <svg aria-hidden="true" />,
}));
import { Pagination } from "./pagination";

it("announces an empty range and disables both directions", () => {
  const html = renderToStaticMarkup(
    <Pagination
      page={1}
      totalItems={0}
      pageSize={10}
      onPageChange={vi.fn()}
      label="Donations pagination"
    />,
  );
  expect(html).toContain('aria-label="Donations pagination"');
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain("0–0 of 0 results");
  expect(html.match(/disabled=""/g)).toHaveLength(2);
  expect(html).toContain("Page 1 of 1");
  expect(html).toContain('aria-label="Previous page"');
  expect(html).toContain('aria-label="Next page"');
});
it("renders nothing for a single page when asked to hide it", () => {
  const props = { page: 1, pageSize: 10, onPageChange: vi.fn() };
  expect(
    renderToStaticMarkup(
      <Pagination {...props} totalItems={10} hideSinglePage />,
    ),
  ).toBe("");
  expect(
    renderToStaticMarkup(
      <Pagination {...props} totalItems={11} hideSinglePage />,
    ),
  ).toContain("Page 1 of 2");
});
it("renders the final partial range with only Next disabled", () => {
  const html = renderToStaticMarkup(
    <Pagination
      page={3}
      totalItems={25}
      pageSize={10}
      onPageChange={vi.fn()}
    />,
  );
  expect(html).toContain("21–25 of 25 results");
  expect(html).toContain("Page 3 of 3");
  expect(html.match(/disabled=""/g)).toHaveLength(1);
});
