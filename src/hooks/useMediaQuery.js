import { useEffect, useState } from 'react';

/** `true` tant que la requête média correspond (ex. « (max-width: 900px) »). */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener?.('change', update);
    return () => mql.removeEventListener?.('change', update);
  }, [query]);

  return matches;
}

/** Téléphone / petite tablette en portrait : on empile le plan et les widgets. */
export const MOBILE_QUERY = '(max-width: 1023px)';
export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);
