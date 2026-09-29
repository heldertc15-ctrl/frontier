import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InventoryItem, InventoryState } from '../../server/inventory';
import { InventoryPanel } from './InventoryPanel';

const character = {
  id: 'player',
  name: 'Rowan',
  hp: 50,
  maxHp: 100,
  credits: 250,
  characterXp: 0,
  characterLevel: 1,
  currentLocation: 'New Harbor',
  currentLocationId: 'new-harbor',
  activeStatus: 'idle',
};
const bandage: InventoryItem = {
  id: 'bandage',
  instanceId: 'bandage-1',
  name: 'Bandage',
  description: 'Clean dressing.',
  kind: 'consumable',
  stackable: true,
  maxStack: 20,
  equipmentSlot: null,
  healHp: 25,
  quantity: 2,
  location: 'inventory',
  equipped: false,
};
const toolkit: InventoryItem = {
  ...bandage,
  id: 'basic_toolkit',
  instanceId: 'tool-1',
  name: 'Basic toolkit',
  kind: 'tool',
  stackable: false,
  maxStack: 1,
  healHp: 0,
  quantity: 1,
  location: 'locker',
};
const state: InventoryState = { capacity: 10, usedSlots: 1, items: [bandage], locker: [] };
function response(inventory = state) {
  return { ok: true, json: async () => ({ inventory }) } as Response;
}
function setup(inventory = state, hp = 50, adminAuthorized = false) {
  const fetchMock = vi.fn().mockResolvedValue(response(inventory));
  vi.stubGlobal('fetch', fetchMock);
  const onCharacter = vi.fn();
  render(
    <InventoryPanel
      character={{ ...character, hp }}
      busy={false}
      onBusy={vi.fn()}
      onCharacter={onCharacter}
      adminAuthorized={adminAuthorized}
    />,
  );
  return { fetchMock, onCharacter };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'elementFromPoint');
});

