import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { RoomSnapshot } from '../../shared/roomTypes';
import { PropertyRoom } from './PropertyRoom';

vi.mock('../room/RoomCanvas', () => ({
  RoomCanvas: ({
    onFloor,
  }: {
    onFloor: (cell: { x: number; y: number }, touch: boolean) => void;
  }) => (
    <div>
      <button onClick={() => onFloor({ x: 7, y: 7 }, false)}>Invalid floor</button>
      <button onClick={() => onFloor({ x: 3, y: 2 }, false)}>Valid floor</button>
      <button onClick={() => onFloor({ x: 2, y: 1 }, true)}>Touch floor</button>
    </div>
  ),
}));

const initial: RoomSnapshot = {
  room: {
    id: 'test-room',
    name: 'Test room',
    locationId: 'new-harbor',
    width: 8,
    depth: 8,
    revision: 0,
  },
  definitions: [
    { id: 'fixture_bench', name: 'Test bench', width: 2, depth: 1, artworkKey: 'bench' },
  ],
  placements: [],
  placedItems: [],
  carriedInventory: {
    capacity: 10,
    usedSlots: 1,
    items: [{ instanceId: 'bench-1', definitionId: 'fixture_bench', name: 'Test bench' }],
  },
};
const saved: RoomSnapshot = {
  ...initial,
  room: { ...initial.room, revision: 1 },
  placements: [{ itemId: 'bench-1', x: 3, y: 2, rotation: 90 }],
  placedItems: [{ instanceId: 'bench-1', definitionId: 'fixture_bench', name: 'Test bench' }],
  carriedInventory: { ...initial.carriedInventory, usedSlots: 0, items: [] },
};
const okay = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

it('previews without writes, rejects invalid floor clicks and submits one rotated instance', async () => {
  const fetchMock = vi
    .fn()
    .mockImplementation((path: string, options?: RequestInit) =>
      Promise.resolve(okay(options?.method === 'POST' ? saved : initial)),
    );
  vi.stubGlobal('fetch', fetchMock);
  const inventoryChanged = vi.fn();
  render(
    <PropertyRoom
      roomId="test-room"
      characterId="review"
      timeOfDay="Day"
      modalOpen={false}
      onBack={vi.fn()}
      onInventoryChange={inventoryChanged}
    />,
  );
  await screen.findByRole('button', { name: /Test bench/ });
  fireEvent.click(screen.getByRole('button', { name: /Test bench/ }));
  expect(screen.getByRole('button', { name: /Test bench/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.queryByText(/#bench/)).not.toBeInTheDocument();
  const preview = within(screen.getByRole('region', { name: 'Placement preview' }));
  expect(preview.getByText('2 × 1 tiles')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Rotate 90°/ }));
  expect(screen.getByText('1 × 2 tiles')).toBeInTheDocument();
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Invalid floor' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Footprint extends beyond the room.');
  expect(screen.getByRole('button', { name: 'Place furniture' })).toBeDisabled();
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Touch floor' }));
  expect(screen.getByText('Ready to place.')).toBeInTheDocument();
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Move preview southeast' }));
  expect(screen.getByText('Cell 3, 1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Valid floor' }));
  await waitFor(() => expect(screen.getByText('Furniture saved.')).toBeInTheDocument());
  const commands = fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(commands).toHaveLength(1);
  expect(JSON.parse(commands[0][1].body)).toMatchObject({
    itemId: 'bench-1',
    x: 3,
    y: 2,
    rotation: 90,
    expectedRevision: 0,
  });
  expect(inventoryChanged).toHaveBeenCalledOnce();
});

it('keeps the draft inert while a modal drawer is open', async () => {
  const fetchMock = vi.fn().mockResolvedValue(okay(initial));
  vi.stubGlobal('fetch', fetchMock);
  render(
    <PropertyRoom
      roomId="test-room"
      characterId="review"
      timeOfDay="Day"
      modalOpen={true}
      onBack={vi.fn()}
      onInventoryChange={vi.fn()}
    />,
  );
  await screen.findByRole('button', { name: /Test bench/ });
  fireEvent.click(screen.getByRole('button', { name: /Test bench/ }));
  expect(screen.queryByText('New placement')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Valid floor' }));
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
});

it('keeps keyboard preview edits reversible until Enter submits', async () => {
  const fetchMock = vi
    .fn()
    .mockImplementation((_path: string, options?: RequestInit) =>
      Promise.resolve(okay(options?.method === 'POST' ? saved : initial)),
    );
  vi.stubGlobal('fetch', fetchMock);
  render(
    <PropertyRoom
      roomId="test-room"
      characterId="review"
      timeOfDay="Day"
      modalOpen={false}
      onBack={vi.fn()}
      onInventoryChange={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: /Test bench/ }));
  const controls = screen.getByLabelText('Room placement controls');
  fireEvent.keyDown(controls, { key: 'ArrowRight' });
  fireEvent.keyDown(controls, { key: 'ArrowDown' });
  fireEvent.keyDown(controls, { key: 'r' });
  expect(screen.getByText('Cell 1, 1')).toBeInTheDocument();
  expect(screen.getByText('Facing 90°')).toBeInTheDocument();
  fireEvent.keyDown(controls, { key: 'Escape' });
  expect(screen.queryByText('New placement')).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: /Test bench/ }));
  fireEvent.keyDown(controls, { key: 'Enter' });
  await waitFor(() => expect(screen.getByText('Furniture saved.')).toBeInTheDocument());
  expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
});

it('keeps the confirmed room while saving and retries an uncertain command with its original key', async () => {
  let rejectFirst!: (error: Error) => void;
  const firstPost = new Promise<ReturnType<typeof okay>>((_, reject) => {
    rejectFirst = reject;
  });
  let postCount = 0;
  const fetchMock = vi.fn().mockImplementation((_path: string, options?: RequestInit) => {
    if (options?.method !== 'POST') return Promise.resolve(okay(initial));
    postCount += 1;
    return postCount === 1 ? firstPost : Promise.resolve(okay(saved));
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <PropertyRoom
      roomId="test-room"
      characterId="review"
      timeOfDay="Day"
      modalOpen={false}
      onBack={vi.fn()}
      onInventoryChange={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: /Test bench/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Place furniture' }));
  expect(await screen.findByText('Saving layout…')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Place furniture' })).toBeDisabled();
  expect(screen.getByText('Nothing placed yet. Choose a carried piece above.')).toBeInTheDocument();
  rejectFirst(new Error('offline'));
  expect(await screen.findByText('Save not confirmed')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry same action' }));
  await waitFor(() => expect(screen.getByText('Furniture saved.')).toBeInTheDocument());
  const bodies = fetchMock.mock.calls
    .filter(([, options]) => options?.method === 'POST')
    .map(([, options]) => JSON.parse(options.body));
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(screen.getByText('Selected in room')).toBeInTheDocument();
});
