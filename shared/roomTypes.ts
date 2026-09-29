import type { Footprint, Placement } from './roomGeometry.js';

export type FurnitureDefinition = Footprint & { id: string; name: string; artworkKey: string };
export type CropDefinition = {
  id: string;
  name: string;
  width: 1 | 2;
  depth: 1 | 2;
  artworkKey: string;
};
export type RoomCrop = {
  itemId: string;
  definitionId: string;
  name: string;
  bedItemId: string;
  width: 1 | 2;
  depth: 1 | 2;
  x: number;
  y: number;
};
export type RoomSummary = {
  id: string;
  name: string;
  locationId: string;
  width: number;
  depth: number;
  revision: number;
};
export type RoomSnapshot = {
  room: RoomSummary;
  definitions: FurnitureDefinition[];
  buildCatalog?: FurnitureDefinition[];
  cropCatalog?: CropDefinition[];
  placements: Placement[];
  crops?: RoomCrop[];
  placedItems: Array<{ instanceId: string; definitionId: string; name: string }>;
  carriedInventory: {
    capacity: number;
    usedSlots: number;
    items: Array<{ instanceId: string; definitionId: string; name: string }>;
  };
  command?: { requestKey: string; appliedRevision: number };
};
