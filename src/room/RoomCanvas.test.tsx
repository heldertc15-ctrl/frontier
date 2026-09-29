import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { RoomSnapshot } from '../../shared/roomTypes';
import { RoomCanvas } from './RoomCanvas';
import { fitRoom, project } from './roomProjection';

const { destroy, children, load } = vi.hoisted(() => ({
  destroy: vi.fn(),
  children: [] as unknown[],
  load: vi.fn((url: string) => Promise.resolve({ url })),
}));
vi.mock('pixi.js', () => {
  class Graphics {
    clear() {
      return this;
    }
    poly() {
      return this;
    }
    fill() {
      return this;
    }
    stroke() {
      return this;
    }
    circle() {
      return this;
    }
  }
  class Container {
    sortableChildren = false;
    addChild(child: unknown) {
      children.push(child);
    }
    removeChild(child: unknown) {
      const index = children.indexOf(child);
      if (index >= 0) children.splice(index, 1);
    }
  }
  class Application {
    canvas = document.createElement('canvas');
    stage = { addChild: (child: unknown) => children.push(child) };
    async init() {}
    destroy(...args: unknown[]) {
      destroy(...args);
    }
  }
  class Sprite {
    visible = false;
    texture: unknown;
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    alpha = 1;
    tint = 0xffffff;
    anchor = {
      x: 0,
      y: 0,
      set: (x: number, y: number) => {
        this.anchor.x = x;
        this.anchor.y = y;
      },
    };
  }
  return { Application, Assets: { load }, Container, Graphics, Sprite };
});

const room: RoomSnapshot = {
  room: { id: 'room', name: 'Room', locationId: 'new-harbor', width: 8, depth: 8, revision: 0 },
  definitions: [{ id: 'chair', name: 'Chair', width: 1, depth: 1, artworkKey: 'chair' }],
  placements: [],
  placedItems: [],
  carriedInventory: {
    capacity: 10,
    usedSlots: 1,
    items: [{ instanceId: 'chair-1', definitionId: 'chair', name: 'Chair' }],
  },
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  destroy.mockClear();
  load.mockReset();
  load.mockImplementation((url: string) => Promise.resolve({ url }));
  children.length = 0;
});

it('keeps the latest requested phase when an older image load finishes last', async () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  let resolveDay!: (texture: { url: string }) => void;
  let resolveNight!: (texture: { url: string }) => void;
  load.mockImplementation(
    (url: string) =>
      new Promise((resolve) => {
        if (url.includes('yard-day')) resolveDay = resolve;
        if (url.includes('yard-night')) resolveNight = resolve;
      }),
  );
  const view = render(
    <RoomCanvas
      snapshot={room}
      timeOfDay="Day"
      draft={null}
      selectedId={null}
      invalid={false}
      suspended={false}
      onHover={vi.fn()}
      onFloor={vi.fn()}
      onSelect={vi.fn()}
    />,
  );
  const artwork = await waitFor(() => {
    expect(resolveDay).toBeTypeOf('function');
    return children[1] as { texture?: { url: string } };
  });
  view.rerender(
    <RoomCanvas
      snapshot={room}
      timeOfDay="Night"
      draft={null}
      selectedId={null}
      invalid={false}
      suspended={false}
      onHover={vi.fn()}
      onFloor={vi.fn()}
      onSelect={vi.fn()}
    />,
  );
  await waitFor(() => expect(resolveNight).toBeTypeOf('function'));
  resolveNight({ url: 'yard-night' });
  await waitFor(() => expect(artwork.texture?.url).toBe('yard-night'));
  resolveDay({ url: 'yard-day' });
  await Promise.resolve();
  expect(artwork.texture?.url).toBe('yard-night');
  view.unmount();
});

