import { useId } from 'react';
import { MOBILE_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import './Manufacturers.css';

function ManufacturerRadio({ brand, selectedBrand, onSelect, id, className }) {
  return (
    <input
      type="radio"
      className={`form-check-input ${className}`}
      id={id}
      name="manufacturer"
      value={brand.brand}
      aria-label={brand.brand}
      checked={selectedBrand === brand.brand}
      onChange={() => onSelect(brand.brand)}
    />
  );
}

function DesktopManufacturers({ brands, selectedBrand, onSelect, idPrefix }) {
  return (
    <div
      className="manufacturer-list"
      role="radiogroup"
      aria-label="Производитель"
      aria-orientation="vertical"
    >
      {brands.map((brand, index) => (
        <label
          className={`manufacturer-card${selectedBrand === brand.brand ? ' is-selected' : ''}`}
          htmlFor={`${idPrefix}-${index}`}
          key={brand.brand}
        >
          <span className="manufacturer-initial" aria-hidden="true">
            {brand.brand.slice(0, 2)}
          </span>
          <span className="manufacturer-info">
            <strong>{brand.brand}</strong>
            {brand.name && <span>{brand.name}</span>}
          </span>
          <ManufacturerRadio
            brand={brand}
            selectedBrand={selectedBrand}
            onSelect={onSelect}
            id={`${idPrefix}-${index}`}
            className="manufacturer-radio"
          />
        </label>
      ))}
    </div>
  );
}

function MobileManufacturers({ brands, selectedBrand, onSelect, idPrefix }) {
  return (
    <div
      className="manufacturer-list manufacturer-list-mobile"
      role="radiogroup"
      aria-label="Производитель"
      aria-orientation="horizontal"
    >
      {brands.map((brand, index) => (
        <label
          className={`manufacturer-card manufacturer-card-mobile${selectedBrand === brand.brand ? ' is-selected' : ''}`}
          htmlFor={`${idPrefix}-${index}`}
          key={brand.brand}
        >
          <span className="mobile-manufacturer-initial" aria-hidden="true">
            {brand.brand.slice(0, 2)}
          </span>
          <span className="mobile-manufacturer-info">
            <strong>{brand.brand}</strong>
            {brand.name && <span>{brand.name}</span>}
          </span>
          <ManufacturerRadio
            brand={brand}
            selectedBrand={selectedBrand}
            onSelect={onSelect}
            id={`${idPrefix}-${index}`}
            className="mobile-manufacturer-radio"
          />
        </label>
      ))}
    </div>
  );
}

export function Manufacturers({ brands, selectedBrand, onSelect }) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const idPrefix = useId();
  const Layout = isMobile ? MobileManufacturers : DesktopManufacturers;
  return (
    <Layout brands={brands} selectedBrand={selectedBrand} onSelect={onSelect} idPrefix={idPrefix} />
  );
}
