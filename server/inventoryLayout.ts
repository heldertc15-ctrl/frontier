export const LOCKER_VISIBLE_SLOTS = 10;

export function lockerSlotCount(
  items: Array<{ slotIndex?: number }>,
  minimum = LOCKER_VISIBLE_SLOTS,
): number {
  const lastOccupied = items.reduce((last, item) => Math.max(last, item.slotIndex ?? -1), -1);
  return Math.max(minimum, items.length, lastOccupied + 1);
}
