import { normalizeDemoState, type DemoState } from "./demo-store";

const KEY = "dono-demo-v1";
export const STORAGE_WRITE_ERROR =
  "Changes are not saved in this browser and may be lost on reload.";
export const STORAGE_READ_ERROR =
  "Previously saved data could not be loaded. Current changes are not saved and may be lost on reload. Retry saving replaces the browser copy with this session.";
type Snapshot = { state: DemoState; storageError: string | null };
type DemoStorage = Pick<Storage, "getItem" | "setItem">;

// Keep the latest session state even when the browser refuses persistence.
export function createDemoPersistence(
  initial: DemoState,
  getStorage: () => DemoStorage,
) {
  let current: Snapshot = { state: initial, storageError: null };
  let unreadBrowserCopy = false;
  function publish(state: DemoState, explicitRetry = false): Snapshot {
    if (unreadBrowserCopy && !explicitRetry) {
      current = { state, storageError: STORAGE_READ_ERROR };
      return current;
    }
    let storageError: string | null = null;
    try {
      getStorage().setItem(KEY, JSON.stringify(state));
      unreadBrowserCopy = false;
    } catch {
      storageError =
        current.storageError === STORAGE_READ_ERROR
          ? STORAGE_READ_ERROR
          : STORAGE_WRITE_ERROR;
    }
    current = { state, storageError };
    return current;
  }
  return {
    snapshot: () => current,
    publish,
    retry: () => publish(current.state, true),
    hydrate(): Snapshot {
      try {
        const saved = getStorage().getItem(KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (!parsed.donations || !parsed.receipt_originals) {
            throw new Error("Unrecognized demo state");
          }
          current = { state: normalizeDemoState(parsed), storageError: null };
        }
      } catch {
        unreadBrowserCopy = true;
        current = { ...current, storageError: STORAGE_READ_ERROR };
      }
      return current;
    },
  };
}
