import type { RoomSize } from '../../shared/roomGeometry';

export type RoomProjection = {
  originX: number;
  originY: number;
  tileWidth: number;
  tileHeight: number;
};

export function fitRoom(room: RoomSize, width: number, height: number): RoomProjection {
  const scale = Math.max(
    0.1,
    Math.min(
      (width - 40) / ((room.width + room.depth) * 32),
      (height - 92) / ((room.width + room.depth) * 16),
    ),
  );
  const tileWidth = 64 * scale,
    tileHeight = 32 * scale;
  return {
    tileWidth,
    tileHeight,
    originX: width / 2 - ((room.width - room.depth) * tileWidth) / 4,
    originY: (height - ((room.width + room.depth) * tileHeight) / 2) / 2 + 28,
  };
}

export function project(x: number, y: number, p: RoomProjection): { x: number; y: number } {
  return {
    x: p.originX + ((x - y) * p.tileWidth) / 2,
    y: p.originY + ((x + y) * p.tileHeight) / 2,
  };
}

export function unproject(x: number, y: number, p: RoomProjection): { x: number; y: number } {
  const dx = x - p.originX,
    dy = y - p.originY;
  return {
    x: Math.floor(dx / p.tileWidth + dy / p.tileHeight),
    y: Math.floor(dy / p.tileHeight - dx / p.tileWidth),
  };
}
