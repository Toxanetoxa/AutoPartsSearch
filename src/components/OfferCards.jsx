import { formatPrice } from '../domain/parts';
import './OfferCards.css';

export function OfferCards({ offers }) {
  return (
    <ul className="offer-cards" role="list" aria-label="Список предложений">
      {offers.map((offer) => (
        <li
          key={offer.id}
          className={`offer-card${offer.stock === 0 ? ' offer-card-unavailable' : ''}`}
        >
          <div className="offer-card-heading">
            <strong className="offer-card-brand">{offer.brand}</strong>
            <span className={`offer-card-kind${offer.isAnalogue ? '' : ' offer-card-original'}`}>
              {offer.isAnalogue ? 'Аналог' : 'Оригинал'}
            </span>
          </div>
          <div className="offer-card-name">{offer.name || 'Без наименования'}</div>
          <dl className="offer-card-meta">
            <div>
              <dt>Артикул</dt>
              <dd className="offer-card-number">{offer.number || '—'}</dd>
            </div>
            <div>
              <dt>Склад</dt>
              <dd>{offer.warehouse || '—'}</dd>
            </div>
          </dl>
          <div className="offer-card-bottom">
            <span className="offer-card-price">
              <span className="visually-hidden">Цена: </span>
              {offer.price === null ? '—' : formatPrice(offer.price)}
            </span>
            {offer.stock > 0 ? (
              <span className="offer-card-stock">
                <span aria-hidden="true" />
                {offer.stock} шт.
              </span>
            ) : (
              <span className="offer-card-no-stock">Нет в наличии</span>
            )}
          </div>
          {offer.notRefund && (
            <div className="offer-card-non-refundable">Без возврата по причине «Отказ»</div>
          )}
        </li>
      ))}
    </ul>
  );
}
