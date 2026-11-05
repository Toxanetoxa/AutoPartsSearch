import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAppStore } from '../store/store';
import { sampleGoods } from '../test/sample-parts';
import { partsApi, useManufacturers, useOffers } from './queries';

const stores = [];

function setup() {
  const store = createAppStore();
  stores.push(store);
  const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>;
  return { store, wrapper };
}

beforeEach(() => {
  vi.stubEnv('VITE_FAVORIT_API_KEY', 'test-key');
});

afterEach(async () => {
  cleanup();
  await act(async () => {
    for (const store of stores) store.dispatch(partsApi.util.resetApiState());
  });
  stores.length = 0;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('Redux parts queries', () => {
  it('does not start either search without a configured API key', () => {
    vi.stubEnv('VITE_FAVORIT_API_KEY', '');
    vi.stubGlobal('fetch', vi.fn());
    const { wrapper } = setup();
    const manufacturers = renderHook(() => useManufacturers('01089'), { wrapper });
    const offers = renderHook(() => useOffers('01089', 'ZEN'), { wrapper });
    expect(manufacturers.result.current.isFetching).toBe(false);
    expect(offers.result.current.isFetching).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not request manufacturers until the article is valid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ goods: [] })));
    const { wrapper } = setup();
    const { rerender, result } = renderHook(({ number }) => useManufacturers(number), {
      wrapper,
      initialProps: { number: '' },
    });
    expect(result.current.isFetching).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    rerender({ number: '01089' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledOnce();
    expect(result.current.data).toEqual([]);
  });

  it('requires a selected valid manufacturer for offers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ goods: [] })));
    const { wrapper } = setup();
    const { rerender, result } = renderHook(({ brand }) => useOffers('01089', brand), {
      wrapper,
      initialProps: { brand: null },
    });
    expect(result.current.isFetching).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    rerender({ brand: 'ZEN' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = new URL(vi.mocked(fetch).mock.calls[0][0]);
    expect(url.origin).toBe('https://api.favorit-parts.ru');
    expect(url.searchParams.get('number')).toBe('01089');
    expect(url.searchParams.get('brand')).toBe('ZEN');
    expect(url.searchParams.get('analogues')).toBe('on');
  });

  it.each([
    { number: '', brand: 'MEYLE' },
    { number: '01089', brand: '' },
    { number: '01089', brand: 'x'.repeat(121) },
    { number: '01089', brand: 'NGK\u0000NTK' },
    { number: '01089', brand: 'MEYLE\n' },
    { number: '01089', brand: 'NGK\u0085NTK' },
  ])('does not send invalid offer parameters: %j', ({ number, brand }) => {
    vi.stubGlobal('fetch', vi.fn());
    const { wrapper } = setup();
    const { result } = renderHook(() => useOffers(number, brand), { wrapper });
    expect(result.current.isFetching).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('stores manufacturer data in Redux and flattens analogue warehouse offers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(Response.json({ goods: sampleGoods }))),
    );
    const { store, wrapper } = setup();
    const manufacturers = renderHook(() => useManufacturers('7160500039S'), { wrapper });
    await waitFor(() => expect(manufacturers.result.current.isSuccess).toBe(true));
    expect(manufacturers.result.current.data).toEqual([
      expect.objectContaining({ brand: 'MEYLE', count: 20 }),
    ]);
    const cached = partsApi.endpoints.manufacturers.select('7160500039S')(store.getState());
    expect(cached.data).toEqual(manufacturers.result.current.data);
    const offers = renderHook(() => useOffers('7160500039S', 'MEYLE'), { wrapper });
    await waitFor(() => expect(offers.result.current.isSuccess).toBe(true));
    expect(offers.result.current.data).toHaveLength(3);
    expect(offers.result.current.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ brand: 'Mapco', isAnalogue: true, price: 8680.2, stock: 10 }),
        expect.objectContaining({ brand: 'MEYLE', price: null, stock: 0 }),
      ]),
    );
  });

  it('reuses fresh cached results when returning to the same article', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(Response.json({ goods: [] }))),
    );
    const { wrapper } = setup();
    const first = renderHook(() => useManufacturers('01089'), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();
    const second = renderHook(() => useManufacturers('01089'), { wrapper });
    expect(second.result.current.isSuccess).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('refreshes cached results older than 60 seconds on remount', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(Response.json({ goods: [] }))),
    );
    const { wrapper } = setup();
    const first = renderHook(() => useManufacturers('01089'), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();
    vi.setSystemTime(Date.now() + 61_000);
    const second = renderHook(() => useManufacturers('01089'), { wrapper });
    await waitFor(() => expect(second.result.current.isFetching).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps endpoint, article and brand caches independent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(Response.json({ goods: [] }))),
    );
    const { wrapper } = setup();
    const manufacturers = renderHook(() => useManufacturers('01089'), { wrapper });
    const { result, rerender } = renderHook(({ number, brand }) => useOffers(number, brand), {
      wrapper,
      initialProps: { number: '01089', brand: 'ZEN' },
    });
    await waitFor(() =>
      expect(manufacturers.result.current.isSuccess && result.current.isSuccess).toBe(true),
    );
    rerender({ number: '01089', brand: 'NGK/NTK' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ number: '0189', brand: 'NGK/NTK' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('hides old data immediately when the article changes or becomes invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ goods: sampleGoods }))
        .mockImplementation(() => new Promise(() => {})),
    );
    const { wrapper } = setup();
    const { result, rerender } = renderHook(({ number }) => useManufacturers(number), {
      wrapper,
      initialProps: { number: '7160500039S' },
    });
    await waitFor(() => expect(result.current.data?.[0]?.brand).toBe('MEYLE'));
    rerender({ number: '01089' });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isSuccess).toBe(false);
    rerender({ number: '' });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(false);
  });

  it('aborts an obsolete request when the article changes and on unmount', async () => {
    const signals = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_path, options) => {
        signals.push(options.signal);
        return new Promise(() => {});
      }),
    );
    const { wrapper } = setup();
    const { rerender, unmount } = renderHook(({ number }) => useManufacturers(number), {
      wrapper,
      initialProps: { number: '01089' },
    });
    rerender({ number: '7160500039S' });
    await waitFor(() => expect(signals[0].aborted).toBe(true));
    expect(signals[1].aborted).toBe(false);
    unmount();
    await waitFor(() => expect(signals[1].aborted).toBe(true));
  });

  it('keeps the new results when an obsolete request resolves last', async () => {
    const resolvers = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => new Promise((resolve) => resolvers.push(resolve))),
    );
    const { wrapper } = setup();
    const { result, rerender } = renderHook(({ number }) => useManufacturers(number), {
      wrapper,
      initialProps: { number: '01089' },
    });
    rerender({ number: '7160500039S' });
    await act(async () => resolvers[1](Response.json({ goods: sampleGoods })));
    await waitFor(() => expect(result.current.data?.[0]?.brand).toBe('MEYLE'));
    await act(async () => resolvers[0](Response.json({ goods: [] })));
    expect(result.current.data?.[0]?.brand).toBe('MEYLE');
  });

  it('survives StrictMode effect cleanup without cancelling the active request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(Response.json({ goods: [] }))),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useManufacturers('01089'), {
      wrapper,
      reactStrictMode: true,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('does not retry an API error automatically and supports explicit retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ error: 'Request quota exceeded!' }))
        .mockImplementation(() => Promise.resolve(Response.json({ goods: [] }))),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useManufacturers('01089'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual({
      status: 429,
      message: expect.stringContaining('Превышен лимит'),
    });
    expect(fetch).toHaveBeenCalledOnce();
    await act(async () => result.current.refetch());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
