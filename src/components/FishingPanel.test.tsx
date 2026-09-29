import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FishingPanel } from './FishingPanel';
import type { FishingState } from '../../server/fishing';
import type { InventoryState } from '../../server/inventory';

const reelSound = vi.hoisted(() => ({
  prepareReelPromptSound: vi.fn(),
  playReelPromptSound: vi.fn(),
  stopReelPromptSound: vi.fn(),
}));
vi.mock('../audio/reelPrompt', () => reelSound);
const catchSound = vi.hoisted(() => ({
  prepareFishCatchSound: vi.fn(),
  playFishCatchSound: vi.fn(),
  stopFishCatchSound: vi.fn(),
}));
vi.mock('../audio/fishCatch', () => catchSound);

const idle: FishingState = {
  gameTime: {
    day: 1,
    hour: 9,
    minute: 0,
    scheduledPhase: 'Day',
    nextPhase: 'Dusk',
    nextPhaseAt: '2026-09-24T13:30:00.000Z',
  },
  serverTime: '2026-09-24T12:10:00.000Z',
  sea: {
    zoneId: 'fishing-pier',
    blockStartedAt: '2026-09-24T12:00:00.000Z',
    blockEndsAt: '2026-09-24T12:30:00.000Z',
    scheduledCurrentState: 'Moderate',
    nextState: 'Calm',
  },
  activeAttempt: null,
  randomEvent: null,
  eventRevision: 0,
  status: 'idle',
  sessionId: null,
  rodItemId: null,
  baitItemId: null,
  rodName: null,
  baitName: null,
  baitRemaining: 0,
  conditions: { timeOfDay: 'Day', seaState: 'Moderate' },
  catches: 0,
  attempts: 0,
  latestCatch: null,
  catchSummary: [],
  latestResult: null,
  stopReason: null,
};
const inventory: InventoryState = {
  capacity: 10,
  usedSlots: 3,
  locker: [],
  items: [
    {
      id: 'basic_fishing_rod',
      instanceId: 'rod-1',
      name: 'Basic Fishing Rod',
      description: '',
      kind: 'tool',
      stackable: false,
      maxStack: 1,
      equipmentSlot: null,
      healHp: 0,
      quantity: 1,
      location: 'inventory',
      equipped: false,
    },
    {
      id: 'worm_bait',
      instanceId: 'bait-1',
      name: 'Worm Bait',
      description: '',
      kind: 'tool',
      stackable: true,
      maxStack: 100,
      equipmentSlot: null,
      healHp: 0,
      quantity: 2,
      location: 'inventory',
      equipped: false,
    },
    {
      id: 'field_rations',
      instanceId: 'food-1',
      name: 'Field rations',
      description: '',
      kind: 'consumable',
      stackable: true,
      maxStack: 20,
      equipmentSlot: null,
      healHp: 12,
      quantity: 3,
      location: 'inventory',
      equipped: false,
    },
  ],
};
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  reelSound.prepareReelPromptSound.mockClear();
  reelSound.playReelPromptSound.mockClear();
  reelSound.stopReelPromptSound.mockClear();
  catchSound.prepareFishCatchSound.mockClear();
  catchSound.playFishCatchSound.mockClear();
  catchSound.stopFishCatchSound.mockClear();
});

