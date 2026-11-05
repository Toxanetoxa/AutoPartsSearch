import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OfferCards } from './OfferCards';

function makeOffer(overrides = {}) {
  return {
    id: 'offer-1',
    goodsID: 'good-1',
    brand: 'MEYLE',
    name: 'Комплект рычагов подвески',
    number: '7160500039/S',
    price: 12533.62,
    stock: 20,
    warehouse: 'МС2',
    isAnalogue: false,
    notRefund: false,
    ...overrides,
  };
}

describe('OfferCards', () => {
  it('shows the name, manufacturer, warehouse price and stock for each original or analogue', () => {
    render(
      <OfferCards
        offers={[
          makeOffer(),
          makeOffer({
            id: 'offer-2',
            brand: 'Mapco',
            name: 'Комплект рычагов, 6 шт.',
            number: '53612/1',
            warehouse: 'ПТ4',
            price: null,
            stock: 0,
            isAnalogue: true,
            notRefund: true,
          }),
        ]}
      />,
    );

    const cards = within(screen.getByRole('list', { name: 'Список предложений' })).getAllByRole(
      'listitem',
    );
    expect(cards).toHaveLength(2);
    const original = within(cards[0]);
    expect(original.getByText('MEYLE')).toBeInTheDocument();
    expect(original.getByText('Комплект рычагов подвески')).toBeInTheDocument();
    expect(original.getByText('7160500039/S')).toBeInTheDocument();
    expect(original.getByText('МС2')).toBeInTheDocument();
    expect(original.getByText('12 533,62 ₽')).toBeInTheDocument();
    expect(original.getByText('20 шт.')).toBeInTheDocument();
    expect(original.getByText('Оригинал')).toBeInTheDocument();
    expect(original.queryByText('Без возврата по причине «Отказ»')).not.toBeInTheDocument();

    const analogue = within(cards[1]);
    expect(analogue.getByText('Mapco')).toBeInTheDocument();
    expect(analogue.getByText('Комплект рычагов, 6 шт.')).toBeInTheDocument();
    expect(analogue.getByText('53612/1')).toBeInTheDocument();
    expect(analogue.getByText('ПТ4')).toBeInTheDocument();
    expect(analogue.getByText('—')).toBeInTheDocument();
    expect(analogue.getByText('Нет в наличии')).toBeInTheDocument();
    expect(analogue.getByText('Аналог')).toBeInTheDocument();
    expect(analogue.getByText('Без возврата по причине «Отказ»')).toBeInTheDocument();
  });

  it('keeps zero prices visible and supplies a fallback for an empty part name', () => {
    render(<OfferCards offers={[makeOffer({ price: 0, name: '' })]} />);
    expect(screen.getByText('0,00 ₽')).toBeInTheDocument();
    expect(screen.getByText('Без наименования')).toBeInTheDocument();
  });

  it('keeps complete long article, name and warehouse strings in the card', () => {
    const number = 'LONG-ARTICLE/&'.repeat(15);
    const warehouse = 'WAREHOUSE-'.repeat(20);
    const name = 'Длинное наименование детали '.repeat(12).trim();
    render(<OfferCards offers={[makeOffer({ number, warehouse, name })]} />);
    expect(screen.getByText(number)).toBeInTheDocument();
    expect(screen.getByText(warehouse)).toBeInTheDocument();
    expect(screen.getByText(name)).toBeInTheDocument();
  });

  it('handles missing metadata and an empty offer list', () => {
    const { rerender } = render(<OfferCards offers={[makeOffer({ number: '', warehouse: '' })]} />);
    expect(screen.getAllByText('—')).toHaveLength(2);

    rerender(<OfferCards offers={[]} />);
    expect(screen.getByRole('list', { name: 'Список предложений' })).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});
