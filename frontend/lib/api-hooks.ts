"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiPage } from "./api";
import { useAuth } from "./auth-context";

export function useApiResource<T>(path: string | null) {
  const { user, loading: authLoading } = useAuth();
  const key = !authLoading && user && path ? `${user.id}:${path}` : null;
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const invalidate = useCallback(() => {
    generation.current++;
    controller.current?.abort();
  }, []);
  const [state, setState] = useState<{
    key: string | null;
    data: T | null;
    loading: boolean;
    error: string | null;
  }>({ key: null, data: null, loading: false, error: null });
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    controller.current?.abort();
    if (!key || !path) return;
    const request = new AbortController();
    controller.current = request;
    setState((old) => ({
      key,
      data: old.key === key ? old.data : null,
      loading: true,
      error: null,
    }));
    try {
      const data = await api<T>(path, { signal: request.signal });
      if (current === generation.current && !request.signal.aborted)
        setState({ key, data, loading: false, error: null });
    } catch (error) {
      if (current === generation.current && !request.signal.aborted)
        setState({
          key,
          data: null,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not load these details. Try again.",
        });
    }
  }, [key, path]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      clearTimeout(timer);
      invalidate();
    };
  }, [refresh, invalidate]);
  const visible = state.key === key && key !== null;
  return {
    data: visible ? state.data : null,
    loading: authLoading || (key !== null && (!visible || state.loading)),
    error: visible ? state.error : null,
    refresh,
  };
}

export function useApiPage<T>(path: string | null) {
  const { user, loading: authLoading } = useAuth();
  const key = !authLoading && user && path ? `${user.id}:${path}` : null;
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const invalidate = useCallback(() => {
    generation.current++;
    controller.current?.abort();
  }, []);
  const pending = useRef(false);
  const [state, setState] = useState<{
    key: string | null;
    data: T[];
    loading: boolean;
    error: string | null;
    cursor: string | null;
  }>({ key: null, data: [], loading: false, error: null, cursor: null });
  const read = useCallback(
    async (cursor: string | null) => {
      if (!key || !path || (cursor && pending.current)) return;
      const current = ++generation.current;
      controller.current?.abort();
      const request = new AbortController();
      controller.current = request;
      pending.current = true;
      setState((old) => ({
        key,
        data: cursor && old.key === key ? old.data : [],
        loading: true,
        error: null,
        cursor,
      }));
      try {
        const url = cursor
          ? `${path}${path.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}`
          : path;
        const page = await apiPage<T>(url, { signal: request.signal });
        if (current === generation.current && !request.signal.aborted)
          setState((old) => ({
            key,
            data: cursor ? [...old.data, ...page.data] : page.data,
            loading: false,
            error: null,
            cursor: page.page.has_more ? page.page.next_cursor : null,
          }));
      } catch (error) {
        if (current === generation.current && !request.signal.aborted)
          setState((old) => ({
            ...old,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Could not load this list. Try again.",
          }));
      } finally {
        if (current === generation.current && !request.signal.aborted)
          pending.current = false;
      }
    },
    [key, path],
  );
  const refresh = useCallback(() => read(null), [read]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      clearTimeout(timer);
      invalidate();
      pending.current = false;
    };
  }, [refresh, invalidate]);
  const visible = state.key === key && key !== null;
  return {
    data: visible ? state.data : [],
    loading: authLoading || (key !== null && (!visible || state.loading)),
    error: visible ? state.error : null,
    hasMore: visible && !!state.cursor,
    refresh,
    loadMore: () =>
      visible && state.cursor ? read(state.cursor) : Promise.resolve(),
  };
}
