import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleGoods } from '../test/sample-parts';
import { API_TIMEOUT_MS, ApiError, fetchParts } from './client';
function mockResponse(body, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status })));
}
beforeEach(() => {
  vi.stubEnv('VITE_FAVORIT_API_KEY', 'test-key');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe('fetchParts', () => {
  it('parses sample goods, warehouses and nested analogues', async () => {
    mockResponse({ goods: sampleGoods });
    await expect(fetchParts('7160500039S', 'MEYLE')).resolves.toEqual(sampleGoods);
  });
  it('calls the documented endpoint and encodes every parameter without rewriting punctuation', async () => {
    mockResponse({ goods: [] });
    const controller = new AbortController();
    await expect(fetchParts('01/#& 89', 'NGK/NTK & Co#', controller.signal)).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledOnce();
    const [path, options] = vi.mocked(fetch).mock.calls[0];
    const url = new URL(path);
    expect(url.origin).toBe('https://api.favorit-parts.ru');
    expect(url.pathname).toBe('/hs/hsprice/');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      key: 'test-key',
      number: '01/#& 89',
      brand: 'NGK/NTK & Co#',
      analogues: 'on',
      info: 'on',
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });
  it('omits brand and analogues for the manufacturer search', async () => {
    mockResponse({ goods: [] });
    await fetchParts('01089');
    const url = new URL(vi.mocked(fetch).mock.calls[0][0]);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      key: 'test-key',
      number: '01089',
      info: 'on',
    });
  });
  it('does not fetch without an API key', async () => {
    vi.stubEnv('VITE_FAVORIT_API_KEY', '  ');
    vi.stubGlobal('fetch', vi.fn());
    await expect(fetchParts('01089')).rejects.toThrow('Укажите VITE_FAVORIT_API_KEY в .env');
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    ['Empty key!', 'Ключ Favorit Parts не принят'],
    ['Invalid key client!', 'Ключ Favorit Parts не принят'],
    ['Empty number goods!', 'Проверьте номер детали'],
    ['Request quota exceeded!', 'Превышен лимит запросов'],
  ])('translates documented HTTP-200 errors: %s', async (raw, expected) => {
    mockResponse({ error: raw });
    await expect(fetchParts('01089')).rejects.toThrow(expected);
  });
  it('combines several documented errors into one Russian message', async () => {
    mockResponse({ error: 'Empty key! Empty number goods! Request quota exceeded!' });
    await expect(fetchParts('01089')).rejects.toMatchObject({
      status: 429,
      message: expect.stringMatching(/Ключ.*артикул.*Превышен лимит/s),
    });
  });
  it.each([401, 403, 429])('translates HTTP %i even without a structured error', async (status) => {
    mockResponse({ unexpected: true }, status);
    await expect(fetchParts('01089')).rejects.toMatchObject({
      status,
      message: expect.stringMatching(status === 429 ? /Превышен лимит/ : /Ключ/),
    });
  });
  it('translates documented errors in a non-200 response', async () => {
    mockResponse({ error: 'Empty number goods!' }, 400);
    await expect(fetchParts('01089')).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('артикул'),
    });
  });
  it.each([200, 500])(
    'does not expose arbitrary upstream text or the key (HTTP %i)',
    async (status) => {
      mockResponse({ error: 'Failure for https://api.favorit-parts.ru/?key=test-key' }, status);
      const error = await fetchParts('01089').catch((caught) => caught);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toContain('Favorit Parts не смог выполнить поиск');
      expect(error.message).not.toContain('test-key');
      expect(error.message).not.toMatch(/https?:\/\//);
    },
  );
  it.each([{ goods: null }, { unexpected: [] }, { goods: [{ brand: 42 }] }])(
    'rejects an invalid payload: %j',
    async (body) => {
      mockResponse(body);
      await expect(fetchParts('01089')).rejects.toThrow('неизвестном формате');
    },
  );
  it('handles a non-JSON success response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Error</html>')));
    await expect(fetchParts('01089')).rejects.toThrow('некорректный ответ');
  });
  it('handles a non-JSON HTTP error without exposing the body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('test-key', { status: 502 })));
    await expect(fetchParts('01089')).rejects.toThrow('Favorit Parts не смог выполнить поиск');
  });
  it('explains a network or browser access failure without exposing request details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed http://api/?key=test-key')),
    );
    const error = await fetchParts('01089').catch((caught) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toContain('Проверьте соединение');
    expect(error.message).toContain('браузером');
    expect(error.message).not.toContain('test-key');
  });
  it('preserves AbortError from fetch', async () => {
    const aborted = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(aborted));
    await expect(fetchParts('01089')).rejects.toBe(aborted);
  });
  it('does not fetch with an already aborted external signal', async () => {
    const controller = new AbortController();
    const reason = new Error('Search replaced');
    controller.abort(reason);
    vi.stubGlobal('fetch', vi.fn());
    await expect(fetchParts('01089', undefined, controller.signal)).rejects.toBe(reason);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('aborts the fetch and preserves the caller reason when input changes', async () => {
    const controller = new AbortController();
    let fetchSignal;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, options) => {
        fetchSignal = options.signal;
        return new Promise(() => {});
      }),
    );
    const request = fetchParts('01089', undefined, controller.signal);
    const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    expect(fetchSignal?.aborted).toBe(true);
  });
  it('preserves cancellation while reading the response body', async () => {
    const aborted = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ status: 200, ok: true, json: vi.fn().mockRejectedValue(aborted) }),
    );
    await expect(fetchParts('01089')).rejects.toBe(aborted);
  });
  it('times out a stalled request and aborts its signal', async () => {
    vi.useFakeTimers();
    let fetchSignal;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, options) => {
        fetchSignal = options.signal;
        return new Promise(() => {});
      }),
    );
    const rejected = expect(fetchParts('01089')).rejects.toMatchObject({
      status: 504,
      message: expect.stringContaining('не ответил вовремя'),
    });
    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS);
    await rejected;
    expect(fetchSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('applies the timeout to reading the JSON body too', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200, ok: true, json: () => new Promise(() => {}) }),
    );
    const rejected = expect(fetchParts('01089')).rejects.toMatchObject({ status: 504 });
    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cleans up the timeout and external abort listener after success', async () => {
    vi.useFakeTimers();
    mockResponse({ goods: [] });
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    await fetchParts('01089', undefined, controller.signal);
    const fetchSignal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    controller.abort();
    expect(fetchSignal?.aborted).toBe(false);
  });
});
