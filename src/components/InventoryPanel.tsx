import { useEffect, useRef, useState } from 'react';
import type { Character } from '../../server/character';
import type { InventoryItem, InventoryState } from '../../server/inventory';
import { lockerSlotCount } from '../../server/inventoryLayout';
import type { FishSpecimen } from '../../server/fishSpecimens';
import { formatFishWeightKg } from '../../server/fishWeightFormat';
import { TrophyBadge } from './TrophyBadge';
import { InventoryItemDetails } from './InventoryItemDetails';
import '../inventory-refinement.css';

type Action = 'use' | 'equip' | 'unequip' | 'transfer';
type Reply = { inventory: InventoryState; character?: Character; moved?: number };
type ItemLocation = InventoryItem['location'];
type DragState = {
  id: string;
  location: ItemLocation;
  targetLocation: ItemLocation | null;
  targetId: string | null;
  emptyIndex: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
};

function arrangedSlots(items: InventoryItem[], capacity: number): Array<InventoryItem | null> {
  const slots: Array<InventoryItem | null> = Array(Math.max(capacity, items.length)).fill(null);
  const placed = new Set<string>();
  for (const item of items) {
    if (
      item.slotIndex === undefined ||
      item.slotIndex < 0 ||
      item.slotIndex >= slots.length ||
      slots[item.slotIndex]
    )
      continue;
    slots[item.slotIndex] = item;
    placed.add(item.instanceId);
  }
  for (const item of items) {
    if (placed.has(item.instanceId)) continue;
    slots[slots.findIndex((slot) => !slot)] = item;
  }
  return slots;
}

function movedItems(
  items: InventoryItem[],
  capacity: number,
  sourceId: string,
  targetId: string | null,
  emptyIndex: number | null,
) {
  const slots = arrangedSlots(items, capacity);
  const source = slots.findIndex((item) => item?.instanceId === sourceId);
  const target =
    targetId === null ? emptyIndex : slots.findIndex((item) => item?.instanceId === targetId);
  if (source < 0 || target === null || target < 0 || source === target) return null;
  [slots[source], slots[target]] = [slots[target], slots[source]];
  return slots.flatMap((item, slotIndex) => (item ? [{ ...item, slotIndex }] : []));
}

function sortedSpecimens(item: InventoryItem) {
  return [...(item.specimens ?? [])].sort((a, b) => {
    if (a.weightKg === null) return b.weightKg === null ? 0 : 1;
    if (b.weightKg === null) return -1;
    return b.weightKg - a.weightKg;
  });
}

function hasTrophyInStack(item: InventoryItem): boolean {
  return item.specimens?.some((specimen) => specimen.trophy) ?? false;
}

function stackTotalWeightKg(item: InventoryItem): number | null | undefined {
  if (!item.specimens) return undefined;
  if (item.specimens.length !== item.quantity) return null;
  let total = 0;
  for (const specimen of item.specimens) {
    if (specimen.weightKg === null) return null;
    total += specimen.weightKg;
  }
  return total;
}

async function request(path: string, options: RequestInit = {}): Promise<Reply> {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? 'Your items could not be loaded.');
  if (!body.inventory) throw new Error('Your items could not be loaded. Please try again.');
  return body as Reply;
}