it('renders the temporary farm-bed fixture as an anchored in-world sprite', async () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  const farmRoom: RoomSnapshot = {
    ...room,
    definitions: [
      {
        id: 'fixture_farm_bed',
        name: 'Temporary farm bed',
        width: 2,
        depth: 2,
        artworkKey: 'temporary_farm_bed',
      },
    ],
    placements: [{ itemId: 'farm-1', x: 2, y: 2, rotation: 0 }],
    placedItems: [
      { instanceId: 'farm-1', definitionId: 'fixture_farm_bed', name: 'Temporary farm bed' },
    ],
    carriedInventory: {
      capacity: 10,
      usedSlots: 0,
      items: [],
    },
  };
  const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 640,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 480,
  });
  try {
    const view = render(
      <RoomCanvas
        snapshot={farmRoom}
        timeOfDay="Day"
        draft={null}
        selectedId={null}
        invalid={false}
        suspended={false}
        onHover={vi.fn()}
        onFloor={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(load).toHaveBeenCalledWith(expect.stringContaining('temporary-farm-bed.png')),
    );
    const sprite = await waitFor(() => {
      const loaded = children.find((child) =>
        (child as { texture?: { url?: string } }).texture?.url?.includes('temporary-farm-bed.png'),
      ) as
        | {
            visible: boolean;
            anchor: { x: number; y: number };
            alpha: number;
            width: number;
            height: number;
          }
        | undefined;
      expect(loaded).toBeDefined();
      expect(loaded!.visible).toBe(true);
      return loaded!;
    });
    const projection = fitRoom(farmRoom.room, 640, 480);
    expect(sprite.anchor).toMatchObject({ x: 720 / 1415, y: 980 / 1111 });
    expect(sprite.width).toBeCloseTo((2 * projection.tileWidth * 1415) / 1220);
    expect(sprite.height).toBeCloseTo((2 * projection.tileHeight * 1111) / 750);
    view.unmount();
  } finally {
    if (width) Object.defineProperty(HTMLElement.prototype, 'clientWidth', width);
    if (height) Object.defineProperty(HTMLElement.prototype, 'clientHeight', height);
  }
});

it('snaps a primary pointer click once and disposes the Pixi application', async () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 640,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 480,
  });
  try {
    const onFloor = vi.fn();
    const view = render(
      <RoomCanvas
        snapshot={room}
        timeOfDay="Day"
        draft={{ itemId: 'chair-1', x: 0, y: 0, rotation: 0 }}
        selectedId={null}
        invalid={false}
        suspended={false}
        onHover={vi.fn()}
        onFloor={onFloor}
        onSelect={vi.fn()}
      />,
    );
    const canvas = await waitFor(() => {
      const element = view.container.querySelector('canvas');
      expect(element).not.toBeNull();
      return element!;
    });
    const artwork = children[1] as {
      visible: boolean;
      x: number;
      y: number;
      width: number;
      height: number;
    };
    await waitFor(() => expect(artwork.visible).toBe(true));
    await waitFor(() =>
      expect(artwork).toHaveProperty('texture.url', expect.stringContaining('yard-day')),
    );
    const p = fitRoom(room.room, 640, 480);
    const scale = (room.room.width * p.tileWidth) / 1640;
    p.originY = (480 - 941 * scale) / 2 + 69 * scale;
    const back = project(0, 0, p);
    expect(artwork.x + 836 * scale).toBeCloseTo(back.x);
    expect(artwork.y + 69 * scale).toBeCloseTo(back.y);
    expect(artwork.width).toBeCloseTo(1672 * scale);
    expect(artwork.height).toBeCloseTo(941 * scale);
    canvas.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 640,
      height: 480,
      right: 640,
      bottom: 480,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(canvas, {
      button: 0,
      pointerId: 1,
      clientX: 320,
      clientY: 224,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(canvas, {
      button: 0,
      pointerId: 1,
      clientX: 320,
      clientY: 224,
      pointerType: 'mouse',
    });
    fireEvent.click(canvas, { button: 0, clientX: 320, clientY: 224 });
    expect(onFloor).toHaveBeenCalledTimes(1);
    expect(onFloor).toHaveBeenCalledWith({ x: 3, y: 3 }, false);
    view.rerender(
      <RoomCanvas
        snapshot={room}
        timeOfDay="Night"
        draft={{ itemId: 'chair-1', x: 0, y: 0, rotation: 0 }}
        selectedId={null}
        invalid={false}
        suspended={false}
        onHover={vi.fn()}
        onFloor={onFloor}
        onSelect={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(artwork).toHaveProperty('texture.url', expect.stringContaining('yard-night')),
    );
    view.unmount();
    expect(destroy).toHaveBeenCalled();
  } finally {
    if (width) Object.defineProperty(HTMLElement.prototype, 'clientWidth', width);
    if (height) Object.defineProperty(HTMLElement.prototype, 'clientHeight', height);
  }
});
