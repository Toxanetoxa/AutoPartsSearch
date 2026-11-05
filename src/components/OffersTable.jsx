import { useRef, useState } from 'react';
import { formatPrice } from '../domain/parts';
import { MOBILE_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { OfferCards } from './OfferCards';
import './OffersTable.css';

const PAGE_SIZE = 50;

export function OffersTable({ offers }) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [page, setPage] = useState(0);
  const scrollRef = useRef(null);
  const pageCount = Math.max(1, Math.ceil(offers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const firstOffer = currentPage * PAGE_SIZE;
  const visibleOffers = offers.slice(firstOffer, firstOffer + PAGE_SIZE);

  function changePage(nextPage) {
    setPage(nextPage);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }

  return (
    <>
      <div
        ref={scrollRef}
        className={`table-responsive offers-table-scroll${isMobile ? ' offers-cards-scroll' : ''}`}
        tabIndex={0}
        role="region"
        aria-label={isMobile ? 'Карточки предложений' : 'Таблица предложений'}
      >
        {isMobile ? (
          <OfferCards offers={visibleOffers} />
        ) : (
          <table className="table offers-table align-middle mb-0">
            <caption className="visually-hidden">
              Оригинальная деталь и аналоги. Цена и остаток каждого склада.
            </caption>
            <thead>
              <tr>
                <th scope="col">Название / Производитель</th>
                <th scope="col">Артикул</th>
                <th scope="col">Склад</th>
                <th scope="col" className="offers-numeric">
                  Складской остаток
                </th>
                <th scope="col" className="offers-numeric">
                  Цена
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleOffers.map((offer) => (
                <tr key={offer.id} className={offer.stock === 0 ? 'offers-unavailable' : ''}>
                  <td>
                    <div className="offers-part-brand">
                      <strong>{offer.brand}</strong>
                      <span
                        className={`offers-kind${offer.isAnalogue ? '' : ' offers-kind-original'}`}
                      >
                        {offer.isAnalogue ? 'Аналог' : 'Оригинал'}
                      </span>
                    </div>
                    <div className="offers-part-name">{offer.name || 'Без наименования'}</div>
                    {offer.notRefund && (
                      <small className="offers-non-refundable">
                        Без возврата по причине «Отказ»
                      </small>
                    )}
                  </td>
                  <td className="offers-article">{offer.number}</td>
                  <td>
                    <span className="offers-warehouse">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="m3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5m9-5-9 5m0 0v10M7.5 4.5l9 5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {offer.warehouse}
                    </span>
                  </td>
                  <td className="offers-numeric">
                    {offer.stock > 0 ? (
                      <span className="offers-stock">
                        <span aria-hidden="true" />
                        {offer.stock} шт.
                      </span>
                    ) : (
                      <span className="offers-no-stock">Нет в наличии</span>
                    )}
                  </td>
                  <td className="offers-numeric offers-price">
                    {offer.price === null ? '—' : formatPrice(offer.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {pageCount > 1 && (
        <div className="offers-pagination">
          <span className="offers-pagination-range" aria-live="polite" aria-atomic="true">
            {firstOffer + 1}–{Math.min(firstOffer + PAGE_SIZE, offers.length)} из {offers.length}
          </span>
          <nav className="offers-pagination-controls" aria-label="Навигация по предложениям">
            <button
              type="button"
              className="btn offers-page-button"
              aria-label="Предыдущая страница"
              disabled={currentPage === 0}
              onClick={() => changePage(currentPage - 1)}
            >
              <span className="offers-page-label-full">Предыдущая страница</span>
              <span className="offers-page-label-short" aria-hidden="true">
                Назад
              </span>
            </button>
            <span className="offers-pagination-page">
              Страница {currentPage + 1} из {pageCount}
            </span>
            <button
              type="button"
              className="btn offers-page-button"
              aria-label="Следующая страница"
              disabled={currentPage === pageCount - 1}
              onClick={() => changePage(currentPage + 1)}
            >
              <span className="offers-page-label-full">Следующая страница</span>
              <span className="offers-page-label-short" aria-hidden="true">
                Далее
              </span>
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
