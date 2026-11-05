export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}
/** Only documented errors are shown; arbitrary upstream text can contain request data. */
export function serviceError(message, status) {
  const errors = [];
  if (
    message.includes('Empty key!') ||
    message.includes('Invalid key client!') ||
    status === 401 ||
    status === 403
  ) {
    errors.push('Ключ Favorit Parts не принят. Проверьте VITE_FAVORIT_API_KEY в .env.');
  }
  if (message.includes('Empty number goods!')) {
    errors.push('Сервис не принял артикул. Проверьте номер детали.');
  }
  if (message.includes('Request quota exceeded!') || status === 429) {
    errors.push('Превышен лимит запросов Favorit Parts. Повторите поиск позднее.');
    status = 429;
  }
  return new ApiError(
    errors.join(' ') || 'Favorit Parts не смог выполнить поиск. Повторите попытку позднее.',
    status,
  );
}
