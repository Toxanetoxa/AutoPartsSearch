import { useCallback, useRef, useState } from 'react';
import { getApiConfigurationError } from './api/config';
import { useManufacturers, useOffers } from './api/queries';
import { OffersTable } from './components/OffersTable';
import { Manufacturers } from './components/Manufacturers';
import { articleSchema } from './domain/parts';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { useSearchNumber } from './hooks/useSearchNumber';

function LoadingState({ children }) {
  return (
    <div className="search-loading" role="status">
      <span className="spinner-border spinner-border-sm" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="alert alert-danger search-error" role="alert">
      <p className="mb-2">Не удалось получить данные. {message}</p>
      <button type="button" className="btn btn-outline-danger btn-sm" onClick={onRetry}>
        Попробовать снова
      </button>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3 8 4.5v7M4 7.5 12 12m0-9L4 7.5v9L12 21l2-1m-2-8v9m0-9 8-4.5M8 5.3l8 4.5" />
      <circle cx="18" cy="17" r="3" />
      <path d="m20.2 19.2 2 2" />
    </svg>
  );
}

export default function App() {
  const inputRef = useRef(null);
  const [showValidation, setShowValidation] = useState(false);
  const [submittedNumber, setSubmittedNumber] = useState(null);
  const [selection, setSelection] = useState(null);
  const resetSelection = useCallback(() => {
    setSubmittedNumber(null);
    setSelection(null);
  }, []);
  const onUrlNavigation = useCallback(() => {
    resetSelection();
    setShowValidation(false);
  }, [resetSelection]);
  const [number, setNumber] = useSearchNumber(onUrlNavigation);
  const parsedNumber = articleSchema.safeParse(number);
  const validNumber = parsedNumber.success ? parsedNumber.data : '';
  const validationError =
    showValidation && !parsedNumber.success ? parsedNumber.error.issues[0].message : null;
  const debouncedNumber = useDebouncedValue(validNumber);
  const apiConfigurationError = getApiConfigurationError();
  const apiConfigured = apiConfigurationError === null;
  const activeNumber =
    apiConfigured &&
    validNumber &&
    (validNumber === debouncedNumber || validNumber === submittedNumber)
      ? validNumber
      : '';
  const selectedBrand = selection?.number === activeNumber && activeNumber ? selection.brand : null;
  const manufacturers = useManufacturers(activeNumber);
  const offers = useOffers(activeNumber, selectedBrand);
  const brands = manufacturers.data ?? [];
  const hasManufacturerCards = Boolean(
    activeNumber && manufacturers.isSuccess && !manufacturers.isFetching && brands.length,
  );
  const allOffers = offers.data ?? [];
  const availableCount = allOffers.filter((offer) => offer.stock > 0).length;
  const waitingForInput = apiConfigured && Boolean(validNumber && !activeNumber);

  function submit(event) {
    event.preventDefault();
    setShowValidation(true);
    if (!apiConfigured || !parsedNumber.success) {
      inputRef.current.focus();
      return;
    }
    setSelection(null);
    setSubmittedNumber(parsedNumber.data);
    if (activeNumber === parsedNumber.data) void manufacturers.refetch();
  }

  return (
    <main className="container search-app">
      <h1 className="search-title">Поиск автозапчастей</h1>

      {!apiConfigured && (
        <div className="alert alert-warning search-config-warning" role="alert">
          <strong>Не настроен API Favorit Parts.</strong> {apiConfigurationError}
        </div>
      )}

      <form className="card search-card" onSubmit={submit} noValidate>
        <label htmlFor="part-number" className="form-label search-field-label">
          Артикул запчасти
        </label>
        <div className={`search-input-group${validationError ? ' is-invalid' : ''}`}>
          <span className="search-input-icon">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            id="part-number"
            className="form-control search-input"
            value={number}
            onChange={(event) => {
              setNumber(event.target.value);
              setShowValidation(true);
              resetSelection();
            }}
            placeholder="Например, 01089"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(validationError)}
            aria-describedby={validationError ? 'number-error' : 'number-hint'}
          />
          {number && (
            <button
              type="button"
              className="btn search-clear"
              aria-label="Очистить артикул"
              onClick={() => {
                setNumber('');
                setShowValidation(false);
                resetSelection();
                inputRef.current.focus();
              }}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="m6 6 12 12M6 18 18 6" />
              </svg>
            </button>
          )}
          <button className="btn btn-primary search-submit" type="submit" disabled={!apiConfigured}>
            Найти <ArrowIcon />
          </button>
        </div>
        {validationError ? (
          <p id="number-error" className="search-field-error" role="alert">
            {validationError}
          </p>
        ) : (
          <p id="number-hint" className="search-field-hint">
            Поиск начнётся автоматически после ввода артикула.
          </p>
        )}
      </form>

      <div className="search-workspace">
        <section
          className="card search-panel manufacturers-panel"
          aria-labelledby="manufacturers-title"
          aria-busy={manufacturers.isFetching || waitingForInput}
        >
          <div className="search-panel-header">
            <span
              className={`search-step${brands.length ? ' is-complete' : ''}`}
              aria-hidden="true"
            >
              01
            </span>
            <h2 id="manufacturers-title">Производитель</h2>
            {brands.length > 0 && <span className="search-count">{brands.length}</span>}
          </div>
          <p className="manufacturers-description">
            Выберите бренд, чтобы увидеть предложения и аналоги.
          </p>
          <div
            className={`manufacturers-content${hasManufacturerCards ? ' manufacturers-content-cards' : ''}`}
            role="group"
            aria-label="Результаты поиска производителей"
            tabIndex={0}
          >
            {!activeNumber && !waitingForInput && (
              <div className="manufacturers-placeholder">
                <div className="manufacturer-placeholder-row" aria-hidden="true" />
                <div className="manufacturer-placeholder-row" aria-hidden="true" />
                <div className="manufacturer-placeholder-row" aria-hidden="true" />
                <p>Введите артикул для поиска производителей.</p>
              </div>
            )}
            {(waitingForInput || manufacturers.isFetching) && (
              <LoadingState>Ищем производителей…</LoadingState>
            )}
            {activeNumber && manufacturers.isError && (
              <ErrorState
                message={manufacturers.error.message}
                onRetry={() => void manufacturers.refetch()}
              />
            )}
            {activeNumber &&
              manufacturers.isSuccess &&
              !manufacturers.isFetching &&
              (brands.length ? (
                <Manufacturers
                  brands={brands}
                  selectedBrand={selectedBrand}
                  onSelect={(brand) => setSelection({ number: activeNumber, brand })}
                />
              ) : (
                <p className="manufacturers-not-found">
                  Ничего не найдено. Проверьте артикул или введите другой номер.
                </p>
              ))}
          </div>
        </section>

        <section
          className="card search-panel offers-panel"
          aria-labelledby="offers-title"
          aria-busy={offers.isFetching}
        >
          <div className="search-panel-header offers-panel-header">
            <span className="search-step" aria-hidden="true">
              02
            </span>
            <h2 id="offers-title">Предложения и аналоги</h2>
            {selectedBrand && offers.isSuccess && (
              <span className="search-count">{allOffers.length}</span>
            )}
            <span className="offers-warehouse-label">
              <span />
              По складам
            </span>
          </div>
          <div className="offers-content">
            {!selectedBrand && (
              <div className="offers-placeholder">
                <div className="offers-placeholder-illustration" aria-hidden="true">
                  <PackageIcon />
                </div>
                <h3>Предложения появятся здесь</h3>
                <p>Выберите производителя, чтобы увидеть предложения.</p>
                <span>Цены, остатки на складах и доступные аналоги.</span>
              </div>
            )}
            {selectedBrand && offers.isFetching && (
              <LoadingState>Загружаем предложения и аналоги…</LoadingState>
            )}
            {selectedBrand && offers.isError && (
              <ErrorState message={offers.error.message} onRetry={() => void offers.refetch()} />
            )}
            {selectedBrand &&
              offers.isSuccess &&
              !offers.isFetching &&
              (allOffers.length ? (
                <>
                  <div className="offers-summary">
                    <span>
                      <strong>{selectedBrand}</strong>
                      <span className="offers-summary-divider">/</span>
                      <span className="offers-summary-article">{activeNumber}</span>
                    </span>
                    <span>В наличии: {availableCount}</span>
                  </div>
                  <OffersTable key={`${activeNumber}:${selectedBrand}`} offers={allOffers} />
                  <p className="offers-price-note">Цена указана за единицу на конкретном складе.</p>
                </>
              ) : (
                <p className="offers-not-found">Предложения не найдены.</p>
              ))}
          </div>
        </section>
      </div>
    </main>
  );
}
