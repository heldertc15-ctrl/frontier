import { useEffect, useRef, useState } from 'react';
import type { Placement } from '../../shared/roomGeometry';
import { occupiedCells, rotatedFootprint } from '../../shared/roomGeometry';
import type { RoomSnapshot } from '../../shared/roomTypes';
import type { TimeOfDay } from '../../server/fishingConfig';
import temporaryFarmBed from '../assets/furniture/temporary-farm-bed.png';
import temporaryFarmBedAxisB from '../assets/furniture/temporary-farm-bed-axis-b.png';
import fixtureTomatoCrop from '../assets/furniture/fixture-tomato-crop.png';
import yardDawn from '../assets/rooms/yard/yard-dawn.webp';
import yardDay from '../assets/rooms/yard/yard-day.webp';
import yardDusk from '../assets/rooms/yard/yard-dusk.webp';
import yardNight from '../assets/rooms/yard/yard-night.webp';
import { depthOrder } from './depthOrder';
import { fitRoom, project, unproject } from './roomProjection';

const YARD_SCENES: Record<TimeOfDay, string> = {
  Dawn: yardDawn,
  Day: yardDay,
  Dusk: yardDusk,
  Night: yardNight,
};

// Measured ground corners in the owner's 1672×941 artwork. The 8×8 floor spans
// approximately x=16…1656; keeping this registration tied to fitRoom also keeps
// pointer picking and furniture on the same cells when the canvas resizes.
const YARD_ART = { backX: 836, backY: 69, floorWidth: 1640, width: 1672, height: 941 };
const TEMPORARY_FARM_BED = {
  artworkKey: 'temporary_farm_bed',
  anchorX: 720 / 1415,
  anchorY: 980 / 1111,
  width: 1415,
  height: 1111,
  groundWidth: 1220,
  groundHeight: 750,
};
type PhaseLighting = { color: number; alpha: number; tint: number };
const PHASE_LIGHTING: Record<TimeOfDay, PhaseLighting> = {
  Dawn: { color: 0xffc98e, alpha: 0.12, tint: 0xffd3a8 },
  Day: { color: 0xfff6e5, alpha: 0.035, tint: 0xffffff },
  Dusk: { color: 0xffa16f, alpha: 0.15, tint: 0xe0a277 },
  Night: { color: 0x6581b7, alpha: 0.18, tint: 0x7887a9 },
};

