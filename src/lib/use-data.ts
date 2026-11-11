import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal data-loading hook: runs `load` on mount, when deps change and
 * when the screen regains focus. Returns data, loading/error state and reload.
 */
export function useData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  const seq = useRef(0);

  useEffect(() => {
    loadRef.current = load;
  });

  /** Fetches and applies the result, ignoring responses from superseded requests. */
  const run = useCallback(async () => {
    const id = ++seq.current;
    try {
      const result = await loadRef.current();
      if (id !== seq.current) return;
      setData(result);
      setError(null);
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    await run();
  }, [run]);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void run();
    }, [run]),
  );

  return { data, error, loading, reload, setData };
}
