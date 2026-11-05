import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMatchMedia } from '../test/media-query';
import { OffersTable } from './OffersTable';

function makeOffers(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `offer-${index + 1}`,
    goodsID: `good-${index + 1}`,
    brand: `Производитель ${index + 1}`,
    name: `Деталь ${index + 1}`,
    number: `ARTICLE-${index + 1}`,
    price: 1000 + index,
    stock: index + 1,
    warehouse: `Склад ${index + 1}`,
    isAnalogue: index > 0,
    notRefund: false,
  }));
}

function visibleRows() {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1);
}

afterEach(() => vi.unstubAllGlobals());

describe('OffersTable pagination', () => {
  it('renders 101 offers in ordered pages of at most 50 and respects both boundaries', async () => {
    const user = userEvent.setup();
    render(<OffersTable offers={makeOffers(101)} />);

    const previous = screen.getByRole('button', { name: 'Предыдущая страница' });
    const next = screen.getByRole('button', { name: 'Следующая страница' });
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();
    expect(visibleRows()).toHaveLength(50);
    expect(screen.getByText('ARTICLE-1')).toBeInTheDocument();
    expect(screen.getByText('ARTICLE-50')).toBeInTheDocument();
    expect(screen.queryByText('ARTICLE-51')).not.toBeInTheDocument();
    expect(screen.getByText('1–50 из 101')).toBeInTheDocument();
    expect(screen.getByText('Страница 1 из 3')).toBeInTheDocument();

    await user.click(next);
    expect(visibleRows()).toHaveLength(50);
    expect(screen.queryByText('ARTICLE-50')).not.toBeInTheDocument();
    expect(screen.getByText('ARTICLE-51')).toBeInTheDocument();
    expect(screen.getByText('ARTICLE-100')).toBeInTheDocument();
    expect(screen.queryByText('ARTICLE-101')).not.toBeInTheDocument();
    expect(screen.getByText('51–100 из 101')).toBeInTheDocument();
    expect(screen.getByText('Страница 2 из 3')).toBeInTheDocument();
    expect(previous).toBeEnabled();

    await user.click(next);
    expect(visibleRows()).toHaveLength(1);
    expect(screen.getByText('ARTICLE-101')).toBeInTheDocument();
    expect(screen.getByText('101–101 из 101')).toBeInTheDocument();
    expect(screen.getByText('Страница 3 из 3')).toBeInTheDocument();
    expect(next).toBeDisabled();

    await user.click(next);
    expect(screen.getByText('Страница 3 из 3')).toBeInTheDocument();
    await user.click(previous);
    expect(screen.getByText('Страница 2 из 3')).toBeInTheDocument();
    expect(next).toBeEnabled();
    await user.click(previous);
    expect(screen.getByText('Страница 1 из 3')).toBeInTheDocument();
    expect(previous).toBeDisabled();
    await user.click(previous);
    expect(screen.getByText('Страница 1 из 3')).toBeInTheDocument();
  });

  it.each([0, 1, 50])('does not show pagination for %i offers', (count) => {
    render(<OffersTable offers={makeOffers(count)} />);
    expect(visibleRows()).toHaveLength(count);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('clamps the visible page when the offers array shrinks', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OffersTable offers={makeOffers(101)} />);
    await user.click(screen.getByRole('button', { name: 'Следующая страница' }));
    await user.click(screen.getByRole('button', { name: 'Следующая страница' }));

    rerender(<OffersTable offers={makeOffers(60)} />);
    expect(visibleRows()).toHaveLength(10);
    expect(screen.getByText('51–60 из 60')).toBeInTheDocument();
    expect(screen.getByText('Страница 2 из 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Следующая страница' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Предыдущая страница' }));
    expect(visibleRows()).toHaveLength(50);
    expect(screen.getByText('Страница 1 из 2')).toBeInTheDocument();

    rerender(<OffersTable offers={makeOffers(2)} />);
    expect(visibleRows()).toHaveLength(2);
    expect(screen.getByText('ARTICLE-1')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    rerender(<OffersTable offers={[]} />);
    expect(visibleRows()).toHaveLength(0);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('preserves offer price, warehouse stock, original/analogue labels and return restrictions', () => {
    const offers = makeOffers(2);
    offers[0] = { ...offers[0], price: 12533.62, stock: 7, notRefund: true };
    offers[1] = { ...offers[1], price: null, stock: 0 };
    render(<OffersTable offers={offers} />);

    expect(screen.getByRole('region', { name: 'Таблица предложений' })).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(screen.getByRole('table')).toHaveAccessibleName(
      'Оригинальная деталь и аналоги. Цена и остаток каждого склада.',
    );
    expect(screen.getByText('12 533,62 ₽')).toBeInTheDocument();
    expect(screen.getByText('7 шт.')).toBeInTheDocument();
    expect(screen.getByText('Склад 1')).toBeInTheDocument();
    expect(screen.getByText('Оригинал')).toBeInTheDocument();
    expect(screen.getByText('Аналог')).toBeInTheDocument();
    expect(screen.getByText('Без возврата по причине «Отказ»')).toBeInTheDocument();
    expect(screen.getByText('Нет в наличии')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('displays a valid zero price and a fallback for an unnamed part', () => {
    const [offer] = makeOffers(1);
    render(<OffersTable offers={[{ ...offer, price: 0, name: '' }]} />);
    expect(screen.getByText('0,00 ₽')).toBeInTheDocument();
    expect(screen.getByText('Без наименования')).toBeInTheDocument();
  });

  it('starts each next and previous page at the top of the table scroll area', async () => {
    const user = userEvent.setup();
    render(<OffersTable offers={makeOffers(101)} />);
    const scrollArea = screen.getByRole('region', { name: 'Таблица предложений' });

    scrollArea.scrollTop = 400;
    await user.click(screen.getByRole('button', { name: 'Следующая страница' }));
    expect(scrollArea.scrollTop).toBe(0);
    expect(screen.getByText('ARTICLE-51')).toBeInTheDocument();

    scrollArea.scrollTop = 300;
    await user.click(screen.getByRole('button', { name: 'Предыдущая страница' }));
    expect(scrollArea.scrollTop).toBe(0);
    expect(screen.getByText('ARTICLE-1')).toBeInTheDocument();
  });
});

describe('OffersTable responsive layout', () => {
  it('renders one mobile card list with at most 50 offers and no desktop table', () => {
    const media = createMatchMedia(true);
    vi.stubGlobal('matchMedia', media.matchMedia);
    render(<OffersTable offers={makeOffers(101)} />);

    expect(screen.getByRole('region', { name: 'Карточки предложений' })).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(screen.getByRole('list', { name: 'Список предложений' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(50);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByText('ARTICLE-1')).toHaveLength(1);
    expect(screen.queryByText('ARTICLE-51')).not.toBeInTheDocument();
    expect(screen.getByText('1–50 из 101')).toBeInTheDocument();
  });

  it('preserves the current page and data when resizing between table and cards', async () => {
    const media = createMatchMedia(false);
    vi.stubGlobal('matchMedia', media.matchMedia);
    const user = userEvent.setup();
    render(<OffersTable offers={makeOffers(101)} />);
    await user.click(screen.getByRole('button', { name: 'Следующая страница' }));
    expect(visibleRows()).toHaveLength(50);

    act(() => media.setMatches(true));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(50);
    expect(screen.getAllByText('ARTICLE-51')).toHaveLength(1);
    expect(screen.queryByText('ARTICLE-1')).not.toBeInTheDocument();
    expect(screen.getByText('Страница 2 из 3')).toBeInTheDocument();

    act(() => media.setMatches(false));
    expect(screen.getByRole('region', { name: 'Таблица предложений' })).toBeInTheDocument();
    expect(visibleRows()).toHaveLength(50);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getAllByText('ARTICLE-51')).toHaveLength(1);
    expect(screen.getByText('Страница 2 из 3')).toBeInTheDocument();
  });

  it('resets card scroll when changing pages and respects mobile pagination boundaries', async () => {
    const media = createMatchMedia(true);
    vi.stubGlobal('matchMedia', media.matchMedia);
    const user = userEvent.setup();
    render(<OffersTable offers={makeOffers(101)} />);
    const scrollArea = screen.getByRole('region', { name: 'Карточки предложений' });
    const previous = screen.getByRole('button', { name: 'Предыдущая страница' });
    const next = screen.getByRole('button', { name: 'Следующая страница' });
    expect(previous).toBeDisabled();

    scrollArea.scrollTop = 400;
    await user.click(next);
    expect(scrollArea.scrollTop).toBe(0);
    expect(screen.getByText('ARTICLE-51')).toBeInTheDocument();

    scrollArea.scrollTop = 300;
    await user.click(previous);
    expect(scrollArea.scrollTop).toBe(0);
    expect(screen.getByText('ARTICLE-1')).toBeInTheDocument();

    await user.click(next);
    await user.click(next);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('ARTICLE-101')).toBeInTheDocument();
    expect(screen.getByText('101–101 из 101')).toBeInTheDocument();
    expect(next).toBeDisabled();
  });
});
