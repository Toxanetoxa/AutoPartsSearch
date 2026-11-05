import { z } from 'zod';
const articleSchema = z
  .string()
  .refine((value) => !/\p{Cc}/u.test(value), 'Артикул не должен содержать управляющие символы')
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1, 'Введите артикул детали')
      .max(80, 'Артикул должен содержать не больше 80 символов'),
  );
const searchFormSchema = z.object({ number: articleSchema });
const warehouseSchema = z.object({
  id: z.string(),
  code: z.string().optional(),
  own: z.boolean().optional(),
  shipmentDate: z.iso.datetime({ offset: true }).optional(),
  price: z.number().finite().nonnegative(),
  stock: z.number().int().nonnegative(),
  notRefund: z.boolean().optional(),
  warehouseShipping: z.string().optional(),
});
const goodSchema = z.lazy(() =>
  z.object({
    goodsID: z.string(),
    brand: z.string(),
    number: z.string(),
    name: z.string(),
    count: z.number().int().nonnegative(),
    price: z.number().finite().nonnegative(),
    rate: z.number().int().nonnegative(),
    warehouses: z.array(warehouseSchema),
    analogues: z.array(goodSchema).optional(),
    notRefund: z.boolean().optional(),
  }),
);
const priceResponseSchema = z.union([
  z.object({ goods: z.array(goodSchema) }),
  z.object({ error: z.string() }),
]);
const ZERO_ID = '00000000-0000-0000-0000-000000000000';
function isRealGood(good) {
  return good.brand.trim() !== '' && good.goodsID !== ZERO_ID;
}
function productKey(good) {
  return good.goodsID || JSON.stringify([good.brand.toLocaleLowerCase(), good.number]);
}
function getManufacturers(goods) {
  const manufacturers = new Map();
  const seenProducts = new Set();
  for (const good of goods) {
    if (!isRealGood(good) || seenProducts.has(productKey(good))) continue;
    seenProducts.add(productKey(good));
    const key = good.brand.trim().toLocaleLowerCase();
    const existing = manufacturers.get(key);
    if (existing) {
      existing.count += good.count;
    } else {
      manufacturers.set(key, {
        brand: good.brand,
        name: good.name,
        number: good.number,
        count: good.count,
      });
    }
  }
  return [...manufacturers.values()];
}
function warehouseKey(warehouse) {
  return JSON.stringify([
    warehouse.id,
    warehouse.warehouseShipping ?? '',
    warehouse.shipmentDate ?? '',
    warehouse.price,
    warehouse.stock,
  ]);
}
function getOffers(goods) {
  const products = new Map();
  function collect(good, isAnalogue) {
    if (!isRealGood(good)) return;
    const key = productKey(good);
    const product = products.get(key) ?? {
      good,
      isAnalogue,
      notRefund: false,
      warehouses: new Map(),
    };
    product.isAnalogue &&= isAnalogue;
    product.notRefund ||= good.notRefund === true;
    for (const warehouse of good.warehouses) {
      const key2 = warehouseKey(warehouse);
      const existing = product.warehouses.get(key2);
      product.warehouses.set(key2, {
        ...existing,
        ...warehouse,
        notRefund: existing?.notRefund === true || warehouse.notRefund === true,
      });
    }
    products.set(key, product);
  }
  for (const good of goods) collect(good, false);
  const visited = new Set();
  function visitAnalogues(good) {
    if (visited.has(good)) return;
    visited.add(good);
    for (const analogue of good.analogues ?? []) {
      collect(analogue, true);
      visitAnalogues(analogue);
    }
  }
  for (const good of goods) visitAnalogues(good);
  const offers = [];
  for (const [key, product] of products) {
    const { good } = product;
    const common = {
      goodsID: good.goodsID,
      brand: good.brand,
      number: good.number,
      name: good.name,
      isAnalogue: product.isAnalogue,
    };
    if (product.warehouses.size === 0) {
      offers.push({
        ...common,
        id: JSON.stringify([key, null]),
        price: null,
        stock: 0,
        warehouse: '—',
        notRefund: product.notRefund,
      });
      continue;
    }
    for (const [warehouseId, warehouse] of product.warehouses) {
      offers.push({
        ...common,
        id: JSON.stringify([key, warehouseId]),
        price: warehouse.price,
        stock: warehouse.stock,
        warehouse: warehouse.code || warehouse.id || '—',
        notRefund: product.notRefund || warehouse.notRefund === true,
        ...(warehouse.shipmentDate ? { shipmentDate: warehouse.shipmentDate } : {}),
      });
    }
  }
  return offers;
}
const rubles = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function formatPrice(price) {
  return price === null ? 'Нет предложений' : rubles.format(price);
}
export {
  articleSchema,
  formatPrice,
  getManufacturers,
  getOffers,
  goodSchema,
  priceResponseSchema,
  searchFormSchema,
  warehouseSchema,
};
