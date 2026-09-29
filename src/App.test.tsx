import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

const character = {
  id: 'character-1',
  name: 'Avery Vale',
  credits: 250,
  hp: 100,
  maxHp: 100,
  characterXp: 0,
  characterLevel: 1,
  currentLocation: 'New Harbor',
  currentLocationId: 'new-harbor',
  activeStatus: 'idle',
};

describe('Frontier account shell', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '#places');
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ authenticated: false }) }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows a first-login account form after loading an anonymous session', async () => {
    render(<App />);
    expect(await screen.findByRole('form', { name: 'Create account' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create character →' })).toBeEnabled(),
    );
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
  });

  it('loads server character data into the sidebar', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: true, account: { username: 'frontier-dev' }, character }),
    } as Response);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Avery Vale' })).toBeInTheDocument();
    const summary = screen.getByRole('complementary', { name: 'Character summary' });
    expect(within(summary).getByText('Level 1')).toBeInTheDocument();
    expect(within(summary).getByText('0', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('100 / 100')).toBeInTheDocument();
    expect(within(summary).queryByText('New Harbor')).not.toBeInTheDocument();
    expect(within(summary).queryByText('@frontier-dev')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inventory' })).toHaveAttribute('href', '#inventory');
    expect(
      within(summary).queryByRole('group', { name: 'Fishing sounds' }),
    ).not.toBeInTheDocument();
  });

  it('shows independent Pier sound toggles and restores this character’s choices after remount', async () => {
    const pierCharacter = { ...character, currentLocationId: 'fishing-pier' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => ({
        ok: true,
        json: async () =>
          path === '/api/session'
            ? {
                authenticated: true,
                account: { username: 'frontier-dev' },
                character: pierCharacter,
              }
            : {},
      })),
    );
    const first = render(<App />);
    await screen.findByRole('heading', { name: 'Avery Vale' });
    const summary = await screen.findByRole('complementary', { name: 'Character summary' });
    const reel = within(summary).getByRole('checkbox', { name: 'Reel event sound' });
    const catchCue = within(summary).getByRole('checkbox', { name: 'Fish caught sound' });
    expect(reel).toBeChecked();
    expect(catchCue).toBeChecked();
    fireEvent.click(reel);
    expect(reel).not.toBeChecked();
    expect(catchCue).toBeChecked();
    expect(localStorage.getItem('frontier:fishing-sounds:character-1')).toBe(
      JSON.stringify({ reelEvent: false, fishCatch: true }),
    );
    fireEvent.click(catchCue);
    expect(reel).not.toBeChecked();
    expect(catchCue).not.toBeChecked();
    expect(localStorage.getItem('frontier:fishing-sounds:character-1')).toBe(
      JSON.stringify({ reelEvent: false, fishCatch: false }),
    );
    first.unmount();
    render(<App />);
    await screen.findByRole('heading', { name: 'Avery Vale' });
    const restored = await screen.findByRole('complementary', { name: 'Character summary' });
    expect(within(restored).getByRole('checkbox', { name: 'Reel event sound' })).not.toBeChecked();
    expect(within(restored).getByRole('checkbox', { name: 'Fish caught sound' })).not.toBeChecked();
  });

  it('shows the authoritative Frontier clock in the shared character HUD', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string) =>
        Promise.resolve({
          ok: true,
          json: async () =>
            path === '/api/session'
              ? { authenticated: true, account: { username: 'frontier-dev' }, character }
              : path === '/api/world/state'
                ? {
                    serverTime: '2026-09-24T12:00:00.000Z',
                    gameTime: { hour: 9, minute: 12 },
                    conditions: { timeOfDay: 'Day', seaState: 'Calm' },
                  }
                : {},
        } as Response),
      ),
    );
    render(<App />);
    expect(await screen.findAllByText('09:12 · Day')).toHaveLength(1);
    expect(screen.getByText('Frontier time', { selector: 'dt' })).toBeInTheDocument();
  });

  it('updates the global clock when the server pushes a changed world state', async () => {
    class MockEventSource {
      static instance: MockEventSource;
      onmessage: ((event: MessageEvent) => void) | null = null;
      constructor(readonly url: string) {
        MockEventSource.instance = this;
      }
      close() {}
    }
    vi.stubGlobal('EventSource', MockEventSource);
    vi.stubGlobal(
      'fetch',
      vi.fn((route: string) =>
        Promise.resolve({
          ok: true,
          json: async () =>
            route === '/api/session'
              ? { authenticated: true, account: { username: 'frontier-dev' }, character }
              : {},
        } as Response),
      ),
    );
    render(<App />);
    await screen.findByRole('heading', { name: 'Avery Vale' });
    await waitFor(() => expect(MockEventSource.instance?.url).toBe('/api/world/events'));
    act(() => {
      MockEventSource.instance.onmessage?.({
        data: JSON.stringify({
          serverTime: '2026-09-24T12:00:00.000Z',
          gameTime: { hour: 17, minute: 4 },
          conditions: { timeOfDay: 'Dusk', seaState: 'Dangerous' },
        }),
      } as MessageEvent);
    });
    expect(screen.getAllByText('17:04 · Dusk')).toHaveLength(1);
  });

  it('opens a clearly labeled movable fishing admin window only after server authorization', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string) => {
        const payload =
          path === '/api/session'
            ? { authenticated: true, account: { username: 'frontier-dev' }, character }
            : path === '/api/fishing/admin/access'
              ? { authorized: true }
              : path === '/api/fishing/admin'
                ? {
                    definitions: [],
                    inventory: { items: [], locker: [], capacity: 10, usedSlots: 0 },
                    fishing: {
                      gameTime: {
                        day: 1,
                        hour: 9,
                        minute: 0,
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
                      status: 'idle',
                      attempts: 0,
                      conditions: { timeOfDay: 'Day', seaState: 'Calm' },
                    },
                    traces: [],
                    events: [],
                    audit: [],
                  }
                : {};
        return Promise.resolve({ ok: true, json: async () => payload } as Response);
      }),
    );
    render(<App />);
    await screen.findByRole('heading', { name: 'Avery Vale' });
    expect(
      within(screen.getByRole('navigation', { name: 'Main navigation' })).queryByRole('link', {
        name: 'Fishing test tools (development/admin)',
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Account' }));
    expect(screen.getByText('@frontier-dev')).toBeVisible();
    const entry = await screen.findByRole('link', {
      name: 'Fishing test tools (development/admin)',
    });
    expect(entry).toHaveTextContent('DEV / ADMIN');
    fireEvent.click(entry);
    expect(await screen.findByRole('heading', { name: 'Fishing test tools' })).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'Inventory testing tool' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Move fishing test tools window/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Resize fishing test tools window/ })).toBeVisible();
    expect(fetch).toHaveBeenCalledWith('/api/fishing/admin/access', expect.any(Object));
    fireEvent.click(screen.getByRole('link', { name: 'World' }));
    await waitFor(() => expect(screen.getByText('Welcome back, Avery Vale')).not.toBeVisible());
    expect(screen.getByText('Fishing test tools', { selector: 'h1' })).not.toBeVisible();
    expect(window.location.hash).toBe('#places');
  });

  it('submits account creation and immediately updates the character sidebar', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ authenticated: false }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          account: { username: 'nora' },
          character: { ...character, name: 'Nora Vale' },
        }),
      } as Response);
    render(<App />);
    await screen.findByRole('form', { name: 'Create account' });
    await screen.findByText('Connected to Frontier');
    fireEvent.change(screen.getByLabelText('Character name'), { target: { value: 'Nora Vale' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'nora' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create character →' }));
    expect(await screen.findByRole('heading', { name: 'Nora Vale' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows a connection failure and offers retry', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: false }),
      } as Response);
    render(<App />);
    expect(await screen.findByText('Unable to connect')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Connected to Frontier')).toBeInTheDocument();
  });
});
