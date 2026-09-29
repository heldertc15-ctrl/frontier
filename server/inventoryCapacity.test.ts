// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { createAccount } from './auth.js';
import { createCharacter } from './character.js';
import { openDatabase, seedDatabase } from './database.js';
import { adminInventoryMutation } from './fishing.js';
import { getInventory, reorderItems, transferItem } from './inventory.js';
import { lockerSlotCount } from './inventoryLayout.js';

const previousAdmins = process.env.FRONTIER_ADMIN_USERNAMES;
afterEach(() => {
  if (previousAdmins === undefined) delete process.env.FRONTIER_ADMIN_USERNAMES;
  else process.env.FRONTIER_ADMIN_USERNAMES = previousAdmins;
});

describe('admin inventory and locker capacity', () => {
  it('uses the admin allowlist and environment for authoritative capacity', () => {
    process.env.FRONTIER_ADMIN_USERNAMES = 'operator';
    const database = openDatabase(':memory:');
    seedDatabase(database);
    const admin = createAccount(database, 'operator', 'test-password');
    createCharacter(database, admin.id, 'Operator');
    const player = createAccount(database, 'player', 'test-password');
    createCharacter(database, player.id, 'Player');

    expect(getInventory(database, admin.id, 'development')).toMatchObject({
      capacity: 50,
      lockerCapacity: 50,
    });
    expect(getInventory(database, admin.id, 'production')).toMatchObject({
      capacity: 10,
      lockerCapacity: null,
    });
    expect(getInventory(database, player.id, 'development')).toMatchObject({
      capacity: 10,
      lockerCapacity: null,
    });
    database.close();
  });

  it('holds exactly 50 admin stacks in each container and never grows slots on last-cell drops', () => {
    process.env.FRONTIER_ADMIN_USERNAMES = 'operator';
    const database = openDatabase(':memory:');
    seedDatabase(database);
    const account = createAccount(database, 'operator', 'test-password');
    const character = createCharacter(database, account.id, 'Operator');
    database.prepare('DELETE FROM character_items WHERE character_id = ?').run(character.id);

    const add = (quantity: number) =>
      adminInventoryMutation(database, account.id, 'operator', {
        action: 'add',
        definitionId: 'basic_toolkit',
        quantity,
        requestKey: randomUUID(),
      });
    expect(add(1)).toEqual({ inventoryChanged: true });
    const firstId = getInventory(database, account.id, 'development')!.items[0].instanceId;
    expect(transferItem(database, account.id, firstId, 'locker', 1, 'development')).toHaveProperty(
      'state',
    );
    const lastCell = [...Array<string | null>(49).fill(null), firstId];
    expect(reorderItems(database, account.id, 'locker', lastCell, 'development')).toHaveProperty(
      'state',
    );
    const atLastCell = getInventory(database, account.id, 'development')!;
    expect(atLastCell.locker[0].slotIndex).toBe(49);
    expect(lockerSlotCount(atLastCell.locker, atLastCell.lockerCapacity!)).toBe(50);
    expect(
      transferItem(database, account.id, firstId, 'inventory', 1, 'development'),
    ).toHaveProperty('state');
    expect(
      adminInventoryMutation(database, account.id, 'operator', {
        action: 'clear',
        requestKey: randomUUID(),
      }),
    ).toEqual({ inventoryChanged: true });
    expect(add(50)).toEqual({ inventoryChanged: true });
    expect(add(1)).toMatchObject({ error: 'INVENTORY_FULL' });
    const carried = getInventory(database, account.id, 'development')!.items;
    for (const item of carried)
      expect(
        transferItem(database, account.id, item.instanceId, 'locker', 1, 'development'),
      ).toHaveProperty('state');
    const full = getInventory(database, account.id, 'development')!;
    expect(full.locker).toHaveLength(50);
    expect(lockerSlotCount(full.locker, full.lockerCapacity!)).toBe(50);
    expect(add(1)).toEqual({ inventoryChanged: true });
    const extra = getInventory(database, account.id, 'development')!.items[0]!;
    expect(
      transferItem(database, account.id, extra.instanceId, 'locker', 1, 'development'),
    ).toMatchObject({ error: 'LOCKER_FULL' });
    expect(
      adminInventoryMutation(database, account.id, 'operator', {
        action: 'add',
        definitionId: 'sardine',
        quantity: 1,
        requestKey: randomUUID(),
      }),
    ).toEqual({ inventoryChanged: true });
    const fish = getInventory(database, account.id, 'development')!.items.find(
      (item) => item.id === 'sardine',
    )!;
    expect(
      transferItem(database, account.id, fish.instanceId, 'locker', 1, 'development'),
    ).toMatchObject({ error: 'LOCKER_FULL' });

    const reordered = [...full.locker.map((item) => item.instanceId)];
    reordered[49] = reordered[0];
    reordered[0] = full.locker[49].instanceId;
    expect(reorderItems(database, account.id, 'locker', reordered, 'development')).toHaveProperty(
      'state',
    );
    expect(lockerSlotCount(getInventory(database, account.id, 'development')!.locker, 50)).toBe(50);
    database.close();
  });

  it('keeps ordinary locker growth tied to occupied positions', () => {
    expect(lockerSlotCount([{ slotIndex: 9 }])).toBe(10);
    expect(lockerSlotCount([{ slotIndex: 10 }])).toBe(11);
    expect(lockerSlotCount([{ slotIndex: 49 }], 50)).toBe(50);
  });
});
