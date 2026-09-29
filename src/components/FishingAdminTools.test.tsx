import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FishingAdminTools } from './FishingAdminTools';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('authorized Fishing tools', () => {
  it('shows event diagnostics, prevents duplicate force actions, and refreshes the next cast automatically', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    const initialTime = '2026-09-26T12:00:00.000Z';
    const data = {
      definitions: [
        { id: 'sardine', name: 'Sardine' },
        { id: 'bluefin_tuna', name: 'Bluefin Tuna' },
      ],
      inventory: { items: [], locker: [], capacity: 10, usedSlots: 0 },
      fishing: {
        status: 'active',
        sessionId: 'admin-session',
        attempts: 2,
        eventRevision: 0,
        serverTime: initialTime,
        randomEvent: null as { id: string; message: string } | null,
        activeAttempt: {
          startedAt: initialTime,
          deadlineAt: '2026-09-26T12:01:00.000Z',
          durationMs: 60000,
        },
        conditions: { timeOfDay: 'Day', seaState: 'Calm' },
        gameTime: { hour: 9, minute: 5, nextPhaseAt: '' },
        sea: {
          scheduledCurrentState: 'Calm',
          nextState: 'Moderate',
          blockStartedAt: '',
          blockEndsAt: '',
        },
      },
      randomEvents: {
        cycleDurationMs: 3600000,
        elapsedMs: 1398000,
        nextEventInMs: 162000,
        triggeredCount: 2,
        scheduleMs: [120000, 840000, 1560000, 2280000, 3000000],
        currentEvent: null as { id: string; message: string } | null,
        canForce: true,
      },
      seaOverrideState: null,
      timeOverrideState: null,
      discoveredFish: [],
      traces: [],
      events: [],
      audit: [],
    };
    let release!: () => void;
    const responseReady = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn(async (path: string) => {
      if (path === '/api/fishing/admin/event') {
        await responseReady;
        data.fishing.eventRevision++;
        data.fishing.randomEvent = { id: 'forced', message: 'Your rod jerks hard!' };
        data.randomEvents.currentEvent = data.fishing.randomEvent;
        data.randomEvents.canForce = false;
      }
      return { ok: true, json: async () => structuredClone(data) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const onMutation = vi.fn();
    render(<FishingAdminTools onMutation={onMutation} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    const pool = within(screen.getByRole('region', { name: 'Catch pool test' }));
    fireEvent.change(pool.getByLabelText('Time of day'), { target: { value: 'Night' } });
    fireEvent.change(pool.getByLabelText('Sea state'), { target: { value: 'Dangerous' } });
    fireEvent.change(pool.getByLabelText('Bait'), { target: { value: 'squid_bait' } });
    fireEvent.change(pool.getByLabelText('Rod'), { target: { value: 'heavy_game_fishing_rod' } });
    expect(pool.getByText(/swordfish:/)).toBeInTheDocument();
    fireEvent.change(pool.getByLabelText('Time of day'), { target: { value: 'Day' } });
    expect(pool.queryByText(/swordfish:/)).not.toBeInTheDocument();
    expect(screen.getByText('23:18 / 60:00')).toBeInTheDocument();
    expect(screen.getByText('02:42')).toBeInTheDocument();
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Generated event schedule' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(5);
    expect(screen.queryByText('Surface Activity weights')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Force Reel Pull' }));
    fireEvent.click(screen.getByRole('button', { name: 'Force Reel Pull' }));
    expect(
      screen.queryByRole('button', { name: 'Force Surface Activity' }),
    ).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([path]) => path === '/api/fishing/admin/event'),
    ).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/fishing/admin/event',
      expect.objectContaining({
        body: expect.stringContaining('"sessionId":"admin-session","expectedAttemptCount":2'),
      }),
    );
    await act(async () => {
      release();
    });
    expect(onMutation).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Force Reel Pull' })).toBeDisabled();
    expect(screen.getByText('Your rod jerks hard!')).toBeInTheDocument();
    data.fishing.randomEvent = null;
    data.fishing.attempts++;
    data.fishing.eventRevision++;
    data.randomEvents.currentEvent = null;
    data.randomEvents.canForce = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByRole('button', { name: 'Force Reel Pull' })).toBeEnabled();
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    data.fishing.status = 'stopped';
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByRole('button', { name: 'Force Reel Pull' })).toBeDisabled();
  });
  it('offers a Trophy force that also requests a successful authorized attempt', async () => {
    const fetchMock = vi.fn(async (path: string) => ({
      ok: true,
      json: async () =>
        path === '/api/fishing/admin'
          ? {
              definitions: [],
              inventory: { items: [], locker: [], capacity: 10, usedSlots: 0 },
              fishing: {
                status: 'active',
                attempts: 2,
                conditions: { timeOfDay: 'Day', seaState: 'Calm' },
                gameTime: { hour: 9, minute: 5, nextPhaseAt: '', nextPhase: 'Dusk' },
                sea: {
                  scheduledCurrentState: 'Calm',
                  nextState: 'Moderate',
                  blockStartedAt: '',
                  blockEndsAt: '',
                },
              },
              seaOverrideState: null,
              timeOverrideState: null,
              discoveredFish: [],
              traces: [],
              events: [],
              audit: [],
            }
          : { fishing: { status: 'active' } },
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<FishingAdminTools onMutation={vi.fn()} />);
    fireEvent.click(
      await screen.findByLabelText('Force next catch to be Trophy (also forces success)'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Force next fishing attempt' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/fishing/admin/force',
        expect.objectContaining({ body: expect.stringContaining('"forceTrophy":true') }),
      ),
    );
    const call = fetchMock.mock.calls.find(
      ([path]) => path === '/api/fishing/admin/force',
    ) as unknown as [string, RequestInit];
    const body = JSON.parse(String(call[1].body));
    expect(body).toMatchObject({ forceSuccess: true, forceTrophy: true, expectedAttemptCount: 2 });
  });
  it('shows the effective clock and requires an explicit personal discovery reset', async () => {
    let discoveredFish = ['sardine'];
    const fetchMock = vi.fn(async (path: string) => {
      if (path === '/api/fishing/admin/discoveries/reset') discoveredFish = [];
      return {
        ok: true,
        json: async () =>
          path === '/api/fishing/admin'
            ? {
                definitions: [],
                inventory: { items: [], locker: [], capacity: 10, usedSlots: 0 },
                fishing: {
                  status: 'idle',
                  attempts: 0,
                  conditions: { timeOfDay: 'Day', seaState: 'Calm' },
                  gameTime: {
                    day: 1,
                    hour: 9,
                    minute: 5,
                    scheduledPhase: 'Day',
                    nextPhase: 'Dusk',
                    nextPhaseAt: '2026-09-24T13:30:00.000Z',
                  },
                  sea: {
                    zoneId: 'fishing-pier',
                    blockStartedAt: '2026-09-24T12:00:00.000Z',
                    blockEndsAt: '2026-09-24T12:30:00.000Z',
                    scheduledCurrentState: 'Calm',
                    nextState: 'Moderate',
                  },
                },
                seaOverrideState: null,
                timeOverrideState: null,
                discoveredFish,
                traces: [],
                events: [],
                audit: [],
              }
            : { removed: 1 },
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const onMutation = vi.fn();
    render(<FishingAdminTools onMutation={onMutation} />);
    expect(await screen.findByText('1 discovered for this character.')).toBeInTheDocument();
    expect(screen.getByText(/Frontier clock: 09:05/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Set clock to phase start'), {
      target: { value: 'Dawn' },
    });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/fishing/admin/conditions',
        expect.objectContaining({ body: JSON.stringify({ timeOfDay: 'Dawn' }) }),
      ),
    );
    await screen.findByText('Time override completed.');
    fireEvent.click(screen.getByRole('button', { name: 'Reset my fish discoveries' }));
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/fishing/admin/discoveries/reset',
      expect.anything(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reset' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/fishing/admin/discoveries/reset',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await waitFor(() => expect(onMutation).toHaveBeenCalled());
    expect(await screen.findByText('0 discovered for this character.')).toBeInTheDocument();
  });
  it('requires confirmation before clearing only the authorized character locker', async () => {
    let locker = [{ instanceId: 'stored-rod', name: 'Basic Fishing Rod', quantity: 1 }];
    const fetchMock = vi.fn(async (path: string) => {
      if (path === '/api/fishing/admin/inventory') locker = [];
      return {
        ok: true,
        json: async () => ({
          definitions: [],
          inventory: { items: [], locker, capacity: 10, usedSlots: 0 },
          fishing: {
            status: 'idle',
            attempts: 0,
            conditions: { timeOfDay: 'Day', seaState: 'Calm' },
            gameTime: { hour: 9, minute: 5, nextPhaseAt: '' },
            sea: {
              scheduledCurrentState: 'Calm',
              nextState: 'Moderate',
              blockStartedAt: '',
              blockEndsAt: '',
            },
          },
          seaOverrideState: null,
          timeOverrideState: null,
          discoveredFish: [],
          traces: [],
          events: [],
          audit: [],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const onMutation = vi.fn();
    render(<FishingAdminTools onMutation={onMutation} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Clear Locker' }));
    expect(screen.getByRole('group', { name: 'Confirm clear locker' })).toHaveTextContent(
      'Delete all 1 stored stacks',
    );
    expect(fetchMock).not.toHaveBeenCalledWith('/api/fishing/admin/inventory', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Confirm clear locker' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/fishing/admin/inventory',
        expect.objectContaining({
          body: expect.stringContaining('"action":"clear_locker"'),
        }),
      ),
    );
    await waitFor(() => expect(onMutation).toHaveBeenCalled());
    expect(await screen.findByText('Clear locker completed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear Locker' })).toBeDisabled();
  });

  it('selects and confirms deletion of a single locker stack', async () => {
    let locker = [
      { instanceId: 'stored-rod', name: 'Basic Fishing Rod', quantity: 1, location: 'locker' },
    ];
    const fetchMock = vi.fn(async (path: string) => {
      if (path === '/api/fishing/admin/inventory') locker = [];
      return {
        ok: true,
        json: async () => ({
          definitions: [],
          inventory: { items: [], locker, capacity: 10, usedSlots: 0 },
          fishing: {
            status: 'idle',
            attempts: 0,
            conditions: { timeOfDay: 'Day', seaState: 'Calm' },
            gameTime: { hour: 9, minute: 5, nextPhaseAt: '' },
            sea: {
              scheduledCurrentState: 'Calm',
              nextState: 'Moderate',
              blockStartedAt: '',
              blockEndsAt: '',
            },
          },
          seaOverrideState: null,
          timeOverrideState: null,
          discoveredFish: [],
          traces: [],
          events: [],
          audit: [],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const onMutation = vi.fn();
    render(<FishingAdminTools onMutation={onMutation} />);
    fireEvent.change(await screen.findByLabelText('Inventory or locker stack'), {
      target: { value: 'stored-rod' },
    });
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Stack' }));
    expect(screen.getByRole('group', { name: 'Confirm delete stack' })).toHaveTextContent(
      'Delete Basic Fishing Rod ×1 from the city locker?',
    );
    expect(fetchMock).not.toHaveBeenCalledWith('/api/fishing/admin/inventory', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete stack' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/fishing/admin/inventory',
        expect.objectContaining({ body: expect.stringContaining('"itemId":"stored-rod"') }),
      ),
    );
    await waitFor(() => expect(onMutation).toHaveBeenCalled());
  });
});
