import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Character } from '../../server/character';
import type { FishingState } from '../../server/fishing';
import type { PublicWorldSnapshot } from '../../server/seaState';
import type { LocationDefinition, LocationState } from '../../server/locations';
import {
  districtOrientation,
  fishingPierArtwork,
  fishingStoreArtwork,
  locationArtwork,
} from './locationArtwork';
import { FishingPanel } from './FishingPanel';
import type { FishingSoundPreferences } from '../audio/fishingSoundPreferences';
import { FishBuyerPanel } from './FishBuyerPanel';
import { SceneryImage } from './SceneryImage';
import { PropertyRoom } from './PropertyRoom';
import type { RoomSummary } from '../../shared/roomTypes';

interface LocationsResponse {
  locationState: LocationState;
  character?: Character;
}
const ACTIVE_ROOM_STORAGE_KEY = 'frontier.activeRoomId';
async function request(
  path: string,
  signal: AbortSignal,
  body?: Record<string, unknown>,
): Promise<LocationsResponse> {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    signal,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? 'Locations could not be updated.');
  if (!payload.locationState?.locations)
    throw new Error('Locations could not load. Please try again.');
  return payload;
}
function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M8 3h8l-1 6 3 4H6l3-4-1-6ZM12 13v8" />
    </svg>
  );
}
function DestinationIcon({ kind }: { kind: LocationDefinition['kind'] }) {
  return (
    <svg
      className="route-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'place' ? (
        <>
          <path d="M12 21s7-5.5 7-12a7 7 0 1 0-14 0c0 6.5 7 12 7 12Z" />
          <circle cx="12" cy="9" r="2.5" />
        </>
      ) : (
        <>
          <path d="M3 20h18M5 20V8l7-5 7 5v12M9 20v-7h6v7" />
        </>
      )}
    </svg>
  );
}

