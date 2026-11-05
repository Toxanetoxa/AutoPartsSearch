import { createApi, fakeBaseQuery, skipToken } from '@reduxjs/toolkit/query/react';
import { useEffect, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { z } from 'zod';

import { articleSchema, getManufacturers, getOffers } from '../domain/parts';
import { fetchParts } from './client';
import { isApiConfigured } from './config';

const brandSchema = z
  .string()
  .refine((value) => !/\p{Cc}/u.test(value))
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(120));

async function queryParts(number, brand, signal, select) {
  try {
    return { data: select(await fetchParts(number, brand, signal)) };
  } catch (error) {
    return {
      error: {
        status: error.status ?? 0,
        message: error.message || 'Не удалось получить данные. Повторите поиск.',
      },
    };
  }
}

export const partsApi = createApi({
  reducerPath: 'partsApi',
  baseQuery: fakeBaseQuery(),
  keepUnusedDataFor: 60,
  refetchOnMountOrArgChange: 60,
  refetchOnFocus: false,
  refetchOnReconnect: false,
  endpoints: (builder) => ({
    manufacturers: builder.query({
      queryFn: (number, { signal }) => queryParts(number, undefined, signal, getManufacturers),
    }),
    offers: builder.query({
      queryFn: ({ number, brand }, { signal }) => queryParts(number, brand, signal, getOffers),
    }),
  }),
});

// Each search stage has one consumer. Cancel its old request when the argument changes.
function useAbortObsoleteQuery(endpoint, arg) {
  const dispatch = useDispatch();
  const activeArg = useRef(skipToken);

  useEffect(() => {
    if (arg === skipToken) return;
    activeArg.current = arg;
    return () => {
      activeArg.current = skipToken;
      // StrictMode immediately restores the same effect; keep that request running.
      queueMicrotask(() => {
        if (activeArg.current !== arg) {
          dispatch(partsApi.util.getRunningQueryThunk(endpoint, arg))?.abort();
        }
      });
    };
  }, [dispatch, endpoint, arg]);
}

function currentResult(result, arg) {
  const enabled = arg !== skipToken;
  return {
    data: enabled ? result.currentData : undefined,
    isLoading: enabled && result.isLoading,
    isFetching: enabled && result.isFetching,
    isSuccess: enabled && result.currentData !== undefined && !result.isError,
    isError: enabled && result.isError,
    error:
      enabled && result.error
        ? { status: result.error.status ?? 0, message: result.error.message }
        : undefined,
    refetch: result.refetch,
  };
}

export function useManufacturers(number) {
  const parsed = articleSchema.safeParse(number);
  const arg = parsed.success && isApiConfigured() ? parsed.data : skipToken;
  const result = partsApi.useManufacturersQuery(arg);
  useAbortObsoleteQuery('manufacturers', arg);
  return currentResult(result, arg);
}

export function useOffers(number, brand) {
  const parsedNumber = articleSchema.safeParse(number);
  const parsedBrand = brandSchema.safeParse(brand);
  const normalizedNumber = parsedNumber.success ? parsedNumber.data : null;
  const normalizedBrand = parsedBrand.success ? parsedBrand.data : null;
  const configured = isApiConfigured();
  const arg = useMemo(
    () =>
      normalizedNumber && normalizedBrand && configured
        ? { number: normalizedNumber, brand: normalizedBrand }
        : skipToken,
    [normalizedNumber, normalizedBrand, configured],
  );
  const result = partsApi.useOffersQuery(arg);
  useAbortObsoleteQuery('offers', arg);
  return currentResult(result, arg);
}
