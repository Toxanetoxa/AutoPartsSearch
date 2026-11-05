import { ApiError } from './errors';
export const MISSING_API_KEY_MESSAGE =
  'Укажите VITE_FAVORIT_API_KEY в .env и перезапустите приложение.';

export function isApiConfigured() {
  return Boolean(import.meta.env.VITE_FAVORIT_API_KEY?.trim());
}

export function getApiKey() {
  const key = import.meta.env.VITE_FAVORIT_API_KEY?.trim();
  if (!key) throw new ApiError(MISSING_API_KEY_MESSAGE);
  return key;
}
