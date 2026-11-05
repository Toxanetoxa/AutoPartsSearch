const warehouse = {
  code: 'МС2',
  id: 'E8C31C27-031C-11E7-80CF-0050568E1762',
  own: false,
  shipmentDate: '2019-05-31T15:30:00+03:00',
  warehouseShipping: '9506B522-2875-11E4-9621-0050568E0E34',
};
const sampleGoods = [
  {
    goodsID: '1FAFD8CA-F73E-11DC-A83E-000E0CE9B9AA',
    brand: 'MEYLE',
    number: '7160500039/S',
    name: 'Рычаги задней подвески (комплект на две стороны)',
    count: 20,
    price: 12533.62,
    rate: 1,
    warehouses: [{ ...warehouse, price: 12533.62, stock: 20 }],
    analogues: [
      {
        goodsID: '9FFB3D2A-22FD-11E0-81EF-001517C72418',
        brand: 'Mapco',
        number: '53612/1',
        name: 'Комплект рычагов задней подвески, 6 шт. с болтами',
        count: 10,
        price: 8680.2,
        rate: 1,
        warehouses: [
          {
            ...warehouse,
            code: 'ПТ4',
            id: 'B70E79BB-10CD-11E8-8136-0050568E1762',
            shipmentDate: '2019-06-01T13:30:00+03:00',
            price: 8680.2,
            stock: 10,
          },
        ],
      },
      {
        goodsID: 'DB661B6A-F980-11DF-A27F-001517C72418',
        brand: 'MEYLE',
        number: '7160500039/SK',
        name: 'Рычаги задней подвески (комплект на одну сторону)',
        count: 0,
        price: 0,
        rate: 1,
        warehouses: [],
      },
    ],
  },
];
const articleSampleGoods = [
  {
    goodsID: 'EBC80534-6DBB-4E7A-8DE1-87EE5691C042',
    brand: 'ZEN',
    number: '0189',
    name: 'Бендикс',
    count: 6,
    price: 367.92,
    rate: 1,
    warehouses: [{ ...warehouse, price: 367.92, stock: 6 }],
  },
  {
    goodsID: '74E7ABE5-14D4-439D-9E87-4E7F18FF0C6C',
    brand: 'NGK/NTK',
    number: '0189',
    name: 'Лямбда-зонд',
    count: 0,
    price: 0,
    rate: 1,
    warehouses: [],
  },
  {
    goodsID: '9769C10C-5401-4C55-B79B-5B3774FA9642',
    brand: 'CAFFARO',
    number: '01-89',
    name: 'Ролик поликлинового ремня',
    count: 4,
    price: 429.96,
    rate: 1,
    warehouses: [{ ...warehouse, price: 429.96, stock: 4 }],
  },
];
function buildSampleResponse(number, brand) {
  const article = number.trim().toLocaleUpperCase();
  const source = ['01089', '0189', '01-89'].includes(article)
    ? articleSampleGoods
    : ['7160500039S', '7160500039/S'].includes(article)
      ? sampleGoods
      : [];
  const goods = source
    .filter(
      (good) =>
        brand === undefined || good.brand.toLocaleLowerCase() === brand.trim().toLocaleLowerCase(),
    )
    .map((good) => {
      const copy = structuredClone(good);
      if (brand === undefined) delete copy.analogues;
      return copy;
    });
  return { goods };
}
export { articleSampleGoods, buildSampleResponse, sampleGoods };