function blendColor(from: number, to: number, amount: number): number {
  const channel = (shift: number) => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.round(a + (b - a) * amount);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

function blendLighting(from: PhaseLighting, to: PhaseLighting, amount: number): PhaseLighting {
  return {
    color: blendColor(from.color, to.color, amount),
    alpha: from.alpha + (to.alpha - from.alpha) * amount,
    tint: blendColor(from.tint, to.tint, amount),
  };
}

function fitScene(room: RoomSnapshot['room'], width: number, height: number) {
  const projection = fitRoom(room, width, height);
  if (room.width === 8 && room.depth === 8) {
    const scale = (room.width * projection.tileWidth) / YARD_ART.floorWidth;
    projection.originY = (height - YARD_ART.height * scale) / 2 + YARD_ART.backY * scale;
  }
  return projection;
}

function containsPoint(point: { x: number; y: number }, polygon: number[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 2; i < polygon.length; j = i, i += 2) {
    const xi = polygon[i],
      yi = polygon[i + 1],
      xj = polygon[j],
      yj = polygon[j + 1];
    if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

type Props = {
  snapshot: RoomSnapshot;
  timeOfDay: TimeOfDay;
  draft: Placement | null;
  selectedId: string | null;
  invalid: boolean;
  suspended: boolean;
  onHover: (cell: { x: number; y: number } | null) => void;
  onFloor: (cell: { x: number; y: number }, touch: boolean) => void;
  onSelect: (itemId: string | null) => void;
};

export function RoomCanvas({
  snapshot,
  timeOfDay,
  draft,
  selectedId,
  invalid,
  suspended,
  onHover,
  onFloor,
  onSelect,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onHover, onFloor, onSelect });
  const state = useRef({
    snapshot,
    timeOfDay,
    draft,
    selectedId,
    invalid,
    suspended,
  });
  const drawRef = useRef<(() => void) | null>(null);
  const loadYardRef = useRef<((phase: TimeOfDay) => void) | null>(null);
  const [failure, setFailure] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    callbacks.current = { onHover, onFloor, onSelect };
  }, [onHover, onFloor, onSelect]);
  useEffect(() => {
    state.current = { snapshot, timeOfDay, draft, selectedId, invalid, suspended };
    drawRef.current?.();
    loadYardRef.current?.(timeOfDay);
  }, [snapshot, timeOfDay, draft, selectedId, invalid, suspended]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let live = true;
    let app: import('pixi.js').Application | null = null;
    let observer: ResizeObserver | null = null;
    let cleanupInput = () => {};
    let yardFadeFrame = 0;
    void (async () => {
      try {
        const { Application, Assets, Container, Graphics, Sprite } = await import('pixi.js');
        const next = new Application();
        await next.init({
          resizeTo: element,
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          autoDensity: true,
        });
        if (!live) {
          next.destroy(true, { children: true });
          return;
        }
        app = next;
        const canvas = next.canvas as HTMLCanvasElement;
        canvas.setAttribute('aria-hidden', 'true');
        element.appendChild(canvas);
        const yardLayer = new Container();
        next.stage.addChild(yardLayer);
        const yard = new Sprite();
        yard.visible = false;
        yardLayer.addChild(yard);
        let yardReady = false;
        let renderedPhase = state.current.timeOfDay;
        let requestedYard = 0;
        let loadingPhase: TimeOfDay | null = null;
        let incomingYard: import('pixi.js').Sprite | null = null;
        let incomingPhase: TimeOfDay | null = null;
        let pendingYard: { texture: import('pixi.js').Texture; phase: TimeOfDay } | null = null;
        let activeLighting = PHASE_LIGHTING[renderedPhase];
        const finishYardFade = () => {
          if (!incomingYard || !incomingPhase) return;
          const nextTexture = incomingYard.texture;
          yard.texture = nextTexture;
          yard.alpha = 1;
          incomingYard.destroy({ texture: false, textureSource: false });
          incomingYard = null;
          renderedPhase = incomingPhase;
          incomingPhase = null;
          activeLighting = PHASE_LIGHTING[renderedPhase];
          yardReady = true;
          drawRef.current?.();
          const pending = pendingYard;
          pendingYard = null;
          if (pending && pending.phase !== renderedPhase)
            startYardFade(pending.texture, pending.phase);
        };
        function startYardFade(texture: import('pixi.js').Texture, phase: TimeOfDay) {
          if (incomingYard) {
            pendingYard = { texture, phase };
            return;
          }
          if (!yardReady || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            yard.texture = texture;
            yard.alpha = 1;
            renderedPhase = phase;
            activeLighting = PHASE_LIGHTING[phase];
            yardReady = true;
            drawRef.current?.();
            return;
          }
          const incoming = new Sprite(texture);
          incoming.alpha = 0;
          incoming.visible = true;
          yardLayer.addChild(incoming);
          incomingYard = incoming;
          incomingPhase = phase;
          const fromLighting = activeLighting;
          const toLighting = PHASE_LIGHTING[phase];
          const startedAt = performance.now();
          const animate = (now: number) => {
            if (!live || incomingYard !== incoming) return;
            const progress = Math.min(1, (now - startedAt) / 1000);
            const eased = 0.5 - Math.cos(Math.PI * progress) * 0.5;
            yard.alpha = 1 - eased;
            incoming.alpha = eased;
            activeLighting = blendLighting(fromLighting, toLighting, eased);
            drawRef.current?.();
            if (progress < 1) yardFadeFrame = window.requestAnimationFrame(animate);
            else finishYardFade();
          };
          yardFadeFrame = window.requestAnimationFrame(animate);
        }
        const loadYard = (phase: TimeOfDay) => {
          if (phase === incomingPhase) {
            pendingYard = null;
            return;
          }
          if (phase === renderedPhase && yardReady) {
            pendingYard = incomingYard ? { texture: yard.texture, phase } : null;
            return;
          }
          if (phase === loadingPhase) return;
          const request = ++requestedYard;
          loadingPhase = phase;
          void Assets.load(YARD_SCENES[phase])
            .then((texture) => {
              if (!live || request !== requestedYard) return;
              loadingPhase = null;
              startYardFade(texture, phase);
            })
            .catch(() => {
              if (request === requestedYard) loadingPhase = null;
              // Keep the current phase visible; the procedural floor is the initial fallback.
            });
        };
        loadYardRef.current = loadYard;
        const floor = new Graphics();
        next.stage.addChild(floor);
        const farmBedLayer = new Container();
        farmBedLayer.sortableChildren = true;
        next.stage.addChild(farmBedLayer);
        const farmBeds = new Map<string, import('pixi.js').Sprite>();
        const farmCropLayer = new Container();
        farmCropLayer.sortableChildren = true;
        next.stage.addChild(farmCropLayer);
        const farmCrops = new Map<string, import('pixi.js').Sprite>();
        const objects = new Graphics();
        next.stage.addChild(objects);
        const lighting = new Graphics();
        next.stage.addChild(lighting);
        const highlights = new Graphics();
        next.stage.addChild(highlights);
        const farmBedGhost = new Sprite();
        farmBedGhost.visible = false;
        farmBedGhost.anchor.set(TEMPORARY_FARM_BED.anchorX, TEMPORARY_FARM_BED.anchorY);
        next.stage.addChild(farmBedGhost);
        const farmCropGhost = new Sprite();
        farmCropGhost.visible = false;
        farmCropGhost.anchor.set(0.5, 0.94);
        next.stage.addChild(farmCropGhost);
        const overlay = new Graphics();
        next.stage.addChild(overlay);
        let farmBedTextures: [import('pixi.js').Texture, import('pixi.js').Texture] | null = null;
        let farmCropTexture: import('pixi.js').Texture | null = null;
        const drawDiamond = (
          graphics: import('pixi.js').Graphics,
          x: number,
          y: number,
          width: number,
          height: number,
          color: number,
          alpha: number,
          stroke: number,
          strokeWidth = 1.4,
          strokeAlpha = 1,
        ) => {
          const a = project(x, y, projection),
            b = project(x + width, y, projection),
            c = project(x + width, y + height, projection),
            d = project(x, y + height, projection);
          graphics
            .poly([a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y])
            .fill({ color, alpha })
            .stroke({ color: stroke, alpha: strokeAlpha, width: strokeWidth });
        };
        const objectCorners = (
          placement: Placement,
          size: { width: number; depth: number },
          lift: number,
        ) => {
          const footprint = rotatedFootprint(size, placement.rotation);
          return [
            project(placement.x, placement.y, projection),
            project(placement.x + footprint.width, placement.y, projection),
            project(placement.x + footprint.width, placement.y + footprint.depth, projection),
            project(placement.x, placement.y + footprint.depth, projection),
          ].flatMap((point) => [point.x, point.y - lift]);
        };
        const drawObjectLighting = (
          graphics: import('pixi.js').Graphics,
          placement: Placement,
          size: { width: number; depth: number },
          lift: number,
          light: PhaseLighting,
        ) => {
          graphics.poly(objectCorners(placement, size, lift)).fill({
            color: light.color,
            alpha: light.alpha,
          });
        };
        const drawObjectHighlight = (
          graphics: import('pixi.js').Graphics,
          placement: Placement,
          size: { width: number; depth: number },
          lift: number,
        ) => {
          graphics
            .poly(objectCorners(placement, size, lift))
            .fill({ color: 0xffdc9c, alpha: 0.1 })
            .stroke({
              color: 0xffe8bd,
              alpha: 0.94,
              width: Math.max(1.5, projection.tileHeight * 0.045),
            });
        };
        const drawBlock = (
          graphics: import('pixi.js').Graphics,
          placement: Placement,
          size: { width: number; depth: number; artworkKey: string },
          mode: 'saved' | 'selected' | 'subdued' | 'ghost' | 'invalid',
        ) => {
          const footprint = rotatedFootprint(size, placement.rotation);
          const { x, y } = placement;
          const a = project(x, y, projection);
          const b = project(x + footprint.width, y, projection);
          const c = project(x + footprint.width, y + footprint.depth, projection);
          const d = project(x, y + footprint.depth, projection);
          const lift =
            projection.tileHeight *
            (size.artworkKey === 'table' ? 0.86 : size.artworkKey === 'bench' ? 0.58 : 0.72);
          const ghost = mode === 'ghost' || mode === 'invalid';
          const alpha = mode === 'subdued' ? 0.32 : ghost ? 0.7 : 1;
          const palette =
            mode === 'invalid'
              ? { top: 0xb9686a, right: 0x82464c, left: 0x9c555b, edge: 0xffc7c7 }
              : mode === 'ghost'
                ? { top: 0x98dcc5, right: 0x4f9c87, left: 0x73b7a1, edge: 0xe2fff1 }
                : size.artworkKey === 'table'
                  ? { top: 0xb99b79, right: 0x76604e, left: 0x93775e, edge: 0xe6cfae }
                  : size.artworkKey === 'bench'
                    ? { top: 0x9db9b3, right: 0x536e70, left: 0x718e8b, edge: 0xd2e5df }
                    : { top: 0xc49a78, right: 0x795945, left: 0x9c7459, edge: 0xe8c6a7 };
          graphics
            .poly([b.x, b.y - lift, c.x, c.y - lift, c.x, c.y, b.x, b.y])
            .fill({ color: palette.right, alpha })
            .stroke({ color: palette.edge, alpha, width: 1.2 });
          graphics
            .poly([d.x, d.y - lift, c.x, c.y - lift, c.x, c.y, d.x, d.y])
            .fill({ color: palette.left, alpha })
            .stroke({ color: palette.edge, alpha, width: 1.2 });
          graphics
            .poly([a.x, a.y - lift, b.x, b.y - lift, c.x, c.y - lift, d.x, d.y - lift])
            .fill({ color: palette.top, alpha })
            .stroke({ color: palette.edge, alpha, width: mode === 'selected' ? 2.4 : 1.5 });
          const center = project(x + footprint.width / 2, y + footprint.depth / 2, projection);
          // This is a facing indicator, not furniture artwork. Keep it legible at phone scale.
          const marker = Math.max(4, projection.tileHeight * 0.13);
          const angle = (placement.rotation * Math.PI) / 180;
          const facing = [
            [0, -marker],
            [marker * 0.8, marker * 0.65],
            [0, marker * 0.3],
            [-marker * 0.8, marker * 0.65],
          ].flatMap(([mx, my]) => [
            center.x + mx * Math.cos(angle) - my * Math.sin(angle),
            center.y - lift + mx * Math.sin(angle) + my * Math.cos(angle),
          ]);
          graphics.poly(facing).fill({ color: ghost ? 0x173b3e : 0x263a3f, alpha });
        };
        let projection = fitScene(
          state.current.snapshot.room,
          element.clientWidth,
          element.clientHeight,
        );
        let hoveredId: string | null = null;
        const draw = () => {
          const {
            snapshot: snap,
            draft: ghost,
            selectedId: selected,
            invalid: bad,
          } = state.current;
          projection = fitScene(snap.room, element.clientWidth, element.clientHeight);
          floor.clear();
          objects.clear();
          lighting.clear();
          highlights.clear();
          overlay.clear();
          const back = project(0, 0, projection);
          const right = project(snap.room.width, 0, projection);
          const front = project(snap.room.width, snap.room.depth, projection);
          const left = project(0, snap.room.depth, projection);
          const showYard = yardReady && snap.room.width === 8 && snap.room.depth === 8;
          yard.visible = showYard;
          if (showYard) {
            const scale = (snap.room.width * projection.tileWidth) / YARD_ART.floorWidth;
            yard.x = back.x - YARD_ART.backX * scale;
            yard.y = back.y - YARD_ART.backY * scale;
            yard.width = YARD_ART.width * scale;
            yard.height = YARD_ART.height * scale;
            if (incomingYard) {
              incomingYard.visible = true;
              incomingYard.x = yard.x;
              incomingYard.y = yard.y;
              incomingYard.width = yard.width;
              incomingYard.height = yard.height;
            }
            for (let y = 0; y < snap.room.depth; y++)
              for (let x = 0; x < snap.room.width; x++)
                drawDiamond(floor, x, y, 1, 1, 0x203e32, 0, 0x254335, 0.8, 0.28);
          } else {
            if (incomingYard) incomingYard.visible = false;
            const edge = Math.max(4, projection.tileHeight * 0.16);
            // Keep the procedural floor if the yard cannot load or a room has other dimensions.
            floor
              .poly([
                back.x,
                back.y + edge * 2,
                right.x,
                right.y + edge * 2,
                front.x,
                front.y + edge * 2,
                left.x,
                left.y + edge * 2,
              ])
              .fill({ color: 0x050e13, alpha: 0.35 });
            floor
              .poly([
                right.x,
                right.y,
                front.x,
                front.y,
                front.x,
                front.y + edge,
                right.x,
                right.y + edge,
              ])
              .fill({ color: 0x29363b });
            floor
              .poly([
                left.x,
                left.y,
                front.x,
                front.y,
                front.x,
                front.y + edge,
                left.x,
                left.y + edge,
              ])
              .fill({ color: 0x354449 });
            for (let y = 0; y < snap.room.depth; y++)
              for (let x = 0; x < snap.room.width; x++)
                drawDiamond(
                  floor,
                  x,
                  y,
                  1,
                  1,
                  (x + y) % 2 ? 0x465456 : 0x4a585a,
                  1,
                  0x738789,
                  0.65,
                );
          }
          floor.poly([back.x, back.y, right.x, right.y, front.x, front.y, left.x, left.y]).stroke({
            color: showYard ? 0x405c3d : 0x91a8a8,
            alpha: showYard ? 0.4 : 1,
            width: 1.3,
          });
          const definition = new Map(
            [...snap.definitions, ...(snap.cropCatalog ?? []).map((crop) => ({ ...crop }))].map(
              (entry) => [entry.id, entry],
            ),
          );
          const itemType = new Map(
            snap.carriedInventory.items.map((item) => [item.instanceId, item.definitionId]),
          );
          // Placed definitions are sent separately in the snapshot's placement metadata.
          for (const item of snap.placedItems ?? [])
            itemType.set(item.instanceId, item.definitionId);
          const entry = snap.placements.flatMap((placement) => {
            const size = definition.get(itemType.get(placement.itemId) ?? '');
            return size ? [{ placement, size }] : [];
          });
          const hoverId = hoveredId && hoveredId !== selected ? hoveredId : null;
          const lightingStyle = showYard ? activeLighting : PHASE_LIGHTING[state.current.timeOfDay];
          farmBedGhost.visible = false;
          farmCropGhost.visible = false;
          let ordered: string[];
          try {
            ordered = depthOrder(entry);
          } catch {
            setFailure('Furniture ordering is unavailable. Refresh the room.');
            return;
          }
          for (const id of ordered) {
            const object = entry.find((item) => item.placement.itemId === id)!;
            const { placement, size } = object;
            const rotated = rotatedFootprint(size, placement.rotation);
            const active = selected === id;
            const hovered = hoverId === id;
            if (size.artworkKey === TEMPORARY_FARM_BED.artworkKey) {
              const farmBedTexture =
                farmBedTextures?.[placement.rotation % 180 === 90 ? 1 : 0] ?? null;
              // The bed art includes its own soil and border; do not draw a tile slab beneath it.
              if (!farmBedTexture) {
                drawBlock(
                  objects,
                  placement,
                  size,
                  ghost?.itemId === id ? 'subdued' : active ? 'selected' : 'saved',
                );
              } else {
                let sprite = farmBeds.get(id);
                if (!sprite) {
                  sprite = new Sprite(farmBedTexture);
                  sprite.anchor.set(TEMPORARY_FARM_BED.anchorX, TEMPORARY_FARM_BED.anchorY);
                  farmBeds.set(id, sprite);
                  farmBedLayer.addChild(sprite);
                }
                sprite.texture = farmBedTexture;
                const footprint = rotatedFootprint(size, placement.rotation);
                const tileSpan = (footprint.width + footprint.depth) * 0.5;
                const front = project(
                  placement.x + footprint.width,
                  placement.y + footprint.depth,
                  projection,
                );
                sprite.width =
                  (tileSpan * projection.tileWidth * TEMPORARY_FARM_BED.width) /
                  TEMPORARY_FARM_BED.groundWidth;
                sprite.height =
                  (tileSpan * projection.tileHeight * TEMPORARY_FARM_BED.height) /
                  TEMPORARY_FARM_BED.groundHeight;
                sprite.x = front.x;
                sprite.y = front.y;
                sprite.zIndex =
                  placement.x + placement.y + (footprint.width + footprint.depth) * 0.5;
                sprite.alpha = ghost?.itemId === id ? 0.32 : active ? 1 : 0.94;
                sprite.tint = lightingStyle.tint;
                sprite.visible = true;
              }
              // Apply phase color directly to the image; a footprint wash makes the bed read
              // like a tinted grid tile rather than a lit object.
              if (active) drawObjectHighlight(highlights, placement, size, 0);
              continue;
            }
            if (active)
              for (const [x, y] of occupiedCells(placement, size))
                drawDiamond(objects, x, y, 1, 1, 0xc8b37f, 0.35, 0xf1d998);
            else
              drawDiamond(
                objects,
                placement.x,
                placement.y,
                rotated.width,
                rotated.depth,
                0x6c7a76,
                0.5,
                0xc2d0ca,
              );
            drawBlock(
              objects,
              placement,
              size,
              ghost?.itemId === id ? 'subdued' : active ? 'selected' : 'saved',
            );
            const lift =
              projection.tileHeight *
              (size.artworkKey === 'table' ? 0.86 : size.artworkKey === 'bench' ? 0.58 : 0.72);
            drawObjectLighting(lighting, placement, size, lift, lightingStyle);
            if (hovered || active) drawObjectHighlight(highlights, placement, size, lift);
          }
          for (const [id, sprite] of farmBeds) {
            if (
              !entry.some(
                ({ placement, size }) =>
                  placement.itemId === id && size.artworkKey === TEMPORARY_FARM_BED.artworkKey,
              )
            ) {
              farmBedLayer.removeChild(sprite);
              sprite.destroy({ texture: false, textureSource: false });
              farmBeds.delete(id);
            }
          }
          const bedPlacements = new Map(
            entry
              .filter(({ size }) => size.artworkKey === TEMPORARY_FARM_BED.artworkKey)
              .map(({ placement }) => [placement.itemId, placement]),
          );
          const activeCropIds = new Set<string>();
          for (const crop of snap.crops ?? []) {
            const bed = bedPlacements.get(crop.bedItemId);
            if (!bed || !farmCropTexture) continue;
            activeCropIds.add(crop.itemId);
            let sprite = farmCrops.get(crop.itemId);
            if (!sprite) {
              sprite = new Sprite(farmCropTexture);
              sprite.anchor.set(0.5, 0.94);
              farmCrops.set(crop.itemId, sprite);
              farmCropLayer.addChild(sprite);
            }
            const centerOffsetX = crop.width === 2 ? 1 : crop.x + 0.5;
            const centerOffsetY = crop.depth === 2 ? 1 : crop.y + 0.5;
            const point = project(bed.x + centerOffsetX, bed.y + centerOffsetY, projection);
            sprite.width = projection.tileWidth * (crop.width === 2 ? 1.55 : 0.82);
            sprite.height = projection.tileHeight * (crop.depth === 2 ? 2.8 : 2.15);
            sprite.x = point.x;
            sprite.y = point.y + projection.tileHeight * 0.15;
            sprite.zIndex = bed.x + bed.y + crop.x + crop.y + 0.5;
            sprite.tint = lightingStyle.tint;
            sprite.visible = true;
          }
          for (const [id, sprite] of farmCrops)
            if (!activeCropIds.has(id)) {
              farmCropLayer.removeChild(sprite);
              sprite.destroy({ texture: false, textureSource: false });
              farmCrops.delete(id);
            }
          if (ghost) {
            const size = definition.get(itemType.get(ghost.itemId) ?? '');
            if (size) {
              const isCrop = snap.cropCatalog?.some(
                (crop) => crop.id === itemType.get(ghost.itemId),
              );
              const farmBedTexture = farmBedTextures?.[ghost.rotation % 180 === 90 ? 1 : 0] ?? null;
              if (isCrop && farmCropTexture) {
                const point = project(ghost.x + 0.5, ghost.y + 0.5, projection);
                farmCropGhost.texture = farmCropTexture;
                farmCropGhost.width = projection.tileWidth * 0.82;
                farmCropGhost.height = projection.tileHeight * 2.15;
                farmCropGhost.x = point.x;
                farmCropGhost.y = point.y + projection.tileHeight * 0.15;
                farmCropGhost.zIndex = ghost.x + ghost.y + 0.5;
                farmCropGhost.alpha = 0.74;
                farmCropGhost.tint = bad ? 0xf16d74 : 0x74e39e;
                farmCropGhost.visible = true;
                drawDiamond(
                  overlay,
                  ghost.x,
                  ghost.y,
                  1,
                  1,
                  bad ? 0xa9535a : 0x58bd82,
                  0.56,
                  bad ? 0xffb2b5 : 0xd9ffe9,
                );
              } else if (size.artworkKey === TEMPORARY_FARM_BED.artworkKey && farmBedTexture) {
                const footprint = rotatedFootprint(size, ghost.rotation);
                const tileSpan = (footprint.width + footprint.depth) * 0.5;
                const front = project(
                  ghost.x + footprint.width,
                  ghost.y + footprint.depth,
                  projection,
                );
                farmBedGhost.texture = farmBedTexture;
                farmBedGhost.width =
                  (tileSpan * projection.tileWidth * TEMPORARY_FARM_BED.width) /
                  TEMPORARY_FARM_BED.groundWidth;
                farmBedGhost.height =
                  (tileSpan * projection.tileHeight * TEMPORARY_FARM_BED.height) /
                  TEMPORARY_FARM_BED.groundHeight;
                farmBedGhost.x = front.x;
                farmBedGhost.y = front.y;
                farmBedGhost.alpha = 0.62;
                farmBedGhost.tint = bad ? 0xe56f76 : 0x59c996;
                farmBedGhost.visible = true;
              } else {
                for (const [x, y] of occupiedCells(ghost, size))
                  drawDiamond(
                    overlay,
                    x,
                    y,
                    1,
                    1,
                    bad ? 0xa9535a : 0x78baa6,
                    0.58,
                    bad ? 0xffb2b5 : 0xd9ffe9,
                  );
                drawBlock(overlay, ghost, size, bad ? 'invalid' : 'ghost');
              }
            }
          }
        };
        drawRef.current = draw;
        draw();
        if (
          state.current.snapshot.definitions.some(
            (definition) => definition.artworkKey === TEMPORARY_FARM_BED.artworkKey,
          )
        )
          void Promise.all([
            Assets.load(temporaryFarmBed),
            Assets.load(temporaryFarmBedAxisB),
            Assets.load(fixtureTomatoCrop),
          ])
            .then(([texture, axisB, cropTexture]) => {
              if (!live) return;
              farmBedTextures = [texture, axisB];
              farmCropTexture = cropTexture;
              draw();
            })
            .catch(() => {
              // The procedural fixture remains visible if its temporary art cannot load.
            });
        if (state.current.snapshot.room.width === 8 && state.current.snapshot.room.depth === 8)
          loadYard(state.current.timeOfDay);
        observer = new ResizeObserver(() => draw());
        observer.observe(element);
        let down: { id: number; x: number; y: number; button: number } | null = null;
        let handledPointerClick = false;
        const pointFor = (event: { clientX: number; clientY: number }) => {
          const rect = canvas.getBoundingClientRect();
          const x = ((event.clientX - rect.left) * element.clientWidth) / rect.width;
          const y = ((event.clientY - rect.top) * element.clientHeight) / rect.height;
          return { x, y };
        };
        const cellFor = (event: { clientX: number; clientY: number }) => {
          const { x, y } = pointFor(event);
          const cell = unproject(x, y, projection);
          return cell.x >= 0 &&
            cell.y >= 0 &&
            cell.x < state.current.snapshot.room.width &&
            cell.y < state.current.snapshot.room.depth
            ? cell
            : null;
        };
        const itemAtCell = (cell: { x: number; y: number }) => {
          if (state.current.draft) return null;
          const { snapshot: snap } = state.current;
          const definitions = new Map(snap.definitions.map((entry) => [entry.id, entry]));
          const placed = new Map(
            (snap.placedItems ?? []).map((item) => [item.instanceId, item.definitionId]),
          );
          const orderedIds = depthOrder(
            snap.placements.flatMap((placement) => {
              const size = definitions.get(placed.get(placement.itemId) ?? '');
              return size ? [{ placement, size }] : [];
            }),
          ).reverse();
          for (const id of orderedIds) {
            const placement = snap.placements.find((entry) => entry.itemId === id)!;
            const size = definitions.get(placed.get(id) ?? '');
            if (size?.artworkKey === TEMPORARY_FARM_BED.artworkKey) continue;
            if (
              size &&
              occupiedCells(placement, size).some(([x, y]) => x === cell.x && y === cell.y)
            )
              return id;
          }
          return null;
        };
        const itemAtPoint = (point: { x: number; y: number }) => {
          if (state.current.draft) return null;
          const { snapshot: snap } = state.current;
          const definitions = new Map(snap.definitions.map((entry) => [entry.id, entry]));
          const placed = new Map(
            (snap.placedItems ?? []).map((item) => [item.instanceId, item.definitionId]),
          );
          const orderedIds = depthOrder(
            snap.placements.flatMap((placement) => {
              const size = definitions.get(placed.get(placement.itemId) ?? '');
              return size ? [{ placement, size }] : [];
            }),
          ).reverse();
          for (const id of orderedIds) {
            const placement = snap.placements.find((entry) => entry.itemId === id)!;
            const size = definitions.get(placed.get(id) ?? '');
            if (!size) continue;
            if (size.artworkKey === TEMPORARY_FARM_BED.artworkKey) continue;
            const lift =
              projection.tileHeight *
              (size.artworkKey === 'table' ? 0.86 : size.artworkKey === 'bench' ? 0.58 : 0.72);
            if (containsPoint(point, objectCorners(placement, size, lift))) return id;
          }
          return null;
        };
        let lastCell = '';
        const move = (event: PointerEvent) => {
          if (!state.current.suspended) {
            const cell = cellFor(event);
            const key = cell ? `${cell.x},${cell.y}` : '';
            const nextHovered = itemAtPoint(pointFor(event)) ?? (cell ? itemAtCell(cell) : null);
            if (hoveredId !== nextHovered) {
              hoveredId = nextHovered;
              draw();
            }
            if (key !== lastCell) {
              lastCell = key;
              callbacks.current.onHover(cell);
            }
          }
        };
        const leave = () => {
          down = null;
          lastCell = '';
          hoveredId = null;
          draw();
          callbacks.current.onHover(null);
        };
        const pointerDown = (event: PointerEvent) => {
          handledPointerClick = false;
          if (!state.current.suspended && !down && event.button === 0)
            down = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              button: event.button,
            };
        };
        const pointerCancel = () => {
          down = null;
          handledPointerClick = true;
        };
        const activate = (event: { clientX: number; clientY: number }, touch: boolean) => {
          const cell = cellFor(event);
          if (!cell) {
            callbacks.current.onSelect(null);
            return;
          }
          if (!state.current.draft) {
            const id = itemAtCell(cell);
            if (id) {
              hoveredId = null;
              callbacks.current.onSelect(id);
              draw();
              return;
            }
            callbacks.current.onSelect(null);
          }
          callbacks.current.onFloor(cell, touch);
        };
        const pointerUp = (event: PointerEvent) => {
          const start = down;
          down = null;
          if (!start) return;
          handledPointerClick = true;
          if (
            state.current.suspended ||
            start.id !== event.pointerId ||
            Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6
          )
            return;
          activate(event, event.pointerType === 'touch');
        };
        const click = (event: MouseEvent) => {
          if (handledPointerClick || state.current.suspended || event.button !== 0) {
            handledPointerClick = false;
            return;
          }
          activate(event, false);
        };
        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerleave', leave);
        canvas.addEventListener('pointerdown', pointerDown);
        canvas.addEventListener('pointerup', pointerUp);
        canvas.addEventListener('pointercancel', pointerCancel);
        canvas.addEventListener('click', click);
        cleanupInput = () => {
          canvas.removeEventListener('pointermove', move);
          canvas.removeEventListener('pointerleave', leave);
          canvas.removeEventListener('pointerdown', pointerDown);
          canvas.removeEventListener('pointerup', pointerUp);
          canvas.removeEventListener('pointercancel', pointerCancel);
          canvas.removeEventListener('click', click);
        };
        setFailure('');
      } catch {
        if (live) setFailure('The room renderer could not start.');
      }
    })();
    return () => {
      live = false;
      loadYardRef.current = null;
      drawRef.current = null;
      window.cancelAnimationFrame(yardFadeFrame);
      cleanupInput();
      observer?.disconnect();
      app?.destroy(true, { children: true });
    };
  }, [retry]);
  return (
    <div
      className={`room-canvas${snapshot.room.width === 8 && snapshot.room.depth === 8 ? ' room-yard' : ''}`}
      ref={host}
    >
      {failure && (
        <div className="room-render-error" role="alert">
          {failure}{' '}
          <button className="button secondary" onClick={() => setRetry((value) => value + 1)}>
            Retry renderer
          </button>
        </div>
      )}
    </div>
  );
}
