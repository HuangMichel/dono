"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import type { Membership, Profile, Page } from "./api-contracts";
import { api, apiPage } from "./api";
import { safeOfferReturn } from "./offer-intent";
import { getSupabase } from "./supabase/client";

type AuthState = {
  // SDK identity survives account-loading errors so sign-out remains available.
  sessionUser: User | null;
  // Application access stays blocked until profile and memberships both load.
  user: User | null;
  profile: Profile | null;
  memberships: Membership[];
  loading: boolean;
  error: string | null;
};
type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    next?: string,
  ) => Promise<{ confirmationRequired: boolean }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
const empty: AuthState = {
  sessionUser: null,
  user: null,
  profile: null,
  memberships: [],
  loading: true,
  error: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(empty);
  const generation = useRef(0);
  const subject = useRef<string | null>(null);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setState((old) => ({ ...old, loading: true, error: null }));
    try {
      const { data, error } = await getSupabase().auth.getSession();
      if (error) throw error;
      const user = data.session?.user ?? null;
      if (!user) {
        if (current === generation.current)
          setState({ ...empty, loading: false });
        return;
      }
      if (current !== generation.current) return;
      subject.current = user.id;
      setState({ ...empty, sessionUser: user });
      // Bootstrap is authorized by the verified subject and never accepts roles.
      const profile = await api<Profile>("/account/profile", {
        method: "POST",
        body: {},
      });
      if (current !== generation.current) return;
      const memberships: Membership[] = [];
      let cursor: string | null = null;
      do {
        const page: Page<Membership> = await apiPage<Membership>(
          `/account/memberships?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        );
        if (current !== generation.current) return;
        memberships.push(...page.data);
        cursor = page.page.has_more ? page.page.next_cursor : null;
      } while (cursor);
      if (current === generation.current)
        setState({
          sessionUser: user,
          user,
          profile,
          memberships,
          loading: false,
          error: null,
        });
    } catch (error) {
      if (current === generation.current)
        setState((old) => ({
          ...empty,
          sessionUser: old.sessionUser,
          loading: false,
          error: error instanceof Error ? error.message : "Sign-in failed.",
        }));
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const { data } = getSupabase().auth.onAuthStateChange(
        (event, session) => {
          const nextSubject = session?.user.id ?? null;
          // Token refresh and refocusing a signed-in tab must not erase form input.
          if (
            (event === "TOKEN_REFRESHED" && subject.current === nextSubject) ||
            (event === "SIGNED_IN" && subject.current === nextSubject)
          )
            return;
          subject.current = nextSubject;
          // Run outside the SDK auth callback lock, including initial session restore.
          clearTimeout(timer);
          generation.current++;
          setState({ ...empty, sessionUser: session?.user ?? null });
          timer = setTimeout(() => {
            void refresh();
          }, 0);
        },
      );
      unsubscribe = () => data.subscription.unsubscribe();
    } catch (error) {
      timer = setTimeout(
        () =>
          setState({
            ...empty,
            loading: false,
            error:
              error instanceof Error ? error.message : "Sign-in unavailable.",
          }),
        0,
      );
    }
    return () => {
      invalidate();
      clearTimeout(timer);
      unsubscribe?.();
    };
  }, [refresh, invalidate]);

  async function signIn(email: string, password: string) {
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
  }
  async function signUp(email: string, password: string, next?: string) {
    const continuation = safeOfferReturn(next ?? null);
    const callback = new URL("/auth/callback", window.location.origin);
    if (continuation) callback.searchParams.set("next", continuation);
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: callback.toString() },
    });
    if (error) throw error;
    return { confirmationRequired: !data.session };
  }
  async function signOut() {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
    generation.current++;
    subject.current = null;
    setState({ ...empty, loading: false });
  }
  return (
    <AuthContext.Provider
      value={{ ...state, signIn, signUp, signOut, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider missing");
  return auth;
}
