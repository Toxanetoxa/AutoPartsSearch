import { describe, expect, it } from 'vitest';
import { emptyGood, makeGood, makeWarehouse } from '../test/fixtures';
import {
  articleSchema,
  formatPrice,
  getManufacturers,
  getOffers,
  goodSchema,
  priceResponseSchema,
  searchFormSchema,
  warehouseSchema,
} from './parts';
describe('articleSchema', () => {
  it('trims surrounding spaces without changing meaningful punctuation or case', () => {
    expect(articleSchema.parse('  Фильтр A#10&B/01-89  ')).toBe('Фильтр A#10&B/01-89');
  });
  it.each(['', '   ', 'A'.repeat(81), 'A\nB', 'A	B', 'A\0B', '\n0189'])(
    'rejects an invalid article %j',
    (number) => {
      expect(articleSchema.safeParse(number).success).toBe(false);
    },
  );
  it('accepts an article exactly at the limit after trimming', () => {
    expect(articleSchema.parse(`  ${'A'.repeat(80)}  `)).toHaveLength(80);
  });
  it('validates the search form with the same rules', () => {
    expect(searchFormSchema.parse({ number: ' 0189 ' })).toEqual({ number: '0189' });
    expect(searchFormSchema.safeParse({ number: ' ' }).success).toBe(false);
  });
});
describe('API schemas', () => {
  it('validates an original with recursively nested analogues', () => {
    const good = makeGood({
      analogues: [makeGood({ analogues: [makeGood({ goodsID: 'deep-analogue' })] })],
    });
    expect(goodSchema.parse(good)).toEqual(good);
  });
  it('accepts optional warehouse metadata, offset dates and missing code', () => {
    expect(warehouseSchema.parse({ id: 'w', price: 0, stock: 0 })).toEqual({
      id: 'w',
      price: 0,
      stock: 0,
    });
    expect(
      warehouseSchema.safeParse(
        makeWarehouse({
          shipmentDate: '2019-05-31T15:30:00+03:00',
          notRefund: true,
          warehouseShipping: 'shipping-id',
        }),
      ).success,
    ).toBe(true);
  });
  it.each([
    { price: -1 },
    { price: Infinity },
    { price: NaN },
    { stock: -1 },
    { stock: 1.5 },
    { shipmentDate: 'yesterday' },
  ])('rejects malformed warehouse fields %j', (overrides) => {
    expect(warehouseSchema.safeParse(makeWarehouse(overrides)).success).toBe(false);
  });
  it('rejects string-valued prices and malformed nested analogues', () => {
    expect(
      priceResponseSchema.safeParse({
        goods: [{ ...makeGood(), warehouses: [{ id: 'w', price: '1200', stock: 1 }] }],
      }).success,
    ).toBe(false);
    expect(
      goodSchema.safeParse(makeGood({ analogues: [{ ...makeGood(), count: -1 }] })).success,
    ).toBe(false);
  });
  it('accepts documented empty sentinel, empty results and service errors', () => {
    expect(priceResponseSchema.parse({ goods: [emptyGood] })).toEqual({ goods: [emptyGood] });
    expect(priceResponseSchema.parse({ goods: [] })).toEqual({ goods: [] });
    expect(priceResponseSchema.parse({ error: 'Invalid key client!' })).toEqual({
      error: 'Invalid key client!',
    });
  });
  it.each([{}, { goods: null }, { goods: [{}] }, { error: 42 }])(
    'rejects an invalid response %j',
    (response) => {
      expect(priceResponseSchema.safeParse(response).success).toBe(false);
    },
  );
});
describe('getManufacturers', () => {
  it('keeps real zero-stock brands and ignores the empty sentinel', () => {
    const good = makeGood({ brand: 'NGK/NTK', count: 0, warehouses: [] });
    expect(getManufacturers([emptyGood, makeGood({ brand: ' ' }), good])).toEqual([
      {
        brand: 'NGK/NTK',
        name: good.name,
        number: good.number,
        count: 0,
      },
    ]);
  });
  it('deduplicates brands without changing the exact returned spelling', () => {
    expect(
      getManufacturers([
        makeGood({ brand: 'NGK/NTK', count: 3 }),
        makeGood({ goodsID: 'good-2', brand: 'ngk/ntk', count: 7 }),
        makeGood({ brand: 'NGK/NTK', count: 3 }),
      ]),
    ).toEqual([
      {
        brand: 'NGK/NTK',
        name: 'Рычаг подвески',
        number: '7160500039/S',
        count: 10,
      },
    ]);
  });
  it('does not offer analogue-only brands in the first search step', () => {
    expect(
      getManufacturers([
        makeGood({
          analogues: [makeGood({ goodsID: 'analogue', brand: 'Mapco' })],
        }),
      ]).map(({ brand }) => brand),
    ).toEqual(['MEYLE']);
  });
});
describe('getOffers', () => {
  it('uses each warehouse price and stock instead of deprecated product price or total count', () => {
    const good = makeGood({
      count: 100,
      price: 99999,
      warehouses: [
        makeWarehouse({ id: 'first', price: 1200.5, stock: 3 }),
        makeWarehouse({ id: 'second', code: 'ПТ4', price: 1100, stock: 8 }),
      ],
    });
    expect(getOffers([good])).toMatchObject([
      { goodsID: good.goodsID, price: 1200.5, stock: 3, warehouse: 'МС2', isAnalogue: false },
      { goodsID: good.goodsID, price: 1100, stock: 8, warehouse: 'ПТ4', isAnalogue: false },
    ]);
  });
  it('keeps an unavailable product without suggesting its legacy price is an offer', () => {
    expect(getOffers([makeGood({ warehouses: [], price: 99999, count: 100 })])).toMatchObject([
      { price: null, stock: 0, warehouse: '—', isAnalogue: false },
    ]);
  });
  it('keeps a zero-price or zero-stock warehouse offer as returned', () => {
    expect(
      getOffers([makeGood({ warehouses: [makeWarehouse({ price: 0, stock: 0 })] })]),
    ).toMatchObject([{ price: 0, stock: 0 }]);
  });
  it('flattens arbitrarily nested analogues and preserves the original status', () => {
    const offers = getOffers([
      makeGood({
        analogues: [
          makeGood({
            goodsID: 'analogue-1',
            brand: 'Mapco',
            analogues: [makeGood({ goodsID: 'analogue-2', brand: 'FEBI' })],
          }),
        ],
      }),
    ]);
    expect(offers.map(({ brand, isAnalogue }) => ({ brand, isAnalogue }))).toEqual([
      { brand: 'MEYLE', isAnalogue: false },
      { brand: 'Mapco', isAnalogue: true },
      { brand: 'FEBI', isAnalogue: true },
    ]);
  });
  it('deduplicates goods and identical warehouse offers, with original metadata taking precedence', () => {
    const original = makeGood({ goodsID: 'original', name: 'Original name' });
    const repeated = makeGood({ goodsID: 'original', name: 'Repeated name' });
    const another = makeGood({ goodsID: 'another', analogues: [repeated, repeated] });
    const offers = getOffers([another, original, original]);
    expect(offers).toHaveLength(2);
    expect(offers.find(({ goodsID }) => goodsID === 'original')).toMatchObject({
      name: 'Original name',
      isAnalogue: false,
    });
    expect(new Set(offers.map(({ id }) => id)).size).toBe(2);
  });
  it('merges warehouses from repeated products and removes the unavailable placeholder', () => {
    const offers = getOffers([
      makeGood({ warehouses: [] }),
      makeGood({ warehouses: [makeWarehouse(), makeWarehouse()] }),
      makeGood({ warehouses: [makeWarehouse({ id: 'other', code: 'ПТ4' })] }),
    ]);
    expect(offers).toHaveLength(2);
    expect(offers.every(({ price }) => price !== null)).toBe(true);
    expect(new Set(offers.map(({ id }) => id)).size).toBe(2);
  });
  it('keeps genuinely different offers on the same warehouse', () => {
    expect(
      getOffers([
        makeGood({ warehouses: [makeWarehouse({ price: 1e3 }), makeWarehouse({ price: 1500 })] }),
      ]),
    ).toHaveLength(2);
  });
  it('combines product and warehouse return restrictions independently per offer', () => {
    const warehouses = [makeWarehouse({ id: 'a' }), makeWarehouse({ id: 'b', notRefund: true })];
    expect(getOffers([makeGood({ warehouses })]).map(({ notRefund }) => notRefund)).toEqual([
      false,
      true,
    ]);
    expect(
      getOffers([makeGood({ warehouses, notRefund: true })]).map(({ notRefund }) => notRefund),
    ).toEqual([true, true]);
  });
  it('retains return restrictions when merging duplicate offers', () => {
    expect(
      getOffers([makeGood({ warehouses: [makeWarehouse({ notRefund: true })] }), makeGood()]),
    ).toMatchObject([{ notRefund: true }]);
  });
  it('uses the warehouse id when its optional code is absent and preserves shipment date', () => {
    expect(
      getOffers([
        makeGood({
          warehouses: [
            {
              id: 'warehouse-without-code',
              price: 10,
              stock: 1,
              shipmentDate: '2019-05-31T15:30:00+03:00',
            },
          ],
        }),
      ]),
    ).toMatchObject([
      {
        warehouse: 'warehouse-without-code',
        shipmentDate: '2019-05-31T15:30:00+03:00',
      },
    ]);
  });
  it('returns empty results for unknown or sentinel goods', () => {
    expect(getOffers([])).toEqual([]);
    expect(getOffers([emptyGood, makeGood({ brand: '' })])).toEqual([]);
  });
  it('does not mutate the API response', () => {
    const goods = [makeGood({ analogues: [makeGood({ goodsID: 'analogue' })] })];
    const before = structuredClone(goods);
    getManufacturers(goods);
    getOffers(goods);
    expect(goods).toEqual(before);
  });
});
describe('formatPrice', () => {
  it('formats a ruble amount with cents and handles unavailable pricing', () => {
    expect(formatPrice(12533.62).replace(/\s/g, ' ')).toBe('12 533,62 ₽');
    expect(formatPrice(0).replace(/\s/g, ' ')).toBe('0,00 ₽');
    expect(formatPrice(null)).toBe('Нет предложений');
  });
});
