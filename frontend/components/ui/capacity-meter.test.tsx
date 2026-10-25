import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CapacityMeter } from "./capacity-meter";

it("exposes actual usage and explains threshold boundaries without color alone", () => {
  const html = renderToStaticMarkup(
    <CapacityMeter
      label="Food"
      inStock="0.017"
      reserved="0"
      limit="0.02"
      description="0.017 kg used of 0.02 kg"
    />,
  );
  expect(html).toContain('value="0.017"');
  expect(html).toContain('max="0.02"');
  expect(html).toContain('aria-valuetext="85%"');
  expect(html).toContain('aria-describedby="');
  expect(html).toContain("0.017 kg used of 0.02 kg");
  expect(html).toContain(
    "Green through 60%; orange above 60% through 85%; red above 85%.",
  );
});
it("announces paused intake without representing a positive progress value", () => {
  const html = renderToStaticMarkup(
    <CapacityMeter label="Shoes" inStock="0" reserved="0" limit="0" />,
  );
  expect(html).toContain('value="0"');
  expect(html).toContain('aria-valuetext="Paused, no storage space available"');
  expect(html).toContain("Paused. No storage space available.");
  expect(html).not.toContain("NaN");
});