function ItemIcon({ item }: { item?: InventoryItem }) {
  const paths =
    item?.id === 'bandage' ? (
      <>
        <rect x="7" y="3" width="10" height="18" rx="3" transform="rotate(40 12 12)" />
        <path d="M10 10h4v4h-4z" />
      </>
    ) : item?.kind === 'equipment' ? (
      <path d="m8 4 4 2 4-2 5 5-3 3-2-2v10H8V10l-2 2-3-3 5-5Zm4 2v14" />
    ) : item?.kind === 'tool' ? (
      <>
        <rect x="3" y="8" width="18" height="12" rx="2" />
        <path d="M8 8V4h8v4M3 13h18M10 12v3h4v-3" />
      </>
    ) : (
      <>
        <path d="M6 5h12l2 15H4L6 5ZM8 5V3h8v2" />
        <path d="M9 11h6M9 15h6" />
      </>
    );
  return (
    <svg
      className="possession-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}

function SlotFace({ item }: { item: InventoryItem }) {
  const totalWeight = stackTotalWeightKg(item);
  return (
    <>
      <span className="slot-top">
        {item.artworkPath ? (
          <img className="possession-art" src={item.artworkPath} alt="" />
        ) : (
          <ItemIcon item={item} />
        )}
        <span className="slot-quantity">×{item.quantity}</span>
      </span>
      <strong>{item.name}</strong>
      <span className="slot-footer">
        <span className="slot-caption">
          {hasTrophyInStack(item) ? (
            <TrophyBadge />
          ) : item.equipped ? (
            '✓ Equipped'
          ) : item.kind === 'consumable' ? (
            `Restores ${item.healHp} HP`
          ) : item.kind === 'tool' ? (
            item.specimens ? (
              'Fish'
            ) : item.id.endsWith('_bait') ? (
              'Bait'
            ) : (
              'Tool'
            )
          ) : item.kind === 'furniture' ? (
            'Furniture'
          ) : (
            'Clothing'
          )}
        </span>
        {totalWeight !== undefined && (
          <span className="slot-stack-weight">
            {totalWeight === null ? '—' : formatFishWeightKg(totalWeight)} kg
          </span>
        )}
      </span>
    </>
  );
}

function AdminDeleteControl({
  item,
  busy,
  onDelete,
}: {
  item: InventoryItem;
  busy: boolean;
  onDelete: (item: InventoryItem, requestKey: string) => Promise<void>;
}) {
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const label = item.quantity === 1 ? 'item' : 'stack';
  return (
    <section className="admin-item-delete" aria-label="Admin item tools">
      <p className="eyebrow">DEV / ADMIN</p>
      {requestKey ? (
        <>
          <p>
            Delete {item.name} ×{item.quantity} from{' '}
            {item.location === 'locker' ? 'the city locker' : 'carried inventory'}?
          </p>
          <div className="admin-item-delete-actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => void onDelete(item, requestKey)}
            >
              Confirm delete {label}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => setRequestKey(null)}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => setRequestKey(crypto.randomUUID())}
        >
          Delete {label}…
        </button>
      )}
    </section>
  );
}

