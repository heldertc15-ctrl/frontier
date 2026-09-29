import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FishingAttemptProgress } from './FishingAttemptProgress';

afterEach(cleanup);

describe('fishing attempt progress accessibility', () => {
  it('exposes accurate numeric progress without placing frame updates in a live region', () => {
    const view = render(<FishingAttemptProgress progress={0.25} phase="waiting" />);
    const progress = screen.getByRole('progressbar', { name: 'Current fishing attempt' });
    const status = screen.getByRole('status');
    expect(progress).toHaveAttribute('aria-valuemin', '0');
    expect(progress).toHaveAttribute('aria-valuemax', '100');
    expect(progress).toHaveAttribute('aria-valuenow', '25');
    expect(progress).toHaveAccessibleDescription('Each attempt consumes 1 bait.');
    expect(progress.closest('[aria-live], [role="status"]')).toBeNull();
    expect(status).toHaveTextContent('Waiting for a bite…');

    view.rerender(<FishingAttemptProgress progress={0.26} phase="waiting" />);
    expect(progress).toHaveAttribute('aria-valuenow', '26');
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('Waiting for a bite…');
  });

  it('distinguishes waiting for a result from interrupted server confirmation', () => {
    const view = render(<FishingAttemptProgress progress={1} phase="checking" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByRole('status')).toHaveTextContent('Checking for a bite…');

    view.rerender(<FishingAttemptProgress progress={0.6} phase="reconnecting" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '60%, awaiting server confirmation',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Connection interrupted');
    expect(
      screen.getByText('Progress paused until the server confirms your session.'),
    ).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([
    [-0.5, '0'],
    [0, '0'],
    [1, '100'],
    [1.5, '100'],
    [Number.NaN, '0'],
    [Number.POSITIVE_INFINITY, '0'],
  ])('keeps progress %s within the accessible range', (progress, expected) => {
    render(<FishingAttemptProgress progress={progress} phase="waiting" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', expected);
  });
});
