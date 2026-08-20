import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Fetches `path` on mount (and whenever `deps` change) and tracks loading/error state.
 * Pass `null` as path to skip fetching (e.g. while waiting on another value).
 */
export function useFetch(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    api
      .get(path)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
