import { useCallback, useMemo, useSyncExternalStore } from 'react';

export const MOBILE_QUERY = '(max-width: 1080px)';

const getServerSnapshot = () => false;

export function useMediaQuery(query) {
  const mediaQuery = useMemo(
    () =>
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(query)
        : null,
    [query],
  );

  const subscribe = useCallback(
    (onChange) => {
      if (!mediaQuery) return () => {};
      mediaQuery.addEventListener('change', onChange);
      return () => mediaQuery.removeEventListener('change', onChange);
    },
    [mediaQuery],
  );
  const getSnapshot = useCallback(() => mediaQuery?.matches ?? false, [mediaQuery]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
