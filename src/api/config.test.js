import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiKey, isApiConfigured, MISSING_API_KEY_MESSAGE } from './config';
afterEach(() => {
  vi.unstubAllEnvs();
});
describe('API configuration', () => {
  it.each([undefined, '', '  '])('rejects a missing or blank key: %j', (key) => {
    vi.stubEnv('VITE_FAVORIT_API_KEY', key);
    expect(isApiConfigured()).toBe(false);
    expect(getApiKey).toThrow(MISSING_API_KEY_MESSAGE);
  });
  it('reads the frontend environment key and trims accidental outer whitespace', () => {
    vi.stubEnv('VITE_FAVORIT_API_KEY', '  test-key  ');
    expect(isApiConfigured()).toBe(true);
    expect(getApiKey()).toBe('test-key');
  });
});
