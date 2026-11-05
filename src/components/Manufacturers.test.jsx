import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getManufacturers } from '../domain/parts';
import { createMatchMedia } from '../test/media-query';
import { buildSampleResponse } from '../test/sample-parts';
import { Manufacturers } from './Manufacturers';

const brands = getManufacturers(buildSampleResponse('01089').goods);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setupMedia(isMobile) {
  const media = createMatchMedia(isMobile);
  vi.stubGlobal('matchMedia', media.matchMedia);
  return media;
}

describe('responsive manufacturers', () => {
  it('renders a vertical native radio group on desktop and selects through the description', async () => {
    setupMedia(false);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <Manufacturers brands={brands} selectedBrand={null} onSelect={onSelect} />,
    );

    expect(screen.getByRole('radiogroup', { name: 'Производитель' })).toHaveAttribute(
      'aria-orientation',
      'vertical',
    );
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'NGK/NTK' })).toHaveAttribute('type', 'radio');
    await user.click(screen.getByText('Бендикс'));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('ZEN');
    rerender(<Manufacturers brands={brands} selectedBrand="ZEN" onSelect={onSelect} />);
    expect(screen.getByRole('radio', { name: 'ZEN' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'NGK/NTK' })).not.toBeChecked();
  });

  it('renders a horizontal group immediately on mobile and keeps the whole tile clickable', async () => {
    setupMedia(true);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <Manufacturers brands={brands} selectedBrand={null} onSelect={onSelect} />,
    );

    expect(screen.getByRole('radiogroup', { name: 'Производитель' })).toHaveAttribute(
      'aria-orientation',
      'horizontal',
    );
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    await user.click(screen.getByText('Лямбда-зонд'));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('NGK/NTK');
    rerender(<Manufacturers brands={brands} selectedBrand="NGK/NTK" onSelect={onSelect} />);
    expect(screen.getByRole('radio', { name: 'NGK/NTK' })).toBeChecked();
  });

  it('preserves the controlled selection while changing layout and cleans up its subscription', () => {
    const media = setupMedia(false);
    const onSelect = vi.fn();
    const { unmount } = render(
      <Manufacturers brands={brands} selectedBrand="ZEN" onSelect={onSelect} />,
    );
    expect(media.listenerCount()).toBe(1);

    act(() => media.setMatches(true));
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-orientation', 'horizontal');
    expect(screen.getByRole('radio', { name: 'ZEN' })).toBeChecked();
    act(() => media.setMatches(false));
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-orientation', 'vertical');
    expect(screen.getByRole('radio', { name: 'ZEN' })).toBeChecked();
    expect(onSelect).not.toHaveBeenCalled();
    expect(media.listenerCount()).toBe(1);
    unmount();
    expect(media.listenerCount()).toBe(0);
  });

  it('keeps mobile radios focusable and selects an exact brand with the keyboard', async () => {
    setupMedia(true);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Manufacturers brands={brands} selectedBrand={null} onSelect={onSelect} />);

    await user.tab();
    expect(screen.getByRole('radio', { name: 'ZEN' })).toHaveFocus();
    await user.keyboard(' ');
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('ZEN');
  });
});