export function LocationsPanel({
  character,
  busy,
  onBusy,
  onCharacter,
  onPinnedPlaces,
  quickTravelDialog,
  onCloseQuickTravel,
  refreshRevision = 0,
  worldState = null,
  onInventoryChange = () => {},
  onOpenPack,
  fishingSoundPreferences,
  adminAuthorized = false,
  modalOpen = false,
}: {
  character: Character | null;
  busy: boolean;
  onBusy: (value: boolean) => void;
  onCharacter: (character: Character) => void;
  onPinnedPlaces: (names: string[]) => void;
  quickTravelDialog: RefObject<HTMLDialogElement | null>;
  onCloseQuickTravel: () => void;
  refreshRevision?: number;
  worldState?: PublicWorldSnapshot | null;
  onInventoryChange?: () => void;
  onOpenPack?: (opener: HTMLButtonElement) => void;
  fishingSoundPreferences?: FishingSoundPreferences;
  adminAuthorized?: boolean;
  modalOpen?: boolean;
}) {
  const [state, setState] = useState<LocationState | null>(null);
  const [loading, setLoading] = useState(Boolean(character));
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [roomListLoadedAt, setRoomListLoadedAt] = useState<string | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() =>
    window.sessionStorage.getItem(ACTIVE_ROOM_STORAGE_KEY),
  );
  const [roomError, setRoomError] = useState('');
  const [fishingConditions, setFishingConditions] = useState<FishingState['conditions'] | null>(
    null,
  );
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const sceneViewport = useRef<HTMLElement>(null);
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(true);
  const callbacks = useRef({ onBusy, onCharacter, onPinnedPlaces });
  useEffect(() => {
    callbacks.current = { onBusy, onCharacter, onPinnedPlaces };
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  const locations = useMemo(
    () => new Map((state?.locations ?? []).map((location) => [location.id, location])),
    [state],
  );
  const characterId = character?.id;
  const current = state ? locations.get(state.currentLocationId) : undefined;
  useEffect(() => {
    if (activeRoomId) window.sessionStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, activeRoomId);
    else window.sessionStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
  }, [activeRoomId]);
  useEffect(() => {
    if (
      activeRoomId &&
      current &&
      roomListLoadedAt === current.id &&
      !rooms.some((room) => room.id === activeRoomId && room.locationId === current.id)
    )
      window.sessionStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
  }, [activeRoomId, current, roomListLoadedAt, rooms]);
  useEffect(() => {
    if (!characterId || !current?.id) return;
    const locationId = current.id;
    let live = true;
    void fetch('/api/rooms')
      .then((response) => response.json())
      .then((body) => {
        if (live) {
          setRooms(body.rooms ?? []);
          setRoomListLoadedAt(locationId);
        }
      })
      .catch(() => {
        if (live) setRoomError('Rooms could not load.');
      });
    return () => {
      live = false;
    };
  }, [characterId, current?.id]);
  const parent = current?.parentId ? locations.get(current.parentId) : undefined;
  const scene =
    current && locationArtwork[current.id] ? current : current?.kind === 'place' ? parent : current;
  const sceneConditions = worldState?.conditions ?? fishingConditions;
  let artwork = scene ? (locationArtwork[scene.id] ?? locationArtwork['new-harbor']) : undefined;
  if (scene?.id === 'fishing-pier' && sceneConditions) {
    artwork = fishingPierArtwork(sceneConditions.timeOfDay, sceneConditions.seaState);
  } else if (scene?.id === 'fishing-store' && worldState) {
    artwork = fishingStoreArtwork(worldState.conditions.timeOfDay);
  }
  useEffect(() => {
    const element = sceneViewport.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const resize = new ResizeObserver(([entry]) => {
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    resize.observe(element);
    return () => resize.disconnect();
  }, [artwork?.src]);
  const sceneScale =
    artwork && viewport.width && viewport.height
      ? Math.min(viewport.width / artwork.width, viewport.height / artwork.height)
      : 1;
  const sceneWidth = artwork ? artwork.width * sceneScale : 0;
  const sceneHeight = artwork ? artwork.height * sceneScale : 0;
  const sceneLeft = (viewport.width - sceneWidth) / 2;
  const sceneTop = (viewport.height - sceneHeight) / 2;
  const isOverviewFallback = Boolean(scene && !locationArtwork[scene.id]);
  const restoringRoom = Boolean(
    activeRoomId && current && roomListLoadedAt !== current.id && !roomError,
  );
  const disabled = busy || loading || Boolean(pending);
  const preview = (selectedId && locations.get(selectedId)) || current;
  const canEnter = Boolean(
    preview &&
    current &&
    preview.id !== current.id &&
    (current.parentId === preview.id || current.childLocationIds.includes(preview.id)),
  );
  const applyState = useCallback((next: LocationState) => {
    setState(next);
    callbacks.current.onPinnedPlaces(
      next.pinnedLocationIds
        .map((id) => next.locations.find((place) => place.id === id)?.name)
        .filter((name): name is string => Boolean(name)),
    );
  }, []);
  const load = useCallback(async () => {
    if (!characterId || locked.current) return;
    locked.current = true;
    setLoading(true);
    setError('');
    const abort = new AbortController();
    controller.current = abort;
    const timer = window.setTimeout(() => abort.abort(), 10000);
    try {
      const response = await request('/api/locations', abort.signal);
      if (mounted.current) applyState(response.locationState);
    } catch (cause) {
      if (mounted.current)
        setError(
          abort.signal.aborted
            ? 'The city is taking too long to respond. Refresh places to try again.'
            : cause instanceof Error
              ? cause.message
              : 'Locations could not load.',
        );
    } finally {
      window.clearTimeout(timer);
      locked.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [characterId, applyState]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function mutate(locationId: string, pin?: boolean) {
    if (disabled || locked.current || !state || !current) return;
    locked.current = true;
    const target = locations.get(locationId);
    const known = state.discoveredLocationIds.includes(locationId);
    const connected =
      current.parentId === locationId || current.childLocationIds.includes(locationId);
    const path = pin !== undefined ? 'pins' : connected ? 'navigate' : 'quick-navigate';
    setPending(pin !== undefined ? 'Saving pin…' : `Visiting ${target?.name ?? 'place'}…`);
    onBusy(true);
    setError('');
    setNotice('');
    const abort = new AbortController();
    controller.current = abort;
    const timer = window.setTimeout(() => abort.abort(), 10000);
    let uncertain = false;
    try {
      const result = await request(`/api/locations/${path}`, abort.signal, {
        locationId,
        ...(pin !== undefined ? { pinned: pin } : {}),
      });
      if (!mounted.current) return;
      applyState(result.locationState);
      if (result.character) callbacks.current.onCharacter(result.character);
      const firstVisit =
        pin === undefined &&
        !known &&
        result.locationState.discoveredLocationIds.includes(locationId);
      setNotice(
        pin !== undefined
          ? `${target?.name} ${pin ? 'pinned. Find it in your saved places.' : 'removed from your pins.'}`
          : firstVisit
            ? `Discovered ${target?.name}. Pin it to add it to Quick Travel.`
            : `Arrived at ${target?.name}.`,
      );
      if (pin === undefined) {
        setSelectedId(null);
        setHoveredId(null);
        if (quickTravelDialog.current?.open) onCloseQuickTravel();
        else heading.current?.focus();
      }
    } catch (cause) {
      uncertain = abort.signal.aborted;
      if (mounted.current)
        setError(
          uncertain
            ? 'The result could not be confirmed. Refreshing your location before another action.'
            : cause instanceof Error
              ? cause.message
              : 'The action could not be completed.',
        );
    } finally {
      window.clearTimeout(timer);
      locked.current = false;
      if (mounted.current) {
        setPending('');
        callbacks.current.onBusy(false);
        if (uncertain)
          window.setTimeout(() => {
            void load();
          }, 0);
      }
    }
  }

  function status(place: LocationDefinition) {
    return place.id === current?.id
      ? 'You are here'
      : state?.discoveredLocationIds.includes(place.id)
        ? 'Discovered'
        : 'Not yet visited';
  }
  if (!character)
    return (
      <section className="panel locations-panel" id="places" aria-labelledby="places-heading">
        <h2 id="places-heading">Explore New Harbor</h2>
        <p className="muted">Sign in to explore districts, discover places, and save favorites.</p>
      </section>
    );
  const routes =
    (current?.kind === 'place' ? [] : current?.childLocationIds)
      ?.map((id) => locations.get(id))
      .filter((place): place is LocationDefinition => Boolean(place && place.id !== current?.id)) ??
    [];
  const pinned = Boolean(current && state?.pinnedLocationIds.includes(current.id));
  const canPinCurrent = Boolean(
    current?.pinEligible && state?.discoveredLocationIds.includes(current.id),
  );
  const pinLimitReached = (state?.pinnedLocationIds.length ?? 0) >= 5;
  const fishingActive = current?.id === 'fishing-pier' && character.activeStatus === 'FISHING';
  const pinExplanation = !canPinCurrent
    ? current?.pinEligible
      ? 'Enter this location before pinning it.'
      : 'This location cannot be pinned.'
    : !pinned && pinLimitReached
      ? '5 locations pinned. Unpin one to add another.'
      : 'Save up to five locations for Quick Travel.';
  const worldNotices = (
    <div className="world-notices">
      <div className="world-notice-copy">
        <div className="places-feedback" role="status" aria-live="polite">
          {pending || notice}
        </div>
        {error && (
          <p className="places-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="places-section-heading">
        <button
          className="button secondary"
          disabled={disabled}
          onClick={() => void load()}
          aria-label="Refresh places"
        >
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>
    </div>
  );
  return (
    <section className="locations-panel" id="places" aria-labelledby="places-heading">
      <h2 id="places-heading" className="sr-only">
        New Harbor
      </h2>
      {!state && worldNotices}
      {loading && !state && (
        <div className="panel places-loading" role="status">
          <h3>Finding your place in New Harbor…</h3>
          <div aria-hidden="true" />
        </div>
      )}
      {state &&
        current &&
        scene &&
        artwork &&
        (activeRoomId &&
        rooms.some((room) => room.id === activeRoomId && room.locationId === current.id) ? (
          <PropertyRoom
            roomId={activeRoomId}
            characterId={character.id}
            timeOfDay={worldState?.conditions.timeOfDay ?? 'Day'}
            modalOpen={modalOpen}
            onBack={() => setActiveRoomId(null)}
            onInventoryChange={onInventoryChange}
            onBusy={onBusy}
          />
        ) : restoringRoom ? (
          <div className="panel places-loading" role="status">
            <h3>Returning to your plot…</h3>
            <div aria-hidden="true" />
          </div>
        ) : (
          <div className="location-atlas">
            <div className="world-stage">
              <header className="world-location-header">
                <h3 ref={heading} tabIndex={-1} aria-current="location">
                  {current.name}
                </h3>
                {parent && (
                  <button
                    className="button secondary location-back"
                    aria-label={`Back to ${parent.name}`}
                    aria-describedby={fishingActive ? 'leaving-pier-note' : undefined}
                    disabled={disabled}
                    onClick={() => void mutate(parent.id)}
                  >
                    <span aria-hidden="true">←</span> {parent.name}
                  </button>
                )}
                <div className="location-pin-controls">
                  <button
                    className="button secondary pin-location"
                    aria-label={pinned ? 'Unpin location' : 'Pin location'}
                    aria-describedby="current-pin-count current-pin-explanation"
                    aria-pressed={pinned}
                    disabled={disabled || (!pinned && (!canPinCurrent || pinLimitReached))}
                    onClick={() => void mutate(current.id, !pinned)}
                  >
                    <PinIcon /> {pinned ? 'Pinned' : 'Pin'}
                  </button>
                  <details className="location-pin-details">
                    <summary aria-label="Pin details" title="Pin limit and location details">
                      {state.pinnedLocationIds.length}/5
                    </summary>
                    <div className="location-pin-popover">
                      <span id="current-pin-count">Pinned {state.pinnedLocationIds.length}/5</span>
                      <p id="current-pin-explanation">{pinExplanation}</p>
                    </div>
                  </details>
                </div>
                {fishingActive && (
                  <p className="sr-only" id="leaving-pier-note">
                    Leaving the pier stops fishing.
                  </p>
                )}
              </header>
              <figure className="location-art" ref={sceneViewport}>
                <div
                  className="scene-stage"
                  style={{ width: sceneWidth, height: sceneHeight, left: sceneLeft, top: sceneTop }}
                >
                  {imageFailed !== artwork.src ? (
                    <>
                      <SceneryImage
                        src={artwork.src}
                        alt={artwork.alt}
                        onError={setImageFailed}
                        transitionGroup={current.id}
                        durationMs={
                          scene.id === 'fishing-pier' || scene.id === 'fishing-store' ? 1000 : 120
                        }
                      />
                      {!isOverviewFallback && artwork.hotspots.length > 0 && (
                        <div className="map-overlays" role="group" aria-label="Map destinations">
                          {artwork.hotspots.map((hotspot) => {
                            const place = locations.get(hotspot.locationId);
                            if (!place || !scene.childLocationIds.includes(place.id)) return null;
                            const previewed = hoveredId === place.id;
                            const selected = selectedId === place.id;
                            return (
                              <div key={place.id} className="hotspot-layer">
                                {hotspot.cutoutSrc && (
                                  <img
                                    className={`district-cutout${previewed ? ' is-previewed' : ''}${selected ? ' is-selected' : ''}`}
                                    src={hotspot.cutoutSrc}
                                    alt=""
                                    aria-hidden="true"
                                  />
                                )}
                                {hotspot.path && (
                                  <svg
                                    className="district-regions"
                                    viewBox={`0 0 ${artwork.width} ${artwork.height}`}
                                    preserveAspectRatio="none"
                                    aria-hidden="false"
                                  >
                                    <path
                                      d={hotspot.path}
                                      className={`district-region${previewed ? ' is-active' : ''}${selected ? ' is-selected' : ''}`}
                                      role="button"
                                      tabIndex={disabled ? -1 : 0}
                                      aria-label={`Select ${place.name} — ${status(place)}`}
                                      aria-pressed={selected}
                                      aria-disabled={disabled}
                                      onMouseEnter={() => setHoveredId(place.id)}
                                      onMouseLeave={() => setHoveredId(null)}
                                      onFocus={() => setHoveredId(place.id)}
                                      onBlur={() => setHoveredId(null)}
                                      onClick={() => !disabled && setSelectedId(place.id)}
                                      onKeyDown={(event) => {
                                        if (
                                          !disabled &&
                                          (event.key === 'Enter' || event.key === ' ')
                                        ) {
                                          event.preventDefault();
                                          setSelectedId(place.id);
                                        }
                                      }}
                                    />
                                  </svg>
                                )}
                                <button
                                  className={`map-label${previewed ? ' is-highlighted' : ''}`}
                                  style={{ left: `${hotspot.labelX}%`, top: `${hotspot.labelY}%` }}
                                  aria-label={`Select ${place.name} — ${status(place)}`}
                                  aria-pressed={selectedId === place.id}
                                  aria-current={place.id === current.id ? 'location' : undefined}
                                  disabled={disabled}
                                  onClick={() => setSelectedId(place.id)}
                                  onMouseEnter={() => setHoveredId(place.id)}
                                  onMouseLeave={() => setHoveredId(null)}
                                  onFocus={() => setHoveredId(place.id)}
                                  onBlur={() => setHoveredId(null)}
                                >
                                  {place.name}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="art-unavailable">
                      The scene image is unavailable. Select a named destination in the routes
                      panel.
                    </div>
                  )}
                </div>
              </figure>
              {worldNotices}
            </div>
            <aside
              className={`location-context${current.id === 'fishing-pier' ? ' has-fishing' : ''}${current.id === 'fishing-store' && !selectedId ? ' has-buyer' : ''}`}
              aria-label="Destination context"
            >
              <div className="location-body">
                {selectedId ? (
                  <div className="destination-summary is-preview">
                    <p className="eyebrow context-state">Selected destination · Preview</p>
                    <h4>{preview?.name}</h4>
                    <p className="context-description">{preview?.description}</p>
                  </div>
                ) : current.id !== 'fishing-pier' && current.id !== 'fishing-store' ? (
                  <p className="context-description current-description">{current.description}</p>
                ) : null}
                {current.id === 'fishing-pier' && !selectedId && character && (
                  <FishingPanel
                    worldState={worldState}
                    onCharacter={onCharacter}
                    onInventoryChange={onInventoryChange}
                    onOpenPack={onOpenPack}
                    soundPreferences={fishingSoundPreferences}
                    onConditions={setFishingConditions}
                    refreshRevision={refreshRevision}
                  />
                )}
                {current.id === 'fishing-store' && !selectedId && character && (
                  <FishBuyerPanel
                    onCharacter={onCharacter}
                    onInventoryChange={onInventoryChange}
                    onOpenPack={onOpenPack}
                    refreshRevision={refreshRevision}
                  />
                )}
                {!selectedId &&
                  rooms.map((room) => (
                    <button
                      key={room.id}
                      className="button primary"
                      disabled={disabled}
                      onClick={() => setActiveRoomId(room.id)}
                    >
                      Open {room.name}
                    </button>
                  ))}
                {!selectedId && adminAuthorized && import.meta.env.DEV && (
                  <button
                    className="button secondary"
                    disabled={disabled}
                    onClick={() => {
                      void fetch('/api/rooms/admin/fixture', { method: 'POST' })
                        .then(async (response) => {
                          const body = await response.json();
                          if (!response.ok)
                            throw new Error(body.error?.message ?? 'Fixture unavailable.');
                          setRooms((previous) =>
                            previous.some((room) => room.id === body.room.id)
                              ? previous
                              : [...previous, body.room],
                          );
                          onInventoryChange();
                          setActiveRoomId(body.room.id);
                          setRoomError('');
                        })
                        .catch((cause) =>
                          setRoomError(
                            cause instanceof Error ? cause.message : 'Fixture unavailable.',
                          ),
                        );
                    }}
                  >
                    Open development test room
                  </button>
                )}
                {roomError && (
                  <p className="places-error" role="alert">
                    {roomError}
                  </p>
                )}
                {preview?.id !== current.id && (
                  <p className="context-status">
                    {preview ? status(preview) : ''} · Your location is still {current.name}.
                  </p>
                )}
                {preview?.id !== current.id && canEnter && (
                  <button
                    className="button primary enter-destination"
                    disabled={disabled}
                    onClick={() => void mutate(preview!.id)}
                  >
                    {pending ? 'Entering…' : `Enter ${preview!.name}`}
                  </button>
                )}
                {preview?.id !== current.id && !canEnter && (
                  <div className="route-requirement">
                    <p>
                      Go back to {current.kind === 'place' ? parent?.name : 'a connected district'}{' '}
                      before entering this destination.
                    </p>
                  </div>
                )}
                {current.kind !== 'place' && (
                  <>
                    <div className="place-list-heading">
                      <h4>{current.kind === 'city' ? 'Districts & city zones' : 'Destinations'}</h4>
                      <span>{routes.length}</span>
                    </div>
                    <div className="place-card-grid">
                      {routes.map((place) => (
                        <button
                          key={place.id}
                          className={`place-card${selectedId === place.id ? ' is-selected' : ''}`}
                          aria-pressed={selectedId === place.id}
                          aria-current={place.id === current.id ? 'location' : undefined}
                          disabled={disabled}
                          onClick={() => setSelectedId(place.id)}
                          onMouseEnter={() => setHoveredId(place.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          onFocus={() => setHoveredId(place.id)}
                          onBlur={() => setHoveredId(null)}
                        >
                          <DestinationIcon kind={place.kind} />
                          <span className="place-card-copy">
                            <span className="place-card-title">
                              {place.name}
                              {place.kind === 'zone' ? ' · City zone' : ''}
                            </span>
                            <span className="place-card-description">
                              {districtOrientation[place.id] ?? place.description}
                            </span>
                          </span>
                          <span className="place-status">
                            {selectedId === place.id ? 'Selected' : status(place)}
                          </span>
                        </button>
                      ))}
                      {routes.length === 0 && (
                        <p className="muted small">No destinations here yet.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </aside>
          </div>
        ))}
      <dialog
        className="game-drawer quick-travel-drawer"
        ref={quickTravelDialog}
        aria-labelledby="quick-travel-heading"
        onCancel={(event) => {
          event.preventDefault();
          onCloseQuickTravel();
        }}
      >
        <button
          className="drawer-close"
          aria-label="Close Quick Travel"
          onClick={onCloseQuickTravel}
        >
          ×
        </button>
        <p className="eyebrow">New Harbor</p>
        <h2 id="quick-travel-heading" tabIndex={-1} data-drawer-heading>
          Quick Travel
        </h2>
        <p className="muted small">Return directly to your pinned locations.</p>
        {fishingActive && (
          <p className="quick-travel-consequence">Leaving the pier stops fishing.</p>
        )}
        {pending && <p role="status">{pending}</p>}
        {error && (
          <p className="quick-travel-error" role="alert">
            {error}
          </p>
        )}
        {!state && (
          <div className="quick-travel-empty">
            <p>{loading ? 'Loading your locations…' : 'Locations could not be loaded.'}</p>
            {!loading && (
              <button className="button secondary" onClick={() => void load()}>
                Refresh locations
              </button>
            )}
          </div>
        )}
        {state && current && (
          <>
            <div className="quick-travel-group">
              <h3>
                Pinned <span>{state.pinnedLocationIds.length}/5</span>
              </h3>
              {state.pinnedLocationIds.length ? (
                <ul className="quick-travel-list">
                  {state.pinnedLocationIds.map((id) => {
                    const place = locations.get(id);
                    return place ? (
                      <li key={id}>
                        <button
                          className="quick-travel-route"
                          aria-description={
                            fishingActive && id !== current.id
                              ? 'Leaving the pier stops fishing.'
                              : undefined
                          }
                          disabled={disabled || id === current.id}
                          onClick={() => void mutate(id)}
                        >
                          <span>{place.name}</span>
                          <small>{id === current.id ? 'You are here' : 'Travel ↗'}</small>
                        </button>
                        <button
                          className="quick-travel-unpin"
                          aria-label={`Unpin ${place.name}`}
                          disabled={disabled}
                          onClick={() => void mutate(id, false)}
                        >
                          ×
                        </button>
                      </li>
                    ) : null;
                  })}
                </ul>
              ) : (
                <p className="quick-travel-empty">
                  Enter a location and use Pin location to add it here.
                </p>
              )}
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