describe('A01 authoritative attempt display', () => {
  const base = Date.parse(idle.serverTime);
  const iso = (offset: number) => new Date(base + offset).toISOString();
  function activeState(elapsed = 30000, duration = 60000): FishingState {
    return {
      ...idle,
      status: 'active',
      sessionId: 'timed-session',
      rodItemId: 'rod-1',
      baitItemId: 'bait-1',
      rodName: 'Basic Fishing Rod',
      baitName: 'Worm Bait',
      baitRemaining: 2,
      serverTime: iso(elapsed),
      activeAttempt: { startedAt: iso(0), deadlineAt: iso(duration), durationMs: duration },
    };
  }
  function setup(initial: FishingState) {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'],
    });
    const source = { state: initial, failed: false };
    const fetchMock = vi.fn(
      async (path: string): Promise<{ ok: boolean; json: () => Promise<unknown> }> => {
        if (source.failed) throw new Error('offline');
        return {
          ok: true,
          json: async () =>
            path === '/api/fishing'
              ? { fishing: source.state }
              : path === '/api/character'
                ? {
                    character: {
                      id: 'player',
                      activeStatus: source.state.status === 'active' ? 'FISHING' : 'IDLE',
                    },
                  }
                : { inventory },
        };
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    const props = { onCharacter: vi.fn(), onInventoryChange: vi.fn() };
    return { source, fetchMock, props };
  }
  const advance = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  const value = () =>
    Number(
      screen
        .getByRole('progressbar', { name: 'Current fishing attempt' })
        .getAttribute('aria-valuenow'),
    );

  it('restores actual progress, preserves it over rerender/poll, and resets on confirmed forced/no-catch attempts', async () => {
    const { source, props } = setup(activeState());
    const view = render(<FishingPanel {...props} refreshRevision={0} />);
    await advance(1);
    expect(value()).toBe(50);
    await advance(10000);
    expect(value()).toBe(67);
    view.rerender(<FishingPanel {...props} refreshRevision={1} />);
    await advance(1);
    expect(value()).toBe(67);
    source.state = {
      ...source.state,
      attempts: 1,
      serverTime: iso(40000),
      activeAttempt: { startedAt: iso(40000), deadlineAt: iso(100000), durationMs: 60000 },
      catches: 1,
      latestCatch: { species: 'Sardine', weightKg: 0.1, trophy: false },
      catchSummary: [{ species: 'Sardine', count: 1, trophyCount: 0 }],
    };
    view.rerender(<FishingPanel {...props} refreshRevision={2} />);
    await advance(1);
    expect(value()).toBe(0);
    source.state = {
      ...source.state,
      attempts: 2,
      serverTime: iso(50000),
      latestResult: 'No catch this attempt.',
      activeAttempt: { startedAt: iso(50000), deadlineAt: iso(110000), durationMs: 60000 },
    };
    view.rerender(<FishingPanel {...props} refreshRevision={3} />);
    await advance(1);
    expect(value()).toBe(0);
    expect(screen.getByRole('region', { name: 'Latest catch' })).toHaveTextContent('Sardine');
    expect(screen.getByText('No catch this attempt.')).toBeInTheDocument();
  });

  it('plays the catch clip for a newly confirmed fish, not a restored catch or later no-catch', async () => {
    const initial = {
      ...activeState(),
      catches: 1,
      attempts: 1,
      latestCatch: { species: 'Sardine', weightKg: 0.1, trophy: false },
    };
    const { source, props } = setup(initial);
    const view = render(<FishingPanel {...props} refreshRevision={0} />);
    await advance(1);
    expect(catchSound.playFishCatchSound).not.toHaveBeenCalled();

    source.state = {
      ...source.state,
      catches: 2,
      attempts: 2,
      serverTime: iso(40000),
      latestCatch: { species: 'Mackerel', weightKg: 0.4, trophy: false },
      activeAttempt: { startedAt: iso(40000), deadlineAt: iso(100000), durationMs: 60000 },
    };
    view.rerender(<FishingPanel {...props} refreshRevision={1} />);
    await advance(1);
    expect(catchSound.playFishCatchSound).toHaveBeenCalledOnce();
    view.rerender(<FishingPanel {...props} refreshRevision={2} />);
    await advance(1);
    expect(catchSound.playFishCatchSound).toHaveBeenCalledOnce();

    source.state = {
      ...source.state,
      attempts: 3,
      serverTime: iso(50000),
      latestResult: 'No catch this attempt.',
      activeAttempt: { startedAt: iso(50000), deadlineAt: iso(110000), durationMs: 60000 },
    };
    view.rerender(<FishingPanel {...props} refreshRevision={3} />);
    await advance(1);
    expect(catchSound.playFishCatchSound).toHaveBeenCalledOnce();
  });

  it('keeps both fishing cues silent when their individual preferences are disabled', async () => {
    const { source, props } = setup(activeState());
    const view = render(
      <FishingPanel
        {...props}
        soundPreferences={{ reelEvent: false, fishCatch: false }}
        refreshRevision={0}
      />,
    );
    await advance(1);
    source.state = {
      ...source.state,
      catches: 1,
      attempts: 1,
      eventRevision: 1,
      serverTime: iso(32000),
      latestCatch: { species: 'Sardine', weightKg: 0.1, trophy: false },
      randomEvent: {
        id: 'quiet-offer',
        type: 'reel_pull',
        sessionId: 'timed-session',
        attempts: 1,
        message: 'Your rod jerks hard!',
        buttonLabel: 'REEL!',
        expiresAt: iso(37000),
        windowMs: 5000,
      },
      activeAttempt: { startedAt: iso(32000), deadlineAt: iso(92000), durationMs: 60000 },
    };
    view.rerender(
      <FishingPanel
        {...props}
        soundPreferences={{ reelEvent: false, fishCatch: false }}
        refreshRevision={1}
      />,
    );
    await advance(1);
    expect(screen.getByRole('button', { name: 'REEL!' })).toBeEnabled();
    expect(catchSound.playFishCatchSound).not.toHaveBeenCalled();
    expect(reelSound.playReelPromptSound).not.toHaveBeenCalled();
  });

  it('follows a configured duration after remount and reconciles tab resume without restarting', async () => {
    const { source, props, fetchMock } = setup(activeState(30000, 120000));
    const first = render(<FishingPanel {...props} refreshRevision={0} />);
    await advance(1);
    expect(value()).toBe(25);
    first.unmount();
    source.state = activeState(60000, 120000);
    render(<FishingPanel {...props} refreshRevision={0} />);
    await advance(1);
    expect(value()).toBe(50);
    source.state = activeState(90000, 120000);
    fireEvent(document, new Event('visibilitychange'));
    await advance(1);
    expect(value()).toBe(75);
    expect(fetchMock.mock.calls.every(([path]) => !path.endsWith('/start'))).toBe(true);
  });

  it('holds full while awaiting the server, performs bounded reads, and never consumes bait locally', async () => {
    const { source, fetchMock, props } = setup(activeState(59000));
    const view = render(<FishingPanel {...props} refreshRevision={0} />);
    await advance(1);
    await advance(5000);
    expect(value()).toBe(100);
    expect(screen.getByText('Checking for a bite…')).toBeInTheDocument();
    expect(screen.getByText('×2 left')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/fishing')).toHaveLength(3);
    expect(
      fetchMock.mock.calls.some(([path]) => path.includes('/start') || path.includes('/force')),
    ).toBe(false);
    source.state = {
      ...source.state,
      status: 'stopped',
      activeAttempt: null,
      serverTime: iso(65000),
      attempts: 1,
      baitRemaining: 0,
      stopReason: 'Fishing stopped: out of bait.',
    };
    view.rerender(<FishingPanel {...props} refreshRevision={1} />);
    await advance(1);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Fishing stopped: out of bait.')).toBeInTheDocument();
  });

  it('freezes during connection errors, ignores stale state, then reconciles a confirmed stop on reconnect', async () => {
    const { source, props } = setup(activeState());
    const view = render(<FishingPanel {...props} refreshRevision={0} />);
    await advance(1);
    await advance(5000);
    source.failed = true;
    fireEvent(window, new Event('offline'));
    const frozen = value();
    await advance(20000);
    expect(value()).toBe(frozen);
    expect(screen.getByText('Connection interrupted')).toBeInTheDocument();
    source.failed = false;
    source.state = activeState(10000);
    view.rerender(<FishingPanel {...props} refreshRevision={1} />);
    await advance(1);
    expect(value()).toBe(frozen);
    source.state = {
      ...activeState(60000),
      status: 'stopped',
      activeAttempt: null,
      stopReason: 'Fishing stopped: session inactive.',
    };
    fireEvent(window, new Event('online'));
    await advance(1);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Fishing stopped: session inactive.')).toBeInTheDocument();
    source.state = activeState(60001);
    view.rerender(<FishingPanel {...props} refreshRevision={2} />);
    await advance(1);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop Fishing' })).not.toBeInTheDocument();
  });

  it('receives natural prompts during the countdown without polling inventory for every event read', async () => {
    const { source, fetchMock, props } = setup(activeState());
    render(<FishingPanel {...props} refreshRevision={0} />);
    await advance(1);
    const inventoryReads = fetchMock.mock.calls.filter(
      ([path]) => path === '/api/inventory',
    ).length;
    source.state = {
      ...source.state,
      serverTime: iso(32000),
      eventRevision: 1,
      randomEvent: {
        id: 'natural-event',
        type: 'reel_pull',
        sessionId: 'timed-session',
        attempts: 0,
        message: 'Your rod jerks hard!',
        buttonLabel: 'REEL!',
        expiresAt: iso(35000),
        windowMs: 5000,
      },
    };
    await advance(2000);
    expect(screen.getByText('Your rod jerks hard!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'REEL!' })).toBeEnabled();
    expect(reelSound.playReelPromptSound).toHaveBeenCalledExactlyOnceWith(3000, 5000);
    await advance(1000);
    expect(reelSound.playReelPromptSound).toHaveBeenCalledTimes(1);
    source.state = {
      ...source.state,
      serverTime: iso(34000),
      eventRevision: 2,
      randomEvent: null,
    };
    await advance(1000);
    expect(reelSound.stopReelPromptSound).toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/inventory')).toHaveLength(
      inventoryReads,
    );
    expect(
      screen.getByRole('progressbar', { name: 'Current fishing attempt' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('submits Reel Pull once, waits for confirmed resolution, and rejects stale event snapshots', async () => {
    const event: NonNullable<FishingState['randomEvent']> = {
      id: 'reel-event',
      type: 'reel_pull',
      sessionId: 'timed-session',
      attempts: 0,
      message: 'Your rod jerks hard!',
      buttonLabel: 'REEL!',
      expiresAt: iso(35000),
      windowMs: 5000,
    };
    const original = { ...activeState(), randomEvent: event, eventRevision: 1 };
    const { source, fetchMock, props } = setup(original);
    const baseFetch = fetchMock.getMockImplementation()!;
    let release!: () => void;
    const responseReady = new Promise<void>((resolve) => {
      release = resolve;
    });
    fetchMock.mockImplementation(async (path: string) => {
      if (path !== '/api/fishing/event') return baseFetch(path);
      await responseReady;
      return {
        ok: true,
        json: async () => ({ fishing: source.state, character: { id: 'player' } }),
      };
    });
    const view = render(<FishingPanel {...props} refreshRevision={0} />);
    await advance(1);
    expect(value()).toBe(50);
    expect(reelSound.playReelPromptSound).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'REEL!' }));
    expect(reelSound.stopReelPromptSound).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirming…' }));
    expect(screen.getByRole('button', { name: 'Confirming…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Stop Fishing' })).toBeDisabled();
    expect(value()).toBe(50);
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/fishing/event')).toHaveLength(1);
    source.state = {
      ...original,
      attempts: 1,
      baitRemaining: 1,
      latestResult: 'No catch.',
      randomEvent: null,
      eventRevision: 3,
      activeAttempt: { startedAt: iso(30000), deadlineAt: iso(60000), durationMs: 30000 },
    };
    await act(async () => {
      release();
    });
    expect(value()).toBe(0);
    expect(screen.queryByRole('button', { name: 'REEL!' })).not.toBeInTheDocument();
    expect(screen.getByText('Reeled in. Attempt complete.')).toBeInTheDocument();
    expect(screen.getByText('×1 left')).toBeInTheDocument();
    source.state = { ...original, serverTime: iso(31000) };
    view.rerender(<FishingPanel {...props} refreshRevision={1} />);
    await advance(1);
    expect(screen.queryByRole('button', { name: 'REEL!' })).not.toBeInTheDocument();
    expect(value()).toBe(0);
  });

  it('disables a disconnected Reel Pull prompt and confirms it after reconnect', async () => {
    const event: NonNullable<FishingState['randomEvent']> = {
      id: 'reel-offline-event',
      type: 'reel_pull',
      sessionId: 'timed-session',
      attempts: 0,
      message: 'Your rod jerks hard!',
      buttonLabel: 'REEL!',
      expiresAt: iso(35000),
      windowMs: 5000,
    };
    const { source, fetchMock, props } = setup({
      ...activeState(),
      randomEvent: event,
      eventRevision: 1,
    });
    const baseFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (path: string) => {
      if (path !== '/api/fishing/event') return baseFetch(path);
      source.state = {
        ...source.state,
        attempts: 1,
        baitRemaining: 1,
        eventRevision: 3,
        randomEvent: null,
        activeAttempt: { startedAt: iso(30000), deadlineAt: iso(60000), durationMs: 30000 },
      };
      return {
        ok: true,
        json: async () => ({ fishing: source.state, character: { id: 'player' } }),
      };
    });
    const view = render(<FishingPanel {...props} refreshRevision={0} />);
    await advance(1);
    fireEvent(window, new Event('offline'));
    expect(screen.getByRole('button', { name: 'REEL!' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'REEL!' }));
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/fishing/event')).toHaveLength(0);
    fireEvent(window, new Event('online'));
    await advance(1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'REEL!' }));
    });
    expect(screen.getByText('Reeled in. Attempt complete.')).toBeInTheDocument();
    expect(value()).toBe(0);
    source.state = {
      ...activeState(),
      attempts: 2,
      eventRevision: 4,
      serverTime: iso(60000),
      activeAttempt: { startedAt: iso(60000), deadlineAt: iso(120000), durationMs: 60000 },
    };
    view.rerender(<FishingPanel {...props} refreshRevision={1} />);
    await advance(1);
    expect(screen.queryByText('Reeled in. Attempt complete.')).not.toBeInTheDocument();
    expect(screen.getByText('Waiting for a bite…')).toBeInTheDocument();
  });

  it('retains a failed event action for safe retry after server reconciliation', async () => {
    const { source, fetchMock, props } = setup({
      ...activeState(),
      eventRevision: 1,
      randomEvent: {
        id: 'retry-event',
        type: 'reel_pull',
        sessionId: 'timed-session',
        attempts: 0,
        message: 'Your rod jerks hard!',
        buttonLabel: 'REEL!',
        expiresAt: iso(35000),
        windowMs: 5000,
      },
    });
    const baseFetch = fetchMock.getMockImplementation()!;
    let fail = true;
    fetchMock.mockImplementation(async (path: string) => {
      if (path !== '/api/fishing/event') return baseFetch(path);
      if (fail) throw new Error('Connection lost');
      source.state = { ...source.state, randomEvent: null, eventRevision: 2 };
      return {
        ok: true,
        json: async () => ({ fishing: source.state, character: { id: 'player' } }),
      };
    });
    render(<FishingPanel {...props} refreshRevision={0} />);
    await advance(1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'REEL!' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Connection to Frontier was interrupted.');
    expect(screen.getByRole('button', { name: 'REEL!' })).toBeEnabled();
    expect(value()).toBe(50);
    expect(screen.getByText('×2 left')).toBeInTheDocument();
    fail = false;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'REEL!' }));
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'REEL!' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/fishing/event')).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/fishing/event',
      expect.objectContaining({ body: JSON.stringify({ eventId: 'retry-event' }) }),
    );
  });
});

