import { act, cleanup, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMatchMedia } from '../test/media-query';
import { MOBILE_QUERY, useMediaQuery } from './useMediaQuery';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function installMatchMedia(initial = false) {
  const controller = createMatchMedia(initial);
  const matchMedia = vi.fn(controller.matchMedia);
  vi.stubGlobal('matchMedia', matchMedia);
  return { ...controller, matchMedia };
}

describe('useMediaQuery', () => {
  it('uses the shared mobile breakpoint', () => {
    expect(MOBILE_QUERY).toBe('(max-width: 1080px)');
  });

  it('defaults to desktop when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useMediaQuery(MOBILE_QUERY));
    expect(result.current).toBe(false);
  });

  it('renders safely without window during server rendering', () => {
    vi.stubGlobal('window', undefined);
    function Probe() {
      return <span>{String(useMediaQuery(MOBILE_QUERY))}</span>;
    }
    expect(renderToString(<Probe />)).toBe('<span>false</span>');
  });

  it.each([false, true])('reads the initial media match: %s', (initial) => {
    const { matchMedia, listenerCount } = installMatchMedia(initial);
    const { result } = renderHook(() => useMediaQuery(MOBILE_QUERY));
    expect(result.current).toBe(initial);
    expect(matchMedia).toHaveBeenCalledWith(MOBILE_QUERY);
    expect(listenerCount()).toBe(1);
  });

  it('updates when the viewport crosses the breakpoint in either direction', () => {
    const { setMatches } = installMatchMedia();
    const { result } = renderHook(() => useMediaQuery(MOBILE_QUERY));
    expect(result.current).toBe(false);
    act(() => setMatches(true));
    expect(result.current).toBe(true);
    act(() => setMatches(false));
    expect(result.current).toBe(false);
  });

  it('reuses the media query on rerender and replaces its subscription when the query changes', () => {
    const { matchMedia, listenerCount } = installMatchMedia();
    const { rerender, unmount } = renderHook(({ query }) => useMediaQuery(query), {
      initialProps: { query: MOBILE_QUERY },
    });
    const original = matchMedia.mock.results[0].value;
    const unsubscribe = vi.spyOn(original, 'removeEventListener');
    rerender({ query: MOBILE_QUERY });
    expect(matchMedia).toHaveBeenCalledOnce();
    expect(listenerCount()).toBe(1);

    rerender({ query: '(prefers-reduced-motion: reduce)' });
    expect(matchMedia).toHaveBeenCalledTimes(2);
    expect(unsubscribe).toHaveBeenCalledWith('change', expect.any(Function));
    expect(listenerCount()).toBe(1);
    unmount();
    expect(listenerCount()).toBe(0);
  });

  it('keeps one active listener in StrictMode and cleans it up on unmount', () => {
    const { setMatches, listenerCount } = installMatchMedia();
    const { result, unmount } = renderHook(() => useMediaQuery(MOBILE_QUERY), {
      reactStrictMode: true,
    });
    expect(listenerCount()).toBe(1);
    act(() => setMatches(true));
    expect(result.current).toBe(true);
    unmount();
    expect(listenerCount()).toBe(0);
  });
});

describe('matchMedia test controller', () => {
  it('notifies only on changes and includes each query in its event', () => {
    const { matchMedia, setMatches, listenerCount } = createMatchMedia();
    const mobile = matchMedia(MOBILE_QUERY);
    const listener = vi.fn();
    mobile.addEventListener('change', listener);
    expect(listenerCount()).toBe(1);
    setMatches(false);
    expect(listener).not.toHaveBeenCalled();
    setMatches(true);
    expect(listener).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: 'change', matches: true, media: MOBILE_QUERY }),
    );
    expect(mobile.matches).toBe(true);
    mobile.removeEventListener('change', listener);
    setMatches(false);
    expect(listener).toHaveBeenCalledOnce();
    expect(listenerCount()).toBe(0);
  });
});
