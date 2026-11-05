import { act, cleanup, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSearchNumber } from './useSearchNumber';

let originalUrl;
let originalState;

beforeEach(() => {
  originalUrl = window.location.href;
  originalState = window.history.state;
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(originalState, '', originalUrl);
});

describe('useSearchNumber', () => {
  it('reads the initial number once without rewriting the URL', () => {
    window.history.replaceState(null, '', '/catalog?number=01089#results');
    const replace = vi.spyOn(window.history, 'replaceState');
    const { result, rerender } = renderHook(() => useSearchNumber());
    expect(result.current[0]).toBe('01089');
    rerender();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(['/', '/?view=compact', '/?number='])('defaults to empty for %s', (url) => {
    window.history.replaceState(null, '', url);
    const { result } = renderHook(() => useSearchNumber());
    expect(result.current[0]).toBe('');
  });

  it('preserves decoded raw input including whitespace, punctuation and Unicode', () => {
    const number = ' 01/#&+ Мéйле ';
    const params = new URLSearchParams({ number });
    window.history.replaceState(null, '', `/?${params}`);
    const { result } = renderHook(() => useSearchNumber());
    expect(result.current[0]).toBe(number);
    act(() => result.current[1](`${number}#&+`));
    expect(result.current[0]).toBe(`${number}#&+`);
    expect(new URLSearchParams(window.location.search).get('number')).toBe(`${number}#&+`);
  });

  it('saves typing immediately with replaceState while retaining route, state and other parameters', () => {
    window.history.replaceState(
      { draft: 42 },
      '',
      '/catalog?view=compact&filter=one&filter=two&number=old#offers',
    );
    const state = window.history.state;
    const historyLength = window.history.length;
    const document = window.document;
    const replace = vi.spyOn(window.history, 'replaceState');
    const { result } = renderHook(() => useSearchNumber());

    act(() => result.current[1]('01089'));

    expect(result.current[0]).toBe('01089');
    expect(replace).toHaveBeenCalledExactlyOnceWith(
      state,
      '',
      '/catalog?view=compact&filter=one&filter=two&number=01089#offers',
    );
    expect(window.history.state).toBe(state);
    expect(window.history.length).toBe(historyLength);
    expect(window.document).toBe(document);
    const params = new URLSearchParams(window.location.search);
    expect(params.getAll('filter')).toEqual(['one', 'two']);
    expect(params.has('key')).toBe(false);
    expect(params.has('brand')).toBe(false);
  });

  it('avoids replacing an identical URL, including clearing an already empty search', () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    const { result } = renderHook(() => useSearchNumber());
    act(() => result.current[1](''));
    expect(replace).not.toHaveBeenCalled();
    act(() => result.current[1]('01089'));
    expect(replace).toHaveBeenCalledOnce();
    act(() => result.current[1]('01089'));
    expect(replace).toHaveBeenCalledOnce();
  });

  it('reads the first repeated number and replaces duplicates with one value', () => {
    window.history.replaceState(null, '', '/?number=first&view=one&number=second&view=two');
    const { result } = renderHook(() => useSearchNumber());
    expect(result.current[0]).toBe('first');
    act(() => result.current[1]('updated'));
    const params = new URLSearchParams(window.location.search);
    expect(params.getAll('number')).toEqual(['updated']);
    expect(params.getAll('view')).toEqual(['one', 'two']);
  });

  it('clears every repeated number while preserving other parameters and the hash', () => {
    window.history.replaceState(null, '', '/catalog?number=first&view=one&number=second#offers');
    const { result } = renderHook(() => useSearchNumber());
    act(() => result.current[1](''));
    expect(result.current[0]).toBe('');
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/catalog?view=one#offers',
    );
  });

  it.each([
    ['/?number=0189', '0189'],
    ['/?view=compact', ''],
  ])('reads navigation to %s and calls the callback without writing back', (url, expected) => {
    window.history.replaceState(null, '', '/?number=01089');
    const navigate = window.history.replaceState.bind(window.history);
    const replace = vi.spyOn(window.history, 'replaceState');
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSearchNumber(onNavigate));
    act(() => {
      navigate({ fromHistory: true }, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current[0]).toBe(expected);
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith(expected);
    expect(replace).not.toHaveBeenCalled();
  });

  it('notifies navigation even when the number stays unchanged', () => {
    window.history.replaceState(null, '', '/?number=01089');
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSearchNumber(onNavigate));
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(result.current[0]).toBe('01089');
    expect(onNavigate).toHaveBeenCalledTimes(2);
    expect(onNavigate).toHaveBeenLastCalledWith('01089');
  });

  it('handles navigation without an optional callback', () => {
    const { result } = renderHook(() => useSearchNumber());
    act(() => {
      window.history.replaceState(null, '', '/?number=0189');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current[0]).toBe('0189');
  });

  it('uses the latest navigation callback and removes its listener on unmount', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ onNavigate }) => useSearchNumber(onNavigate), {
      initialProps: { onNavigate: first },
    });
    rerender({ onNavigate: second });
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledExactlyOnceWith('');
    unmount();
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(second).toHaveBeenCalledOnce();
  });

  it('keeps one popstate subscription in StrictMode and cleans it up', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const onNavigate = vi.fn();
    const { unmount } = renderHook(() => useSearchNumber(onNavigate), { reactStrictMode: true });
    const subscriptions = () =>
      add.mock.calls.filter(([event]) => event === 'popstate').length -
      remove.mock.calls.filter(([event]) => event === 'popstate').length;
    expect(subscriptions()).toBe(1);
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(onNavigate).toHaveBeenCalledOnce();
    unmount();
    expect(subscriptions()).toBe(0);
  });

  it('renders an empty number without window during server rendering', () => {
    vi.stubGlobal('window', undefined);
    function Probe() {
      const [number] = useSearchNumber();
      return <span>{number}</span>;
    }
    expect(renderToString(<Probe />)).toBe('<span></span>');
  });
});
