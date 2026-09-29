import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FishingAttempt } from './FishingAttempt';
import type { FishingAttemptClock } from '../fishingAttemptClock';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('corrects an unfired deadline after a delayed response without replenishing its read budget', async () => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'],
  });
  let clock: FishingAttemptClock = {
    key: 'session:0',
    durationMs: 60000,
    elapsedMs: 0,
    receivedMono: 0,
    frozenMono: null,
  };
  const read = vi.fn(async () => {});
  const view = render(
    <FishingAttempt clock={clock} serverTime="2026-09-26T12:00:00.000Z" onReconcile={read} />,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15000);
  });
  // A fresh server response corrects nine seconds of initial response lag.
  clock = { ...clock, receivedMono: 15000, elapsedMs: 24000 };
  view.rerender(
    <FishingAttempt clock={clock} serverTime="2026-09-26T12:00:00.000Z" onReconcile={read} />,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(36150);
  });
  expect(read).toHaveBeenCalledTimes(1);
  view.rerender(
    <FishingAttempt
      clock={{ ...clock }}
      serverTime="2026-09-26T12:00:00.000Z"
      onReconcile={async () => {
        await read();
      }}
    />,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(read).toHaveBeenCalledTimes(2);
  view.rerender(
    <FishingAttempt
      clock={{ ...clock, receivedMono: 53150, elapsedMs: 60000 }}
      serverTime="2026-09-26T12:00:00.000Z"
      onReconcile={read}
    />,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20000);
  });
  expect(read).toHaveBeenCalledTimes(2);
});

it('counts down the server-timed Reel Pull bar and removes the action at expiry', async () => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'],
  });
  const clock: FishingAttemptClock = {
    key: 'session:0',
    durationMs: 30_000,
    elapsedMs: 0,
    receivedMono: 0,
    frozenMono: null,
  };
  render(
    <FishingAttempt
      clock={clock}
      serverTime="2026-09-26T12:00:00.000Z"
      onReconcile={async () => {}}
      randomEvent={{
        id: 'offer',
        type: 'reel_pull',
        sessionId: 'session',
        attempts: 0,
        message: 'Your rod jerks hard!',
        buttonLabel: 'REEL!',
        expiresAt: '2026-09-26T12:00:05.000Z',
        windowMs: 5_000,
      }}
    />,
  );
  const bar = screen.getByRole('progressbar', { name: 'Reel Pull time remaining' });
  expect(bar).toHaveAttribute('aria-valuenow', '5');
  expect(screen.getByRole('button', { name: 'REEL!' })).toBeEnabled();
  await act(async () => vi.advanceTimersByTimeAsync(2_000));
  expect(bar).toHaveAttribute('aria-valuenow', '3');
  expect(bar.querySelector('span')).toHaveStyle({ width: '60%' });
  await act(async () => vi.advanceTimersByTimeAsync(3_000));
  expect(screen.queryByRole('button', { name: 'REEL!' })).not.toBeInTheDocument();
  expect(screen.getByText('Waiting for a bite…')).toBeInTheDocument();
});

it('lets the Reel Pull window expire during a connection interruption while cast progress stays frozen', async () => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'],
  });
  render(
    <FishingAttempt
      clock={{
        key: 'session:0',
        durationMs: 30_000,
        elapsedMs: 0,
        receivedMono: 0,
        frozenMono: 0,
      }}
      serverTime="2026-09-26T12:00:00.000Z"
      onReconcile={async () => {}}
      randomEvent={{
        id: 'offer',
        type: 'reel_pull',
        sessionId: 'session',
        attempts: 0,
        message: 'Your rod jerks hard!',
        buttonLabel: 'REEL!',
        expiresAt: '2026-09-26T12:00:05.000Z',
        windowMs: 5_000,
      }}
    />,
  );
  expect(screen.getByRole('button', { name: 'REEL!' })).toBeDisabled();
  expect(screen.getByRole('progressbar', { name: 'Current fishing attempt' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  await act(async () => vi.advanceTimersByTimeAsync(5_000));
  expect(screen.queryByRole('button', { name: 'REEL!' })).not.toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Current fishing attempt' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
});
