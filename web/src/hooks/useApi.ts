import { useState, useEffect, useCallback } from 'react';

export function useApi<T>(fetchFn: () => Promise<T>, deps: unknown[] = []): { data: T | undefined; isLoading: boolean; error: Error | undefined; refetch: () => void } {
  const [data, setData] = useState<T>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error>();

  const doFetch = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  return { data, isLoading, error, refetch: doFetch };
}
