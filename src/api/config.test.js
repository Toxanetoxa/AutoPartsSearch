import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getApiConfigurationError,
  getApiKey,
  getApiUrl,
  INVALID_API_URL_MESSAGE,
  isApiConfigured,
  MISSING_API_KEY_MESSAGE,
  MISSING_API_URL_MESSAGE,
} from './config';

beforeEach(() => {
  vi.stubEnv('VITE_FAVORIT_API_KEY', 'test-key');
  vi.stubEnv('VITE_FAVORIT_API_URL', 'https://parts.example.test');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('API configuration', () => {
  it.each([undefined, '', '  '])('rejects a missing or blank key: %j', (key) => {
    vi.stubEnv('VITE_FAVORIT_API_KEY', key);
    expect(isApiConfigured()).toBe(false);
    expect(getApiKey).toThrow(MISSING_API_KEY_MESSAGE);
    expect(getApiConfigurationError()).toBe(MISSING_API_KEY_MESSAGE);
  });

  it('reads the frontend environment key and trims accidental outer whitespace', () => {
    vi.stubEnv('VITE_FAVORIT_API_KEY', '  test-key  ');
    expect(isApiConfigured()).toBe(true);
    expect(getApiKey()).toBe('test-key');
    expect(getApiConfigurationError()).toBeNull();
  });

  it.each([
    ['https://parts.example.test', 'https://parts.example.test/hs/hsprice/'],
    ['https://parts.example.test/', 'https://parts.example.test/hs/hsprice/'],
    ['  https://parts.example.test///  ', 'https://parts.example.test/hs/hsprice/'],
    ['http://parts.example.test:8080', 'http://parts.example.test:8080/hs/hsprice/'],
    ['https://other.example.test/catalog', 'https://other.example.test/catalog/hs/hsprice/'],
    ['https://other.example.test/catalog/', 'https://other.example.test/catalog/hs/hsprice/'],
    ['https://other.example.test/catalog///', 'https://other.example.test/catalog/hs/hsprice/'],
    ['https://parts.example.test/api/v1', 'https://parts.example.test/api/v1/hs/hsprice/'],
  ])('resolves the pricing endpoint from base %s', (base, expected) => {
    vi.stubEnv('VITE_FAVORIT_API_URL', base);
    expect(getApiUrl()).toBe(expected);
    expect(isApiConfigured()).toBe(true);
    expect(getApiConfigurationError()).toBeNull();
  });

  it.each([undefined, '', '  '])('requires a base URL without a default fallback: %j', (base) => {
    vi.stubEnv('VITE_FAVORIT_API_URL', base);
    expect(getApiUrl).toThrow(MISSING_API_URL_MESSAGE);
    expect(isApiConfigured()).toBe(false);
    expect(getApiConfigurationError()).toBe(MISSING_API_URL_MESSAGE);
  });

  it.each([
    'not-a-url',
    '/api',
    '//parts.example.test',
    'https:parts.example.test',
    'https://',
    'ftp://parts.example.test',
    'javascript:alert(1)',
    'https://parts.example.test?key=secret',
    'https://parts.example.test?',
    'https://parts.example.test#results',
    'https://parts.example.test#',
    'https://secret@parts.example.test',
    'https://user:secret@parts.example.test',
    'https://parts.example.test/hidden\npath',
  ])('rejects an invalid base without exposing its raw value: %j', (base) => {
    vi.stubEnv('VITE_FAVORIT_API_URL', base);
    expect(getApiUrl).toThrow(INVALID_API_URL_MESSAGE);
    expect(getApiConfigurationError()).toBe(INVALID_API_URL_MESSAGE);
    expect(getApiConfigurationError()).not.toContain(base);
    expect(isApiConfigured()).toBe(false);
  });

  it('reports the missing key before a missing or invalid URL', () => {
    vi.stubEnv('VITE_FAVORIT_API_KEY', '');
    vi.stubEnv('VITE_FAVORIT_API_URL', 'invalid');
    expect(getApiConfigurationError()).toBe(MISSING_API_KEY_MESSAGE);
  });
});
