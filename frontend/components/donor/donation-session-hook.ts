"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { api, apiPage } from "@/lib/api";
import { offerIntent } from "@/lib/offer-intent";
import { DonationSession } from "./donation-session";

/** Account and route identity bound the lifetime of private draft state. */
export function useDonationSession(
  accountId: string | null,
  donationId: string | null,
  intentQuery = "",
) {
  const session = useMemo(
    () =>
      new DonationSession(
        { api, apiPage },
        accountId,
        donationId,
        offerIntent(new URLSearchParams(intentQuery)),
      ),
    [accountId, donationId, intentQuery],
  );
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  useEffect(() => {
    void session.start();
    return () => session.stop();
  }, [session]);
  return { state, session };
}