describe('Inventory player interactions', () => {
  it('offers confirmed per-card deletion only to admins in carried inventory and the locker', async () => {
    const initial = { ...state, locker: [toolkit] };
    const withoutCarried = { ...initial, usedSlots: 0, items: [] };
    const { fetchMock } = setup(initial, 50, true);
    fireEvent.click(await screen.findByRole('button', { name: 'Bandage, quantity 2, carried' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete stack…' }));
    expect(screen.getByText(/Delete Bandage ×2 from carried inventory/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Confirm delete stack' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete stack…' }));
    fetchMock.mockResolvedValueOnce(response(withoutCarried));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete stack' }));
    await waitFor(() => expect(screen.queryByText('Bandage')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/fishing/admin/inventory',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"itemId":"bandage-1"'),
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Basic toolkit, quantity 1, in locker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete item…' }));
    expect(screen.getByText(/Delete Basic toolkit ×1 from the city locker/)).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(response({ ...withoutCarried, locker: [] }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete item' }));
    await waitFor(() => expect(screen.queryByText('Basic toolkit')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/fishing/admin/inventory',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"itemId":"tool-1"'),
      }),
    );
  });

  it('does not show admin delete controls to ordinary players', async () => {
    setup({ ...state, locker: [toolkit] });
    fireEvent.click(await screen.findByRole('button', { name: 'Bandage, quantity 2, carried' }));
    expect(screen.queryByRole('region', { name: 'Admin item tools' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Basic toolkit, quantity 1, in locker' }));
    expect(screen.queryByRole('region', { name: 'Admin item tools' })).not.toBeInTheDocument();
  });

  it('marks a locker fish stack while it contains a Trophy and clears the marker after refresh', async () => {
    const fish: InventoryItem = {
      ...toolkit,
      id: 'mackerel',
      instanceId: 'locker-fish',
      name: 'Mackerel',
      stackable: true,
      maxStack: 10,
      quantity: 2,
      specimens: [
        {
          id: 'trophy',
          weightKg: 0.75,
          weightKnown: true,
          trophy: true,
          minKg: 0.2,
          maxKg: 0.8,
          position: 0.92,
        },
        {
          id: 'ordinary',
          weightKg: 0.3,
          weightKnown: true,
          trophy: false,
          minKg: 0.2,
          maxKg: 0.8,
          position: 0.17,
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(response({ ...state, locker: [fish] }));
    vi.stubGlobal('fetch', fetchMock);
    const props = { character, busy: false, onBusy: vi.fn(), onCharacter: vi.fn() };
    const view = render(<InventoryPanel {...props} refreshRevision={0} />);
    const trophyCard = await screen.findByRole('button', {
      name: 'Mackerel, quantity 2, in locker, Trophy fish in stack',
    });
    expect(trophyCard).toHaveClass('is-trophy-stack');
    expect(within(trophyCard).getByText('Trophy')).toBeInTheDocument();
    expect(within(trophyCard).getByText('1.050 kg')).toHaveClass('slot-stack-weight');
    expect(trophyCard).toHaveAttribute('aria-description', 'Stack total weight 1.050 kilograms');
    Object.defineProperty(trophyCard, 'setPointerCapture', { configurable: true, value: vi.fn() });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => trophyCard),
    });
    fireEvent.pointerDown(trophyCard, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerMove(trophyCard, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 25,
      clientY: 25,
    });
    const ghost = document.querySelector('.inventory-drag-ghost') as HTMLElement;
    expect(ghost).toHaveClass('is-trophy-stack');
    expect(within(ghost).getByText('Trophy')).toBeInTheDocument();
    expect(within(ghost).getByText('1.050 kg')).toHaveClass('slot-stack-weight');
    fireEvent.pointerCancel(trophyCard, { pointerId: 1 });

    fetchMock.mockResolvedValue(
      response({
        ...state,
        locker: [{ ...fish, quantity: 1, specimens: [fish.specimens![1]!] }],
      }),
    );
    view.rerender(<InventoryPanel {...props} refreshRevision={1} />);
    const ordinaryCard = await screen.findByRole('button', {
      name: 'Mackerel, quantity 1, in locker',
    });
    expect(ordinaryCard).not.toHaveClass('is-trophy-stack');
    expect(within(ordinaryCard).queryByText('Trophy')).not.toBeInTheDocument();
    expect(within(ordinaryCard).getByText('0.300 kg')).toHaveClass('slot-stack-weight');
  });

  it('formats larger fish stack totals and marks stacks with missing weights as unknown', async () => {
    const specimen = {
      id: 'tuna-1',
      weightKg: 30.54,
      weightKnown: true,
      trophy: false,
      minKg: 30,
      maxKg: 250,
      position: 0.01,
    };
    const tuna: InventoryItem = {
      ...toolkit,
      id: 'bluefin_tuna',
      instanceId: 'tuna-stack',
      name: 'Bluefin Tuna',
      location: 'inventory',
      stackable: true,
      maxStack: 10,
      quantity: 2,
      specimens: [specimen, { ...specimen, id: 'tuna-2', weightKg: 31.2 }],
    };
    const unknown: InventoryItem = {
      ...tuna,
      instanceId: 'unknown-stack',
      specimens: [specimen, { ...specimen, id: 'unknown', weightKg: null, weightKnown: false }],
    };
    setup({ ...state, usedSlots: 3, items: [tuna, unknown, bandage] });
    const cards = await screen.findAllByRole('button', {
      name: 'Bluefin Tuna, quantity 2, carried',
    });
    expect(within(cards[0]).getByText('61.74 kg')).toHaveClass('slot-stack-weight');
    expect(within(cards[1]).getByText('— kg')).toHaveClass('slot-stack-weight');
    expect(cards[1]).toHaveAttribute('aria-description', 'Stack total weight unknown');
    expect(
      screen
        .getByRole('button', { name: 'Bandage, quantity 2, carried' })
        .querySelector('.slot-stack-weight'),
    ).toBeNull();
  });

  it('opens fish in one click and replaces the previous stack or item view', async () => {
    const fish: InventoryItem = {
      ...toolkit,
      id: 'mackerel',
      name: 'Mackerel',
      description: 'A pier catch.',
      instanceId: 'fish-a',
      location: 'inventory',
      stackable: true,
      maxStack: 10,
      specimens: [
        {
          id: 'fish-1',
          weightKg: 0.75,
          weightKnown: true,
          trophy: true,
          minKg: 0.2,
          maxKg: 0.8,
          position: 0.92,
        },
      ],
    };
    setup({
      ...state,
      usedSlots: 3,
      items: [
        fish,
        {
          ...fish,
          instanceId: 'fish-b',
          quantity: 2,
          specimens: [
            { ...fish.specimens![0]!, id: 'fish-2', weightKg: 0.3, trophy: false },
            { ...fish.specimens![0]!, id: 'fish-3', weightKg: 0.4, trophy: false },
          ],
        },
        bandage,
      ],
    });
    const first = await screen.findByRole('button', {
      name: 'Mackerel, quantity 1, carried, Trophy fish in stack',
    });
    expect(first).toHaveClass('is-trophy-stack');
    expect(within(first).getByText('Trophy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mackerel, quantity 2, carried' })).not.toHaveClass(
      'is-trophy-stack',
    );
    fireEvent.click(first);

    expect(document.querySelectorAll('.item-inspector .fish-collection')).toHaveLength(1);
    const firstInspector = document.querySelector('.item-inspector');
    expect(screen.getByRole('button', { name: 'Fish 1, 0.750 kg, Trophy' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mackerel, quantity 2, carried' }));
    expect(document.querySelectorAll('.item-inspector .fish-collection')).toHaveLength(1);
    expect(document.querySelector('.item-inspector')).not.toBe(firstInspector);
    expect(screen.getAllByRole('list')).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: 'Fish 1, 0.750 kg, Trophy' }),
    ).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Fish 1, 0.400 kg' })).toBeInTheDocument();
    expect(first).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Bandage, quantity 2, carried' }));
    expect(document.querySelectorAll('.item-inspector .fish-collection')).toHaveLength(0);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Inspect fish/ })).not.toBeInTheDocument();
    fireEvent.click(first);
    expect(document.querySelectorAll('.item-inspector .fish-collection')).toHaveLength(1);
    expect(screen.getAllByRole('list')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Fish 1, 0.750 kg, Trophy' })).toBeInTheDocument();
  });

  it('keeps item summaries compact and resets transfer controls on another selection', async () => {
    setup({ ...state, locker: [toolkit] });
    const first = await screen.findByRole('button', { name: 'Bandage, quantity 2, carried' });
    fireEvent.click(first);
    expect(screen.queryByText('Stack size')).not.toBeInTheDocument();
    expect(screen.queryByText('Quantity', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Quantity to store')).not.toBeInTheDocument();
    const store = screen.getByRole('button', { name: 'Store…' });
    expect(store).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(store);
    expect(store).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Quantity to store')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Basic toolkit, quantity 1, in locker' }));
    expect(screen.queryByLabelText('Quantity to store')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take…' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(first);
    expect(screen.getByRole('button', { name: 'Store…' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close item details' }));
    await waitFor(() => expect(first).toHaveFocus());
  });

  it('shows each inventory tile quantity once while retaining a complete accessible name', async () => {
    setup({ ...state, usedSlots: 2, items: [bandage, { ...toolkit, location: 'inventory' }] });
    const bandageSlot = await screen.findByRole('button', { name: 'Bandage, quantity 2, carried' });
    expect(bandageSlot.querySelector('strong')).toHaveTextContent(/^Bandage$/);
    expect(within(bandageSlot).getAllByText('×2')).toHaveLength(1);
    const toolSlot = screen.getByRole('button', { name: 'Basic toolkit, quantity 1, carried' });
    expect(toolSlot.querySelector('strong')).toHaveTextContent(/^Basic toolkit$/);
    expect(within(toolSlot).getAllByText('×1')).toHaveLength(1);
  });
  it('reorders carried tiles by drag, saves the new order, and keeps selection closed', async () => {
    const other = { ...toolkit, location: 'inventory' as const };
    const original = { ...state, usedSlots: 2, items: [bandage, other] };
    const changed = { ...original, items: [other, bandage] };
    const { fetchMock } = setup(original);
    const source = await screen.findByRole('button', { name: 'Bandage, quantity 2, carried' });
    const target = screen.getByRole('button', { name: 'Basic toolkit, quantity 1, carried' });
    Object.defineProperty(source, 'setPointerCapture', { configurable: true, value: vi.fn() });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => target),
    });
    fetchMock.mockResolvedValueOnce(response(changed));
    fireEvent.pointerDown(source, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerMove(source, { pointerId: 1, pointerType: 'mouse', clientX: 25, clientY: 25 });
    fireEvent.pointerUp(source, { pointerId: 1, pointerType: 'mouse', clientX: 25, clientY: 25 });
    fireEvent.click(source);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/inventory/reorder',
        expect.objectContaining({
          body: JSON.stringify({
            location: 'inventory',
            itemIds: ['tool-1', 'bandage-1', ...Array(8).fill(null)],
          }),
        }),
      ),
    );
    expect(screen.queryByRole('button', { name: 'Store…' })).not.toBeInTheDocument();
    expect(
      [...document.querySelectorAll('.carried-panel .possession-slot')].map((slot) =>
        slot.getAttribute('data-reorder-id'),
      ),
    ).toEqual(['tool-1', 'bandage-1']);
    await waitFor(() => expect(screen.queryByText('Saving item order…')).not.toBeInTheDocument());
    expect(screen.queryByText('Item order saved.')).not.toBeInTheDocument();
  });

  it('combines matching stacks on drop and leaves overflow in the dragged stack', async () => {
    const source = { ...bandage, quantity: 4 };
    const target = { ...bandage, instanceId: 'bandage-target', quantity: 18 };
    const original: InventoryState = { ...state, usedSlots: 2, items: [source, target] };
    const changed: InventoryState = {
      ...original,
      items: [
        { ...source, quantity: 2 },
        { ...target, quantity: 20 },
      ],
    };
    const { fetchMock } = setup(original);
    const sourceSlot = await screen.findByRole('button', { name: 'Bandage, quantity 4, carried' });
    const targetSlot = screen.getByRole('button', { name: 'Bandage, quantity 18, carried' });
    Object.defineProperty(sourceSlot, 'setPointerCapture', { configurable: true, value: vi.fn() });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => targetSlot),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ inventory: changed, moved: 2 }),
    });
    fireEvent.pointerDown(sourceSlot, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(sourceSlot, { pointerId: 1, clientX: 25, clientY: 25 });
    expect(targetSlot).toHaveClass('is-merge-target');
    fireEvent.pointerUp(sourceSlot, { pointerId: 1, clientX: 25, clientY: 25 });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/inventory/merge',
        expect.objectContaining({
          body: JSON.stringify({ sourceId: 'bandage-1', targetId: 'bandage-target' }),
        }),
      ),
    );
    expect(
      await screen.findByRole('button', { name: 'Bandage, quantity 20, carried' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Bandage, quantity 2, carried' }),
    ).toBeInTheDocument();
  });

  it('lets a focused item move with Alt and arrow keys', async () => {
    const other = { ...toolkit, location: 'inventory' as const };
    const original = { ...state, usedSlots: 2, items: [bandage, other] };
    const changed = { ...original, items: [other, bandage] };
    const { fetchMock } = setup(original);
    const source = await screen.findByRole('button', { name: 'Bandage, quantity 2, carried' });
    fetchMock.mockResolvedValueOnce(response(changed));
    fireEvent.keyDown(source, { key: 'ArrowRight', altKey: true });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/inventory/reorder',
        expect.objectContaining({
          body: JSON.stringify({
            location: 'inventory',
            itemIds: ['tool-1', 'bandage-1', ...Array(8).fill(null)],
          }),
        }),
      ),
    );
    expect(
      [...document.querySelectorAll('.carried-panel .possession-slot')].map((slot) =>
        slot.getAttribute('data-reorder-id'),
      ),
    ).toEqual(['tool-1', 'bandage-1']);
  });
  it('accepts an empty slot as a drop target and keeps the card in that slot', async () => {
    const other = { ...toolkit, location: 'inventory' as const };
    const original = { ...state, usedSlots: 2, items: [bandage, other] };
    const changed = {
      ...original,
      items: [
        { ...other, slotIndex: 1 },
        { ...bandage, slotIndex: 2 },
      ],
    };
    const { fetchMock } = setup(original);
    const source = await screen.findByRole('button', { name: 'Bandage, quantity 2, carried' });
    const empty = document.querySelector('.carried-panel .vacant-slot')!;
    Object.defineProperty(source, 'setPointerCapture', { configurable: true, value: vi.fn() });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => empty),
    });
    fetchMock.mockResolvedValueOnce(response(changed));
    fireEvent.pointerDown(source, {
      pointerId: 1,
      pointerType: 'touch',
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerMove(source, { pointerId: 1, pointerType: 'touch', clientX: 25, clientY: 25 });
    expect(
      document.querySelector('.carried-panel .vacant-slot.is-drop-target'),
    ).toBeInTheDocument();
    fireEvent.pointerUp(source, { pointerId: 1, pointerType: 'touch', clientX: 25, clientY: 25 });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/inventory/reorder',
        expect.objectContaining({
          body: JSON.stringify({
            location: 'inventory',
            itemIds: [null, 'tool-1', 'bandage-1', ...Array(7).fill(null)],
          }),
        }),
      ),
    );
    expect(
      [...document.querySelector('.carried-panel .possession-grid')!.children]
        .slice(0, 3)
        .map((slot) => slot.getAttribute('data-reorder-id') ?? 'empty'),
    ).toEqual(['empty', 'tool-1', 'bandage-1']);
  });
  it('moves a whole carried stack when dropped into an empty locker', async () => {
    const changed: InventoryState = {
      ...state,
      usedSlots: 0,
      items: [],
      locker: [{ ...bandage, location: 'locker' }],
    };
    const { fetchMock } = setup();
    const source = await screen.findByRole('button', { name: 'Bandage, quantity 2, carried' });
    const emptyLocker = document.querySelector('.locker-empty')!;
    Object.defineProperty(source, 'setPointerCapture', { configurable: true, value: vi.fn() });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => emptyLocker.querySelector('p')),
    });
    fetchMock.mockResolvedValueOnce(response(changed));
    fireEvent.pointerDown(source, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerMove(source, { pointerId: 1, pointerType: 'mouse', clientX: 25, clientY: 25 });
    expect(emptyLocker).toHaveClass('is-drop-target');
    fireEvent.pointerUp(source, { pointerId: 1, pointerType: 'mouse', clientX: 25, clientY: 25 });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/inventory/transfer',
        expect.objectContaining({
          body: JSON.stringify({ itemId: 'bandage-1', destination: 'locker', quantity: 2 }),
        }),
      ),
    );
    expect(
      await screen.findByRole('button', { name: 'Bandage, quantity 2, in locker' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Bandage, quantity 2, carried' }),
    ).not.toBeInTheDocument();
  });

  it('moves a locker card into an empty carried slot', async () => {
    const original: InventoryState = { ...state, usedSlots: 0, items: [], locker: [toolkit] };
    const changed: InventoryState = {
      ...original,
      usedSlots: 1,
      items: [{ ...toolkit, location: 'inventory' }],
      locker: [],
    };
    const { fetchMock } = setup(original);
    const source = await screen.findByRole('button', {
      name: 'Basic toolkit, quantity 1, in locker',
    });
    const emptySlot = document.querySelector('.carried-panel .vacant-slot')!;
    Object.defineProperty(source, 'setPointerCapture', { configurable: true, value: vi.fn() });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => emptySlot),
    });
    fetchMock.mockResolvedValueOnce(response(changed));
    fireEvent.pointerDown(source, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerMove(source, { pointerId: 1, pointerType: 'mouse', clientX: 25, clientY: 25 });
    expect(emptySlot).toHaveClass('is-drop-target');
    fireEvent.pointerUp(source, { pointerId: 1, pointerType: 'mouse', clientX: 25, clientY: 25 });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/inventory/transfer',
        expect.objectContaining({
          body: JSON.stringify({ itemId: 'tool-1', destination: 'inventory', quantity: 1 }),
        }),
      ),
    );
    expect(
      await screen.findByRole('button', { name: 'Basic toolkit, quantity 1, carried' }),
    ).toBeInTheDocument();
  });
  it('swaps locker cards and lifts the complete card artwork while dragging', async () => {
    const rod: InventoryItem = {
      ...toolkit,
      id: 'basic_fishing_rod',
      instanceId: 'rod-1',
      name: 'Basic Fishing Rod',
      artworkPath: '/assets/items/basic-fishing-rod.webp',
    };
    const original = { ...state, locker: [rod, toolkit] };
    const changed = {
      ...original,
      locker: [
        { ...toolkit, slotIndex: 0 },
        { ...rod, slotIndex: 1 },
      ],
    };
    const { fetchMock } = setup(original);
    const source = await screen.findByRole('button', {
      name: 'Basic Fishing Rod, quantity 1, in locker',
    });
    const target = screen.getByRole('button', { name: 'Basic toolkit, quantity 1, in locker' });
    Object.defineProperty(source, 'setPointerCapture', { configurable: true, value: vi.fn() });
    Object.defineProperty(source, 'getBoundingClientRect', {
      configurable: true,
      value: vi.fn(() => ({ left: 20, top: 30, width: 116, height: 132 })),
    });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => target),
    });
    fetchMock.mockResolvedValueOnce(response(changed));
    fireEvent.pointerDown(source, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 30,
      clientY: 40,
    });
    fireEvent.pointerMove(source, { pointerId: 1, pointerType: 'mouse', clientX: 45, clientY: 55 });
    const ghost = document.querySelector('.inventory-drag-ghost')!;
    expect(ghost).toHaveStyle({ width: '116px', height: '132px' });
    expect(ghost.querySelector('img')).toHaveAttribute('src', rod.artworkPath);
    expect(within(ghost as HTMLElement).getByText('×1')).toBeInTheDocument();
    expect(within(ghost as HTMLElement).getByText('Basic Fishing Rod')).toBeInTheDocument();
    expect(within(ghost as HTMLElement).getByText('Tool')).toBeInTheDocument();
    fireEvent.pointerUp(source, { pointerId: 1, pointerType: 'mouse', clientX: 45, clientY: 55 });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/inventory/reorder',
        expect.objectContaining({
          body: JSON.stringify({
            location: 'locker',
            itemIds: ['tool-1', 'rod-1', ...Array(8).fill(null)],
          }),
        }),
      ),
    );
    expect(
      [
        ...document.querySelectorAll('[aria-labelledby="city-locker-heading"] .possession-slot'),
      ].map((slot) => slot.getAttribute('data-reorder-id')),
    ).toEqual(['tool-1', 'rod-1']);
  });

  it('places a locker card in the exact open space', async () => {
    const rod = {
      ...toolkit,
      instanceId: 'rod-1',
      id: 'basic_fishing_rod',
      name: 'Basic Fishing Rod',
    };
    const original = { ...state, locker: [rod, toolkit] };
    const changed = {
      ...original,
      locker: [
        { ...toolkit, slotIndex: 1 },
        { ...rod, slotIndex: 2 },
      ],
    };
    const { fetchMock } = setup(original);
    const source = await screen.findByRole('button', {
      name: 'Basic Fishing Rod, quantity 1, in locker',
    });
    const empty = document.querySelector('[aria-labelledby="city-locker-heading"] .vacant-slot')!;
    Object.defineProperty(source, 'setPointerCapture', { configurable: true, value: vi.fn() });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => empty),
    });
    fetchMock.mockResolvedValueOnce(response(changed));
    fireEvent.pointerDown(source, {
      pointerId: 1,
      pointerType: 'touch',
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerMove(source, { pointerId: 1, pointerType: 'touch', clientX: 25, clientY: 25 });
    expect(empty).toHaveClass('is-drop-target');
    fireEvent.pointerUp(source, { pointerId: 1, pointerType: 'touch', clientX: 25, clientY: 25 });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/inventory/reorder',
        expect.objectContaining({
          body: JSON.stringify({
            location: 'locker',
            itemIds: [null, 'tool-1', 'rod-1', ...Array(7).fill(null)],
          }),
        }),
      ),
    );
    expect(
      [
        ...document.querySelector('[aria-labelledby="city-locker-heading"] .possession-grid')!
          .children,
      ]
        .slice(0, 3)
        .map((slot) => slot.getAttribute('data-reorder-id') ?? 'empty'),
    ).toEqual(['empty', 'tool-1', 'rod-1']);
  });
  it('keeps an admin locker at 50 visible slots after dropping into the last space', async () => {
    const original: InventoryState = { ...state, lockerCapacity: 50, locker: [toolkit] };
    const changed: InventoryState = {
      ...original,
      locker: [{ ...toolkit, slotIndex: 49 }],
    };
    const { fetchMock } = setup(original, 50, true);
    const source = await screen.findByRole('button', {
      name: 'Basic toolkit, quantity 1, in locker',
    });
    const lockerGrid = document.querySelector(
      '[aria-labelledby="city-locker-heading"] .possession-grid',
    )!;
    expect(lockerGrid.children).toHaveLength(50);
    const lastSpace = lockerGrid.lastElementChild!;
    Object.defineProperty(source, 'setPointerCapture', { configurable: true, value: vi.fn() });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => lastSpace),
    });
    fetchMock.mockResolvedValueOnce(response(changed));
    fireEvent.pointerDown(source, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(source, { pointerId: 1, clientX: 25, clientY: 25 });
    fireEvent.pointerUp(source, { pointerId: 1, clientX: 25, clientY: 25 });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/inventory/reorder',
        expect.objectContaining({
          body: JSON.stringify({
            location: 'locker',
            itemIds: [...Array(49).fill(null), 'tool-1'],
          }),
        }),
      ),
    );
    await waitFor(() => expect(lockerGrid.children).toHaveLength(50));
    expect(lockerGrid.lastElementChild).toHaveAttribute('data-reorder-id', 'tool-1');
  });
  it('opens a partial fish collection, sorts numeric weights with stable ties, and selects one gradient', async () => {
    const fish: InventoryItem = {
      ...bandage,
      id: 'bluefin_tuna',
      instanceId: 'tuna-stack',
      name: 'Bluefin Tuna',
      kind: 'tool',
      healHp: 0,
      maxStack: 10,
      quantity: 3,
      artworkPath: '/assets/items/bluefin-tuna.png',
      specimens: [
        {
          id: 'small',
          weightKg: 42,
          trophy: false,
          weightKnown: true,
          minKg: 30,
          maxKg: 250,
          position: 12 / 220,
        },
        {
          id: 'heavy',
          weightKg: 242,
          trophy: true,
          weightKnown: true,
          minKg: 30,
          maxKg: 250,
          position: 212 / 220,
        },
        {
          id: 'equal',
          weightKg: 42,
          trophy: false,
          weightKnown: true,
          minKg: 30,
          maxKg: 250,
          position: 12 / 220,
        },
      ],
    };
    setup({ capacity: 10, usedSlots: 1, items: [fish], locker: [] });
    const opener = await screen.findByRole('button', {
      name: 'Bluefin Tuna, quantity 3, carried, Trophy fish in stack',
    });
    expect(within(opener).getByText('Trophy')).toBeInTheDocument();
    fireEvent.click(opener);

    const rows = screen.getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('strong')?.textContent)).toEqual([
      '242.00 kg',
      '42.00 kg',
      '42.00 kg',
    ]);
    expect(screen.getByText('3 fish')).toBeInTheDocument();
    expect(screen.getByText('An exceptional catch.')).toBeInTheDocument();
    expect(rows[0]?.querySelectorAll('.trophy-badge')).toHaveLength(1);
    for (const row of rows) {
      expect(row.textContent?.match(/\d+\.\d{2} kg/g)).toHaveLength(1);
    }
    expect(screen.getAllByRole('img')).toHaveLength(1);
    const bar = screen.getByRole('img', { name: /242\.00 kilograms/ });
    expect(bar.querySelector('.fish-weight-arrow')).toHaveStyle({ left: `${(212 / 220) * 100}%` });
    const small = screen.getByRole('button', { name: 'Fish 2, 42.00 kg' });
    fireEvent.click(small);
    expect(small).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Fish 3, 42.00 kg' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByText('An exceptional catch.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('img', { name: /42\.00 kilograms/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to item actions' }));
    expect(screen.getByRole('button', { name: 'Store…' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Inspect fish/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('A closer look')).toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
  });
  it('refreshes an open stack and retains a still-present specimen selection', async () => {
    const specimen = {
      id: 'kept',
      weightKg: 200,
      trophy: false,
      weightKnown: true,
      minKg: 30,
      maxKg: 250,
      position: 170 / 220,
    };
    const fish: InventoryItem = {
      ...bandage,
      id: 'bluefin_tuna',
      instanceId: 'stack',
      name: 'Bluefin Tuna',
      kind: 'tool',
      healHp: 0,
      maxStack: 10,
      quantity: 1,
      specimens: [specimen],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ capacity: 10, usedSlots: 1, items: [fish], locker: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const props = { character, busy: false, onBusy: vi.fn(), onCharacter: vi.fn() };
    const view = render(<InventoryPanel {...props} refreshRevision={0} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Bluefin Tuna, quantity 1, carried' }),
    );

    expect(screen.getByText('Fish details')).toBeInTheDocument();
    fetchMock.mockResolvedValue(
      response({
        capacity: 10,
        usedSlots: 1,
        items: [
          {
            ...fish,
            quantity: 2,
            specimens: [specimen, { ...specimen, id: 'new', weightKg: 210 }],
          },
        ],
        locker: [],
      }),
    );
    view.rerender(<InventoryPanel {...props} refreshRevision={1} />);
    await waitFor(() => expect(screen.getByText('2 fish')).toBeInTheDocument());
    expect(screen.getByText('Fish details')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /200\.00 kilograms/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fish 2, 200.00 kg' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fetchMock.mockResolvedValue(
      response({
        capacity: 10,
        usedSlots: 1,
        items: [{ ...fish, specimens: [{ ...specimen, id: 'replacement', weightKg: 210 }] }],
        locker: [],
      }),
    );
    view.rerender(<InventoryPanel {...props} refreshRevision={2} />);
    expect(await screen.findByText('That fish is no longer in this stack.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /210\.00 kilograms/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fish 1, 210.00 kg' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  it('returns focus to the current inventory tile after a manual refresh remounts the grid', async () => {
    const fish: InventoryItem = {
      ...bandage,
      id: 'mackerel',
      instanceId: 'refreshed-stack',
      name: 'Mackerel',
      kind: 'tool',
      healHp: 0,
      maxStack: 10,
      quantity: 1,
      specimens: [
        {
          id: 'fish',
          weightKg: 0.5,
          weightKnown: true,
          trophy: false,
          minKg: 0.2,
          maxKg: 0.8,
          position: 0.5,
        },
      ],
    };
    setup({ capacity: 10, usedSlots: 1, items: [fish], locker: [] });
    const oldTile = await screen.findByRole('button', { name: 'Mackerel, quantity 1, carried' });
    fireEvent.click(oldTile);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh items' }));
    expect(oldTile).not.toBeInTheDocument();
    const currentTile = await screen.findByRole('button', {
      name: 'Mackerel, quantity 1, carried',
    });
    expect(currentTile).not.toBe(oldTile);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(currentTile).toHaveFocus());
  });
  it('keeps unknown fish explicit without inventing a weight, Trophy distinction, or range marker', async () => {
    const fish: InventoryItem = {
      ...bandage,
      id: 'mackerel',
      instanceId: 'unknown-stack',
      name: 'Mackerel',
      kind: 'tool',
      healHp: 0,
      maxStack: 10,
      quantity: 1,
      specimens: [
        {
          id: 'unknown',
          weightKg: null,
          weightKnown: false,
          trophy: false,
          minKg: 0.2,
          maxKg: 0.8,
          position: null,
        },
      ],
    };
    setup({ capacity: 10, usedSlots: 1, items: [fish], locker: [] });
    fireEvent.click(await screen.findByRole('button', { name: 'Mackerel, quantity 1, carried' }));

    expect(screen.getByRole('button', { name: 'Fish 1, weight unavailable' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('This fish has no recorded weight.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('Trophy')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+\.\d+ kg/)).not.toBeInTheDocument();
  });
  it('shows authoritative capacity and disables healing at full health', async () => {
    setup(state, 100);
    fireEvent.click(await screen.findByRole('button', { name: 'Bandage, quantity 2, carried' }));
    expect(screen.getByRole('progressbar', { name: 'Occupied inventory slots' })).toHaveAttribute(
      'value',
      '1',
    );
    expect(screen.getByRole('button', { name: 'Use one bandage' })).toBeDisabled();
    expect(screen.getByText('Already at full health.')).toBeInTheDocument();
  });
  it('validates quantity, sends a partial transfer, and renders the returned locations', async () => {
    const { fetchMock } = setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Bandage, quantity 2, carried' }));
    fireEvent.click(screen.getByRole('button', { name: 'Store…' }));
    fireEvent.change(screen.getByLabelText('Quantity to store'), { target: { value: '3' } });
    expect(screen.getByRole('button', { name: 'Store in locker' })).toBeDisabled();
    expect(screen.getByText('Choose a whole number from 1 to 2.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Quantity to store'), { target: { value: '1' } });
    fetchMock.mockResolvedValueOnce(
      response({
        ...state,
        items: [{ ...bandage, quantity: 1 }],
        locker: [{ ...bandage, instanceId: 'stored-1', location: 'locker', quantity: 1 }],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Store in locker' }));
    expect(await screen.findByText('Moved 1 × Bandage to your city locker.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/inventory/transfer',
      expect.objectContaining({
        body: JSON.stringify({ itemId: 'bandage-1', destination: 'locker', quantity: 1 }),
      }),
    );
    expect(
      screen.getByRole('button', { name: 'Bandage, quantity 1, in locker' }),
    ).toBeInTheDocument();
  });
  it('uses returned health and quantity, and prevents duplicate pending submissions', async () => {
    const { fetchMock, onCharacter } = setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Bandage, quantity 2, carried' }));
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    const use = screen.getByRole('button', { name: 'Use one bandage' });
    fireEvent.click(use);
    fireEvent.click(use);
    expect(use).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    resolve({
      ok: true,
      json: async () => ({
        inventory: { ...state, items: [{ ...bandage, quantity: 1 }] },
        character: { ...character, hp: 75 },
      }),
    } as Response);
    expect(await screen.findByText('Used 1 Bandage. Recovered 25 HP.')).toBeInTheDocument();
    expect(onCharacter).toHaveBeenCalledWith({ ...character, hp: 75 });
  });
  it('allows compatible merges into a full inventory and blocks new occupied slots', async () => {
    setup({
      ...state,
      usedSlots: 10,
      locker: [{ ...bandage, instanceId: 'stored', location: 'locker', quantity: 1 }, toolkit],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Bandage, quantity 1, in locker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take…' }));
    expect(screen.getByRole('button', { name: 'Take into pack' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Use one bandage' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Basic toolkit, quantity 1, in locker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take…' }));
    expect(screen.getByRole('button', { name: 'Take into pack' })).toBeDisabled();
    expect(
      screen.getByText('Your inventory is full. Store a carried item first.'),
    ).toBeInTheDocument();
  });
  it('shows the server rejection without claiming a transfer succeeded', async () => {
    const { fetchMock } = setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Bandage, quantity 2, carried' }));
    fireEvent.click(screen.getByRole('button', { name: 'Store…' }));
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'That item is not available for this transfer.' } }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Store in locker' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That item is not available for this transfer.',
    );
    expect(screen.queryByText('Moved 1 × Bandage to your city locker.')).not.toBeInTheDocument();
  });
  it('recovers a failed inventory load independently of the account', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('The city locker is only available in New Harbor.'))
        .mockResolvedValueOnce(response()),
    );
    render(
      <InventoryPanel character={character} busy={false} onBusy={vi.fn()} onCharacter={vi.fn()} />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The city locker is only available in New Harbor.',
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Refresh items' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Refresh items' }));
    expect(
      await screen.findByRole('button', { name: 'Bandage, quantity 2, carried' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
