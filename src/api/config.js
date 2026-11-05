import { ApiError } from './errors';
export const MISSING_API_KEY_MESSAGE =
  'Укажите VITE_FAVORIT_API_KEY в .env и перезапустите приложение.';
export const MISSING_API_URL_MESSAGE =
  'Укажите VITE_FAVORIT_API_URL в .env и перезапустите приложение.';
export const INVALID_API_URL_MESSAGE =
  'Укажите корректный VITE_FAVORIT_API_URL: абсолютный HTTP(S) URL без параметров, фрагмента и учётных данных.';

export function isApiConfigured() {
  return getApiConfigurationError() === null;
}

export function getApiKey() {
  const key = import.meta.env.VITE_FAVORIT_API_KEY?.trim();
  if (!key) throw new ApiError(MISSING_API_KEY_MESSAGE);
  return key;
}

export function getApiUrl() {
  const value = import.meta.env.VITE_FAVORIT_API_URL?.trim();
  if (!value) throw new ApiError(MISSING_API_URL_MESSAGE);

  let base;
  try {
    base = new URL(value);
  } catch {
    throw new ApiError(INVALID_API_URL_MESSAGE);
  }
  if (
    !/^https?:\/\//i.test(value) ||
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    value.includes('?') ||
    value.includes('#') ||
    /\p{Cc}/u.test(value)
  ) {
    throw new ApiError(INVALID_API_URL_MESSAGE);
  }

  base.pathname = `${base.pathname.replace(/\/+$/, '')}/`;
  return new URL('hs/hsprice/', base).href;
}

export function getApiConfigurationError() {
  try {
    getApiKey();
    getApiUrl();
    return null;
  } catch (error) {
    return error.message;
  }
}
