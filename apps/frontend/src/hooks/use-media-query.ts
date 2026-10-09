import * as React from 'react';

/**
 * Si la pantalla cumple una media query (`(min-width: 1280px)`). Igual que
 * `useIsMobile`: con useSyncExternalStore, sin setState en efectos, y en SSR
 * devuelve false.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
