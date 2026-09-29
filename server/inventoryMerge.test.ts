// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAccount } from './auth.js';
import { createCharacter } from './character.js';
import { openDatabase, seedDatabase } from './database.js';
import { adminInventoryMutation } from './fishing.js';
import { getInventory, mergeStacks, transferItem } from './inventory.js';

afterEach(() => vi.restoreAllMocks());

function setup() {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  const database = openDatabase(':memory:');
  seedDatabase(database);
  const account = createAccount(database, 'stack-tester', 'test-password');
  const character = createCharacter(database, account.id, 'Stack Tester');
  database.prepare('DELETE FROM character_items WHERE character_id = ?').run(character.id);
  const add = (definitionId: string, quantity: number) => {
    expect(
      adminInventoryMutation(database, account.id, 'operator', {
        action: 'add',
        definitionId,
        quantity,
        requestKey: randomUUID(),
      }),
    ).toEqual({ inventoryChanged: true });
    return getInventory(database, account.id)!.items.filter((item) => item.id === definitionId);
  };
  return { database, account, add };
}

describe('drag stack merge', () => {
  it('fills the chosen fish stack, leaves a remainder, and preserves every specimen', () => {
    const { database, account, add } = setup();
    const fishStacks = add('sardine', 15);
    const source = fishStacks.find((stack) => stack.quantity === 10)!;
    const target = fishStacks.find((stack) => stack.quantity === 5)!;
    const specimenIds = [...source.specimens!, ...target.specimens!].map((fish) => fish.id).sort();
    expect(mergeStacks(database, account.id, source.instanceId, target.instanceId)).toMatchObject({
      moved: 5,
    });
    const stacks = getInventory(database, account.id)!.items.filter(
      (item) => item.id === 'sardine',
    );
    expect(stacks.find((stack) => stack.instanceId === source.instanceId)?.quantity).toBe(5);
    expect(stacks.find((stack) => stack.instanceId === target.instanceId)?.quantity).toBe(10);
    expect(stacks.flatMap((stack) => stack.specimens!.map((fish) => fish.id)).sort()).toEqual(
      specimenIds,
    );
    expect(mergeStacks(database, account.id, source.instanceId, target.instanceId)).toMatchObject({
      error: 'STACK_FULL',
    });
    database.close();
  });

  it('merges across containers while leaving overflow in the source stack', () => {
    const { database, account, add } = setup();
    const baitStacks = add('squid_bait', 140);
    const source = baitStacks.find((stack) => stack.quantity === 120)!;
    const target = baitStacks.find((stack) => stack.quantity === 20)!;
    expect(transferItem(database, account.id, target.instanceId, 'locker', 20)).toHaveProperty(
      'state',
    );
    expect(mergeStacks(database, account.id, source.instanceId, target.instanceId)).toMatchObject({
      moved: 100,
    });
    const inventory = getInventory(database, account.id)!;
    expect(inventory.items).toEqual([
      expect.objectContaining({ instanceId: source.instanceId, quantity: 20 }),
    ]);
    expect(inventory.locker).toEqual([
      expect.objectContaining({ instanceId: target.instanceId, quantity: 120 }),
    ]);
    database.close();
  });

  it('deletes a fully absorbed source stack', () => {
    const { database, account, add } = setup();
    const baitStacks = add('squid_bait', 140);
    const source = baitStacks.find((stack) => stack.quantity === 120)!;
    const target = baitStacks.find((stack) => stack.quantity === 20)!;
    expect(
      adminInventoryMutation(database, account.id, 'operator', {
        action: 'remove',
        itemId: source.instanceId,
        quantity: 110,
        requestKey: randomUUID(),
      }),
    ).toEqual({ inventoryChanged: true });
    expect(mergeStacks(database, account.id, source.instanceId, target.instanceId)).toMatchObject({
      moved: 10,
    });
    expect(
      getInventory(database, account.id)!.items.filter((item) => item.id === 'squid_bait'),
    ).toEqual([expect.objectContaining({ instanceId: target.instanceId, quantity: 30 })]);
    database.close();
  });

  it('rejects foreign, incompatible, and non-stackable targets without changing inventory', () => {
    const { database, account, add } = setup();
    const [bait] = add('worm_bait', 2);
    const [otherBait] = add('squid_bait', 2);
    const [rod] = add('basic_fishing_rod', 1);
    const other = createAccount(database, 'other-stack', 'test-password');
    createCharacter(database, other.id, 'Other Stack');
    const foreign = getInventory(database, other.id)!.items[0];
    expect(mergeStacks(database, account.id, bait.instanceId, otherBait.instanceId)).toMatchObject({
      error: 'STACK_NOT_COMPATIBLE',
    });
    expect(mergeStacks(database, account.id, bait.instanceId, foreign.instanceId)).toMatchObject({
      error: 'STACK_NOT_COMPATIBLE',
    });
    expect(mergeStacks(database, account.id, rod.instanceId, rod.instanceId)).toMatchObject({
      error: 'VALIDATION_ERROR',
    });
    expect(
      getInventory(database, account.id)!
        .items.map((item) => item.quantity)
        .sort(),
    ).toEqual([1, 2, 2]);
    database.close();
  });
});
