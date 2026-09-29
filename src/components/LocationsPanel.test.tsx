import { createRef } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { allLocationDefinitions } from '../../server/locations';
import type { LocationDefinition, LocationState } from '../../server/locations';
import type { PublicWorldSnapshot } from '../../server/seaState';
import type { RoomSummary } from '../../shared/roomTypes';
import { LocationsPanel } from './LocationsPanel';
import { fishingPierArtwork, fishingStoreArtwork, locationArtwork } from './locationArtwork';
vi.mock('./FishingPanel', () => ({
  FishingPanel: ({
    onConditions,
  }: {
    onConditions: (value: { timeOfDay: 'Dusk'; seaState: 'Dangerous' }) => void;
  }) => (
    <div>
      Fishing activity
      <button onClick={() => onConditions({ timeOfDay: 'Dusk', seaState: 'Dangerous' })}>
        Update Pier conditions
      </button>
    </div>
  ),
}));
vi.mock('./FishBuyerPanel', () => ({
  FishBuyerPanel: () => <div>Fish buyer appraisal</div>,
}));
vi.mock('./PropertyRoom', () => ({
  PropertyRoom: ({ roomId, onBack }: { roomId: string; onBack: () => void }) => (
    <section role="region" aria-label={`Test plot ${roomId}`}>
      <button onClick={onBack}>Back from plot</button>
    </section>
  ),
}));

