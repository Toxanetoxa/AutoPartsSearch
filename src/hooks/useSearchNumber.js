import { useCallback, useEffect, useState } from 'react';

function readNumber() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('number') ?? '';
}

export function useSearchNumber(onNavigate) {
  const [number, setValue] = useState(readNumber);

  const setNumber = useCallback((next) => {
    setValue(next);
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (next === '') url.searchParams.delete('number');
    else url.searchParams.set('number', next);

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', nextUrl);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const next = readNumber();
      setValue(next);
      onNavigate?.(next);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onNavigate]);

  return [number, setNumber];
}