export function InventoryPanel({
  character,
  busy,
  onBusy,
  onCapacity,
  onCharacter,
  refreshRevision = 0,
  onInventoryMutation,
  adminAuthorized = false,
}: {
  character: Character | null;
  busy: boolean;
  onBusy: (value: boolean) => void;
  onCapacity?: (used: number, capacity: number) => void;
  onCharacter: (value: Character) => void;
  refreshRevision?: number;
  onInventoryMutation?: () => void;
  adminAuthorized?: boolean;
}) {
  const [inventory, setInventory] = useState<InventoryState | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(Boolean(character));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selection, setSelection] = useState<string | null>(null);
  const [fishView, setFishView] = useState(false);
  const [specimenSelection, setSpecimenSelection] = useState<string | null>(null);
  const [pending, setPending] = useState('');
  const [drag, setDrag] = useState<DragState | null>(null);
  const pointer = useRef<{
    id: string;
    location: ItemLocation;
    x: number;
    y: number;
    active: boolean;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null>(null);
  const suppressClick = useRef<string | null>(null);
  const inFlight = useRef(false);
  const details = useRef<HTMLDivElement>(null);
  const slots = useRef(new Map<string, HTMLButtonElement>());
  const capacityCallback = useRef(onCapacity);
  useEffect(() => {
    capacityCallback.current = onCapacity;
  });
  const characterId = character?.id;
  const currentLocationId = character?.currentLocationId;

  useEffect(() => {
    if (!characterId) return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    request('/api/inventory', { signal: controller.signal })
      .then((result) => {
        if (active) {
          setInventory(result.inventory);
          capacityCallback.current?.(result.inventory.usedSlots, result.inventory.capacity);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setInventory(null);
          setError(
            reason instanceof Error && reason.name !== 'AbortError'
              ? reason.message
              : 'Loading took too long. Try refreshing your items.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
        window.clearTimeout(timeout);
      });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [characterId, currentLocationId, revision, refreshRevision]);

  function refresh() {
    setLoading(true);
    setError('');
    setNotice('');
    setInventory(null);
    setRevision((value) => value + 1);
  }

  async function act(action: Action, item: InventoryItem, quantity = 1) {
    if (inFlight.current || busy || !character) return;
    inFlight.current = true;
    onBusy(true);
    setError('');
    setNotice('');
    setPending(
      action === 'transfer'
        ? 'Moving items…'
        : action === 'use'
          ? 'Using item…'
          : 'Updating equipment…',
    );
    try {
      const result = await request(`/api/inventory/${action}`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          itemId: item.instanceId,
          ...(action === 'transfer'
            ? { destination: item.location === 'locker' ? 'inventory' : 'locker', quantity }
            : {}),
        }),
      });
      setInventory(result.inventory);
      onInventoryMutation?.();
      capacityCallback.current?.(result.inventory.usedSlots, result.inventory.capacity);
      if (result.character) onCharacter(result.character);
      setNotice(
        action === 'use'
          ? `Used 1 ${item.name}. Recovered ${(result.character?.hp ?? character.hp) - character.hp} HP.`
          : action === 'transfer'
            ? `Moved ${quantity} × ${item.name} to ${item.location === 'locker' ? 'carried inventory' : 'your city locker'}.`
            : `${item.name} ${action === 'equip' ? 'equipped' : 'unequipped'}.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error && !['TimeoutError', 'AbortError'].includes(reason.name)
          ? reason.message
          : 'The result could not be confirmed. Refresh your items before trying again.',
      );
    } finally {
      inFlight.current = false;
      onBusy(false);
      setPending('');
    }
  }

  async function deleteAdminItem(item: InventoryItem, requestKey: string) {
    if (inFlight.current || busy || !character || !adminAuthorized) return;
    inFlight.current = true;
    onBusy(true);
    setPending('Deleting item…');
    setError('');
    setNotice('');
    try {
      const result = await request('/api/fishing/admin/inventory', {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ action: 'delete', itemId: item.instanceId, requestKey }),
      });
      setInventory(result.inventory);
      setSelection(null);
      setFishView(false);
      setSpecimenSelection(null);
      capacityCallback.current?.(result.inventory.usedSlots, result.inventory.capacity);
      onInventoryMutation?.();
      setNotice(
        `Deleted ${item.name} from ${item.location === 'locker' ? 'the city locker' : 'carried inventory'}.`,
      );
      window.requestAnimationFrame(() => details.current?.focus());
    } catch (reason) {
      setError(
        reason instanceof Error && !['TimeoutError', 'AbortError'].includes(reason.name)
          ? reason.message
          : 'The deletion could not be confirmed. Retry or refresh your items.',
      );
    } finally {
      inFlight.current = false;
      onBusy(false);
      setPending('');
    }
  }

  async function reorder(
    location: ItemLocation,
    sourceId: string,
    targetId: string | null,
    emptyIndex: number | null = null,
  ) {
    if (!inventory || inFlight.current || busy) return;
    const items = location === 'inventory' ? inventory.items : inventory.locker;
    const visibleSlots =
      location === 'inventory'
        ? inventory.capacity
        : lockerSlotCount(items, inventory.lockerCapacity ?? undefined);
    const next = movedItems(items, visibleSlots, sourceId, targetId, emptyIndex);
    if (!next) return;
    const previous = inventory;
    setInventory({ ...inventory, [location === 'inventory' ? 'items' : 'locker']: next });
    inFlight.current = true;
    onBusy(true);
    setPending('Saving item order…');
    setError('');
    setNotice('');
    try {
      const result = await request('/api/inventory/reorder', {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          location,
          itemIds: arrangedSlots(next, visibleSlots).map((item) => item?.instanceId ?? null),
        }),
      });
      setInventory(result.inventory);
    } catch (reason) {
      setInventory(previous);
      setError(reason instanceof Error ? reason.message : 'Item order could not be saved.');
      // A stale item list must be reconciled before another move.
      setRevision((value) => value + 1);
    } finally {
      inFlight.current = false;
      onBusy(false);
      setPending('');
      window.requestAnimationFrame(() => slots.current.get(sourceId)?.focus());
    }
  }

  async function merge(source: InventoryItem, target: InventoryItem) {
    if (!inventory || inFlight.current || busy) return;
    inFlight.current = true;
    onBusy(true);
    setPending('Combining stacks…');
    setError('');
    setNotice('');
    try {
      const result = await request('/api/inventory/merge', {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ sourceId: source.instanceId, targetId: target.instanceId }),
      });
      setInventory(result.inventory);
      if (selection === source.instanceId) {
        setSelection(target.instanceId);
        setSpecimenSelection(null);
      }
      capacityCallback.current?.(result.inventory.usedSlots, result.inventory.capacity);
      onInventoryMutation?.();
      setNotice(`Combined ${result.moved} × ${source.name}.`);
    } catch (reason) {
      setError(
        reason instanceof Error && !['TimeoutError', 'AbortError'].includes(reason.name)
          ? reason.message
          : 'The result could not be confirmed. Refresh your items before trying again.',
      );
    } finally {
      inFlight.current = false;
      onBusy(false);
      setPending('');
      window.requestAnimationFrame(() => slots.current.get(target.instanceId)?.focus());
    }
  }

  function pointerTarget(
    x: number,
    y: number,
  ): { location: ItemLocation; id: string | null; emptyIndex: number | null } | undefined {
    const element = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>('[data-reorder-location], [data-transfer-location]');
    if (!element) return undefined;
    const location = element.dataset.reorderLocation ?? element.dataset.transferLocation;
    if (location !== 'inventory' && location !== 'locker') return undefined;
    return {
      location,
      id: element.dataset.reorderId ?? null,
      emptyIndex:
        element.dataset.reorderEmptyIndex === undefined
          ? null
          : Number(element.dataset.reorderEmptyIndex),
    };
  }

  function startDrag(event: React.PointerEvent<HTMLButtonElement>, item: InventoryItem) {
    if (pending || busy || event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointer.current = {
      id: item.instanceId,
      location: item.location,
      x: event.clientX,
      y: event.clientY,
      active: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const gesture = pointer.current;
    if (!gesture) return;
    if (!gesture.active && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 6)
      return;
    gesture.active = true;
    const target = pointerTarget(event.clientX, event.clientY);
    setDrag({
      id: gesture.id,
      location: gesture.location,
      targetLocation: target?.location ?? null,
      targetId: target?.id === gesture.id ? null : (target?.id ?? null),
      emptyIndex: target?.emptyIndex ?? null,
      x: event.clientX - gesture.offsetX,
      y: event.clientY - gesture.offsetY,
      width: gesture.width,
      height: gesture.height,
    });
  }

  function endDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const gesture = pointer.current;
    pointer.current = null;
    setDrag(null);
    if (!gesture?.active) return;
    event.preventDefault();
    suppressClick.current = gesture.id;
    window.setTimeout(() => {
      suppressClick.current = null;
    }, 0);
    const target = pointerTarget(event.clientX, event.clientY);
    if (!target) return;
    const sourceItem = allItems.find((entry) => entry.instanceId === gesture.id);
    const targetItem = allItems.find((entry) => entry.instanceId === target.id);
    if (
      sourceItem &&
      targetItem &&
      sourceItem.instanceId !== targetItem.instanceId &&
      sourceItem.id === targetItem.id &&
      sourceItem.stackable
    ) {
      void merge(sourceItem, targetItem);
      return;
    }
    if (target.location !== gesture.location) {
      if (sourceItem) void act('transfer', sourceItem, sourceItem.quantity);
    } else if (target.id !== gesture.id) {
      void reorder(gesture.location, gesture.id, target.id, target.emptyIndex);
    }
  }

  const allItems = inventory ? [...inventory.items, ...inventory.locker] : [];
  const draggedItem = drag ? allItems.find((item) => item.instanceId === drag.id) : null;
  const selected = allItems.find((item) => item.instanceId === selection);
  const full = Boolean(inventory && inventory.usedSlots >= inventory.capacity);
  function emptySlot(location: ItemLocation, index: number) {
    return (
      <div
        className={`vacant-slot ${drag?.targetLocation === location && drag.emptyIndex === index ? 'is-drop-target' : ''}`}
        key={`${location}-empty-${index}`}
        aria-hidden="true"
        data-reorder-location={location}
        data-reorder-empty-index={index}
      >
        <span>+</span>
        <span>{location === 'locker' ? 'Open space' : 'Empty slot'}</span>
      </div>
    );
  }
  function slot(item: InventoryItem) {
    const items = item.location === 'inventory' ? inventory!.items : inventory!.locker;
    const dragSource = drag ? allItems.find((entry) => entry.instanceId === drag.id) : null;
    const mergeTarget = Boolean(
      dragSource &&
      dragSource.instanceId !== item.instanceId &&
      dragSource.id === item.id &&
      dragSource.stackable &&
      item.quantity < item.maxStack &&
      drag?.targetId === item.instanceId,
    );
    const trophyStack = hasTrophyInStack(item);
    const totalWeight = stackTotalWeightKg(item);
    return (
      <button
        key={item.instanceId}
        data-reorder-location={item.location}
        data-reorder-id={item.instanceId}
        ref={(node) => {
          if (node) slots.current.set(item.instanceId, node);
          else slots.current.delete(item.instanceId);
        }}
        className={`possession-slot ${item.equipped ? 'is-equipped' : ''} ${trophyStack ? 'is-trophy-stack' : ''} ${drag?.id === item.instanceId ? 'is-dragging' : ''} ${drag?.targetId === item.instanceId && drag.targetLocation === item.location ? 'is-drop-target' : ''} ${mergeTarget ? 'is-merge-target' : ''}`}
        aria-pressed={selected?.instanceId === item.instanceId}
        aria-label={`${item.name}, quantity ${item.quantity}${item.equipped ? ', equipped' : ''}, ${item.location === 'locker' ? 'in locker' : 'carried'}${trophyStack ? ', Trophy fish in stack' : ''}`}
        aria-description={
          totalWeight === undefined
            ? undefined
            : totalWeight === null
              ? 'Stack total weight unknown'
              : `Stack total weight ${formatFishWeightKg(totalWeight)} kilograms`
        }
        title={`${item.name} — ${item.description}`}
        disabled={Boolean(pending)}
        onPointerDown={(event) => startDrag(event, item)}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={() => {
          pointer.current = null;
          setDrag(null);
        }}
        onKeyDown={(event) => {
          if (
            !event.altKey ||
            !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
          )
            return;
          event.preventDefault();
          const offset = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
          const itemSlots = arrangedSlots(
            items,
            item.location === 'inventory'
              ? inventory!.capacity
              : lockerSlotCount(items, inventory!.lockerCapacity ?? undefined),
          );
          const current = itemSlots.findIndex((entry) => entry?.instanceId === item.instanceId);
          const next = current + offset;
          if (next >= 0 && next < itemSlots.length)
            void reorder(item.location, item.instanceId, itemSlots[next]?.instanceId ?? null, next);
        }}
        onClick={() => {
          if (suppressClick.current === item.instanceId) {
            suppressClick.current = null;
            return;
          }
          setSelection(item.instanceId);
          setFishView(Boolean(item.specimens));
          setSpecimenSelection(sortedSpecimens(item)[0]?.id ?? null);
          window.requestAnimationFrame(() => details.current?.focus());
        }}
      >
        <SlotFace item={item} />
      </button>
    );
  }

  return (
    <section className="possessions" aria-labelledby="possessions-heading">
      <div className="possessions-heading">
        <div>
          <p className="eyebrow">Your belongings</p>
          <h2 id="possessions-heading" tabIndex={-1} data-drawer-heading>
            Inventory & storage
          </h2>
          <p className="muted">Keep what you need close. Leave the rest in your locker.</p>
        </div>
        {character && (
          <button className="button secondary" disabled={busy || loading} onClick={refresh}>
            {loading ? 'Loading…' : 'Refresh items'}
          </button>
        )}
      </div>
      {!character ? (
        <div className="panel possession-empty">
          <ItemIcon />
          <h3>Your kit starts here</h3>
          <p className="muted">Sign in to see your carried items and city locker.</p>
        </div>
      ) : (
        <>
          <div className="inventory-feedback" aria-live="polite" role="status">
            {pending || notice}
          </div>
          {error && (
            <div className="feedback form-error inventory-error" role="alert">
              <strong>Items need your attention</strong>
              <p>{error}</p>
              <p className="small">Refresh items to check your latest belongings.</p>
            </div>
          )}
          {loading && (
            <div className="panel inventory-loading" role="status">
              <span className="eyebrow">Opening your inventory</span>
              <p>Loading carried items and city storage…</p>
              <div className="loading-slots" aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => (
                  <span key={index} />
                ))}
              </div>
            </div>
          )}
          {!loading && inventory && (
            <div className={`possessions-layout ${selected ? 'has-item-selection' : ''}`}>
              <div className="storage-containers">
                <section
                  className="panel carried-panel"
                  aria-labelledby="carried-heading"
                  data-transfer-location="inventory"
                >
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">With you</p>
                      <h3 id="carried-heading">Carried inventory</h3>
                    </div>
                    <span className={`badge ${full ? 'capacity-full' : ''}`}>
                      {inventory.usedSlots} / {inventory.capacity} slots
                    </span>
                  </div>
                  <progress
                    className="capacity-meter"
                    aria-label="Occupied inventory slots"
                    value={inventory.usedSlots}
                    max={inventory.capacity}
                  />
                  <p className={`capacity-copy ${full ? 'full-copy' : 'muted'}`}>
                    {full
                      ? 'Inventory full. Compatible locker stacks can still merge with carried items.'
                      : `${inventory.capacity - inventory.usedSlots} slots free · Select an item to inspect or use it.`}
                  </p>
                  <p className="small muted reorder-hint">
                    Drag item cards to sort, combine matching stacks, or move items between your
                    pack and locker · Alt + arrow keys also move the focused item.
                  </p>
                  <div className="possession-grid">
                    {arrangedSlots(inventory.items, inventory.capacity).map((item, index) =>
                      item ? slot(item) : emptySlot('inventory', index),
                    )}
                  </div>
                  {inventory.items.length === 0 && (
                    <p className="muted small">
                      Your inventory is empty. Take an item from the locker to carry it.
                    </p>
                  )}
                  <p className="container-footnote">
                    Equipped items stay in your inventory and occupy a slot.
                  </p>
                </section>
                <section
                  className="panel locker-panel"
                  aria-labelledby="city-locker-heading"
                  data-transfer-location="locker"
                >
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">New Harbor</p>
                      <h3 id="city-locker-heading">City locker</h3>
                    </div>
                    <span className="badge">
                      {inventory.locker.length}
                      {inventory.lockerCapacity ? ` / ${inventory.lockerCapacity}` : ''} stored
                      stacks / items
                    </span>
                  </div>
                  <p className="muted small locker-intro">
                    Stored here, ready when you need it. Accessible only in New Harbor.
                  </p>
                  {inventory.locker.length ? (
                    <div className="possession-grid">
                      {arrangedSlots(
                        inventory.locker,
                        lockerSlotCount(inventory.locker, inventory.lockerCapacity ?? undefined),
                      ).map((item, index) => (item ? slot(item) : emptySlot('locker', index)))}
                    </div>
                  ) : (
                    <div
                      className={`locker-empty ${drag?.targetLocation === 'locker' && drag.location === 'inventory' ? 'is-drop-target' : ''}`}
                    >
                      <span aria-hidden="true">⌑</span>
                      <div>
                        <h4>Room for what you leave behind</h4>
                        <p>Drop a carried item here, or select one and choose “Store in locker”.</p>
                      </div>
                    </div>
                  )}
                </section>
              </div>
              <div
                key={selected ? `${selected.location}-${selected.instanceId}` : 'empty'}
                className={`item-inspector ${selected && !fishView ? 'item-tooltip-inspector' : 'panel'}`}
                ref={details}
                tabIndex={-1}
                aria-label="Item details"
              >
                {selected && fishView && selected.specimens ? (
                  <FishStackDetails
                    key={selected.instanceId}
                    item={selected}
                    selectedId={specimenSelection}
                    onSelect={setSpecimenSelection}
                    onBack={() => {
                      setFishView(false);
                      setSpecimenSelection(null);
                      window.requestAnimationFrame(() => details.current?.focus());
                    }}
                    onClose={() => {
                      setSelection(null);
                      setFishView(false);
                      const closedItemId = selected.instanceId;
                      window.requestAnimationFrame(() => {
                        (slots.current.get(closedItemId) ?? details.current)?.focus();
                      });
                    }}
                  />
                ) : selected ? (
                  <InventoryItemDetails
                    key={`${selected.instanceId}-${selected.location}-${selected.quantity}`}
                    item={selected}
                    character={character}
                    full={full}
                    carriedItems={inventory.items}
                    busy={busy || Boolean(pending)}
                    act={act}
                    onClose={() => {
                      const closedItemId = selected.instanceId;
                      setSelection(null);
                      setFishView(false);
                      setSpecimenSelection(null);
                      window.requestAnimationFrame(() => slots.current.get(closedItemId)?.focus());
                    }}
                    onViewFish={() => {
                      setSpecimenSelection(sortedSpecimens(selected)[0]?.id ?? null);
                      setFishView(true);
                      window.requestAnimationFrame(() => details.current?.focus());
                    }}
                  />
                ) : (
                  <div className="inspector-empty">
                    <ItemIcon />
                    <h3>{selection ? 'Item no longer in this slot' : 'A closer look'}</h3>
                    <p className="muted">
                      Select an item to see its details, use it, or move it between your inventory
                      and locker.
                    </p>
                  </div>
                )}
                {selected && adminAuthorized && (
                  <AdminDeleteControl
                    key={selected.instanceId}
                    item={selected}
                    busy={busy || Boolean(pending)}
                    onDelete={deleteAdminItem}
                  />
                )}
              </div>
            </div>
          )}
          {drag && draggedItem && (
            <div
              className={`inventory-drag-ghost possession-slot ${draggedItem.equipped ? 'is-equipped' : ''} ${hasTrophyInStack(draggedItem) ? 'is-trophy-stack' : ''}`}
              style={{ left: drag.x, top: drag.y, width: drag.width, height: drag.height }}
              aria-hidden="true"
            >
              <SlotFace item={draggedItem} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function WeightGradient({ specimen }: { specimen: FishSpecimen }) {
  if (specimen.weightKg === null || specimen.position === null)
    return <p className="fish-weight-unknown">This fish has no recorded weight.</p>;
  const position = Math.max(0, Math.min(100, specimen.position * 100));
  return (
    <div className="fish-weight">
      <p className="fish-range-label">Species weight range</p>
      <div
        className="fish-weight-bar"
        role="img"
        aria-label={`${formatFishWeightKg(specimen.weightKg)} kilograms, ${position.toFixed(1)} percent of the ${formatFishWeightKg(specimen.minKg)} to ${formatFishWeightKg(specimen.maxKg)} kilogram species weight range`}
      >
        <span className="fish-weight-arrow" style={{ left: `${position}%` }} aria-hidden="true">
          ▼
        </span>
      </div>
      <div className="fish-weight-endpoints">
        <span>{formatFishWeightKg(specimen.minKg)} kg</span>
        <span>{formatFishWeightKg(specimen.maxKg)} kg</span>
      </div>
    </div>
  );
}

function FishStackDetails({
  item,
  selectedId,
  onSelect,
  onBack,
  onClose,
}: {
  item: InventoryItem;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const specimens = sortedSpecimens(item);
  const requested = specimens.find((specimen) => specimen.id === selectedId);
  const selected = requested ?? specimens[0];
  return (
    <div className="fish-collection">
      <div className="fish-stack-header">
        <button
          type="button"
          className="button secondary"
          aria-label="Back to item actions"
          onClick={onBack}
        >
          ← Back
        </button>
        <button type="button" className="button secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="eyebrow">Your catch</p>
      <div className="fish-collection-heading">
        <h3>{item.name}</h3>
        <span className="fish-stack-count">{item.quantity} fish</span>
      </div>
      {selected && (
        <div className={`fish-specimen-hero ${selected.trophy ? 'is-trophy' : ''}`}>
          <div className="fish-specimen-distinction">
            {selected.trophy ? <TrophyBadge /> : <span>Fish details</span>}
          </div>
          {item.artworkPath ? (
            <img className="fish-specimen-art" src={item.artworkPath} alt="" />
          ) : (
            <ItemIcon item={item} />
          )}
          <strong className="fish-specimen-weight">
            {selected.weightKg === null
              ? 'Weight unavailable'
              : `${formatFishWeightKg(selected.weightKg)} kg`}
          </strong>
          {selected.trophy && <p className="fish-trophy-copy">An exceptional catch.</p>}
          <WeightGradient specimen={selected} />
        </div>
      )}
      <div className="fish-collection-list-heading">
        <h4>In this stack</h4>
        <span>Heaviest first</span>
      </div>
      {specimens.length ? (
        <ol className="fish-catch-list" aria-label={`${item.name} in this stack, heaviest first`}>
          {specimens.map((specimen, index) => (
            <li key={specimen.id}>
              <button
                type="button"
                className={specimen.trophy ? 'is-trophy' : undefined}
                aria-label={`Fish ${index + 1}, ${specimen.weightKg === null ? 'weight unavailable' : `${formatFishWeightKg(specimen.weightKg)} kg`}${specimen.trophy ? ', Trophy' : ''}`}
                aria-pressed={specimen.id === selected?.id}
                onClick={() => onSelect(specimen.id)}
              >
                <span className="fish-catch-number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {item.artworkPath && <img src={item.artworkPath} alt="" />}
                <span className="fish-catch-summary">
                  <strong>
                    {specimen.weightKg === null
                      ? 'Weight unavailable'
                      : `${formatFishWeightKg(specimen.weightKg)} kg`}
                  </strong>
                  {specimen.trophy && <TrophyBadge />}
                </span>
                <span className="fish-catch-selected" aria-hidden="true">
                  {specimen.id === selected?.id ? '✓' : '›'}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="small muted">
          No fish remain in this stack. Refresh items to see your latest catch.
        </p>
      )}
      {selectedId && !requested && (
        <p className="small muted" role="status">
          That fish is no longer in this stack.
        </p>
      )}
    </div>
  );
}
