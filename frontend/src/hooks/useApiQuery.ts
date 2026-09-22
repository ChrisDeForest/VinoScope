import { useEffect, useState } from "react";

interface ApiQueryState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useApiQuery<T>(fetcher: () => Promise<T>, deps: unknown[]): ApiQueryState<T> {
  const [state, setState] = useState<ApiQueryState<T>>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
