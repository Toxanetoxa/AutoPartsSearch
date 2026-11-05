import { sampleGoods } from './sample-parts';
import { sampleGoods as sampleGoods2 } from './sample-parts';
function makeWarehouse(overrides = {}) {
  return {
    id: 'warehouse-1',
    code: 'МС2',
    own: false,
    price: 1200.5,
    stock: 3,
    ...overrides,
  };
}
function makeGood(overrides = {}) {
  return {
    goodsID: 'good-1',
    brand: 'MEYLE',
    number: '7160500039/S',
    name: 'Рычаг подвески',
    count: 3,
    price: 99999,
    rate: 1,
    warehouses: [makeWarehouse()],
    ...overrides,
  };
}
const emptyGood = {
  goodsID: '00000000-0000-0000-0000-000000000000',
  brand: '',
  number: '',
  name: '',
  count: 0,
  price: 0,
  rate: 0,
  warehouses: [],
};
function cloneSampleGoods() {
  return structuredClone(sampleGoods);
}
export { cloneSampleGoods, emptyGood, makeGood, makeWarehouse, sampleGoods2 as sampleGoods };
