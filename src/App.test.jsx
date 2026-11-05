import { Provider } from 'react-redux';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { partsApi } from './api/queries';
import { createAppStore } from './store/store';
import { buildSampleResponse } from './test/sample-parts';
import { makeGood, makeWarehouse } from './test/fixtures';
import { createMatchMedia } from './test/media-query';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
let handleParts;
const fetchMock = vi.fn();
const stores = [];
const originalURL = window.location.href;
const originalHistoryState = window.history.state;
beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.stubEnv('VITE_FAVORIT_API_KEY', 'test-key');
  handleParts = (url) =>
    json(
      buildSampleResponse(
        url.searchParams.get('number') ?? '',
        url.searchParams.get('brand') ?? undefined,
      ),
    );
  fetchMock.mockImplementation((path) => {
    const url = new URL(String(path));
    expect(url.hostname).toBe('api.favorit-parts.ru');
    expect(url.pathname).toBe('/hs/hsprice/');
    return Promise.resolve(handleParts(url));
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  stores.forEach((store) => store.dispatch(partsApi.util.resetApiState()));
  stores.length = 0;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  window.history.replaceState(originalHistoryState, '', originalURL);
});
function setup() {
  const store = createAppStore();
  stores.push(store);
  render(
    <Provider store={store}>
      <App />
    </Provider>,
  );
  return userEvent.setup();
}
function partsCalls() {
  return fetchMock.mock.calls.filter(
    ([url]) => new URL(String(url)).hostname === 'api.favorit-parts.ru',
  );
}
async function search(user, number) {
  await user.type(screen.getByLabelText('Артикул запчасти'), number);
  await user.click(screen.getByRole('button', { name: 'Найти' }));
}
async function selectMeyle(user) {
  await search(user, '7160500039S');
  await user.click(await screen.findByRole('radio', { name: 'MEYLE' }));
  return screen.findByRole('table');
}