const character = {
  id: 'review',
  name: 'Rowan',
  hp: 100,
  maxHp: 100,
  credits: 250,
  characterXp: 0,
  characterLevel: 1,
  currentLocation: 'New Harbor',
  currentLocationId: 'new-harbor',
  activeStatus: 'idle',
};
const definitions: LocationDefinition[] = [
  {
    id: 'new-harbor',
    name: 'New Harbor',
    kind: 'city',
    parentId: null,
    childLocationIds: ['harbor'],
    description: 'A working coastal city.',
    pinEligible: false,
    discoveryState: 'starting',
    hotspots: [],
  },
  {
    id: 'harbor',
    name: 'Harbor District',
    kind: 'district',
    parentId: 'new-harbor',
    childLocationIds: ['fishing-pier'],
    description: 'The working waterfront.',
    pinEligible: true,
    discoveryState: 'visit',
    hotspots: [],
  },
  {
    id: 'fishing-pier',
    name: 'Fishing Pier',
    kind: 'place',
    parentId: 'harbor',
    childLocationIds: [],
    description: 'A wooden pier.',
    pinEligible: true,
    discoveryState: 'visit',
    hotspots: [],
  },
];
const initial: LocationState = {
  locations: definitions,
  currentLocationId: 'new-harbor',
  discoveredLocationIds: ['new-harbor'],
  pinnedLocationIds: [],
};
function response(locationState = initial, includeCharacter = false) {
  return {
    ok: true,
    json: async () => ({
      locationState,
      ...(includeCharacter
        ? {
            character: {
              ...character,
              currentLocationId: locationState.currentLocationId,
              currentLocation: definitions.find(
                (place) => place.id === locationState.currentLocationId,
              )!.name,
            },
          }
        : {}),
    }),
  } as Response;
}
function stubLocationFetch(
  fetchMock: (path: string, options?: RequestInit) => Promise<Response>,
  rooms: RoomSummary[] = [],
) {
  vi.stubGlobal('fetch', (path: string, options?: RequestInit) =>
    path === '/api/rooms'
      ? Promise.resolve({ ok: true, json: async () => ({ rooms }) } as Response)
      : fetchMock(path, options),
  );
}
function setup(state = initial, activeStatus = 'idle') {
  const fetchMock = vi.fn().mockResolvedValue(response(state));
  stubLocationFetch(fetchMock);
  const onCharacter = vi.fn();
  const onPinnedPlaces = vi.fn();
  const onBusy = vi.fn();
  const quickTravelDialog = createRef<HTMLDialogElement>();
  const onCloseQuickTravel = vi.fn(() => quickTravelDialog.current?.removeAttribute('open'));
  const view = render(
    <LocationsPanel
      character={{ ...character, activeStatus }}
      busy={false}
      onBusy={onBusy}
      onCharacter={onCharacter}
      onPinnedPlaces={onPinnedPlaces}
      quickTravelDialog={quickTravelDialog}
      onCloseQuickTravel={onCloseQuickTravel}
    />,
  );
  return {
    fetchMock,
    onCharacter,
    onPinnedPlaces,
    onBusy,
    quickTravelDialog,
    onCloseQuickTravel,
    ...view,
  };
}
function openQuickTravel(dialog: HTMLDialogElement | null) {
  dialog?.setAttribute('open', '');
}
function route() {
  return screen.getByText('Southwest waterfront').closest('button')!;
}
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('F03 player navigation', () => {
  it('restores the open plot after refresh and clears it when the player leaves', async () => {
    const room: RoomSummary = {
      id: 'plot-review',
      name: 'Placement test room',
      locationId: 'new-harbor',
      width: 8,
      depth: 8,
      revision: 0,
    };
    const props = {
      character,
      busy: false,
      onBusy: vi.fn(),
      onCharacter: vi.fn(),
      onPinnedPlaces: vi.fn(),
      quickTravelDialog: createRef<HTMLDialogElement>(),
      onCloseQuickTravel: vi.fn(),
    };
    stubLocationFetch(vi.fn().mockResolvedValue(response()), [room]);
    const first = render(<LocationsPanel {...props} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open Placement test room' }));
    expect(
      await screen.findByRole('region', { name: 'Test plot plot-review' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(sessionStorage.getItem('frontier.activeRoomId')).toBe('plot-review'),
    );

    first.unmount();
    render(<LocationsPanel {...props} />);
    expect(
      await screen.findByRole('region', { name: 'Test plot plot-review' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back from plot' }));
    await waitFor(() => expect(sessionStorage.getItem('frontier.activeRoomId')).toBeNull());
    expect(screen.queryByRole('region', { name: 'Test plot plot-review' })).not.toBeInTheDocument();
  });

  it('shows the store interior and buyer without Harbor destinations while awaiting world state', async () => {
    const { container } = setup({
      ...initial,
      locations: allLocationDefinitions(),
      currentLocationId: 'fishing-store',
      discoveredLocationIds: ['new-harbor', 'harbor', 'fishing-store'],
    });
    expect(await screen.findByRole('img')).toHaveAttribute('src', fishingStoreArtwork('Day').src);
    expect(screen.getByRole('heading', { name: 'Fishing Store', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Harbor District' })).toBeEnabled();
    expect(screen.getByRole('complementary', { name: 'Destination context' })).toContainElement(
      screen.getByText('Fish buyer appraisal'),
    );
    expect(screen.queryByRole('group', { name: 'Map destinations' })).not.toBeInTheDocument();
    expect(container.querySelectorAll('.district-cutout, .district-region')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Boat Market/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Fishing activity')).not.toBeInTheDocument();
  });

  it('follows effective shared store phases without changing buyer, location, or reacting to sea alone', async () => {
    const state = {
      ...initial,
      locations: allLocationDefinitions(),
      currentLocationId: 'fishing-store',
      discoveredLocationIds: ['new-harbor', 'harbor', 'fishing-store'],
    };
    const world: PublicWorldSnapshot = {
      serverTime: '2026-09-24T12:00:00.000Z',
      conditions: { timeOfDay: 'Night', seaState: 'Calm' },
      gameTime: {
        day: 1,
        hour: 9,
        minute: 0,
        scheduledPhase: 'Day',
        nextPhase: 'Dusk',
        nextPhaseAt: '2026-09-24T13:00:00.000Z',
      },
      sea: {
        zoneId: 'fishing-pier',
        blockStartedAt: '2026-09-24T12:00:00.000Z',
        blockEndsAt: '2026-09-24T12:30:00.000Z',
        scheduledCurrentState: 'Calm',
        nextState: 'Moderate',
      },
    };
    const props = {
      character: {
        ...character,
        currentLocationId: 'fishing-store',
        currentLocation: 'Fishing Store',
      },
      busy: false,
      onBusy: vi.fn(),
      onCharacter: vi.fn(),
      onPinnedPlaces: vi.fn(),
      quickTravelDialog: createRef<HTMLDialogElement>(),
      onCloseQuickTravel: vi.fn(),
    };
    const fetchMock = vi.fn().mockResolvedValue(response(state));
    stubLocationFetch(fetchMock);
    const view = render(<LocationsPanel {...props} worldState={world} />);
    const image = await screen.findByRole('img');
    expect(image).toHaveAttribute('src', fishingStoreArtwork('Night').src);
    const buyer = screen.getByText('Fish buyer appraisal');

    view.rerender(
      <LocationsPanel
        {...props}
        worldState={{ ...world, conditions: { timeOfDay: 'Night', seaState: 'Dangerous' } }}
      />,
    );
    await act(async () => {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    });
    expect(image).toHaveAttribute('src', fishingStoreArtwork('Night').src);
    expect(view.container.querySelector('.scene-image-previous')).toBeNull();

    let previousSource = fishingStoreArtwork('Night').src;
    for (const timeOfDay of ['Dawn', 'Day', 'Dusk'] as const) {
      view.rerender(
        <LocationsPanel
          {...props}
          worldState={{ ...world, conditions: { timeOfDay, seaState: 'Dangerous' } }}
        />,
      );
      const incoming = screen.getByRole('img', { name: new RegExp(timeOfDay) });
      await waitFor(() =>
        expect(incoming).toHaveAttribute('src', fishingStoreArtwork(timeOfDay).src),
      );
      expect(view.container.querySelector('.scene-image-previous')).toHaveAttribute(
        'src',
        previousSource,
      );
      expect(incoming).not.toHaveClass('is-revealed');
      fireEvent.load(incoming);
      await waitFor(() => expect(incoming).toHaveClass('is-revealed'));
      expect(incoming).toHaveStyle({ animationDuration: '1000ms' });
      expect(screen.getByText('Fish buyer appraisal')).toBe(buyer);
      expect(screen.getByRole('heading', { name: 'Fishing Store', level: 3 })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Back to Harbor District' })).toBeEnabled();
      expect(screen.queryByRole('group', { name: 'Map destinations' })).not.toBeInTheDocument();
      previousSource = fishingStoreArtwork(timeOfDay).src;
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(props.onCharacter).not.toHaveBeenCalled();
  });

  it('shows the supplied Pier scene and fishing context', async () => {
    setup({
      ...initial,
      locations: allLocationDefinitions(),
      currentLocationId: 'fishing-pier',
      discoveredLocationIds: ['new-harbor', 'harbor', 'fishing-pier'],
    });
    const image = await screen.findByRole('img');
    expect(image).toHaveAttribute('src', locationArtwork['fishing-pier'].src);
    expect(screen.getByText('Fishing activity')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to Harbor District/ })).toBeEnabled();
    expect(screen.queryByText('Other destinations')).not.toBeInTheDocument();
    expect(screen.queryByText('Your places')).not.toBeInTheDocument();
    expect(
      screen.getByRole('complementary', { name: 'Destination context' }),
    ).not.toHaveTextContent('Boat Market');
    expect(
      screen.getByRole('heading', { name: 'Fishing Pier', level: 3 }).closest('header'),
    ).toHaveClass('world-location-header');
    expect(screen.getByRole('complementary', { name: 'Destination context' })).not.toContainElement(
      screen.getByRole('button', { name: /Back to Harbor District/ }),
    );
  });
  it('fits the complete artwork and city overlays to one centered coordinate space on resize', async () => {
    let resize!: (width: number, height: number) => void;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resize = (width, height) =>
            callback(
              [{ contentRect: { width, height } } as ResizeObserverEntry],
              this as unknown as ResizeObserver,
            );
        }
        observe() {
          resize(800, 600);
        }
        disconnect() {}
      },
    );
    const view = setup({ ...initial, locations: allLocationDefinitions() });
    const artwork = await screen.findByRole('img');
    const scene = artwork.closest('.scene-stage') as HTMLElement;
    await waitFor(() => expect(scene.style.width).toBe('800px'));
    expect(scene.style.height).toBe('450px');
    expect(scene.style.left).toBe('0px');
    expect(scene.style.top).toBe('75px');
    expect(scene.querySelectorAll('.district-cutout')).toHaveLength(7);
    expect(scene.querySelector('.district-regions')).toHaveAttribute('viewBox', '0 0 2560 1440');
    act(() => resize(320, 640));
    expect(scene.style.width).toBe('320px');
    expect(scene.style.height).toBe('180px');
    expect(scene.style.top).toBe('230px');
    expect(view.container.querySelectorAll('.scene-stage')).toHaveLength(1);
  });
  it('explains the departure consequence only while the confirmed character is fishing', async () => {
    const atPier = {
      ...initial,
      currentLocationId: 'fishing-pier',
      discoveredLocationIds: ['new-harbor', 'harbor', 'fishing-pier'],
      pinnedLocationIds: ['harbor'],
    };
    const { quickTravelDialog } = setup(atPier, 'FISHING');
    const back = await screen.findByRole('button', { name: 'Back to Harbor District' });
    expect(back).toHaveAccessibleDescription('Leaving the pier stops fishing.');
    openQuickTravel(quickTravelDialog.current);
    const shortcut = quickTravelDialog.current!.querySelector('.quick-travel-route')!;
    expect(shortcut).toHaveAttribute('aria-description', 'Leaving the pier stops fishing.');
    cleanup();
    setup(atPier);
    await screen.findByRole('button', { name: 'Back to Harbor District' });
    expect(screen.queryByText('Leaving the pier stops fishing.')).not.toBeInTheDocument();
  });
  it('switches the Pier artwork when authoritative fishing conditions change', async () => {
    setup({
      ...initial,
      currentLocationId: 'fishing-pier',
      discoveredLocationIds: ['new-harbor', 'harbor', 'fishing-pier'],
    });
    await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: 'Update Pier conditions' }));
    await waitFor(() =>
      expect(screen.getByRole('img')).toHaveAttribute(
        'src',
        fishingPierArtwork('Dusk', 'Dangerous').src,
      ),
    );
    expect(screen.getByRole('img')).toHaveAttribute('alt', expect.stringContaining('Dusk'));
  });
  it('crossfades the Pier when a pushed world update changes shared conditions', async () => {
    const state = {
      ...initial,
      currentLocationId: 'fishing-pier',
      discoveredLocationIds: ['new-harbor', 'harbor', 'fishing-pier'],
    };
    const world: PublicWorldSnapshot = {
      serverTime: '2026-09-24T12:00:00.000Z',
      conditions: { timeOfDay: 'Day', seaState: 'Calm' },
      gameTime: {
        day: 1,
        hour: 9,
        minute: 0,
        scheduledPhase: 'Day',
        nextPhase: 'Dusk',
        nextPhaseAt: '2026-09-24T13:00:00.000Z',
      },
      sea: {
        zoneId: 'fishing-pier',
        blockStartedAt: '2026-09-24T12:00:00.000Z',
        blockEndsAt: '2026-09-24T12:30:00.000Z',
        scheduledCurrentState: 'Calm',
        nextState: 'Moderate',
      },
    };
    const props = {
      character,
      busy: false,
      onBusy: vi.fn(),
      onCharacter: vi.fn(),
      onPinnedPlaces: vi.fn(),
      quickTravelDialog: createRef<HTMLDialogElement>(),
      onCloseQuickTravel: vi.fn(),
    };
    stubLocationFetch(vi.fn().mockResolvedValue(response(state)));
    const view = render(<LocationsPanel {...props} worldState={world} />);
    const previousSource = fishingPierArtwork('Day', 'Calm').src;
    expect(await screen.findByRole('img')).toHaveAttribute('src', previousSource);
    view.rerender(
      <LocationsPanel
        {...props}
        worldState={{
          ...world,
          serverTime: '2026-09-24T12:00:01.000Z',
          conditions: { ...world.conditions, seaState: 'Dangerous', timeOfDay: 'Dusk' },
        }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('img', { name: /Dusk/ })).toHaveAttribute(
        'src',
        fishingPierArtwork('Dusk', 'Dangerous').src,
      ),
    );
    const incoming = screen.getByRole('img', { name: /Dusk/ });
    expect(view.container.querySelector('.scene-image-previous')).toHaveAttribute(
      'src',
      previousSource,
    );
    expect(incoming).not.toHaveClass('is-revealed');
    fireEvent.load(incoming);
    await waitFor(() => expect(incoming).toHaveClass('is-revealed'));
  });
  it('shows each supplied location scene while keeping named routes and parent navigation', async () => {
    const locations = allLocationDefinitions();
    const scenes = [
      'harbor',
      'market-district',
      'industrial-district',
      'civic-residential',
      'city-centre',
      'transit-hub',
      'outskirts',
    ];
    for (const id of scenes) {
      const place = locations.find((location) => location.id === id)!;
      const { container } = setup({
        ...initial,
        locations,
        currentLocationId: id,
        discoveredLocationIds: ['new-harbor', id],
      });
      const image = await screen.findByRole('img');
      expect(image).toHaveAttribute('src', locationArtwork[id].src);
      expect(image).toHaveAttribute('alt', locationArtwork[id].alt);
      expect(container.querySelector('figcaption')).toBeNull();
      expect(screen.getByRole('button', { name: /Back to New Harbor/ })).toBeEnabled();
      for (const childId of place.childLocationIds) {
        const child = locations.find((location) => location.id === childId)!;
        expect(screen.getAllByRole('button', { name: new RegExp(child.name) })[0]).toBeEnabled();
      }
      cleanup();
    }
  });
  it('previews, selects, and explicitly enters all seven canonical city regions', async () => {
    const cityDefinitions = allLocationDefinitions();
    const cityState = { ...initial, locations: cityDefinitions };
    const city = cityDefinitions.find((place) => place.id === 'new-harbor')!;
    expect(city.childLocationIds).toHaveLength(7);
    for (const id of city.childLocationIds) {
      const place = cityDefinitions.find((location) => location.id === id)!;
      const { fetchMock, container } = setup(cityState);
      const named = await screen.findAllByRole('button', {
        name: `Select ${place.name} — Not yet visited`,
      });
      expect(named.length).toBeGreaterThanOrEqual(2);
      expect(container.querySelectorAll('.district-region')).toHaveLength(7);
      expect(container.querySelectorAll('.district-cutout')).toHaveLength(7);
      fireEvent.focus(named[0]);
      expect(screen.queryByText('Selected destination · Preview')).not.toBeInTheDocument();
      fireEvent.blur(named[0]);
      fireEvent.click(named[0]);
      expect(named[0]).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Selected destination · Preview')).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      fetchMock.mockResolvedValueOnce(
        response({
          ...cityState,
          currentLocationId: id,
          discoveredLocationIds: ['new-harbor', id],
        }),
      );
      fireEvent.click(screen.getByRole('button', { name: `Enter ${place.name}` }));
      expect(
        await screen.findByText(`Discovered ${place.name}. Pin it to add it to Quick Travel.`),
      ).toBeInTheDocument();
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/locations/navigate',
        expect.objectContaining({ body: JSON.stringify({ locationId: id }) }),
      );
      cleanup();
    }
  });
  it('highlights on hover and focus, then selects only on activation', async () => {
    const { fetchMock } = setup();
    expect(screen.getByText('Finding your place in New Harbor…')).toBeInTheDocument();
    const named = await screen.findAllByRole('button', {
      name: 'Select Harbor District — Not yet visited',
    });
    expect(named.length).toBeGreaterThan(0);
    fireEvent.mouseEnter(route());
    expect(screen.queryByText('Selected destination · Preview')).not.toBeInTheDocument();
    expect(screen.queryByText(/Your location is still New Harbor/)).not.toBeInTheDocument();
    fireEvent.mouseLeave(route());
    expect(screen.queryByText('Selected destination · Preview')).not.toBeInTheDocument();
    fireEvent.focus(named[0]);
    expect(screen.queryByText('Selected destination · Preview')).not.toBeInTheDocument();
    fireEvent.keyDown(named[0], { key: 'Enter' });
    expect(named[0]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.blur(named[0]);
    fireEvent.click(route());
    expect(route()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Selected destination · Preview')).toBeInTheDocument();
    expect(screen.getByText(/Your location is still New Harbor/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter Harbor District' })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Your places')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pin location' })).toBeDisabled();
    expect(screen.getByText('This location cannot be pinned.')).toBeInTheDocument();
  });
  it('waits for the server before changing location and announces a first visit', async () => {
    const { fetchMock, onCharacter } = setup();
    await screen.findByRole('button', { name: 'Refresh places' });
    await screen.findByText('Southwest waterfront');
    fireEvent.click(route());
    const enter = screen.getByRole('button', { name: 'Enter Harbor District' });
    let finish!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    );
    fireEvent.click(enter);
    fireEvent.click(enter);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('heading', { name: 'New Harbor', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh places' })).toBeDisabled();
    const next = {
      ...initial,
      currentLocationId: 'harbor',
      discoveredLocationIds: ['new-harbor', 'harbor'],
    };
    await act(async () => finish(response(next, true)));
    expect(
      await screen.findByText('Discovered Harbor District. Pin it to add it to Quick Travel.'),
    ).toBeInTheDocument();
    expect(onCharacter).toHaveBeenCalledWith(
      expect.objectContaining({ currentLocationId: 'harbor' }),
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/locations/navigate',
      expect.objectContaining({ body: JSON.stringify({ locationId: 'harbor' }) }),
    );
  });
  it('pins and unpins using confirmed server state', async () => {
    const atPier = {
      ...initial,
      currentLocationId: 'fishing-pier',
      discoveredLocationIds: ['new-harbor', 'harbor', 'fishing-pier'],
    };
    const { fetchMock, onPinnedPlaces } = setup(atPier);
    const pin = await screen.findByRole('button', { name: 'Pin location' });
    fetchMock.mockResolvedValueOnce(response({ ...atPier, pinnedLocationIds: ['fishing-pier'] }));
    fireEvent.click(pin);
    expect(await screen.findByRole('button', { name: 'Unpin location' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(onPinnedPlaces).toHaveBeenLastCalledWith(['Fishing Pier']);
    fetchMock.mockResolvedValueOnce(response(atPier));
    fireEvent.click(screen.getByRole('button', { name: 'Unpin location' }));
    expect(await screen.findByRole('button', { name: 'Pin location' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
  it('keeps the pin action tied to the current location and enforces capacity', async () => {
    const atPier = {
      ...initial,
      locations: allLocationDefinitions(),
      currentLocationId: 'fishing-pier',
      discoveredLocationIds: ['new-harbor', 'harbor', 'fishing-pier'],
      pinnedLocationIds: ['saved-1', 'saved-2', 'saved-3', 'saved-4', 'saved-5'],
    };
    const { fetchMock } = setup(atPier);
    await screen.findByRole('heading', { name: 'Fishing Pier', level: 3 });
    expect(screen.queryByText('Other destinations')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fishing Pier', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('Pinned 5/5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pin location' })).toBeDisabled();
    expect(screen.getByText('5 locations pinned. Unpin one to add another.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('keeps a visible parent back action tied to the current location through place and district returns', async () => {
    const atPier = {
      ...initial,
      locations: allLocationDefinitions(),
      currentLocationId: 'fishing-pier',
      discoveredLocationIds: ['new-harbor', 'harbor', 'fishing-pier'],
    };
    const { fetchMock } = setup(atPier);
    await screen.findByRole('button', { name: /Back to Harbor District/ });
    expect(screen.getByRole('heading', { name: 'Fishing Pier', level: 3 })).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(response({ ...atPier, currentLocationId: 'harbor' }, true));
    fireEvent.click(screen.getByRole('button', { name: /Back to Harbor District/ }));
    expect(
      await screen.findByRole('heading', { name: 'Harbor District', level: 3 }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/locations/navigate',
      expect.objectContaining({ body: JSON.stringify({ locationId: 'harbor' }) }),
    );
    fetchMock.mockResolvedValueOnce(response({ ...atPier, currentLocationId: 'new-harbor' }, true));
    fireEvent.click(screen.getByRole('button', { name: /Back to New Harbor/ }));
    expect(
      await screen.findByRole('heading', { name: 'New Harbor', level: 3 }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/locations/navigate',
      expect.objectContaining({ body: JSON.stringify({ locationId: 'new-harbor' }) }),
    );
  });
  it('keeps confirmed pin state when the pin request fails', async () => {
    const atPier = {
      ...initial,
      currentLocationId: 'fishing-pier',
      discoveredLocationIds: ['new-harbor', 'harbor', 'fishing-pier'],
    };
    const { fetchMock } = setup(atPier);
    const pin = await screen.findByRole('button', { name: 'Pin location' });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { code: 'PIN_LIMIT_REACHED', message: 'Pin limit reached.' } }),
    } as Response);
    fireEvent.click(pin);
    expect(await screen.findByRole('alert')).toHaveTextContent('Pin limit reached.');
    expect(screen.getByRole('button', { name: 'Pin location' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByText('Pinned 0/5')).toBeInTheDocument();
  });
  it('uses quick navigation for a saved non-adjacent place', async () => {
    const known = {
      ...initial,
      discoveredLocationIds: ['new-harbor', 'harbor', 'fishing-pier'],
      pinnedLocationIds: ['fishing-pier'],
    };
    const { fetchMock, quickTravelDialog, onCloseQuickTravel } = setup(known);
    await screen.findByRole('button', { name: 'Refresh places' });
    openQuickTravel(quickTravelDialog.current);
    await waitFor(() =>
      expect(quickTravelDialog.current?.querySelectorAll('.quick-travel-route')).toHaveLength(1),
    );
    const shortcut = quickTravelDialog.current!.querySelector(
      '.quick-travel-route',
    ) as HTMLButtonElement;
    expect(shortcut).toHaveTextContent('Fishing Pier');
    fetchMock.mockResolvedValueOnce(
      response({ ...known, currentLocationId: 'fishing-pier' }, true),
    );
    fireEvent.click(shortcut);
    expect(await screen.findByText('Arrived at Fishing Pier.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/locations/quick-navigate',
      expect.objectContaining({ body: JSON.stringify({ locationId: 'fishing-pier' }) }),
    );
    expect(onCloseQuickTravel).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Fishing Pier', level: 3 })).toBeInTheDocument();
  });
  it('shows only pinned locations in Quick Travel and explains an empty list', async () => {
    const known = {
      ...initial,
      discoveredLocationIds: ['new-harbor', 'harbor', 'fishing-pier'],
      pinnedLocationIds: ['fishing-pier'],
    };
    const { quickTravelDialog } = setup(known);
    await screen.findByRole('button', { name: 'Refresh places' });
    openQuickTravel(quickTravelDialog.current);
    await waitFor(() =>
      expect(quickTravelDialog.current?.querySelectorAll('.quick-travel-route')).toHaveLength(1),
    );
    expect(quickTravelDialog.current).toHaveTextContent('Fishing Pier');
    expect(quickTravelDialog.current).not.toHaveTextContent('Other discovered');
    expect(quickTravelDialog.current).not.toHaveTextContent('Harbor District');
    cleanup();
    const empty = setup({ ...known, pinnedLocationIds: [] });
    await screen.findByRole('button', { name: 'Refresh places' });
    openQuickTravel(empty.quickTravelDialog.current);
    expect(empty.quickTravelDialog.current?.querySelectorAll('.quick-travel-route')).toHaveLength(
      0,
    );
    await waitFor(() =>
      expect(empty.quickTravelDialog.current).toHaveTextContent(
        'Enter a location and use Pin location',
      ),
    );
  });
  it('retains selection and confirmed location on rejection, then refreshes', async () => {
    const { fetchMock } = setup();
    await screen.findByText('Southwest waterfront');
    fireEvent.click(route());
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Use a connected city route.' } }),
    } as Response);
    fireEvent.click(screen.getByRole('button', { name: 'Enter Harbor District' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use a connected city route.');
    expect(route()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'New Harbor', level: 3 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh places' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
  it('keeps named routes usable when artwork fails', async () => {
    const { fetchMock, unmount } = setup();
    const map = await screen.findByRole('img');
    fireEvent.error(map);
    expect(screen.getByText(/The scene image is unavailable/)).toBeInTheDocument();
    expect(route()).toBeEnabled();
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
  });
  it('offers recovery when the initial city request fails', async () => {
    const { fetchMock } = setup();
    fetchMock.mockRejectedValueOnce(new Error('The city is unavailable.'));
    expect(await screen.findByRole('alert')).toHaveTextContent('The city is unavailable.');
    expect(screen.queryByRole('heading', { name: 'New Harbor', level: 3 })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh places' }));
    expect(
      await screen.findByRole('heading', { name: 'New Harbor', level: 3 }),
    ).toBeInTheDocument();
  });
});
