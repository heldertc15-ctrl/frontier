import { rotatedFootprint, type Footprint, type Placement } from '../../shared/roomGeometry';

export function depthOrder(items: Array<{ placement: Placement; size: Footprint }>): string[] {
  const bounds = items.map(({ placement, size }) => ({
    id: placement.itemId,
    x: placement.x,
    y: placement.y,
    maxX: placement.x + rotatedFootprint(size, placement.rotation).width,
    maxY: placement.y + rotatedFootprint(size, placement.rotation).depth,
  }));
  const edges = new Map(bounds.map((item) => [item.id, new Set<string>()]));
  const incoming = new Map(bounds.map((item) => [item.id, 0]));
  for (const a of bounds)
    for (const b of bounds) {
      if (a.id === b.id) continue;
      const horizontalOverlap =
        !(a.maxX <= b.x || b.maxX <= a.x) || !(a.maxY <= b.y || b.maxY <= a.y);
      if (horizontalOverlap && (a.maxX <= b.x || a.maxY <= b.y) && !edges.get(a.id)!.has(b.id)) {
        edges.get(a.id)!.add(b.id);
        incoming.set(b.id, incoming.get(b.id)! + 1);
      }
    }
  const result: string[] = [];
  while (result.length < bounds.length) {
    const available = bounds
      .filter((item) => !result.includes(item.id) && incoming.get(item.id) === 0)
      .sort((a, b) => a.maxX + a.maxY - b.maxX - b.maxY || a.id.localeCompare(b.id));
    if (!available.length) throw new Error('Furniture depth ordering cycle');
    const next = available[0];
    result.push(next.id);
    for (const id of edges.get(next.id)!) incoming.set(id, incoming.get(id)! - 1);
  }
  return result;
}
