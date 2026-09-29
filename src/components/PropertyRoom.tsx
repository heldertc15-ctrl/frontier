import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  isRotation,
  rotatedFootprint,
  validatePlacement,
  type Footprint,
  type Placement,
  type Rotation,
} from '../../shared/roomGeometry';
import type { RoomSnapshot } from '../../shared/roomTypes';
import type { TimeOfDay } from '../../server/fishingConfig';
import { RoomCanvas } from '../room/RoomCanvas';
import '../room/room.css';

type Draft = Placement & { action: 'place' | 'move' };
type Command = {
  action: 'place' | 'move' | 'remove' | 'build' | 'crop' | 'crop-remove';
  itemId?: string;
  bedItemId?: string;
  definitionId?: string;
  previousItemIds?: string[];
  x?: number;
  y?: number;
  rotation?: Rotation;
  expectedRevision: number;
  requestKey: string;
};
type ApiError = Error & { code?: string };
const pendingKey = (characterId: string, roomId: string) =>
  `frontier-room-pending:${characterId}:${roomId}`;

async function getJson<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error?.message ?? 'The room could not be updated.') as ApiError;
    error.code = result.error?.code;
    throw error;
  }
  return result as T;
}

function FootprintDiagram({ size }: { size?: Footprint }) {
  if (!size)
    return (
      <span className="room-item-diagram" aria-hidden="true">
        —
      </span>
    );
  const { width, depth } = size;
  const points = (x: number, y: number) => `${4 + (x - y + depth) * 10},${4 + (x + y) * 5}`;
  return (
    <span className="room-item-diagram" aria-hidden="true">
      <svg viewBox={`0 0 ${(width + depth) * 10 + 8} ${(width + depth) * 5 + 8}`} focusable="false">
        {Array.from({ length: width * depth }, (_, index) => {
          const x = index % width;
          const y = Math.floor(index / width);
          return (
            <polygon
              key={index}
              points={[points(x, y), points(x + 1, y), points(x + 1, y + 1), points(x, y + 1)].join(
                ' ',
              )}
            />
          );
        })}
      </svg>
    </span>
  );
}

