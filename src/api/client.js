import { z } from 'zod';
import { priceResponseSchema } from '../domain/parts';
import { getApiKey, getApiUrl } from './config';
import { ApiError, serviceError } from './errors';
export { ApiError } from './errors';

export const API_TIMEOUT_MS = 15_000;

const errorSchema = z.object({ error: z.string() });
function isAbortError(error) {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

function abortReason(signal) {
  return signal.reason ?? new DOMException('Aborted', 'AbortError');
}

async function readResponse(url, signal) {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
    credentials: 'omit',
  });
  let body;
  try {
    body = await response.json();
  } catch (error) {
    if (isAbortError(error) || signal.aborted) throw error;
    if (!response.ok) throw serviceError('', response.status);
    throw new ApiError('Сервис вернул некорректный ответ. Повторите поиск позже.', response.status);
  }
  if (!response.ok) {
    const parsedError = errorSchema.safeParse(body);
    throw serviceError(parsedError.success ? parsedError.data.error : '', response.status);
  }
  return body;
}

async function requestJson(url, signal) {
  if (signal?.aborted) throw abortReason(signal);
  const controller = new AbortController();
  let rejectAbort = () => {};
  const aborted = new Promise((_resolve, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => {
    const reason = abortReason(signal);
    controller.abort(reason);
    rejectAbort(reason);
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => {
    const error = new ApiError('Favorit Parts не ответил вовремя. Повторите поиск.', 504);
    controller.abort(error);
    rejectAbort(error);
  }, API_TIMEOUT_MS);
  try {
    return await Promise.race([readResponse(url, controller.signal), aborted]);
  } catch (error) {
    if (signal?.aborted) throw abortReason(signal);
    if (error instanceof ApiError || isAbortError(error)) throw error;
    throw new ApiError(
      'Не удалось подключиться к Favorit Parts. Проверьте соединение; доступ к API также может быть ограничен браузером.',
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function fetchParts(number, brand, signal) {
  const params = new URLSearchParams({ key: getApiKey(), number, info: 'on' });
  if (brand !== undefined) {
    params.set('brand', brand);
    params.set('analogues', 'on');
  }
  const response = priceResponseSchema.safeParse(
    await requestJson(`${getApiUrl()}?${params.toString()}`, signal),
  );
  if (!response.success) {
    throw new ApiError('Сервис вернул данные в неизвестном формате. Повторите поиск позже.');
  }
  if ('error' in response.data) throw serviceError(response.data.error, 200);
  return response.data.goods;
}
