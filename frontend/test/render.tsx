import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach } from "vitest";

// Use React's actual renderer. Tests mock service boundaries, never hook state.
const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const mounted = new Map<HTMLElement, Root>();

export async function render(element: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.set(container, root);
  await act(async () => root.render(element));

  return {
    container,
    async rerender(next: ReactNode) {
      await act(async () => root.render(next));
    },
    async unmount() {
      if (!mounted.delete(container)) return;
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

afterEach(async () => {
  for (const [container, root] of mounted) {
    await act(async () => root.unmount());
    container.remove();
  }
  mounted.clear();
});
