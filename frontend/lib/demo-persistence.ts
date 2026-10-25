import { normalizeDemoState, type DemoState } from "./demo-store";

export const DEMO_STORAGE_KEY = "dono-demo-v1";
export const STORAGE_WRITE_ERROR =
  "Changes are not saved in this browser and may be lost on reload.";
export const STORAGE_READ_ERROR =
  "Previously saved data could not be loaded. Current changes are not saved and may be lost on reload. Retry saving replaces the browser copy with this session.";
export const STORAGE_CONFLICT_ERROR =
  "Another tab saved changes while this session has unsaved changes. Your local changes are kept here. Retry saving replaces the browser copy with this session.";
type Snapshot = { state: DemoState; storageError: string | null };
type DemoStorage = Pick<Storage, "getItem" | "setItem">;

// Keep the latest session state even when the browser refuses persistence.
export function createDemoPersistence(
  initial: DemoState,
  getStorage: () => DemoStorage,
) {
  let current: Snapshot = { state: initial, storageError: null };
  let unreadBrowserCopy = false;
  let unsavedChanges = false;
  let browserCopy: string | null = null;
  function readSaved(saved: string): DemoState {
    const parsed = JSON.parse(saved);
    if (!parsed.donations || !parsed.receipt_originals) {
      throw new Error("Unrecognized demo state");
    }
    return normalizeDemoState(parsed);
  }
  function synchronize(): Snapshot {
    if (unreadBrowserCopy) return current;
    try {
      const saved = getStorage().getItem(DEMO_STORAGE_KEY);
      if (unsavedChanges) {
        // Never discard local edits or overwrite another tab's newer saved data.
        if (saved !== browserCopy) {
          unreadBrowserCopy = true;
          current = { ...current, storageError: STORAGE_CONFLICT_ERROR };
        }
        return current;
      }
      if (saved !== browserCopy) {
        if (saved) {
          current = {
            state: { ...readSaved(saved), role: current.state.role },
            storageError: null,
          };
        }
        browserCopy = saved;
      }
    } catch {
      unreadBrowserCopy = true;
      current = { ...current, storageError: STORAGE_READ_ERROR };
    }
    return current;
  }
  function publish(state: DemoState, explicitRetry = false): Snapshot {
    if (unreadBrowserCopy && !explicitRetry) {
      unsavedChanges = true;
      current = {
        state,
        storageError: current.storageError ?? STORAGE_READ_ERROR,
      };
      return current;
    }
    let storageError: string | null = null;
    try {
      const serialized = JSON.stringify(state);
      getStorage().setItem(DEMO_STORAGE_KEY, serialized);
      browserCopy = serialized;
      unsavedChanges = false;
      unreadBrowserCopy = false;
    } catch {
      unsavedChanges = true;
      storageError = unreadBrowserCopy
        ? current.storageError
        : STORAGE_WRITE_ERROR;
    }
    current = { state, storageError };
    return current;
  }
  return {
    snapshot: () => current,
    publish,
    synchronize,
    update(reduce: (state: DemoState) => DemoState): Snapshot {
      return publish(reduce(synchronize().state));
    },
    retry(): Snapshot {
      const replacementWasExplained = unreadBrowserCopy;
      synchronize();
      // Show the replacement warning before a retry can overwrite a new conflict.
      if (unreadBrowserCopy && !replacementWasExplained) return current;
      return publish(current.state, true);
    },
    hydrate(): Snapshot {
      try {
        const saved = getStorage().getItem(DEMO_STORAGE_KEY);
        if (saved) {
          current = { state: readSaved(saved), storageError: null };
        }
        browserCopy = saved;
      } catch {
        unreadBrowserCopy = true;
        current = { ...current, storageError: STORAGE_READ_ERROR };
      }
      return current;
    },
  };
}