describe('A01 Pier context', () => {
  it('shows the current haul below the latest catch while active and after stopping', async () => {
    let state: FishingState = {
      ...idle,
      status: 'active',
      sessionId: 'current-session',
      catches: 11,
      latestCatch: { species: 'Sardine', weightKg: 0.099, trophy: false },
      catchSummary: [
        { species: 'Sardine', count: 9, trophyCount: 1 },
        { species: 'Bluefin Tuna', count: 1, trophyCount: 0 },
        { species: 'Mackerel', count: 1, trophyCount: 0 },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => ({
        ok: true,
        json: async () => (path === '/api/fishing' ? { fishing: state } : { inventory }),
      })),
    );
    const props = { onCharacter: vi.fn(), onInventoryChange: vi.fn() };
    const { rerender } = render(<FishingPanel {...props} refreshRevision={0} />);
    const summary = await screen.findByRole('region', { name: 'Your catch' });
    expect(summary).toHaveTextContent('Current session');
    expect(summary).toHaveTextContent('11 fish');
    expect(summary).toHaveTextContent('Sardine');
    expect(summary).toHaveTextContent('9');
    expect(summary).toHaveTextContent('1 Trophy');
    expect(summary).toHaveTextContent('Bluefin Tuna');
    expect(summary).toHaveTextContent('Mackerel');
    expect(summary).not.toHaveTextContent('Largest');
    expect(screen.getByRole('region', { name: 'Latest catch' }).nextElementSibling).toBe(summary);
    state = { ...state, status: 'stopped', stopReason: 'Fishing stopped.' };
    rerender(<FishingPanel {...props} refreshRevision={1} />);
    await screen.findByText('Session complete');
    expect(screen.getByRole('region', { name: 'Latest catch' }).nextElementSibling).toBe(
      screen.getByRole('region', { name: 'Your catch' }),
    );
  });

  it('honors the authoritative Trophy flag and retains the catch after no-catch and final-bait stop', async () => {
    let state: FishingState = {
      ...idle,
      status: 'active',
      sessionId: 'trophy-session',
      catches: 1,
      latestCatch: { species: 'Mackerel', weightKg: 0.75, trophy: true },
      latestResult: 'Caught Mackerel (0.750 kg).',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => ({
        ok: true,
        json: async () => (path === '/api/fishing' ? { fishing: state } : { inventory }),
      })),
    );
    const props = { onCharacter: vi.fn(), onInventoryChange: vi.fn() };
    const { rerender } = render(<FishingPanel {...props} refreshRevision={0} />);
    expect(await screen.findByText('Trophy catch', { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/Trophy catch! Mackerel, 0.750 kg/)).toHaveAttribute('role', 'status');
    state = {
      ...state,
      latestCatch: { species: 'Bluefin Tuna', weightKg: 42.123, trophy: true },
      latestResult: 'Caught Bluefin Tuna (42.12 kg).',
    };
    rerender(<FishingPanel {...props} refreshRevision={1} />);
    expect(await screen.findByText(/Trophy catch! Bluefin Tuna, 42.12 kg/)).toHaveAttribute(
      'role',
      'status',
    );
    state = { ...state, latestResult: 'No catch this time.' };
    rerender(<FishingPanel {...props} refreshRevision={2} />);
    expect(await screen.findByText('No catch this time.')).toBeInTheDocument();
    expect(screen.getByText('Trophy catch', { exact: true })).toBeInTheDocument();
    state = { ...state, status: 'stopped', stopReason: 'Fishing stopped: out of bait.' };
    rerender(<FishingPanel {...props} refreshRevision={3} />);
    expect(await screen.findByText('Fishing stopped: out of bait.')).toBeInTheDocument();
    expect(screen.getByText('Trophy catch', { exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Prepare tackle' }));
    expect(screen.queryByText('Trophy catch', { exact: true })).not.toBeInTheDocument();
  });

  it('removes the previous session result when the server reports idle after departure', async () => {
    let state: FishingState = {
      ...idle,
      status: 'stopped',
      sessionId: 'finished-session',
      catches: 5,
      latestCatch: { species: 'Mackerel', weightKg: 0.682, trophy: true },
      catchSummary: [{ species: 'Mackerel', count: 5, trophyCount: 1 }],
      stopReason: 'Fishing stopped.',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => ({
        ok: true,
        json: async () => (path === '/api/fishing' ? { fishing: state } : { inventory }),
      })),
    );
    const props = { onCharacter: vi.fn(), onInventoryChange: vi.fn() };
    const { rerender } = render(<FishingPanel {...props} refreshRevision={0} />);
    expect(
      await screen.findByText('Mackerel', { selector: '.fishing-catch-species' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Your catch' })).toHaveTextContent('5 fish');
    state = idle;
    rerender(<FishingPanel {...props} refreshRevision={1} />);
    await waitFor(() =>
      expect(
        screen.queryByText('Mackerel', { selector: '.fishing-catch-species' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('region', { name: 'Your catch' })).not.toBeInTheDocument();
    expect(screen.queryByText('Fishing stopped.')).not.toBeInTheDocument();
    expect(screen.getByText('Settle in at the pier')).toBeInTheDocument();
  });

  it('never infers a Trophy distinction from the displayed weight', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => ({
        ok: true,
        json: async () =>
          path === '/api/fishing'
            ? {
                fishing: {
                  ...idle,
                  status: 'active',
                  catches: 1,
                  latestCatch: { species: 'Mackerel', weightKg: 0.75, trophy: false },
                },
              }
            : { inventory },
      })),
    );
    render(<FishingPanel onCharacter={vi.fn()} onInventoryChange={vi.fn()} refreshRevision={0} />);
    await screen.findByText('Mackerel', { selector: '.fishing-catch-species' });
    expect(screen.queryByText('Trophy catch', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText('Added to your inventory')).toBeInTheDocument();
  });

  it('moves focus into choices and returns it after Escape or selection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => ({
        ok: true,
        json: async () => (path === '/api/fishing' ? { fishing: idle } : { inventory }),
      })),
    );
    render(<FishingPanel onCharacter={vi.fn()} onInventoryChange={vi.fn()} refreshRevision={0} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Prepare tackle' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Preparation' })).toHaveFocus());
    const slot = screen.getByRole('button', { name: /Rod: Choose/ });
    fireEvent.click(slot);
    const choice = screen.getByRole('button', { name: /Basic Fishing Rod ×1/ });
    expect(choice).toHaveFocus();
    fireEvent.keyDown(choice, { key: 'Escape' });
    expect(slot).toHaveFocus();
    expect(screen.queryByRole('dialog', { name: 'Choose rod' })).not.toBeInTheDocument();
    fireEvent.click(slot);
    fireEvent.click(screen.getByRole('button', { name: /Basic Fishing Rod ×1/ }));
    expect(slot).toHaveFocus();
    fireEvent.click(slot);
    expect(screen.getByRole('button', { name: /Basic Fishing Rod ×1/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('explains stale supplies and disables commitment after inventory refresh', async () => {
    let supplies = inventory;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => ({
        ok: true,
        json: async () => (path === '/api/fishing' ? { fishing: idle } : { inventory: supplies }),
      })),
    );
    const props = { onCharacter: vi.fn(), onInventoryChange: vi.fn() };
    const view = render(<FishingPanel {...props} refreshRevision={0} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Prepare tackle' }));
    fireEvent.click(screen.getByRole('button', { name: /Rod: Choose/ }));
    fireEvent.click(screen.getByRole('button', { name: /Basic Fishing Rod ×1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Bait: Choose/ }));
    fireEvent.click(screen.getByRole('button', { name: /Worm Bait ×2/ }));
    expect(screen.getByRole('button', { name: 'Start Fishing' })).toBeEnabled();
    supplies = { ...inventory, items: [] };
    view.rerender(<FishingPanel {...props} refreshRevision={1} />);
    await screen.findByText('Selected supplies are no longer carried. Choose replacements.');
    expect(screen.getByRole('button', { name: 'Start Fishing' })).toBeDisabled();
  });
  it('keeps selections while refreshing a server-derived preview and scheduled forecast', async () => {
    let current = idle;
    const fetchMock = vi.fn(async (input: string) => ({
      ok: true,
      json: async () =>
        input === '/api/fishing'
          ? { fishing: current }
          : input === '/api/inventory'
            ? { inventory }
            : {
                preview: {
                  rodItemId: 'rod-1',
                  baitItemId: 'bait-1',
                  serverTime: current.serverTime,
                  conditions: current.conditions,
                  sea: current.sea,
                  gameTime: current.gameTime,
                  seaEffect: 'neutral',
                  possibleSpecies: [
                    {
                      id: 'sardine',
                      name: 'Sardine',
                      artworkPath: '/assets/items/sardine.webp',
                      discovered: true,
                      catchSharePercent: 64.5,
                    },
                    {
                      id: 'mackerel',
                      name: 'Mackerel',
                      artworkPath: '/assets/items/mackerel.webp',
                      discovered: false,
                      catchSharePercent: 35.5,
                    },
                  ],
                },
              },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const props = { onCharacter: vi.fn(), onInventoryChange: vi.fn(), onConditions: vi.fn() };
    const view = render(<FishingPanel {...props} refreshRevision={0} />);
    await screen.findByText('Sea outlook: Calm waters ahead');
    fireEvent.click(await screen.findByRole('button', { name: 'Prepare tackle' }));
    fireEvent.click(screen.getByRole('button', { name: /Rod: Choose/ }));
    fireEvent.click(screen.getByRole('button', { name: /Basic Fishing Rod ×1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Bait: Choose/ }));
    fireEvent.click(screen.getByRole('button', { name: /Worm Bait ×2/ }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([path]) => String(path).startsWith('/api/fishing/preview?')),
      ).toBe(true),
    );
    expect(await screen.findByText('Sardine')).toBeInTheDocument();
    expect(screen.getByText('64.50%')).toBeInTheDocument();
    expect(screen.getByText('Share when a fish is caught')).toBeInTheDocument();
    expect(screen.getByText('???')).toBeInTheDocument();
    expect(screen.queryByText('35.50%')).not.toBeInTheDocument();
    expect(document.querySelector('.fishing-species img.is-undiscovered')).toHaveAttribute(
      'src',
      '/assets/items/mackerel.webp',
    );
    expect(screen.queryByText('Mackerel')).not.toBeInTheDocument();
    expect(props.onConditions).toHaveBeenCalledWith(idle.conditions);
    current = {
      ...idle,
      serverTime: '2026-09-24T12:30:00.000Z',
      conditions: { ...idle.conditions, seaState: 'Calm' },
      sea: {
        ...idle.sea,
        blockStartedAt: idle.sea.blockEndsAt,
        blockEndsAt: '2026-09-24T13:00:00.000Z',
        scheduledCurrentState: 'Calm',
        nextState: 'Moderate',
      },
    };
    view.rerender(<FishingPanel {...props} refreshRevision={1} />);
    await screen.findByText('Sea outlook: Moderate seas ahead');
    expect(screen.getByRole('button', { name: /Rod: Basic Fishing Rod/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bait: Worm Bait/ })).toBeInTheDocument();
  });

  it('retains confirmed active results after refresh failure and offers recovery', async () => {
    let failed = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (failed) throw new Error('Connection lost.');
        return {
          ok: true,
          json: async () =>
            path === '/api/fishing'
              ? {
                  fishing: {
                    ...idle,
                    status: 'active',
                    rodName: 'Basic Fishing Rod',
                    baitName: 'Worm Bait',
                    baitRemaining: 1,
                    catches: 1,
                    latestCatch: { species: 'Sardine', weightKg: 0.123, trophy: false },
                    latestResult: 'No catch this attempt.',
                  },
                }
              : { inventory },
        };
      }),
    );
    const props = { onCharacter: vi.fn(), onInventoryChange: vi.fn() };
    const view = render(<FishingPanel {...props} refreshRevision={0} />);
    await screen.findByRole('heading', { name: 'Fishing…' });
    failed = true;
    view.rerender(<FishingPanel {...props} refreshRevision={1} />);
    await screen.findByRole('alert');
    expect(
      screen.getByText('0.12', { exact: false, selector: '.fishing-catch-weight' }),
    ).toHaveTextContent('0.123 kg');
    expect(screen.getByText('No catch this attempt.')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: 'Stop Fishing' })).toBeEnabled();
    failed = false;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh fishing' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('does not offer preparation when initial state is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Unavailable.');
      }),
    );
    render(<FishingPanel onCharacter={vi.fn()} onInventoryChange={vi.fn()} refreshRevision={0} />);
    expect(screen.getByText('Loading fishing state…')).toHaveAttribute('role', 'status');
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Prepare tackle' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh fishing' })).toBeEnabled();
  });

  it('prepares locally with only carried eligible choices, then commits in the same panel', async () => {
    let state = idle;
    const fetchMock = vi.fn(async (...args: [string, RequestInit?]) => {
      const input = args[0];
      if (input === '/api/fishing') return { ok: true, json: async () => ({ fishing: state }) };
      if (input === '/api/inventory') return { ok: true, json: async () => ({ inventory }) };
      if (input === '/api/fishing/start') {
        state = {
          ...idle,
          status: 'active',
          sessionId: 'session-1',
          rodItemId: 'rod-1',
          baitItemId: 'bait-1',
          rodName: 'Basic Fishing Rod',
          baitName: 'Worm Bait',
          baitRemaining: 2,
        };
        return {
          ok: true,
          json: async () => ({
            fishing: state,
            character: { id: 'player', activeStatus: 'FISHING' },
          }),
        };
      }
      throw new Error(`Unexpected ${input}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<FishingPanel onCharacter={vi.fn()} onInventoryChange={vi.fn()} refreshRevision={0} />);
    const first = await screen.findByRole('button', { name: 'Prepare tackle' });
    fireEvent.click(first);
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/fishing/start')).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Preparation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Possible Catches' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Fishing' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Rod: Choose carried item/ }));
    expect(screen.queryByRole('button', { name: /Field rations/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Basic Fishing Rod ×1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Bait: Choose carried item/ }));
    fireEvent.click(screen.getByRole('button', { name: /Worm Bait ×2/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Fishing' }));
    await screen.findByRole('heading', { name: 'Fishing…' });
    expect(screen.getByRole('button', { name: 'Stop Fishing' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close fishing/i })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.find(([path]) => path === '/api/fishing/start')?.[1]).toMatchObject(
      { body: JSON.stringify({ rodItemId: 'rod-1', baitItemId: 'bait-1' }) },
    );
  });

  it('shows missing supplies and a server stop reason without claiming discovery', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input === '/api/fishing')
        return {
          ok: true,
          json: async () => ({
            fishing: { ...idle, status: 'stopped', stopReason: 'Fishing stopped: inventory full.' },
          }),
        };
      return { ok: true, json: async () => ({ inventory: { ...inventory, items: [] } }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<FishingPanel onCharacter={vi.fn()} onInventoryChange={vi.fn()} refreshRevision={0} />);
    await screen.findByText('Fishing stopped: inventory full.');
    fireEvent.click(screen.getByRole('button', { name: 'Prepare tackle' }));
    fireEvent.click(screen.getByRole('button', { name: /Rod: Choose carried item/ }));
    expect(screen.getByText('No rod in your inventory.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close choices' }));
    expect(screen.getByRole('button', { name: 'Start Fishing' })).toBeDisabled();
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([path]) => path === '/api/fishing/start')).toBe(false),
    );
  });

  it('sends one Start and one Stop while delayed mutations are pending', async () => {
    let state: FishingState = idle;
    let finishStart!: () => void;
    let finishStop!: () => void;
    const startPending = new Promise<void>((resolve) => {
      finishStart = resolve;
    });
    const stopPending = new Promise<void>((resolve) => {
      finishStop = resolve;
    });
    const active: FishingState = {
      ...idle,
      status: 'active',
      activeAttempt: {
        startedAt: idle.serverTime,
        deadlineAt: '2026-09-24T12:11:00.000Z',
        durationMs: 60000,
      },
      sessionId: 'session-1',
      rodItemId: 'rod-1',
      baitItemId: 'bait-1',
      rodName: 'Basic Fishing Rod',
      baitName: 'Worm Bait',
      baitRemaining: 1,
      catches: 1,
      attempts: 1,
      latestCatch: { species: 'Sardine', weightKg: 0.123, trophy: false },
    };
    const fetchMock = vi.fn(async (path: string) => {
      if (path === '/api/fishing/start') {
        await startPending;
        state = active;
        return {
          ok: true,
          json: async () => ({
            fishing: state,
            character: { id: 'player', activeStatus: 'FISHING' },
          }),
        };
      }
      if (path === '/api/fishing/stop') {
        await stopPending;
        state = {
          ...active,
          status: 'stopped',
          stopReason: 'Fishing stopped.',
          catchSummary: [{ species: 'Sardine', count: 1, trophyCount: 0 }],
        };
        return {
          ok: true,
          json: async () => ({ fishing: state, character: { id: 'player', activeStatus: 'IDLE' } }),
        };
      }
      return {
        ok: true,
        json: async () =>
          path === '/api/fishing'
            ? { fishing: state }
            : path === '/api/inventory'
              ? { inventory }
              : {
                  preview: {
                    ...idle,
                    rodItemId: 'rod-1',
                    baitItemId: 'bait-1',
                    possibleSpecies: [],
                  },
                },
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<FishingPanel onCharacter={vi.fn()} onInventoryChange={vi.fn()} refreshRevision={0} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Prepare tackle' }));
    fireEvent.click(screen.getByRole('button', { name: /Rod: Choose/ }));
    fireEvent.click(screen.getByRole('button', { name: /Basic Fishing Rod ×1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Bait: Choose/ }));
    fireEvent.click(screen.getByRole('button', { name: /Worm Bait ×2/ }));
    const start = screen.getByRole('button', { name: 'Start Fishing' });
    fireEvent.click(start);
    fireEvent.click(start);
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/fishing/start')).toHaveLength(1);
    await act(async () => finishStart());
    const stop = await screen.findByRole('button', { name: 'Stop Fishing' });
    expect(stop).toBeEnabled();
    fireEvent.click(stop);
    const prompt = screen.getByRole('dialog', { name: 'Stop fishing?' });
    expect(prompt).toHaveClass('fishing-stop-confirm');
    expect(prompt.closest('.fishing-action-footer')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/fishing/stop')).toHaveLength(0);
    fireEvent.keyDown(prompt, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Stop fishing?' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/fishing/stop')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Stop Fishing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep fishing' }));
    expect(screen.queryByRole('dialog', { name: 'Stop fishing?' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/fishing/stop')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Stop Fishing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop and view catch' }));
    expect(screen.getByRole('button', { name: 'Stopping…' })).toBeDisabled();
    expect(
      screen.getByRole('progressbar', { name: 'Current fishing attempt' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('0.12', { exact: false, selector: '.fishing-catch-weight' }),
    ).toHaveTextContent('0.123 kg');
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/fishing/stop')).toHaveLength(1);
    await act(async () => finishStop());
    expect(await screen.findByRole('button', { name: 'Prepare tackle' })).toBeEnabled();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Your catch' })).toHaveTextContent('1 fish');
    expect(screen.getByRole('region', { name: 'Your catch' })).toHaveTextContent('Sardine');
    expect(screen.getByRole('region', { name: 'Your catch' })).not.toHaveTextContent('Largest');
    expect(screen.getByText('Sardine', { selector: '.fishing-catch-species' })).toBeInTheDocument();
  });

  it('reconciles an uncertain Start to the committed active session and character', async () => {
    let state: FishingState = idle;
    const active: FishingState = {
      ...idle,
      status: 'active',
      sessionId: 'committed-session',
      rodItemId: 'rod-1',
      baitItemId: 'bait-1',
      rodName: 'Basic Fishing Rod',
      baitName: 'Worm Bait',
      baitRemaining: 2,
    };
    const fetchMock = vi.fn(async (path: string) => {
      if (path === '/api/fishing/start') {
        state = active;
        throw new Error('Connection lost while starting.');
      }
      return {
        ok: true,
        json: async () =>
          path === '/api/fishing'
            ? { fishing: state }
            : path === '/api/inventory'
              ? { inventory }
              : path === '/api/character'
                ? { character: { id: 'player', activeStatus: 'FISHING' } }
                : {
                    preview: {
                      ...idle,
                      rodItemId: 'rod-1',
                      baitItemId: 'bait-1',
                      possibleSpecies: [],
                    },
                  },
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const onCharacter = vi.fn();
    render(
      <FishingPanel onCharacter={onCharacter} onInventoryChange={vi.fn()} refreshRevision={0} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Prepare tackle' }));
    fireEvent.click(screen.getByRole('button', { name: /Rod: Choose/ }));
    fireEvent.click(screen.getByRole('button', { name: /Basic Fishing Rod ×1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Bait: Choose/ }));
    fireEvent.click(screen.getByRole('button', { name: /Worm Bait ×2/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Fishing' }));
    await screen.findByRole('heading', { name: 'Fishing…' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop Fishing' })).toBeEnabled());
    expect(screen.getByRole('alert')).toHaveTextContent('Connection to Frontier was interrupted.');
    expect(screen.queryByRole('button', { name: 'Start Fishing' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prepare tackle' })).not.toBeInTheDocument();
    expect(onCharacter).toHaveBeenCalledWith({ id: 'player', activeStatus: 'FISHING' });
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/fishing/start')).toHaveLength(1);
  });

  it('ignores a delayed Start response after the Pier panel has unmounted', async () => {
    let finishStart!: () => void;
    const startPending = new Promise<void>((resolve) => {
      finishStart = resolve;
    });
    const fetchMock = vi.fn(async (path: string) => {
      if (path === '/api/fishing/start') {
        await startPending;
        return {
          ok: true,
          json: async () => ({
            fishing: { ...idle, status: 'active', sessionId: 'departed-session' },
            character: { id: 'player', activeStatus: 'FISHING', currentLocationId: 'fishing-pier' },
          }),
        };
      }
      return {
        ok: true,
        json: async () =>
          path === '/api/fishing'
            ? { fishing: idle }
            : path === '/api/inventory'
              ? { inventory }
              : {
                  preview: {
                    ...idle,
                    rodItemId: 'rod-1',
                    baitItemId: 'bait-1',
                    possibleSpecies: [],
                  },
                },
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const onCharacter = vi.fn();
    const view = render(
      <FishingPanel onCharacter={onCharacter} onInventoryChange={vi.fn()} refreshRevision={0} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Prepare tackle' }));
    fireEvent.click(screen.getByRole('button', { name: /Rod: Choose/ }));
    fireEvent.click(screen.getByRole('button', { name: /Basic Fishing Rod ×1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Bait: Choose/ }));
    fireEvent.click(screen.getByRole('button', { name: /Worm Bait ×2/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Fishing' }));
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled();
    view.unmount();
    const requestCount = fetchMock.mock.calls.length;
    await act(async () => finishStart());
    expect(onCharacter).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(requestCount);
  });
});
