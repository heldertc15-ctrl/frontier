// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createRequestHandler } from './app.js';
import { createAccount } from './auth.js';
import { createCharacter } from './character.js';
import { openDatabase, seedDatabase } from './database.js';
import { getInventory, transferItem } from './inventory.js';
import { provisionRoomFixture, roomCommand, roomSnapshot, roomSummaries } from './rooms.js';

const oldAdmins = process.env.FRONTIER_ADMIN_USERNAMES;
afterEach(() => {
  if (oldAdmins === undefined) delete process.env.FRONTIER_ADMIN_USERNAMES;
  else process.env.FRONTIER_ADMIN_USERNAMES = oldAdmins;
});

describe('authoritative room placement', () => {
  it('guards fixture creation and room routes over authenticated HTTP', async () => {
    process.env.FRONTIER_ADMIN_USERNAMES = 'operator';
    const db = openDatabase(':memory:');
    seedDatabase(db);
    const server = createServer(createRequestHandler(db, 'test'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test port');
    const root = `http://127.0.0.1:${address.port}`;
    const register = async (username: string) => {
      const response = await fetch(`${root}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: 'test-password', characterName: username }),
      });
      expect(response.status).toBe(201);
      return response.headers.get('set-cookie')!.split(';')[0];
    };
    try {
      expect((await fetch(`${root}/api/rooms`)).status).toBe(401);
      const visitor = await register('visitor');
      const admin = await register('operator');
      expect(
        (
          await fetch(`${root}/api/rooms/admin/fixture`, {
            method: 'POST',
            headers: { Cookie: visitor },
          })
        ).status,
      ).toBe(403);
      const fixture = await fetch(`${root}/api/rooms/admin/fixture`, {
        method: 'POST',
        headers: { Cookie: admin },
      });
      expect(fixture.status).toBe(200);
      expect(fixture.headers.get('cache-control')).toBe('no-store');
      const room = (await fixture.json()) as {
        room: { id: string };
        carriedInventory: { items: Array<{ instanceId: string; definitionId: string }> };
      };
      expect(room.carriedInventory.items.map((item) => item.definitionId)).toContain(
        'fixture_farm_bed',
      );
      expect(
        (await fetch(`${root}/api/rooms/${room.room.id}`, { headers: { Cookie: visitor } })).status,
      ).toBe(404);
      const itemId = room.carriedInventory.items.find(
        (item) => item.definitionId === 'fixture_chair',
      )!.instanceId;
      const body = {
        itemId,
        x: 0,
        y: 0,
        rotation: 0,
        expectedRevision: 0,
        requestKey: randomUUID(),
      };
      const send = (input: unknown) =>
        fetch(`${root}/api/rooms/${room.room.id}/place`, {
          method: 'POST',
          headers: { Cookie: admin, 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
      expect((await send(body)).status).toBe(200);
      expect((await send(body)).status).toBe(200);
      const reused = await send({ ...body, x: 1 });
      expect(reused.status).toBe(409);
      expect(await reused.json()).toMatchObject({ error: { code: 'REQUEST_KEY_REUSED' } });
      const inventory = await fetch(`${root}/api/inventory`, { headers: { Cookie: admin } });
      expect(JSON.stringify(await inventory.json())).not.toContain(itemId);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      db.close();
    }
  });
  it('provisions only the intended character and persists exact instances, collisions, moves and retries', () => {
    process.env.FRONTIER_ADMIN_USERNAMES = 'operator';
    const db = openDatabase(':memory:');
    seedDatabase(db);
    const account = createAccount(db, 'operator', 'test-password');
    const person = createCharacter(db, account.id, 'Operator');
    const other = createAccount(db, 'visitor', 'test-password');
    createCharacter(db, other.id, 'Visitor');
    expect(roomSummaries(db, other.id)).toEqual([]);
    const initial = provisionRoomFixture(db, account.id);
    if ('error' in initial) throw new Error(initial.message);
    db.prepare('DELETE FROM character_items WHERE character_id = ? AND definition_id = ?').run(
      person.id,
      'fixture_farm_bed',
    );
    const refreshed = provisionRoomFixture(db, account.id);
    expect(refreshed).toMatchObject({ room: { id: initial.room.id } });
    if ('error' in refreshed) throw new Error(refreshed.message);
    expect(
      refreshed.carriedInventory.items.filter((item) => item.definitionId === 'fixture_farm_bed'),
    ).toHaveLength(1);
    const repeated = provisionRoomFixture(db, account.id);
    expect(
      ('error' in repeated ? [] : repeated.carriedInventory.items).filter(
        (item) => item.definitionId === 'fixture_farm_bed',
      ),
    ).toHaveLength(1);
    expect(roomSnapshot(db, other.id, initial.room.id)).toMatchObject({
      error: 'ROOM_UNAVAILABLE',
    });
    const itemId = initial.carriedInventory.items.find(
      (item) => item.definitionId === 'fixture_bench',
    )!.instanceId;
    const chairId = initial.carriedInventory.items.find(
      (item) => item.definitionId === 'fixture_chair',
    )!.instanceId;
    const place = {
      itemId,
      x: 3,
      y: 2,
      rotation: 90,
      expectedRevision: 0,
      requestKey: randomUUID(),
    };
    const first = roomCommand(db, account.id, initial.room.id, 'place', place);
    if ('error' in first) throw new Error(first.message);
    expect(first.placements).toEqual([{ itemId, x: 3, y: 2, rotation: 90 }]);
    expect(first.carriedInventory.items.some((item) => item.instanceId === itemId)).toBe(false);
    expect(getInventory(db, account.id)!.items.some((item) => item.instanceId === itemId)).toBe(
      false,
    );
    expect(transferItem(db, account.id, itemId, 'locker', 1)).toMatchObject({
      error: 'ITEM_NOT_AVAILABLE',
    });
    expect(roomCommand(db, account.id, initial.room.id, 'place', place)).toMatchObject({
      command: { requestKey: place.requestKey, appliedRevision: 1 },
      room: { revision: 1 },
    });
    expect(roomCommand(db, account.id, initial.room.id, 'move', { ...place, x: 4 })).toMatchObject({
      error: 'REQUEST_KEY_REUSED',
    });
    expect(
      roomCommand(db, account.id, initial.room.id, 'place', {
        itemId: chairId,
        x: 3,
        y: 3,
        rotation: 0,
        expectedRevision: 1,
        requestKey: randomUUID(),
      }),
    ).toMatchObject({ error: 'SPACE_OCCUPIED' });
    expect(
      roomCommand(db, account.id, initial.room.id, 'place', {
        itemId: chairId,
        x: 4,
        y: 3,
        rotation: 0,
        expectedRevision: 1,
        requestKey: randomUUID(),
      }),
    ).toMatchObject({ room: { revision: 2 } });
    expect(
      roomCommand(db, account.id, initial.room.id, 'move', {
        itemId,
        x: 3,
        y: 3,
        rotation: 0,
        expectedRevision: 2,
        requestKey: randomUUID(),
      }),
    ).toMatchObject({ error: 'SPACE_OCCUPIED' });
    expect(
      roomCommand(db, account.id, initial.room.id, 'move', {
        itemId,
        x: 0,
        y: 0,
        rotation: 0,
        expectedRevision: 2,
        requestKey: randomUUID(),
      }),
    ).toMatchObject({ room: { revision: 3 } });
    expect(
      roomCommand(db, account.id, initial.room.id, 'move', {
        itemId,
        x: 1,
        y: 1,
        rotation: 0,
        expectedRevision: 1,
        requestKey: randomUUID(),
      }),
    ).toMatchObject({ error: 'ROOM_CHANGED' });
    expect(
      roomCommand(db, other.id, initial.room.id, 'move', {
        itemId,
        x: 1,
        y: 1,
        rotation: 0,
        expectedRevision: 3,
        requestKey: randomUUID(),
      }),
    ).toMatchObject({ error: 'ROOM_UNAVAILABLE' });
    db.prepare("UPDATE characters SET current_location = 'harbor' WHERE id = ?").run(person.id);
    expect(roomSnapshot(db, account.id, initial.room.id)).toMatchObject({
      error: 'ROOM_UNAVAILABLE',
    });
    db.close();
  });
  it('rejects malformed coordinates and unavailable items without advancing revision', () => {
    const db = openDatabase(':memory:');
    seedDatabase(db);
    const account = createAccount(db, 'builder', 'test-password');
    createCharacter(db, account.id, 'Builder');
    const initial = provisionRoomFixture(db, account.id);
    if ('error' in initial) throw new Error(initial.message);
    const itemId = initial.carriedInventory.items[0].instanceId;
    for (const [x, y, rotation] of [
      [-1, 0, 0],
      [8, 0, 0],
      [0, 0, 45],
      [0.5, 0, 0],
      [Number.MAX_SAFE_INTEGER + 1, 0, 0],
    ]) {
      const result = roomCommand(db, account.id, initial.room.id, 'place', {
        itemId,
        x,
        y,
        rotation,
        expectedRevision: 0,
        requestKey: randomUUID(),
      });
      expect(result).toHaveProperty('error');
    }
    expect(roomSnapshot(db, account.id, initial.room.id)).toMatchObject({
      room: { revision: 0 },
      placements: [],
    });
    db.close();
  });
});
