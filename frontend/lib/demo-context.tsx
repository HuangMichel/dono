"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createInitialState,
  reduceDemo,
  type DemoState,
  type DemoCommand,
} from "./demo-store";
import { createDemoPersistence, DEMO_STORAGE_KEY } from "./demo-persistence";
import { StorageNotice } from "@/components/storage-notice";
type Context = {
  state: DemoState;
  dispatch: (c: DemoCommand) => void;
  ready: boolean;
  reset: () => void;
  storageError: string | null;
  retryStorage: () => void;
};
const DemoContext = createContext<Context | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(createInitialState);
  const [snapshot, setSnapshot] = useState({
      state: initial,
      storageError: null as string | null,
    }),
    [ready, setReady] = useState(false);
  const persistence = useRef<ReturnType<typeof createDemoPersistence> | null>(
    null,
  );
  if (persistence.current === null) {
    persistence.current = createDemoPersistence(initial, () => localStorage);
  }
  // Hydrate browser-local persistence after the server's deterministic first render.
  useEffect(() => {
    setSnapshot(persistence.current!.hydrate());
    setReady(true);
    function onStorage(event: StorageEvent) {
      if (event.key !== DEMO_STORAGE_KEY && event.key !== null) return;
      if (event.storageArea !== window.localStorage) return;
      setSnapshot(persistence.current!.synchronize());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  function publish(next: DemoState) {
    setSnapshot(persistence.current!.publish(next));
  }
  function dispatch(c: DemoCommand) {
    try {
      persistence.current!.update((state) => reduceDemo(state, c));
    } finally {
      // A rejected stale command still reveals the newer saved record.
      setSnapshot(persistence.current!.snapshot());
    }
  }
  function reset() {
    publish(createInitialState());
  }
  function retryStorage() {
    setSnapshot(persistence.current!.retry());
  }
  return (
    <DemoContext.Provider
      value={{ ...snapshot, dispatch, ready, reset, retryStorage }}
    >
      <StorageNotice error={snapshot.storageError} retry={retryStorage} />
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw Error("DemoProvider missing");
  return context;
}