function navigateTo(url) {
  act(() => {
    window.history.replaceState(window.history.state, '', url);
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  });
}
describe('two-stage parts search', () => {
  it('starts with guidance, a labelled input and no requests before typing', () => {
    setup();
    expect(screen.getByLabelText('Артикул запчасти')).toHaveValue('');
    expect(
      screen.getByText('Выберите производителя, чтобы увидеть предложения.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('ДЕМО')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '01089' })).not.toBeInTheDocument();
    expect(partsCalls()).toHaveLength(0);
  });
  it('contains only the search form and two steps without decorative navigation', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Поиск автозапчастей' })).toBeInTheDocument();
    expect(screen.getAllByRole('region')).toHaveLength(2);
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Деталь/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/КАТАЛОГ/)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
  it('validates empty submission and overly long articles without making requests', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Найти' }));
    expect(await screen.findByText('Введите артикул детали')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Артикул запчасти'), 'x'.repeat(81));
    expect(
      await screen.findByText('Артикул должен содержать не больше 80 символов'),
    ).toBeInTheDocument();
    expect(partsCalls()).toHaveLength(0);
  });
  it('debounces typing and requests manufacturers without a brand', async () => {
    const user = setup();
    await user.type(screen.getByLabelText('Артикул запчасти'), '01089');
    expect(partsCalls()).toHaveLength(0);
    expect(await screen.findByRole('radio', { name: 'ZEN' })).toBeInTheDocument();
    expect(partsCalls()).toHaveLength(1);
    expect(new URL(partsCalls()[0][0], 'http://localhost').searchParams.get('brand')).toBeNull();
    expect(new URL(partsCalls()[0][0], 'http://localhost').searchParams.get('key')).toBe(
      'test-key',
    );
    expect(screen.getByRole('radio', { name: 'NGK/NTK' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'ZEN' })).toHaveAttribute('type', 'radio');
  });
  it('submits immediately, preserves special characters and shows no-results feedback', async () => {
    const user = setup();
    await user.type(screen.getByLabelText('Артикул запчасти'), 'A#1&B/2');
    await user.click(screen.getByRole('button', { name: 'Найти' }));
    expect(await screen.findByText(/Ничего не найдено/)).toBeInTheDocument();
    expect(new URL(partsCalls()[0][0], 'http://localhost').searchParams.get('number')).toBe(
      'A#1&B/2',
    );
  });
  it('requests selected brand and renders originals, analogues, warehouse stock and prices', async () => {
    const user = setup();
    const table = await selectMeyle(user);
    expect(within(table).getByText('Mapco')).toBeInTheDocument();
    expect(within(table).getByText('Оригинал')).toBeInTheDocument();
    expect(within(table).getAllByText('Аналог')).toHaveLength(2);
    expect(within(table).getByText(/12\s?533,62/)).toBeInTheDocument();
    expect(within(table).getByText('20 шт.')).toBeInTheDocument();
    expect(within(table).getByText('ПТ4')).toBeInTheDocument();
    expect(within(table).getByText('Нет в наличии')).toBeInTheDocument();
    expect(new URL(partsCalls()[1][0], 'http://localhost').searchParams.get('brand')).toBe('MEYLE');
    expect(new URL(partsCalls()[1][0], 'http://localhost').searchParams.get('analogues')).toBe(
      'on',
    );
  });
  it('selects a manufacturer and loads its offers when the card description is clicked', async () => {
    const user = setup();
    await search(user, '01089');
    await user.click(await screen.findByText('Бендикс'));
    expect(screen.getByRole('radio', { name: 'ZEN' })).toBeChecked();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Бендикс')).toBeInTheDocument();
    expect(within(table).getByText('ZEN')).toBeInTheDocument();
    expect(new URL(partsCalls()[1][0]).searchParams.get('brand')).toBe('ZEN');
  });
  it('reaches the manufacturer results and selects a brand using only the keyboard', async () => {
    const user = setup();
    await search(user, '01089');
    const zen = await screen.findByRole('radio', { name: 'ZEN' });
    expect(screen.getByRole('button', { name: 'Найти' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('group', { name: 'Результаты поиска производителей' })).toHaveFocus();
    await user.tab();
    expect(zen).toHaveFocus();
    await user.keyboard(' ');
    expect(zen).toBeChecked();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Бендикс')).toBeInTheDocument();
    expect(within(table).getByText('ZEN')).toBeInTheDocument();
  });
  it('selects a horizontal manufacturer tile on mobile, renders offer cards and clears them for another article', async () => {
    const media = createMatchMedia(true);
    vi.stubGlobal('matchMedia', media.matchMedia);
    const user = setup();
    await search(user, '01089');
    const manufacturers = await screen.findByRole('radiogroup', { name: 'Производитель' });
    expect(manufacturers).toHaveAttribute('aria-orientation', 'horizontal');
    await user.click(within(manufacturers).getByText('Бендикс'));
    expect(screen.getByRole('radio', { name: 'ZEN' })).toBeChecked();
    const cards = await screen.findByRole('region', { name: 'Карточки предложений' });
    expect(within(cards).getByRole('list', { name: 'Список предложений' })).toBeInTheDocument();
    expect(within(cards).getByText('ZEN')).toBeInTheDocument();
    expect(within(cards).getByText('Бендикс')).toBeInTheDocument();
    expect(within(cards).getByText('367,92 ₽')).toBeInTheDocument();
    expect(within(cards).getByText('6 шт.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Артикул запчасти'), 'X');
    expect(screen.queryByRole('radio', { checked: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Карточки предложений' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Выберите производителя, чтобы увидеть предложения.'),
    ).toBeInTheDocument();
  });
  it('preserves the selected brand and loaded offers while resizing without additional API calls', async () => {
    const media = createMatchMedia(false);
    vi.stubGlobal('matchMedia', media.matchMedia);
    const user = setup();
    await selectMeyle(user);
    const requestCount = partsCalls().length;
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-orientation', 'vertical');

    act(() => media.setMatches(true));
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-orientation', 'horizontal');
    expect(screen.getByRole('radio', { name: 'MEYLE' })).toBeChecked();
    const cards = screen.getByRole('region', { name: 'Карточки предложений' });
    expect(within(cards).getByText('Mapco')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(partsCalls()).toHaveLength(requestCount);

    act(() => media.setMatches(false));
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-orientation', 'vertical');
    expect(screen.getByRole('radio', { name: 'MEYLE' })).toBeChecked();
    expect(screen.getByRole('table')).toHaveTextContent('Mapco');
    expect(screen.queryByRole('region', { name: 'Карточки предложений' })).not.toBeInTheDocument();
    expect(partsCalls()).toHaveLength(requestCount);
  });
  it('immediately clears selected brand and old offers when the article changes', async () => {
    const user = setup();
    await selectMeyle(user);
    await user.type(screen.getByLabelText('Артикул запчасти'), 'X');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { checked: true })).not.toBeInTheDocument();
    expect(
      screen.getByText('Выберите производителя, чтобы увидеть предложения.'),
    ).toBeInTheDocument();
  });
  it('returns pagination to the first page after changing the brand or article', async () => {
    handleParts = (url) => {
      const brand = url.searchParams.get('brand');
      return json(
        brand
          ? {
              goods: Array.from({ length: 65 }, (_, index) =>
                makeGood({
                  goodsID: `good-${index}`,
                  brand,
                  number: `part-${index}`,
                  warehouses: [makeWarehouse({ price: index + 1, stock: 1 })],
                }),
              ),
            }
          : buildSampleResponse(url.searchParams.get('number') ?? ''),
      );
    };
    const user = setup();
    await search(user, '01089');
    await user.click(await screen.findByRole('radio', { name: 'ZEN' }));
    expect(await screen.findByText('Страница 1 из 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Следующая страница' }));
    expect(screen.getByText('Страница 2 из 2')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'CAFFARO' }));
    expect(await screen.findByText('Страница 1 из 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Следующая страница' }));
    expect(screen.getByText('Страница 2 из 2')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Артикул запчасти'));
    await search(user, '7160500039S');
    await user.click(await screen.findByRole('radio', { name: 'MEYLE' }));
    expect(await screen.findByText('Страница 1 из 2')).toBeInTheDocument();
    expect(screen.getByText('1–50 из 65')).toBeInTheDocument();
  });
  it('cancels an old manufacturer request and ignores its delayed response after a new search', async () => {
    let resolveOld;
    handleParts = (url) =>
      url.searchParams.get('number') === '01089'
        ? new Promise((resolve) => {
            resolveOld = resolve;
          })
        : json(buildSampleResponse('7160500039S'));
    const user = setup();
    await search(user, '01089');
    expect(await screen.findByText('Ищем производителей…')).toBeInTheDocument();
    const oldSignal = fetchMock.mock.calls[0][1].signal;
    await user.clear(screen.getByLabelText('Артикул запчасти'));
    await search(user, '7160500039S');
    expect(await screen.findByRole('radio', { name: 'MEYLE' })).toBeInTheDocument();
    await waitFor(() => expect(oldSignal.aborted).toBe(true));
    await act(async () => resolveOld(json(buildSampleResponse('01089'))));
    expect(screen.queryByRole('radio', { name: 'ZEN' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'MEYLE' })).toBeInTheDocument();
  });
  it('cancels pending offers and keeps them hidden when the article changes', async () => {
    let resolveOffers;
    handleParts = (url) =>
      url.searchParams.has('brand')
        ? new Promise((resolve) => {
            resolveOffers = resolve;
          })
        : json(buildSampleResponse(url.searchParams.get('number') ?? ''));
    const user = setup();
    await search(user, '7160500039S');
    await user.click(await screen.findByRole('radio', { name: 'MEYLE' }));
    expect(await screen.findByText('Загружаем предложения и аналоги…')).toBeInTheDocument();
    const oldSignal = fetchMock.mock.calls[1][1].signal;
    await user.type(screen.getByLabelText('Артикул запчасти'), 'X');
    await waitFor(() => expect(oldSignal.aborted).toBe(true));
    await act(async () => resolveOffers(json(buildSampleResponse('7160500039S', 'MEYLE'))));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Mapco')).not.toBeInTheDocument();
    expect(
      screen.getByText('Выберите производителя, чтобы увидеть предложения.'),
    ).toBeInTheDocument();
  });
  it('clears input and results and restores focus', async () => {
    const user = setup();
    await selectMeyle(user);
    await user.click(screen.getByRole('button', { name: 'Очистить артикул' }));
    expect(screen.getByLabelText('Артикул запчасти')).toHaveValue('');
    expect(screen.getByLabelText('Артикул запчасти')).toHaveFocus();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('clears a previous validation error together with the input', async () => {
    const user = setup();
    await user.type(screen.getByLabelText('Артикул запчасти'), 'x'.repeat(81));
    expect(
      await screen.findByText('Артикул должен содержать не больше 80 символов'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Очистить артикул' }));
    expect(screen.getByLabelText('Артикул запчасти')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('resets the selected brand and old offers on explicit repeated search', async () => {
    const user = setup();
    await selectMeyle(user);
    await user.click(screen.getByRole('button', { name: 'Найти' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { checked: true })).not.toBeInTheDocument();
  });
  it('keeps a brand with no inventory selectable', async () => {
    const user = setup();
    await search(user, '01089');
    await user.click(await screen.findByRole('radio', { name: 'NGK/NTK' }));
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Нет в наличии')).toBeInTheDocument();
  });
  it('shows a recoverable manufacturer error without automatic retries', async () => {
    handleParts = () => json({ error: 'Request quota exceeded!' });
    const user = setup();
    await search(user, '01089');
    expect(await screen.findByRole('alert')).toHaveTextContent('Превышен лимит запросов');
    expect(partsCalls()).toHaveLength(1);
    handleParts = () => json(buildSampleResponse('01089'));
    await user.click(screen.getByRole('button', { name: /Попробовать снова/ }));
    expect(await screen.findByRole('radio', { name: 'ZEN' })).toBeInTheDocument();
  });
  it('shows and retries offer errors for the selected brand', async () => {
    let fail = true;
    handleParts = (url) =>
      url.searchParams.has('brand') && fail
        ? json({ error: 'Invalid key client!' })
        : json(buildSampleResponse('01089', url.searchParams.get('brand') ?? undefined));
    const user = setup();
    await search(user, '01089');
    await user.click(await screen.findByRole('radio', { name: 'ZEN' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/ключ/i);
    fail = false;
    await user.click(screen.getByRole('button', { name: /Попробовать снова/ }));
    expect(await screen.findByRole('table')).toHaveTextContent('Бендикс');
  });
  it('shows an empty selected-brand response', async () => {
    handleParts = (url) =>
      json(url.searchParams.has('brand') ? { goods: [] } : buildSampleResponse('01089'));
    const user = setup();
    await search(user, '01089');
    await user.click(await screen.findByRole('radio', { name: 'ZEN' }));
    expect(await screen.findByText('Предложения не найдены.')).toBeInTheDocument();
  });
  it('renders pending offers and then uses warehouse values and non-refund notices', async () => {
    let resolveOffer;
    handleParts = (url) =>
      url.searchParams.has('brand')
        ? new Promise((resolve) => {
            resolveOffer = resolve;
          })
        : json(buildSampleResponse('01089'));
    const user = setup();
    await search(user, '01089');
    await user.click(await screen.findByRole('radio', { name: 'ZEN' }));
    expect(await screen.findByText('Загружаем предложения и аналоги…')).toBeInTheDocument();
    await act(async () =>
      resolveOffer(
        json({
          goods: [
            makeGood({
              name: '',
              notRefund: true,
              price: 99999,
              warehouses: [makeWarehouse({ price: 100, stock: 2 })],
            }),
          ],
        }),
      ),
    );
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Без наименования')).toBeInTheDocument();
    expect(within(table).getByText('Без возврата по причине «Отказ»')).toBeInTheDocument();
    expect(within(table).getByText(/100,00/)).toBeInTheDocument();
    expect(within(table).queryByText(/99\s?999/)).not.toBeInTheDocument();
  });
  it('explains missing API configuration without making requests or substituting sample data', async () => {
    vi.stubEnv('VITE_FAVORIT_API_KEY', '');
    const user = setup();
    expect(screen.getByRole('alert')).toHaveTextContent('Не настроен ключ Favorit Parts');
    expect(screen.getByRole('alert')).toHaveTextContent('VITE_FAVORIT_API_KEY');
    expect(screen.getByRole('alert')).toHaveTextContent('.env');
    expect(screen.getByRole('button', { name: 'Найти' })).toBeDisabled();
    await user.type(screen.getByLabelText('Артикул запчасти'), '01089');
    await user.keyboard('{Enter}');
    await act(async () => new Promise((resolve) => setTimeout(resolve, 500)));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('ДЕМО')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '01089' })).not.toBeInTheDocument();
  });
  it('allows a repeated explicit search for the same article', async () => {
    const user = setup();
    await search(user, '01089');
    await screen.findByRole('radio', { name: 'ZEN' });
    await user.click(screen.getByRole('button', { name: 'Найти' }));
    await waitFor(() => expect(partsCalls()).toHaveLength(2));
  });
});

describe('search number in the URL', () => {
  it('restores the initial article and automatically requests manufacturers without typing', async () => {
    window.history.replaceState(null, '', '/?number=01089');
    setup();
    expect(screen.getByLabelText('Артикул запчасти')).toHaveValue('01089');
    expect(await screen.findByRole('radio', { name: 'ZEN' })).toBeInTheDocument();
    expect(partsCalls()).toHaveLength(1);
    const request = new URL(partsCalls()[0][0]);
    expect(request.searchParams.get('number')).toBe('01089');
    expect(request.searchParams.has('brand')).toBe(false);
  });

  it('writes typed special characters to the URL and sends the exact article to the API', async () => {
    const state = { source: 'catalog' };
    window.history.replaceState(state, '', '/parts?source=catalog&keep=1#stock');
    const user = setup();
    await user.type(screen.getByLabelText('Артикул запчасти'), 'A#1&B/2');
    const currentURL = new URL(window.location.href);
    expect(currentURL.searchParams.get('number')).toBe('A#1&B/2');
    expect(currentURL.search).toContain('number=A%231%26B%2F2');
    expect(currentURL.searchParams.get('source')).toBe('catalog');
    expect(currentURL.searchParams.get('keep')).toBe('1');
    expect(currentURL.pathname).toBe('/parts');
    expect(currentURL.hash).toBe('#stock');
    expect(window.history.state).toEqual(state);
    await user.click(screen.getByRole('button', { name: 'Найти' }));
    expect(await screen.findByText(/Ничего не найдено/)).toBeInTheDocument();
    expect(new URL(partsCalls()[0][0]).searchParams.get('number')).toBe('A#1&B/2');
  });

  it('restores the article with a fresh store after remount while leaving the brand unselected', async () => {
    const user = setup();
    await search(user, '01089');
    await user.click(await screen.findByRole('radio', { name: 'ZEN' }));
    await screen.findByRole('table');
    expect(new URL(window.location.href).searchParams.get('number')).toBe('01089');
    expect(new URL(window.location.href).searchParams.has('brand')).toBe(false);
    const requestsBeforeRemount = partsCalls().length;

    cleanup();
    stores.forEach((store) => store.dispatch(partsApi.util.resetApiState()));
    setup();
    expect(screen.getByLabelText('Артикул запчасти')).toHaveValue('01089');
    expect(await screen.findByRole('radio', { name: 'ZEN' })).not.toBeChecked();
    expect(screen.queryByRole('radio', { checked: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(partsCalls()).toHaveLength(requestsBeforeRemount + 1);
  });

  it('removes only the article parameter when the search is cleared', async () => {
    const state = { source: 'catalog' };
    window.history.replaceState(state, '', '/parts?source=catalog&number=01089#stock');
    const user = setup();
    await screen.findByRole('radio', { name: 'ZEN' });
    await user.click(screen.getByRole('button', { name: 'Очистить артикул' }));
    expect(screen.getByLabelText('Артикул запчасти')).toHaveValue('');
    const currentURL = new URL(window.location.href);
    expect(currentURL.searchParams.has('number')).toBe(false);
    expect(currentURL.searchParams.get('source')).toBe('catalog');
    expect(currentURL.pathname).toBe('/parts');
    expect(currentURL.hash).toBe('#stock');
    expect(window.history.state).toEqual(state);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('updates the article on navigation and clears previously loaded selections and offers', async () => {
    const user = setup();
    await selectMeyle(user);
    navigateTo('/?number=01089');
    expect(screen.getByLabelText('Артикул запчасти')).toHaveValue('01089');
    expect(screen.queryByRole('radio', { checked: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('radio', { name: 'ZEN' }));
    expect(await screen.findByRole('table')).toHaveTextContent('Бендикс');

    navigateTo('/?source=catalog#stock');
    expect(screen.getByLabelText('Артикул запчасти')).toHaveValue('');
    expect(screen.queryByRole('radio', { checked: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it.each(['/?number=01089', '/'])(
    'cancels old offer requests when navigation changes to %s',
    async (url) => {
      let resolveOldOffers;
      handleParts = (request) =>
        request.searchParams.has('brand')
          ? new Promise((resolve) => {
              resolveOldOffers = resolve;
            })
          : json(buildSampleResponse(request.searchParams.get('number') ?? ''));
      const user = setup();
      await search(user, '7160500039S');
      await user.click(await screen.findByRole('radio', { name: 'MEYLE' }));
      expect(await screen.findByText('Загружаем предложения и аналоги…')).toBeInTheDocument();
      const offerRequest = fetchMock.mock.calls.find(([request]) =>
        new URL(request).searchParams.has('brand'),
      );
      const oldSignal = offerRequest[1].signal;
      navigateTo(url);
      expect(screen.getByLabelText('Артикул запчасти')).toHaveValue(
        url.includes('01089') ? '01089' : '',
      );
      expect(screen.queryByRole('radio', { checked: true })).not.toBeInTheDocument();
      expect(screen.queryByText('Загружаем предложения и аналоги…')).not.toBeInTheDocument();
      await waitFor(() => expect(oldSignal.aborted).toBe(true));
      await act(async () => resolveOldOffers(json(buildSampleResponse('7160500039S', 'MEYLE'))));
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByText('Mapco')).not.toBeInTheDocument();
      if (url.includes('01089')) {
        expect(await screen.findByRole('radio', { name: 'ZEN' })).not.toBeChecked();
      } else {
        expect(partsCalls()).toHaveLength(2);
      }
    },
  );

  it.each([
    ['x'.repeat(81), 'Артикул должен содержать не больше 80 символов'],
    ['A\u0001B', 'Артикул не должен содержать управляющие символы'],
  ])(
    'restores an invalid URL article %j without requesting data and validates on submit',
    async (number, message) => {
      const params = new URLSearchParams({ number });
      window.history.replaceState(null, '', `/?${params}`);
      const user = setup();
      expect(screen.getByLabelText('Артикул запчасти')).toHaveValue(number);
      expect(fetchMock).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: 'Найти' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(fetchMock).not.toHaveBeenCalled();
      navigateTo('/');
      expect(screen.getByLabelText('Артикул запчасти')).toHaveValue('');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );
});