export function PropertyRoom({
  roomId,
  characterId,
  timeOfDay,
  modalOpen,
  onBack,
  onInventoryChange,
  onBusy = () => {},
}: {
  roomId: string;
  characterId: string;
  timeOfDay: TimeOfDay;
  modalOpen: boolean;
  onBack: () => void;
  onInventoryChange: () => void;
  onBusy?: (value: boolean) => void;
}) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [buildOpen, setBuildOpen] = useState(false);
  const [pending, setPending] = useState<Command | null>(null);
  const [status, setStatus] = useState('Loading room…');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const lock = useRef(false);
  const mounted = useRef(true);
  const latestRevision = useRef(-1);
  const controls = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const inventoryChange = useRef(onInventoryChange);
  const busyChange = useRef(onBusy);
  useEffect(() => {
    inventoryChange.current = onInventoryChange;
  }, [onInventoryChange]);
  useEffect(() => {
    busyChange.current = onBusy;
  }, [onBusy]);
  const fixture = useRef<Command | null>(null);
  const read = useCallback(async () => {
    setLoading(true);
    setStatus(latestRevision.current < 0 ? 'Loading room…' : 'Refreshing room…');
    try {
      const result = await getJson<RoomSnapshot>(`/api/rooms/${roomId}`);
      if (mounted.current && result.room.revision >= latestRevision.current) {
        latestRevision.current = result.room.revision;
        setSnapshot(result);
        setError('');
        setStatus('Room ready.');
      }
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : 'The room is unavailable.');
        setStatus('Room unavailable.');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [roomId]);
  const submit = useCallback(
    async (command: Command) => {
      if (lock.current) return;
      lock.current = true;
      busyChange.current(true);
      setPending(command);
      setStatus(
        command.action === 'remove'
          ? 'Returning furniture…'
          : command.action === 'crop' || command.action === 'crop-remove'
            ? 'Saving crop placement…'
            : command.action === 'build'
              ? 'Building furniture…'
              : 'Saving placement…',
      );
      setError('');
      sessionStorage.setItem(pendingKey(characterId, roomId), JSON.stringify(command));
      const abort = new AbortController();
      const timeout = window.setTimeout(() => abort.abort(), 10000);
      try {
        const { action, previousItemIds, ...body } = command;
        const result = await getJson<RoomSnapshot>(
          `/api/rooms/${roomId}/${action}`,
          body,
          abort.signal,
        );
        if (!mounted.current) return;
        if (result.room.revision >= latestRevision.current) {
          latestRevision.current = result.room.revision;
          setSnapshot(result);
        }
        sessionStorage.removeItem(pendingKey(characterId, roomId));
        fixture.current = null;
        setDraft(null);
        setSelectedId(
          ['remove', 'crop', 'crop-remove'].includes(command.action)
            ? null
            : (command.itemId ?? null),
        );
        setPending(null);
        const builtItem =
          command.action === 'build'
            ? result.carriedInventory.items.find(
                (item) => !command.previousItemIds?.includes(item.instanceId),
              )
            : undefined;
        if (builtItem) {
          if (result.cropCatalog?.some((crop) => crop.id === builtItem.definitionId)) {
            setSelectedId(builtItem.instanceId);
          }
          setDraft({ action: 'place', itemId: builtItem.instanceId, x: 0, y: 0, rotation: 0 });
        }
        setStatus(
          command.action === 'remove'
            ? 'Furniture returned to inventory.'
            : command.action === 'crop'
              ? 'Crop planted in the bed.'
              : command.action === 'crop-remove'
                ? 'Crop returned to inventory.'
                : command.action === 'build'
                  ? builtItem
                    ? 'New item ready. Choose a tile to place.'
                    : 'Furniture added to inventory.'
                  : 'Furniture saved.',
        );
        if (command.action === 'build') setBuildOpen(false);
        inventoryChange.current();
        busyChange.current(false);
      } catch (cause) {
        if (!mounted.current) return;
        const failure = cause as ApiError;
        if (failure.code) {
          sessionStorage.removeItem(pendingKey(characterId, roomId));
          fixture.current = null;
          setPending(null);
          busyChange.current(false);
          setError(failure.message);
          if (failure.code === 'ROOM_CHANGED') {
            setStatus('Room changed. Refreshing…');
            void read();
          } else if (failure.code === 'ROOM_UNAVAILABLE' || failure.code === 'ITEM_NOT_AVAILABLE') {
            setDraft(null);
            setStatus('Placement unavailable.');
            void read();
          } else
            setStatus(
              command.action === 'build'
                ? 'Could not build this item.'
                : command.action === 'remove'
                  ? 'Could not return this furniture.'
                  : 'Adjust the highlighted footprint and try again.',
            );
        } else {
          setStatus('Save not confirmed. Retry to check your placement.');
          setError('Connection interrupted.');
        }
      } finally {
        window.clearTimeout(timeout);
        lock.current = false;
      }
    },
    [characterId, roomId, read],
  );
  useEffect(() => {
    mounted.current = true;
    const saved = sessionStorage.getItem(pendingKey(characterId, roomId));
    if (saved) {
      try {
        const command = JSON.parse(saved) as Command;
        if (
          command &&
          ((['place', 'move'].includes(command.action) &&
            typeof command.itemId === 'string' &&
            isRotation(command.rotation)) ||
            (command.action === 'remove' && typeof command.itemId === 'string') ||
            (command.action === 'build' && typeof command.definitionId === 'string') ||
            (command.action === 'crop' &&
              typeof command.itemId === 'string' &&
              typeof command.bedItemId === 'string' &&
              Number.isSafeInteger(command.x) &&
              Number.isSafeInteger(command.y)) ||
            (command.action === 'crop-remove' && typeof command.itemId === 'string'))
        )
          fixture.current = command;
      } catch {
        sessionStorage.removeItem(pendingKey(characterId, roomId));
      }
    }
    const start = window.setTimeout(() => {
      void read().then(() => {
        if (fixture.current) void submit(fixture.current);
      });
    }, 0);
    const refresh = () => {
      if (document.visibilityState === 'visible' && !fixture.current) void read();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      mounted.current = false;
      busyChange.current(false);
      window.clearTimeout(start);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [characterId, roomId, read, submit]);
  const definition = useMemo(
    () =>
      new Map(
        [
          ...(snapshot?.definitions ?? []),
          ...(snapshot?.cropCatalog ?? []).map((crop) => ({
            id: crop.id,
            name: crop.name,
            width: crop.width,
            depth: crop.depth,
            artworkKey: crop.artworkKey,
          })),
        ].map((entry) => [entry.id, entry]),
      ),
    [snapshot],
  );
  const itemType = useMemo(
    () =>
      new Map(
        [...(snapshot?.carriedInventory.items ?? []), ...(snapshot?.placedItems ?? [])].map(
          (item) => [item.instanceId, item.definitionId],
        ),
      ),
    [snapshot],
  );
  const placement = draft
    ? { itemId: draft.itemId, x: draft.x, y: draft.y, rotation: draft.rotation }
    : null;
  const draftDefinition = definition.get(itemType.get(draft?.itemId ?? '') ?? '');
  const draftIsCrop = Boolean(
    draftDefinition && snapshot?.cropCatalog?.some((crop) => crop.id === draftDefinition.id),
  );
  const cropBedForDraft =
    draft && snapshot && draftIsCrop
      ? snapshot.placements.find((placed) => {
          const size = definition.get(itemType.get(placed.itemId) ?? '');
          return (
            size?.artworkKey === 'temporary_farm_bed' &&
            draft.x >= placed.x &&
            draft.x < placed.x + 2 &&
            draft.y >= placed.y &&
            draft.y < placed.y + 2
          );
        })
      : undefined;
  const issue =
    draft && snapshot
      ? draftIsCrop
        ? draft.x < 0 ||
          draft.y < 0 ||
          draft.x >= snapshot.room.width ||
          draft.y >= snapshot.room.depth
          ? 'OUT_OF_BOUNDS'
          : !cropBedForDraft
            ? 'VALIDATION_ERROR'
            : (snapshot.crops ?? []).some(
                  (crop) =>
                    crop.bedItemId === cropBedForDraft.itemId &&
                    crop.x === draft.x - cropBedForDraft.x &&
                    crop.y === draft.y - cropBedForDraft.y,
                )
              ? 'SPACE_OCCUPIED'
              : null
        : validatePlacement(
            snapshot.room,
            draft,
            draftDefinition ?? { width: 0, depth: 0 },
            snapshot.placements.flatMap((item) => {
              const size = definition.get(itemType.get(item.itemId) ?? '');
              return size ? [{ placement: item, size }] : [];
            }),
            draft.action === 'move' ? draft.itemId : undefined,
          )
      : null;
  const reason =
    draftIsCrop && issue === 'VALIDATION_ERROR'
      ? 'Hover a farming-bed square.'
      : draftIsCrop && issue === 'SPACE_OCCUPIED'
        ? 'That bed square already has a tomato plant.'
        : issue === 'OUT_OF_BOUNDS'
          ? 'Footprint extends beyond the room.'
          : issue === 'SPACE_OCCUPIED'
            ? 'Another piece occupies this space.'
            : issue
              ? 'This footprint cannot be placed here.'
              : 'Ready to place.';
  const draftItem = draft
    ? snapshot?.carriedInventory.items
        .concat(snapshot.placedItems)
        .find((item) => item.instanceId === draft.itemId)
    : null;
  const draftSize = draftItem ? definition.get(draftItem.definitionId) : null;
  const footprint = draft && draftSize ? rotatedFootprint(draftSize, draft.rotation) : null;
  const selectedItem = snapshot?.placedItems.find((item) => item.instanceId === selectedId);
  const selectedPlacement = snapshot?.placements.find((item) => item.itemId === selectedId);
  const carried =
    snapshot?.carriedInventory.items.filter((item) => definition.has(item.definitionId)) ?? [];
  const updateDraft = (candidate: Draft) => {
    setDraft(candidate);
    setError('');
  };
  const pick = (itemId: string, action: 'place' | 'move') => {
    if (!snapshot || pending || modalOpen) return;
    const original = snapshot.placements.find((entry) => entry.itemId === itemId);
    updateDraft({
      itemId,
      x: original?.x ?? 0,
      y: original?.y ?? 0,
      rotation: original?.rotation ?? 0,
      action,
    });
    setSelectedId(itemId);
    setError('');
    setStatus(action === 'place' ? 'Choose a tile to place the item.' : 'Choose a new position.');
    controls.current?.focus({ preventScroll: true });
    if (window.innerWidth <= 760)
      window.requestAnimationFrame(() => world.current?.scrollIntoView?.({ block: 'start' }));
    else controls.current?.scrollIntoView?.({ block: 'nearest' });
  };
  const commit = (candidate: Draft) => {
    if (!snapshot || pending || modalOpen || issue) return;
    if (draftIsCrop) {
      const bed = snapshot.placements.find((placed) => {
        const size = definition.get(itemType.get(placed.itemId) ?? '');
        return (
          size?.artworkKey === 'temporary_farm_bed' &&
          candidate.x >= placed.x &&
          candidate.x < placed.x + 2 &&
          candidate.y >= placed.y &&
          candidate.y < placed.y + 2
        );
      });
      if (!bed) return;
      const command: Command = {
        action: 'crop',
        itemId: candidate.itemId,
        bedItemId: bed.itemId,
        x: candidate.x - bed.x,
        y: candidate.y - bed.y,
        expectedRevision: snapshot.room.revision,
        requestKey: crypto.randomUUID(),
      };
      fixture.current = command;
      void submit(command);
      return;
    }
    const command: Command = {
      ...candidate,
      expectedRevision: snapshot.room.revision,
      requestKey: crypto.randomUUID(),
    };
    fixture.current = command;
    void submit(command);
  };
  const floor = (cell: { x: number; y: number }, touch: boolean) => {
    if (!draft || pending || modalOpen) return;
    const candidate = { ...draft, ...cell };
    updateDraft(candidate);
    if (!touch && snapshot) {
      const size = definition.get(itemType.get(draft.itemId) ?? '');
      const existing = snapshot.placements.flatMap((item) => {
        const footprint = definition.get(itemType.get(item.itemId) ?? '');
        if (draftIsCrop && footprint?.artworkKey === 'temporary_farm_bed') return [];
        return footprint ? [{ placement: item, size: footprint }] : [];
      });
      const bedAtCell = snapshot.placements.find((placed) => {
        const bed = definition.get(itemType.get(placed.itemId) ?? '');
        return (
          bed?.artworkKey === 'temporary_farm_bed' &&
          candidate.x >= placed.x &&
          candidate.x < placed.x + 2 &&
          candidate.y >= placed.y &&
          candidate.y < placed.y + 2
        );
      });
      const occupiedCrop =
        draftIsCrop &&
        bedAtCell &&
        (snapshot.crops ?? []).some(
          (crop) =>
            crop.bedItemId === bedAtCell.itemId &&
            crop.x === candidate.x - bedAtCell.x &&
            crop.y === candidate.y - bedAtCell.y,
        );
      const problem =
        draftIsCrop && !bedAtCell
          ? 'VALIDATION_ERROR'
          : occupiedCrop
            ? 'SPACE_OCCUPIED'
            : size
              ? validatePlacement(
                  snapshot.room,
                  candidate,
                  size,
                  existing,
                  draft.action === 'move' ? draft.itemId : undefined,
                )
              : 'VALIDATION_ERROR';
      if (problem) {
        setError(
          problem === 'SPACE_OCCUPIED'
            ? 'That bed square is already planted.'
            : draftIsCrop
              ? 'Move the tomato plant onto a farming bed square.'
              : 'Footprint extends beyond the room.',
        );
        return;
      }
      if (draftIsCrop && bedAtCell) {
        const command: Command = {
          action: 'crop',
          itemId: candidate.itemId,
          bedItemId: bedAtCell.itemId,
          x: candidate.x - bedAtCell.x,
          y: candidate.y - bedAtCell.y,
          expectedRevision: snapshot.room.revision,
          requestKey: crypto.randomUUID(),
        };
        fixture.current = command;
        void submit(command);
        return;
      }
      const command: Command = {
        ...candidate,
        expectedRevision: snapshot.room.revision,
        requestKey: crypto.randomUUID(),
      };
      fixture.current = command;
      void submit(command);
    }
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!draft || modalOpen || pending || event.target instanceof HTMLInputElement) return;
    const shifts: Record<string, [number, number]> = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowDown: [0, 1],
      ArrowUp: [0, -1],
    };
    if (event.key in shifts) {
      event.preventDefault();
      const [x, y] = shifts[event.key];
      updateDraft({ ...draft, x: draft.x + x, y: draft.y + y });
    } else if (event.key.toLowerCase() === 'r' && !draftIsCrop) {
      event.preventDefault();
      updateDraft({ ...draft, rotation: ((draft.rotation + 90) % 360) as Rotation });
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setDraft(null);
      setStatus('Placement canceled.');
    } else if (event.key === 'Enter' && event.target === controls.current) {
      event.preventDefault();
      commit(draft);
    }
  };
  const nudge = (x: number, y: number) => {
    if (draft && !pending && !modalOpen) updateDraft({ ...draft, x: draft.x + x, y: draft.y + y });
  };
  return (
    <div className="location-atlas property-room" onKeyDown={keyDown}>
      <div className="world-stage" ref={world}>
        <header className="world-location-header">
          <h3>{snapshot?.room.name ?? 'Property room'}</h3>
          <button className="button secondary" disabled={Boolean(pending)} onClick={onBack}>
            ← Back to location
          </button>
        </header>
        {snapshot ? (
          <RoomCanvas
            snapshot={snapshot}
            timeOfDay={timeOfDay}
            draft={placement}
            selectedId={selectedId}
            invalid={Boolean(issue)}
            suspended={modalOpen || Boolean(pending)}
            onHover={(cell) => {
              if (
                cell &&
                draft &&
                !modalOpen &&
                !pending &&
                (cell.x !== draft.x || cell.y !== draft.y)
              )
                updateDraft({ ...draft, ...cell });
            }}
            onFloor={floor}
            onSelect={(id) => {
              setSelectedId(id);
              setStatus(id ? 'Furniture selected. Choose Move to edit it.' : 'Selection cleared.');
            }}
          />
        ) : (
          <div className="room-loading" role="status">
            <strong>{error ? 'Room unavailable' : 'Opening room'}</strong>
            <span>{error || 'Loading the saved layout and furniture…'}</span>
            {error && (
              <button className="button secondary" onClick={() => void read()}>
                Retry opening room
              </button>
            )}
          </div>
        )}
        {draft && (
          <div className="room-mobile-toolbar" aria-label="Touch placement controls">
            <span className={issue ? 'room-invalid' : 'room-valid'}>
              {issue ? reason : `Ready at cell ${draft.x}, ${draft.y}`}
            </span>
            <div>
              {!draftIsCrop && (
                <button
                  className="button secondary"
                  disabled={Boolean(pending)}
                  onClick={() =>
                    updateDraft({ ...draft, rotation: ((draft.rotation + 90) % 360) as Rotation })
                  }
                >
                  <span aria-hidden="true">↻</span> Rotate
                </button>
              )}
              <button
                className="button primary"
                aria-label={
                  draftIsCrop
                    ? 'Plant tomato at selected square'
                    : draft.action === 'place'
                      ? 'Place at tile'
                      : 'Save move at tile'
                }
                disabled={Boolean(issue) || Boolean(pending)}
                onClick={() => commit(draft)}
              >
                {draftIsCrop ? 'Plant tomato' : draft.action === 'place' ? 'Place' : 'Save move'}
              </button>
              <button
                className="button secondary"
                aria-label="Cancel preview"
                disabled={Boolean(pending)}
                onClick={() => {
                  setDraft(null);
                  setStatus('Placement canceled.');
                  setError('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <div className="world-notices room-feedback" role="status" aria-live="polite">
          <span>{status}</span>
          {error && (
            <p className="places-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
      <aside className="location-context room-context" aria-label="Room controls">
        <div
          className="location-body"
          ref={controls}
          tabIndex={0}
          aria-label="Room placement controls"
          aria-keyshortcuts={
            draftIsCrop
              ? 'ArrowUp ArrowDown ArrowLeft ArrowRight Enter Escape'
              : 'ArrowUp ArrowDown ArrowLeft ArrowRight R Enter Escape'
          }
        >
          <p className="eyebrow">Room layout</p>
          <h4>Arrange furniture</h4>
          <p className="room-intro">
            {draft
              ? draftIsCrop
                ? 'Move the tomato ghost onto an open bed square, then plant it.'
                : 'Click a clear tile to place. On touch, tap a tile, then Place.'
              : 'Choose from your inventory, or select furniture in the room to move it.'}
          </p>
          {draft && (
            <section className="room-draft" aria-label="Placement preview">
              <div className="room-draft-heading">
                <div>
                  <span className="room-kicker">
                    {draft.action === 'place' ? 'New placement' : 'Moving furniture'}
                  </span>
                  <h5>{draftItem?.name ?? 'Furniture'}</h5>
                </div>
                <span className="room-footprint-size">
                  {footprint
                    ? `${footprint.width} × ${footprint.depth} tiles`
                    : 'Footprint unavailable'}
                </span>
              </div>
              <div className="room-draft-metrics">
                <span>
                  Cell {draft.x}, {draft.y}
                </span>
                {!draftIsCrop && <span>Facing {draft.rotation}°</span>}
              </div>
              <p id="room-placement-reason" className={issue ? 'room-invalid' : 'room-valid'}>
                <span aria-hidden="true">{issue ? '✕' : '✓'}</span> {reason}
              </p>
              <div className="room-nudge-row">
                <span>One tile</span>
                <div className="room-nudge-controls" aria-label="Nudge preview">
                  <button
                    className="button secondary"
                    aria-label="Move preview northwest"
                    disabled={Boolean(pending)}
                    onClick={() => nudge(-1, 0)}
                  >
                    ↖
                  </button>
                  <button
                    className="button secondary"
                    aria-label="Move preview northeast"
                    disabled={Boolean(pending)}
                    onClick={() => nudge(0, -1)}
                  >
                    ↗
                  </button>
                  <button
                    className="button secondary"
                    aria-label="Move preview southwest"
                    disabled={Boolean(pending)}
                    onClick={() => nudge(0, 1)}
                  >
                    ↙
                  </button>
                  <button
                    className="button secondary"
                    aria-label="Move preview southeast"
                    disabled={Boolean(pending)}
                    onClick={() => nudge(1, 0)}
                  >
                    ↘
                  </button>
                </div>
              </div>
              <div className="room-actions">
                {!draftIsCrop && (
                  <button
                    className="button secondary room-rotate"
                    disabled={Boolean(pending)}
                    onClick={() =>
                      updateDraft({ ...draft, rotation: ((draft.rotation + 90) % 360) as Rotation })
                    }
                  >
                    ↻ Rotate 90°
                  </button>
                )}
                <button
                  className="button primary room-place"
                  disabled={Boolean(issue) || Boolean(pending)}
                  aria-describedby="room-placement-reason"
                  onClick={() => commit(draft)}
                >
                  {draftIsCrop
                    ? 'Plant tomato'
                    : draft.action === 'place'
                      ? 'Place furniture'
                      : 'Save move'}
                </button>
                <button
                  className="button secondary room-cancel"
                  disabled={Boolean(pending)}
                  onClick={() => {
                    setDraft(null);
                    setStatus('Placement canceled.');
                    setError('');
                  }}
                >
                  Cancel
                </button>
              </div>
              <div className="room-keyboard-hint" aria-label="Keyboard shortcuts">
                <span>
                  <kbd>Arrows</kbd> Move
                </span>
                {!draftIsCrop && (
                  <span>
                    <kbd>R</kbd> Rotate
                  </span>
                )}
                <span>
                  <kbd>Enter</kbd> Place
                </span>
                <span>
                  <kbd>Esc</kbd> Cancel
                </span>
              </div>
            </section>
          )}
          {pending && (
            <div className="room-pending" role="status">
              <strong>{status.endsWith('…') ? status : 'Save not confirmed'}</strong>
              <p>
                {status.endsWith('…')
                  ? 'Your furniture will update once the save is confirmed.'
                  : 'This room action is waiting for confirmation. Retry to check its result.'}
              </p>
              {!status.endsWith('…') && (
                <button className="button secondary" onClick={() => void submit(pending)}>
                  Retry same action
                </button>
              )}
            </div>
          )}
          {snapshot && (
            <>
              {selectedItem && !draft && (
                <div className="room-selected">
                  <span className="room-kicker">Selected in room</span>
                  <div className="room-selected-summary">
                    <FootprintDiagram
                      size={
                        selectedPlacement && definition.get(selectedItem.definitionId)
                          ? rotatedFootprint(
                              definition.get(selectedItem.definitionId)!,
                              selectedPlacement.rotation,
                            )
                          : undefined
                      }
                    />
                    <div>
                      <strong>{selectedItem.name}</strong>
                      <span>
                        Cell {selectedPlacement?.x}, {selectedPlacement?.y} ·{' '}
                        {selectedPlacement?.rotation}°
                      </span>
                    </div>
                  </div>
                  <button
                    className="button primary"
                    disabled={Boolean(pending)}
                    onClick={() => pick(selectedItem.instanceId, 'move')}
                  >
                    Move selected furniture
                  </button>
                  <button
                    className="button secondary"
                    disabled={Boolean(pending)}
                    onClick={() => {
                      if (!snapshot || pending) return;
                      void submit({
                        action: 'remove',
                        itemId: selectedItem.instanceId,
                        expectedRevision: snapshot.room.revision,
                        requestKey: crypto.randomUUID(),
                      });
                    }}
                  >
                    Return to inventory
                  </button>
                </div>
              )}
              {snapshot.buildCatalog?.length || snapshot.cropCatalog?.length ? (
                <>
                  <button
                    className="button primary room-build-toggle"
                    aria-expanded={buildOpen}
                    aria-controls="room-build-menu"
                    disabled={Boolean(pending)}
                    onClick={() => setBuildOpen((open) => !open)}
                  >
                    {buildOpen ? 'Close Build menu' : 'Build'}
                  </button>
                  {buildOpen && (
                    <section
                      id="room-build-menu"
                      className="room-item-list room-build-menu"
                      aria-label="Build furniture"
                    >
                      <h5>
                        Build test items{' '}
                        <span>
                          {(snapshot.buildCatalog?.length ?? 0) +
                            (snapshot.cropCatalog?.length ?? 0)}
                        </span>
                      </h5>
                      <p className="room-build-note">
                        Add a test item to your inventory, then select it to place.
                      </p>
                      {(snapshot.buildCatalog ?? []).map((item) => (
                        <div key={item.id} className="room-build-item">
                          <FootprintDiagram size={item} />
                          <span className="room-item-copy">
                            <strong>{item.name}</strong>
                            <small>
                              {item.width} × {item.depth} tiles
                            </small>
                          </span>
                          <button
                            className="button secondary"
                            disabled={Boolean(pending)}
                            onClick={() => {
                              if (!snapshot || pending) return;
                              void submit({
                                action: 'build',
                                definitionId: item.id,
                                previousItemIds: snapshot.carriedInventory.items.map(
                                  (carriedItem) => carriedItem.instanceId,
                                ),
                                expectedRevision: snapshot.room.revision,
                                requestKey: crypto.randomUUID(),
                              });
                            }}
                          >
                            Add
                          </button>
                        </div>
                      ))}
                      {(snapshot.cropCatalog ?? []).map((crop) => (
                        <div key={crop.id} className="room-build-item">
                          <span className="room-item-diagram" aria-hidden="true">
                            🍅
                          </span>
                          <span className="room-item-copy">
                            <strong>{crop.name}</strong>
                            <small>1 × 1 · fixed orientation</small>
                          </span>
                          <button
                            className="button secondary"
                            disabled={Boolean(pending)}
                            onClick={() => {
                              if (!snapshot || pending) return;
                              void submit({
                                action: 'build',
                                definitionId: crop.id,
                                previousItemIds: snapshot.carriedInventory.items.map(
                                  (carriedItem) => carriedItem.instanceId,
                                ),
                                expectedRevision: snapshot.room.revision,
                                requestKey: crypto.randomUUID(),
                              });
                            }}
                          >
                            Add
                          </button>
                        </div>
                      ))}
                    </section>
                  )}
                </>
              ) : null}
              <section className="room-item-list" aria-label="Inventory items">
                <h5>
                  In your inventory <span>{carried.length}</span>
                </h5>
                {carried.map((item) => (
                  <button
                    key={item.instanceId}
                    className="button secondary room-item"
                    aria-pressed={draft?.itemId === item.instanceId}
                    disabled={Boolean(pending)}
                    onClick={() => pick(item.instanceId, 'place')}
                  >
                    <FootprintDiagram size={definition.get(item.definitionId)} />
                    <span className="room-item-copy">
                      <strong>{item.name}</strong>
                      <small>
                        {definition.get(item.definitionId)?.width} ×{' '}
                        {definition.get(item.definitionId)?.depth} tiles
                      </small>
                    </span>
                    <span className="room-item-check" aria-hidden="true">
                      {draft?.itemId === item.instanceId ? '✓' : '+'}
                    </span>
                  </button>
                ))}
                {!carried.length && (
                  <p className="muted">
                    No placeable items in your inventory. Select a placed piece to rearrange it.
                  </p>
                )}
              </section>
              {(snapshot.crops ?? []).length > 0 && (
                <section className="room-item-list" aria-label="Crops in farming beds">
                  <h5>
                    Planted crops <span>{snapshot.crops!.length}</span>
                  </h5>
                  {(snapshot.crops ?? []).map((crop) => {
                    const item = snapshot.placedItems.find(
                      (placed) => placed.instanceId === crop.bedItemId,
                    );
                    const cropName = crop.name;
                    return (
                      <div key={crop.itemId} className="room-build-item">
                        <span className="room-item-copy">
                          <strong>{cropName}</strong>
                          <small>
                            {item?.name ?? 'Farming bed'} ·{' '}
                            {crop.width === 2
                              ? 'full bed, centered'
                              : `square ${crop.x + 1}, ${crop.y + 1}`}
                          </small>
                        </span>
                        <button
                          className="button secondary"
                          disabled={Boolean(pending)}
                          onClick={() =>
                            void submit({
                              action: 'crop-remove',
                              itemId: crop.itemId,
                              expectedRevision: snapshot.room.revision,
                              requestKey: crypto.randomUUID(),
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </section>
              )}
              <section className="room-item-list" aria-label="Placed furniture">
                <h5>
                  In this room <span>{snapshot.placedItems.length}</span>
                </h5>
                {snapshot.placedItems.map((item) => {
                  const position = snapshot.placements.find(
                    (entry) => entry.itemId === item.instanceId,
                  );
                  const size = definition.get(item.definitionId);
                  return (
                    <button
                      key={item.instanceId}
                      className="button secondary room-item"
                      aria-pressed={selectedId === item.instanceId}
                      disabled={Boolean(pending)}
                      onClick={() => {
                        setSelectedId(item.instanceId);
                        setCropSelectedId(null);
                        setStatus('Furniture selected. Choose Move to edit it.');
                      }}
                    >
                      <FootprintDiagram
                        size={size && position ? rotatedFootprint(size, position.rotation) : size}
                      />
                      <span className="room-item-copy">
                        <strong>{item.name}</strong>
                        <small>
                          {position
                            ? `Cell ${position.x}, ${position.y} · ${position.rotation}°`
                            : 'Saved in room'}
                        </small>
                      </span>
                      <span className="room-item-check" aria-hidden="true">
                        {selectedId === item.instanceId ? '✓' : '›'}
                      </span>
                    </button>
                  );
                })}
                {!snapshot.placedItems.length && (
                  <p className="muted">Nothing placed yet. Choose a carried piece above.</p>
                )}
              </section>
              <button
                className="button secondary room-refresh"
                disabled={Boolean(pending) || loading}
                onClick={() => void read()}
              >
                {loading ? 'Refreshing…' : 'Refresh room'}
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
