import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SceneryImage } from './SceneryImage';

describe('scenery crossfade', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the old scene visible until the new image loads, then removes it after the fade', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callback(0));
    const onError = vi.fn();
    const { rerender, container } = render(
      <SceneryImage src="day.webp" alt="Day" onError={onError} />,
    );

    rerender(<SceneryImage src="dusk.webp" alt="Dusk" onError={onError} />);
    const incoming = screen.getByRole('img', { name: 'Dusk' });
    expect(incoming).not.toHaveClass('is-revealed');
    expect(container.querySelector('.scene-image-previous')).toHaveAttribute('src', 'day.webp');

    fireEvent.load(incoming);
    expect(incoming).toHaveClass('is-revealed');
    expect(incoming).toHaveClass('scene-image-incoming');
    act(() => vi.advanceTimersByTime(1050));
    expect(container.querySelector('.scene-image-previous')).toBeNull();
    expect(incoming).not.toHaveClass('scene-image-incoming');
    expect(incoming).toHaveAttribute('src', 'dusk.webp');
    expect(onError).not.toHaveBeenCalled();
  });

  it('allows the incoming image to paint at zero opacity before revealing it', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 16),
    );
    vi.stubGlobal('cancelAnimationFrame', (frame: number) => window.clearTimeout(frame));
    const { rerender } = render(<SceneryImage src="day.webp" alt="Day" onError={vi.fn()} />);
    rerender(<SceneryImage src="night.webp" alt="Night" onError={vi.fn()} />);
    act(() => vi.advanceTimersByTime(16));
    const incoming = screen.getByRole('img', { name: 'Night' });
    fireEvent.load(incoming);
    expect(incoming).not.toHaveClass('is-revealed');
    act(() => vi.advanceTimersByTime(16));
    expect(incoming).not.toHaveClass('is-revealed');
    act(() => vi.advanceTimersByTime(16));
    expect(incoming).toHaveClass('is-revealed');
  });

  it('uses a short fade for moving locations', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callback(0));
    const { rerender, container } = render(
      <SceneryImage src="city.webp" alt="City" onError={vi.fn()} transitionGroup="city" />,
    );
    rerender(<SceneryImage src="pier.webp" alt="Pier" onError={vi.fn()} transitionGroup="pier" />);
    const incoming = screen.getByRole('img', { name: 'Pier' });
    fireEvent.load(incoming);
    expect(incoming).toHaveStyle({ animationDuration: '120ms' });
    act(() => vi.advanceTimersByTime(170));
    expect(container.querySelector('.scene-image-previous')).toBeNull();
  });

  it('keeps the longer fade for changes within the Pier', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callback(0));
    const { rerender } = render(
      <SceneryImage src="calm.webp" alt="Calm" onError={vi.fn()} transitionGroup="pier" />,
    );
    rerender(
      <SceneryImage
        src="dangerous.webp"
        alt="Dangerous"
        onError={vi.fn()}
        transitionGroup="pier"
      />,
    );
    const incoming = screen.getByRole('img', { name: 'Dangerous' });
    fireEvent.load(incoming);
    expect(incoming).toHaveStyle({ animationDuration: '1000ms' });
  });

  it('keeps the last visible scene through rapid condition updates', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callback(0));
    const { rerender, container } = render(
      <SceneryImage src="day.webp" alt="Day" onError={vi.fn()} />,
    );
    rerender(<SceneryImage src="dusk.webp" alt="Dusk" onError={vi.fn()} />);
    rerender(<SceneryImage src="night.webp" alt="Night" onError={vi.fn()} />);
    expect(container.querySelector('.scene-image-previous')).toHaveAttribute('src', 'day.webp');
    expect(screen.getByRole('img', { name: 'Night' })).not.toHaveClass('is-revealed');
  });
});
