import { describe, expect, it } from 'vitest';
import { buildSampleResponse } from './sample-parts';
import { getManufacturers, getOffers, priceResponseSchema } from '../domain/parts';
describe('buildSampleResponse', () => {
  it.each(['01089', '0189', '01-89'])('provides documented manufacturers for %s', (number) => {
    const result = buildSampleResponse(number);
    expect(priceResponseSchema.safeParse(result).success).toBe(true);
    expect(getManufacturers(result.goods).map(({ brand }) => brand)).toEqual([
      'ZEN',
      'NGK/NTK',
      'CAFFARO',
    ]);
  });
  it.each(['7160500039S', '7160500039/S'])(
    'searches %s without leaking analogues into manufacturers',
    (number) => {
      const result = buildSampleResponse(number);
      expect(result.goods).toHaveLength(1);
      expect(result.goods[0]?.brand).toBe('MEYLE');
      expect(result.goods[0]?.analogues).toBeUndefined();
    },
  );
  it('returns documented original and analogue offers after selecting MEYLE', () => {
    const result = buildSampleResponse('7160500039S', 'MEYLE');
    expect(priceResponseSchema.safeParse(result).success).toBe(true);
    expect(getOffers(result.goods)).toMatchObject([
      { brand: 'MEYLE', stock: 20, price: 12533.62, isAnalogue: false },
      { brand: 'Mapco', stock: 10, price: 8680.2, isAnalogue: true },
      { brand: 'MEYLE', stock: 0, price: null, isAnalogue: true },
    ]);
  });
  it('preserves the slash in the documented NGK/NTK brand', () => {
    expect(buildSampleResponse('0189', 'NGK/NTK').goods).toMatchObject([
      { brand: 'NGK/NTK', count: 0, warehouses: [] },
    ]);
    expect(buildSampleResponse('0189', 'NGKNTK').goods).toEqual([]);
  });
  it('does not fabricate results for unknown articles or manufacturers', () => {
    expect(buildSampleResponse('UNKNOWN')).toEqual({ goods: [] });
    expect(buildSampleResponse('7260500039S')).toEqual({ goods: [] });
    expect(buildSampleResponse('7160500039S', 'ZEN')).toEqual({ goods: [] });
  });
  it('returns independent response objects so callers cannot alter future requests', () => {
    const result = buildSampleResponse('7160500039S', 'MEYLE');
    result.goods[0].name = 'Changed';
    result.goods[0].warehouses[0].price = 1;
    expect(buildSampleResponse('7160500039S', 'MEYLE').goods[0]).toMatchObject({
      name: 'Рычаги задней подвески (комплект на две стороны)',
      warehouses: [{ price: 12533.62 }],
    });
  });
});
