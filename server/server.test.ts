// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { contentTypeFor, createRequestHandler } from './app.js';
import { openDatabase, SCHEMA_VERSION, seedDatabase } from './database.js';
import { insertFishSpecimen } from './fishSpecimens.js';

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true });
});

async function startTestServer() {
  const directory = mkdtempSync(path.join(tmpdir(), 'frontier-test-'));
  temporaryDirectories.push(directory);
  const databasePath = path.join(directory, 'frontier.sqlite');
  const database = openDatabase(databasePath);
  seedDatabase(database);
  const { server, origin } = await listen(database, 'test');
  return { database, databasePath, origin, server };
}
async function listen(
  database: ReturnType<typeof openDatabase>,
  environment: 'test' | 'production',
) {
  const server = createServer(createRequestHandler(database, environment));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Test server did not expose a TCP address.');
  const origin = `http://127.0.0.1:${address.port}`;
  return { origin, server };
}
async function closeTestServer(
  server: ReturnType<typeof createServer>,
  database: ReturnType<typeof openDatabase>,
) {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  database.close();
}
function cookie(response: Response): string {
  const value = response.headers.get('set-cookie');
  if (!value) throw new Error('Expected session cookie.');
  return value.split(';')[0];
}
async function register(origin: string, username: string, characterName: string) {
  const response = await fetch(`${origin}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'test-password', characterName }),
  });
  expect(response.status).toBe(201);
  return {
    cookie: cookie(response),
    body: (await response.json()) as { character: { id: string; name: string } },
  };
}

describe('Frontier account and character APIs', () => {
  it('serves Fishing Store quotes and credits a confirmed specimen sale once', async () => {
    const { database, origin, server } = await startTestServer();
    const seller = await register(origin, 'fish-seller', 'Fish Seller');
    expect((await fetch(`${origin}/api/fish-buyer`)).status).toBe(401);
    expect(
      (await fetch(`${origin}/api/fish-buyer`, { headers: { Cookie: seller.cookie } })).status,
    ).toBe(403);
    const characterId = seller.body.character.id;
    database
      .prepare("UPDATE characters SET current_location = 'fishing-store' WHERE id = ?")
      .run(characterId);
    const stackId = randomBytes(16).toString('hex');
    const now = new Date().toISOString();
    database
      .prepare(
        `INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at)
      VALUES (?, ?, 'sardine', 1, 'inventory', 0, ?, ?)`,
      )
      .run(stackId, characterId, now, now);
    insertFishSpecimen(database, stackId, 0.1, 'catch');
    const quoteResponse = await fetch(`${origin}/api/fish-buyer`, {
      headers: { Cookie: seller.cookie },
    });
    const quote = (await quoteResponse.json()) as {
      buyer: { offers: Array<{ specimens: Array<{ id: string; credits: number }> }> };
    };
    expect(quoteResponse.headers.get('cache-control')).toBe('no-store');
    expect(quote.buyer.offers[0].specimens[0].credits).toBe(3);
    const body = {
      stackId,
      specimenIds: [quote.buyer.offers[0].specimens[0].id],
      requestKey: randomUUID(),
    };
    const sell = () =>
      fetch(`${origin}/api/fish-buyer/sell`, {
        method: 'POST',
        headers: { Cookie: seller.cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const first = await sell();
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      creditsEarned: 3,
      character: { credits: 253, characterXp: 0 },
      buyer: { offers: [] },
    });
    const retry = await sell();
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ creditsEarned: 3, character: { credits: 253 } });
    await closeTestServer(server, database);
  });
  it('serves optimized location artwork with the correct media type', () => {
    expect(contentTypeFor('assets/new-harbor.webp')).toBe('image/webp');
  });

  it('boots with initialized persistence and health status', async () => {
    const { database, origin, server } = await startTestServer();
    const response = await fetch(`${origin}/api/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      database: 'ready',
      schemaVersion: SCHEMA_VERSION,
    });
    await closeTestServer(server, database);
  });

  it('creates, persists, logs out, and logs back into one character', async () => {
    const { database, origin, server } = await startTestServer();
    const first = await register(origin, 'northstar', 'Nora Vale');
    expect(first.body.character.name).toBe('Nora Vale');
    const changed = await fetch(`${origin}/api/character/development-state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: first.cookie },
      body: JSON.stringify({ credits: 375, hp: 74, characterXp: 90 }),
    });
    expect(await changed.json()).toMatchObject({
      character: {
        name: 'Nora Vale',
        credits: 375,
        hp: 74,
        maxHp: 100,
        characterXp: 90,
        characterLevel: 1,
        currentLocation: 'New Harbor',
        activeStatus: 'idle',
      },
    });
    const loggedOut = await fetch(`${origin}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: first.cookie },
    });
    expect(loggedOut.status).toBe(200);
    const loggedIn = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'northstar', password: 'test-password' }),
    });
    expect(loggedIn.status).toBe(200);
    const reloaded = await fetch(`${origin}/api/character`, {
      headers: { Cookie: cookie(loggedIn) },
    });
    expect(await reloaded.json()).toMatchObject({
      character: {
        id: first.body.character.id,
        name: 'Nora Vale',
        credits: 375,
        hp: 74,
        characterXp: 90,
      },
    });
    await closeTestServer(server, database);
  });

  it('isolates character state between separate accounts', async () => {
    const { database, origin, server } = await startTestServer();
    const alpha = await register(origin, 'alpha-user', 'Alpha Reed');
    const beta = await register(origin, 'beta-user', 'Beta Reed');
    await fetch(`${origin}/api/character/development-state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: alpha.cookie },
      body: JSON.stringify({ credits: 900, hp: 40, characterXp: 250 }),
    });
    const betaState = await fetch(`${origin}/api/character`, { headers: { Cookie: beta.cookie } });
    expect(await betaState.json()).toMatchObject({
      character: { name: 'Beta Reed', credits: 250, hp: 100, characterXp: 0 },
    });
    await closeTestServer(server, database);
  });

  it('rejects unauthenticated character access and invalid state changes', async () => {
    const { database, origin, server } = await startTestServer();
    expect((await fetch(`${origin}/api/character`)).status).toBe(401);
    const account = await register(origin, 'valid-user', 'Valid Reed');
    expect(
      (
        await fetch(`${origin}/api/character/development-state`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
          body: JSON.stringify({ hp: 101 }),
        })
      ).status,
    ).toBe(400);
    await closeTestServer(server, database);
  });

  it('rejects duplicate accounts without creating another character', async () => {
    const { database, origin, server } = await startTestServer();
    await register(origin, 'one-account', 'One Reed');
    const duplicate = await fetch(`${origin}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'one-account',
        password: 'test-password',
        characterName: 'Second Reed',
      }),
    });
    expect(duplicate.status).toBe(409);
    expect(
      database.prepare('SELECT count(*) AS count FROM characters').get() as { count: number },
    ).toEqual({ count: 1 });
    await closeTestServer(server, database);
  });

  it('treats expired sessions as anonymous and protects character data', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'expired-user', 'Expired Reed');
    database.prepare('UPDATE sessions SET expires_at = ?').run('2000-01-01T00:00:00.000Z');
    const session = await fetch(`${origin}/api/session`, { headers: { Cookie: account.cookie } });
    await expect(session.json()).resolves.toEqual({ authenticated: false });
    expect(
      (await fetch(`${origin}/api/character`, { headers: { Cookie: account.cookie } })).status,
    ).toBe(401);
    await closeTestServer(server, database);
  });

  it('retains the entire character record after a server restart', async () => {
    const { database, databasePath, origin, server } = await startTestServer();
    const account = await register(origin, 'restart-user', 'Restart Reed');
    database
      .prepare(
        `UPDATE characters
         SET credits = ?, hp = ?, max_hp = ?, character_xp = ?, character_level = ?,
             current_location = ?, active_status = ?`,
      )
      .run(900, 80, 125, 500, 4, 'New Harbor', 'resting');
    await closeTestServer(server, database);
    const restartedDatabase = openDatabase(databasePath);
    const restarted = await listen(restartedDatabase, 'test');
    const loaded = await fetch(`${restarted.origin}/api/character`, {
      headers: { Cookie: account.cookie },
    });
    expect(await loaded.json()).toMatchObject({
      character: {
        name: 'Restart Reed',
        credits: 900,
        hp: 80,
        maxHp: 125,
        characterXp: 500,
        characterLevel: 4,
        currentLocation: 'New Harbor',
        activeStatus: 'resting',
      },
    });
    await closeTestServer(restarted.server, restartedDatabase);
  });

  it('does not expose development state mutation in production', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'frontier-production-test-'));
    temporaryDirectories.push(directory);
    const database = openDatabase(path.join(directory, 'frontier.sqlite'));
    seedDatabase(database);
    const { origin, server } = await listen(database, 'production');
    const account = await register(origin, 'production-user', 'Production Reed');
    expect(
      (
        await fetch(`${origin}/api/character/development-state`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
          body: JSON.stringify({ credits: 999 }),
        })
      ).status,
    ).toBe(404);
    await closeTestServer(server, database);
  });
});

describe('Frontier inventory APIs', () => {
  async function inventory(origin: string, sessionCookie: string) {
    const response = await fetch(`${origin}/api/inventory`, { headers: { Cookie: sessionCookie } });
    return {
      response,
      body: (await response.json()) as {
        inventory: {
          capacity: number;
          usedSlots: number;
          items: Array<{
            instanceId: string;
            id: string;
            quantity: number;
            equipped: boolean;
            slotIndex: number;
          }>;
          locker: Array<{ instanceId: string; id: string; quantity: number; slotIndex: number }>;
        };
      },
    };
  }
  it('persists item order, appends transferred stacks, and rejects stale or foreign reorder lists', async () => {
    const { database, databasePath, origin, server } = await startTestServer();
    const alpha = await register(origin, 'sort-alpha', 'Sort Alpha');
    const beta = await register(origin, 'sort-beta', 'Sort Beta');
    const initial = await inventory(origin, alpha.cookie);
    const original = initial.body.inventory.items.map((item) => item.instanceId);
    const toolkitId = initial.body.inventory.items.find(
      (item) => item.id === 'basic_toolkit',
    )!.instanceId;
    const desired = [toolkitId, ...original.filter((itemId) => itemId !== toolkitId).reverse()];
    const post = (sessionCookie: string, location: string, itemIds: string[]) =>
      fetch(`${origin}/api/inventory/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
        body: JSON.stringify({
          location,
          itemIds:
            location === 'inventory'
              ? [...itemIds, ...Array(10 - itemIds.length).fill(null)]
              : itemIds,
        }),
      });
    const changed = await post(alpha.cookie, 'inventory', desired);
    expect(changed.status).toBe(200);
    expect(
      (await changed.json()).inventory.items.map((item: { instanceId: string }) => item.instanceId),
    ).toEqual(desired);
    const withGap = [
      desired[0]!,
      null,
      ...desired.slice(1),
      ...Array(10 - desired.length - 1).fill(null),
    ];
    const gapped = await fetch(`${origin}/api/inventory/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alpha.cookie },
      body: JSON.stringify({ location: 'inventory', itemIds: withGap }),
    });
    expect(gapped.status).toBe(200);
    const gapState = (await gapped.json()).inventory;
    expect(gapState.items[1].slotIndex).toBe(2);
    const foreign = await post(beta.cookie, 'inventory', desired);
    expect(foreign.status).toBe(400);
    await expect(foreign.json()).resolves.toMatchObject({ error: { code: 'INVENTORY_CHANGED' } });
    const duplicate = await post(alpha.cookie, 'inventory', [desired[0]!, desired[0]!]);
    expect(duplicate.status).toBe(400);
    await expect(duplicate.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    const stale = await post(alpha.cookie, 'inventory', desired.slice(1));
    expect(stale.status).toBe(400);
    await expect(stale.json()).resolves.toMatchObject({ error: { code: 'INVENTORY_CHANGED' } });
    const stored = await fetch(`${origin}/api/inventory/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alpha.cookie },
      body: JSON.stringify({ itemId: desired[0], destination: 'locker', quantity: 1 }),
    });
    expect(stored.status).toBe(200);
    const afterStore = await inventory(origin, alpha.cookie);
    expect(afterStore.body.inventory.items.map((item) => item.instanceId)).toEqual(
      desired.slice(1),
    );
    const bandages = afterStore.body.inventory.items.find((item) => item.id === 'bandage')!;
    const storedBandages = await fetch(`${origin}/api/inventory/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alpha.cookie },
      body: JSON.stringify({
        itemId: bandages.instanceId,
        destination: 'locker',
        quantity: bandages.quantity,
      }),
    });
    expect(storedBandages.status).toBe(200);
    const lockerOrder = [bandages.instanceId, toolkitId];
    expect((await post(alpha.cookie, 'locker', lockerOrder)).status).toBe(200);
    const lockerGapped = [null, ...lockerOrder, ...Array(7).fill(null)];
    const placedLocker = await fetch(`${origin}/api/inventory/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alpha.cookie },
      body: JSON.stringify({ location: 'locker', itemIds: lockerGapped }),
    });
    expect(placedLocker.status).toBe(200);
    expect(
      (await placedLocker.json()).inventory.locker.map(
        (item: { slotIndex: number }) => item.slotIndex,
      ),
    ).toEqual([1, 2]);
    await closeTestServer(server, database);
    const reopened = openDatabase(databasePath);
    const restart = await listen(reopened, 'test');
    const persisted = await inventory(restart.origin, alpha.cookie);
    expect(persisted.body.inventory.items.map((item) => item.instanceId)).toEqual(
      desired.filter((id) => id !== toolkitId && id !== bandages.instanceId),
    );
    expect(persisted.body.inventory.items.map((item) => item.slotIndex)).toEqual(
      persisted.body.inventory.items.map((item) => withGap.indexOf(item.instanceId)),
    );
    expect(persisted.body.inventory.locker.map((item) => item.instanceId)).toEqual(lockerOrder);
    expect(persisted.body.inventory.locker.map((item) => item.slotIndex)).toEqual([1, 2]);
    const taken = await fetch(`${restart.origin}/api/inventory/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alpha.cookie },
      body: JSON.stringify({ itemId: toolkitId, destination: 'inventory', quantity: 1 }),
    });
    expect(taken.status).toBe(200);
    const afterTake = await inventory(restart.origin, alpha.cookie);
    expect(
      afterTake.body.inventory.items.find((item) => item.instanceId === toolkitId)?.slotIndex,
    ).toBe(0);
    await closeTestServer(restart.server, reopened);
  });
  it('seeds persistent starter stacks, clothing, and tools', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'items-user', 'Items Reed');
    const first = await inventory(origin, account.cookie);
    expect(first.response.status).toBe(200);
    expect(first.body.inventory).toMatchObject({ capacity: 10, usedSlots: 4 });
    expect(first.body.inventory.items.map((item) => item.id).sort()).toEqual([
      'bandage',
      'basic_toolkit',
      'field_rations',
      'newcomer_jacket',
    ]);
    await closeTestServer(server, database);
  });
  it('adds the order column when reopening an existing inventory database', async () => {
    const { database, databasePath, origin, server } = await startTestServer();
    const account = await register(origin, 'legacy-order', 'Legacy Order');
    const before = await inventory(origin, account.cookie);
    database.exec(`PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE;
      CREATE TABLE character_items_legacy (
        id TEXT PRIMARY KEY, character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        definition_id TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0),
        location TEXT NOT NULL CHECK(location IN ('inventory','locker')),
        equipped INTEGER NOT NULL DEFAULT 0 CHECK(equipped IN (0,1)),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        CHECK(NOT(location='locker' AND equipped=1)));
      INSERT INTO character_items_legacy (id,character_id,definition_id,quantity,location,equipped,created_at,updated_at)
      SELECT id,character_id,definition_id,quantity,location,equipped,created_at,updated_at FROM character_items;
      DROP TABLE character_items;
      ALTER TABLE character_items_legacy RENAME TO character_items;
      COMMIT; PRAGMA foreign_keys = ON;`);
    await closeTestServer(server, database);
    const reopened = openDatabase(databasePath);
    const restart = await listen(reopened, 'test');
    const after = await inventory(restart.origin, account.cookie);
    expect(after.body.inventory.items.map((item) => item.instanceId)).toEqual(
      before.body.inventory.items.map((item) => item.instanceId),
    );
    await closeTestServer(restart.server, reopened);
  });
  it('enforces carried capacity and preserves all locations across restart', async () => {
    const { database, databasePath, origin, server } = await startTestServer();
    const account = await register(origin, 'capacity-user', 'Capacity Reed');
    const now = new Date().toISOString();
    const character = account.body.character.id;
    for (let index = 0; index < 6; index += 1)
      database
        .prepare(
          'INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at) VALUES (?, ?, ?, 1, ?, 0, ?, ?)',
        )
        .run(`filled-${index}`, character, 'basic_toolkit', 'inventory', now, now);
    database
      .prepare(
        'INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at) VALUES (?, ?, ?, 1, ?, 0, ?, ?)',
      )
      .run('locker-tool', character, 'basic_toolkit', 'locker', now, now);
    const full = await fetch(`${origin}/api/inventory/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
      body: JSON.stringify({ itemId: 'locker-tool', destination: 'inventory', quantity: 1 }),
    });
    expect(full.status).toBe(400);
    await expect(full.json()).resolves.toMatchObject({ error: { code: 'INVENTORY_FULL' } });
    await closeTestServer(server, database);
    const restartedDatabase = openDatabase(databasePath);
    const restarted = await listen(restartedDatabase, 'test');
    const state = await inventory(restarted.origin, account.cookie);
    expect(state.body.inventory).toMatchObject({
      usedSlots: 10,
      locker: [{ instanceId: 'locker-tool', id: 'basic_toolkit' }],
    });
    await closeTestServer(restarted.server, restartedDatabase);
  });
  it('transfers stacks atomically and only for their owner', async () => {
    const { database, origin, server } = await startTestServer();
    const alpha = await register(origin, 'transfer-alpha', 'Alpha Transfer');
    const beta = await register(origin, 'transfer-beta', 'Beta Transfer');
    const initial = await inventory(origin, alpha.cookie);
    const rations = initial.body.inventory.items.find((item) => item.id === 'field_rations')!;
    const moved = await fetch(`${origin}/api/inventory/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alpha.cookie },
      body: JSON.stringify({ itemId: rations.instanceId, destination: 'locker', quantity: 2 }),
    });
    expect(moved.status).toBe(200);
    const movedBody = (await moved.json()) as {
      inventory: {
        items: Array<{ id: string; quantity: number }>;
        locker: Array<{ id: string; quantity: number }>;
      };
    };
    expect(
      movedBody.inventory.items.some((item) => item.id === 'field_rations' && item.quantity === 1),
    ).toBe(true);
    expect(
      movedBody.inventory.locker.some((item) => item.id === 'field_rations' && item.quantity === 2),
    ).toBe(true);
    const theft = await fetch(`${origin}/api/inventory/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: beta.cookie },
      body: JSON.stringify({ itemId: rations.instanceId, destination: 'locker', quantity: 1 }),
    });
    expect(theft.status).toBe(400);
    await expect(theft.json()).resolves.toMatchObject({ error: { code: 'ITEM_NOT_AVAILABLE' } });
    await closeTestServer(server, database);
  });
  it('conserves quantity when an entire source stack merges into a compatible stack', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'merge-user', 'Merge Reed');
    const initial = await inventory(origin, account.cookie);
    const rations = initial.body.inventory.items.find((item) => item.id === 'field_rations')!;
    const split = await fetch(`${origin}/api/inventory/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
      body: JSON.stringify({ itemId: rations.instanceId, destination: 'locker', quantity: 1 }),
    });
    expect(split.status).toBe(200);
    const merge = await fetch(`${origin}/api/inventory/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
      body: JSON.stringify({ itemId: rations.instanceId, destination: 'locker', quantity: 2 }),
    });
    expect(merge.status).toBe(200);
    const final = await inventory(origin, account.cookie);
    const allRations = [...final.body.inventory.items, ...final.body.inventory.locker].filter(
      (item) => item.id === 'field_rations',
    );
    expect(allRations.reduce((total, item) => total + item.quantity, 0)).toBe(3);
    expect(final.body.inventory.items.some((item) => item.id === 'field_rations')).toBe(false);
    expect(final.body.inventory.locker).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'field_rations', quantity: 3 })]),
    );
    await closeTestServer(server, database);
  });
  it('merges the chosen stacks through the authenticated API', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'drop-merge-user', 'Drop Merge');
    const initial = await inventory(origin, account.cookie);
    const rations = initial.body.inventory.items.find((item) => item.id === 'field_rations')!;
    const split = await fetch(`${origin}/api/inventory/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
      body: JSON.stringify({ itemId: rations.instanceId, destination: 'locker', quantity: 1 }),
    });
    expect(split.status).toBe(200);
    const splitBody = await split.json();
    const targetId = splitBody.inventory.locker[0].instanceId;
    const body = JSON.stringify({ sourceId: rations.instanceId, targetId });
    const anonymous = await fetch(`${origin}/api/inventory/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    expect(anonymous.status).toBe(401);
    const merged = await fetch(`${origin}/api/inventory/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
      body,
    });
    expect(merged.status).toBe(200);
    await expect(merged.json()).resolves.toMatchObject({
      moved: 2,
      inventory: {
        items: expect.not.arrayContaining([
          expect.objectContaining({ instanceId: rations.instanceId }),
        ]),
        locker: [expect.objectContaining({ instanceId: targetId, quantity: 3 })],
      },
    });
    await closeTestServer(server, database);
  });
  it('rejects invalid quantities and client-authored item data without changing inventory', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'validation-user', 'Validation Reed');
    const initial = await inventory(origin, account.cookie);
    const rations = initial.body.inventory.items.find((item) => item.id === 'field_rations')!;
    for (const quantity of [0, -1, 1.5, 4, '2']) {
      const response = await fetch(`${origin}/api/inventory/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
        body: JSON.stringify({
          itemId: rations.instanceId,
          destination: 'locker',
          quantity,
          definitionId: 'bandage',
          resultingQuantity: 999,
        }),
      });
      expect(response.status).toBe(400);
    }
    const invented = await fetch(`${origin}/api/inventory/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
      body: JSON.stringify({
        itemId: 'client-created-item',
        destination: 'locker',
        quantity: 1,
        definitionId: 'bandage',
      }),
    });
    expect(invented.status).toBe(400);
    const final = await inventory(origin, account.cookie);
    expect(final.body.inventory.items.find((item) => item.id === 'field_rations')?.quantity).toBe(
      3,
    );
    expect(final.body.inventory.locker).toEqual([]);
    expect(
      database.prepare('SELECT count(*) AS count FROM character_items').get() as { count: number },
    ).toEqual({ count: 4 });
    await closeTestServer(server, database);
  });
  it('allows a compatible merge into a full inventory but rejects a new occupied slot', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'full-merge-user', 'Full Merge');
    const initial = await inventory(origin, account.cookie);
    const bandage = initial.body.inventory.items.find((item) => item.id === 'bandage')!;
    expect(
      (
        await fetch(`${origin}/api/inventory/transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
          body: JSON.stringify({ itemId: bandage.instanceId, destination: 'locker', quantity: 1 }),
        })
      ).status,
    ).toBe(200);
    const now = new Date().toISOString();
    for (let index = 0; index < 6; index += 1)
      database
        .prepare(
          'INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at) VALUES (?, ?, ?, 1, ?, 0, ?, ?)',
        )
        .run(
          `full-tool-${index}`,
          account.body.character.id,
          'basic_toolkit',
          'inventory',
          now,
          now,
        );
    database
      .prepare(
        'INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at) VALUES (?, ?, ?, 1, ?, 0, ?, ?)',
      )
      .run('full-locker-tool', account.body.character.id, 'basic_toolkit', 'locker', now, now);
    const fullState = await inventory(origin, account.cookie);
    expect(fullState.body.inventory.usedSlots).toBe(10);
    const storedBandage = fullState.body.inventory.locker.find((item) => item.id === 'bandage')!;
    const merge = await fetch(`${origin}/api/inventory/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
      body: JSON.stringify({
        itemId: storedBandage.instanceId,
        destination: 'inventory',
        quantity: 1,
      }),
    });
    expect(merge.status).toBe(200);
    const newSlot = await fetch(`${origin}/api/inventory/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
      body: JSON.stringify({ itemId: 'full-locker-tool', destination: 'inventory', quantity: 1 }),
    });
    expect(newSlot.status).toBe(400);
    await expect(newSlot.json()).resolves.toMatchObject({ error: { code: 'INVENTORY_FULL' } });
    const final = await inventory(origin, account.cookie);
    expect(final.body.inventory.usedSlots).toBe(10);
    expect(final.body.inventory.items.find((item) => item.id === 'bandage')?.quantity).toBe(2);
    expect(final.body.inventory.locker).toEqual(
      expect.arrayContaining([expect.objectContaining({ instanceId: 'full-locker-tool' })]),
    );
    await closeTestServer(server, database);
  });
  it('conserves items across repeated requests and immediate refreshes', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'retry-user', 'Retry Reed');
    const initial = await inventory(origin, account.cookie);
    const toolkit = initial.body.inventory.items.find((item) => item.id === 'basic_toolkit')!;
    const transfer = () =>
      fetch(`${origin}/api/inventory/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
        body: JSON.stringify({ itemId: toolkit.instanceId, destination: 'locker', quantity: 1 }),
      });
    const attempts = await Promise.all([transfer(), transfer()]);
    expect(attempts.map((response) => response.status).sort()).toEqual([200, 400]);
    const refreshed = await inventory(origin, account.cookie);
    const toolRows = [...refreshed.body.inventory.items, ...refreshed.body.inventory.locker].filter(
      (item) => item.id === 'basic_toolkit',
    );
    expect(toolRows).toHaveLength(1);
    expect(toolRows[0]).toMatchObject({ quantity: 1 });
    expect(refreshed.body.inventory.locker).toEqual(
      expect.arrayContaining([expect.objectContaining({ instanceId: toolkit.instanceId })]),
    );
    await closeTestServer(server, database);
  });
  it('keeps incompatible items as separate instances during transfers', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'instances-user', 'Instances Reed');
    const initial = await inventory(origin, account.cookie);
    const jacket = initial.body.inventory.items.find((item) => item.id === 'newcomer_jacket')!;
    const toolkit = initial.body.inventory.items.find((item) => item.id === 'basic_toolkit')!;
    for (const item of [jacket, toolkit]) {
      const moved = await fetch(`${origin}/api/inventory/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
        body: JSON.stringify({ itemId: item.instanceId, destination: 'locker', quantity: 1 }),
      });
      expect(moved.status).toBe(200);
    }
    const final = await inventory(origin, account.cookie);
    expect(final.body.inventory.locker).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'newcomer_jacket', quantity: 1 }),
        expect.objectContaining({ id: 'basic_toolkit', quantity: 1 }),
      ]),
    );
    expect(final.body.inventory.locker).toHaveLength(2);
    await closeTestServer(server, database);
  });
  it('uses a carried bandage server-authoritatively and consumes one unit', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'bandage-user', 'Bandage Reed');
    await fetch(`${origin}/api/character/development-state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
      body: JSON.stringify({ hp: 50 }),
    });
    const before = await inventory(origin, account.cookie);
    const bandage = before.body.inventory.items.find((item) => item.id === 'bandage')!;
    const used = await fetch(`${origin}/api/inventory/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
      body: JSON.stringify({ itemId: bandage.instanceId }),
    });
    expect(used.status).toBe(200);
    const usedBody = (await used.json()) as {
      character: { hp: number };
      inventory: { items: Array<{ id: string; quantity: number }> };
    };
    expect(usedBody.character.hp).toBe(75);
    expect(
      usedBody.inventory.items.some((item) => item.id === 'bandage' && item.quantity === 1),
    ).toBe(true);
    const forged = await fetch(`${origin}/api/inventory/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
      body: JSON.stringify({ itemId: 'not-an-item', healHp: 9999 }),
    });
    expect(forged.status).toBe(400);
    await closeTestServer(server, database);
  });
  it('consumes the last item in a stack and cannot heal from the deleted instance again', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'last-item-user', 'Last Item');
    await fetch(`${origin}/api/character/development-state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
      body: JSON.stringify({ hp: 0 }),
    });
    const initial = await inventory(origin, account.cookie);
    const bandage = initial.body.inventory.items.find((item) => item.id === 'bandage')!;
    const use = () =>
      fetch(`${origin}/api/inventory/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
        body: JSON.stringify({ itemId: bandage.instanceId, healHp: 10_000 }),
      });
    expect((await use()).status).toBe(200);
    expect((await use()).status).toBe(200);
    const repeated = await use();
    expect(repeated.status).toBe(400);
    await expect(repeated.json()).resolves.toMatchObject({
      error: { code: 'ITEM_NOT_AVAILABLE' },
    });
    const character = await fetch(`${origin}/api/character`, {
      headers: { Cookie: account.cookie },
    });
    await expect(character.json()).resolves.toMatchObject({ character: { hp: 50 } });
    const final = await inventory(origin, account.cookie);
    expect(final.body.inventory.items.some((item) => item.id === 'bandage')).toBe(false);
    await closeTestServer(server, database);
  });
  it('equips and unequips only the owning account item without changing quantity', async () => {
    const { database, origin, server } = await startTestServer();
    const alpha = await register(origin, 'equip-alpha', 'Equip Alpha');
    const beta = await register(origin, 'equip-beta', 'Equip Beta');
    const alphaState = await inventory(origin, alpha.cookie);
    const alphaJacket = alphaState.body.inventory.items.find(
      (item) => item.id === 'newcomer_jacket',
    )!;
    const equip = await fetch(`${origin}/api/inventory/equip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alpha.cookie },
      body: JSON.stringify({ itemId: alphaJacket.instanceId, equipped: false }),
    });
    expect(equip.status).toBe(200);
    const betaAttempt = await fetch(`${origin}/api/inventory/unequip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: beta.cookie },
      body: JSON.stringify({ itemId: alphaJacket.instanceId }),
    });
    expect(betaAttempt.status).toBe(400);
    const unequip = await fetch(`${origin}/api/inventory/unequip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alpha.cookie },
      body: JSON.stringify({ itemId: alphaJacket.instanceId }),
    });
    expect(unequip.status).toBe(200);
    const final = await inventory(origin, alpha.cookie);
    expect(
      final.body.inventory.items.find((item) => item.instanceId === alphaJacket.instanceId),
    ).toMatchObject({ quantity: 1, equipped: false });
    await closeTestServer(server, database);
  });
  it('lets two accounts mutate their own stacks independently', async () => {
    const { database, origin, server } = await startTestServer();
    const alpha = await register(origin, 'independent-alpha', 'Independent Alpha');
    const beta = await register(origin, 'independent-beta', 'Independent Beta');
    const alphaInitial = await inventory(origin, alpha.cookie);
    const betaInitial = await inventory(origin, beta.cookie);
    const alphaRations = alphaInitial.body.inventory.items.find(
      (item) => item.id === 'field_rations',
    )!;
    const betaRations = betaInitial.body.inventory.items.find(
      (item) => item.id === 'field_rations',
    )!;
    await Promise.all([
      fetch(`${origin}/api/inventory/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: alpha.cookie },
        body: JSON.stringify({
          itemId: alphaRations.instanceId,
          destination: 'locker',
          quantity: 1,
        }),
      }),
      fetch(`${origin}/api/inventory/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: beta.cookie },
        body: JSON.stringify({
          itemId: betaRations.instanceId,
          destination: 'locker',
          quantity: 2,
        }),
      }),
    ]);
    const alphaFinal = await inventory(origin, alpha.cookie);
    const betaFinal = await inventory(origin, beta.cookie);
    expect(
      alphaFinal.body.inventory.items.find((item) => item.id === 'field_rations')?.quantity,
    ).toBe(2);
    expect(
      alphaFinal.body.inventory.locker.find((item) => item.id === 'field_rations')?.quantity,
    ).toBe(1);
    expect(
      betaFinal.body.inventory.items.find((item) => item.id === 'field_rations')?.quantity,
    ).toBe(1);
    expect(
      betaFinal.body.inventory.locker.find((item) => item.id === 'field_rations')?.quantity,
    ).toBe(2);
    await closeTestServer(server, database);
  });
  it('rejects invalid and remote locker operations, while equipment can be toggled', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'locker-user', 'Locker Reed');
    const state = await inventory(origin, account.cookie);
    const jacket = state.body.inventory.items.find((item) => item.id === 'newcomer_jacket')!;
    const equipped = await fetch(`${origin}/api/inventory/equip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
      body: JSON.stringify({ itemId: jacket.instanceId }),
    });
    expect(equipped.status).toBe(200);
    const equippedBody = (await equipped.json()) as {
      inventory: { items: Array<{ id: string; equipped: boolean }> };
    };
    expect(
      equippedBody.inventory.items.some((item) => item.id === 'newcomer_jacket' && item.equipped),
    ).toBe(true);
    database
      .prepare("UPDATE characters SET current_location = 'Coastal Camp' WHERE id = ?")
      .run(account.body.character.id);
    expect(
      (await fetch(`${origin}/api/inventory`, { headers: { Cookie: account.cookie } })).status,
    ).toBe(403);
    const remote = await fetch(`${origin}/api/inventory/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
      body: JSON.stringify({ itemId: jacket.instanceId, destination: 'locker', quantity: 1 }),
    });
    expect(remote.status).toBe(403);
    const remoteReorder = await fetch(`${origin}/api/inventory/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: account.cookie },
      body: JSON.stringify({
        location: 'inventory',
        itemIds: [
          ...state.body.inventory.items.map((item) => item.instanceId),
          ...Array(6).fill(null),
        ],
      }),
    });
    expect(remoteReorder.status).toBe(403);
    await closeTestServer(server, database);
  });
});

describe('Frontier city location APIs', () => {
  async function locations(origin: string, sessionCookie: string) {
    const response = await fetch(`${origin}/api/locations`, { headers: { Cookie: sessionCookie } });
    return {
      response,
      body: (await response.json()) as {
        locationState: {
          currentLocationId: string;
          discoveredLocationIds: string[];
          pinnedLocationIds: string[];
          locations: Array<{
            id: string;
            name: string;
            kind: string;
            parentId: string | null;
            childLocationIds: string[];
            pinEligible: boolean;
            hotspots: Array<{ targetLocationId: string; region?: unknown }>;
          }>;
        };
      },
    };
  }
  function action(
    origin: string,
    sessionCookie: string,
    path: 'navigate' | 'quick-navigate' | 'pins',
    body: Record<string, unknown>,
  ) {
    return fetch(`${origin}/api/locations/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify(body),
    });
  }
  it('defines the city hierarchy, representative places, and coordinate-ready hotspots', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'map-definitions', 'Map Definitions');
    const state = await locations(origin, account.cookie);
    expect(state.response.status).toBe(200);
    expect(state.body.locationState).toMatchObject({
      currentLocationId: 'new-harbor',
      discoveredLocationIds: ['new-harbor'],
    });
    expect(state.body.locationState.locations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'new-harbor', kind: 'city' }),
        expect.objectContaining({ id: 'harbor', kind: 'district' }),
        expect.objectContaining({ id: 'market-district', kind: 'district' }),
        expect.objectContaining({ id: 'industrial-district', kind: 'district' }),
        expect.objectContaining({
          id: 'civic-residential',
          name: 'Residential District',
          kind: 'district',
        }),
        expect.objectContaining({ id: 'city-centre', name: 'City Centre', kind: 'district' }),
        expect.objectContaining({ id: 'transit-hub', name: 'Transit Hub', kind: 'zone' }),
        expect.objectContaining({ id: 'outskirts', name: 'Outskirts', kind: 'zone' }),
        expect.objectContaining({ id: 'fishing-pier', parentId: 'harbor', pinEligible: true }),
        expect.objectContaining({ id: 'freight-terminal', parentId: 'harbor' }),
        expect.objectContaining({ id: 'refinery', parentId: 'industrial-district' }),
        expect.objectContaining({ id: 'civic-hall', parentId: 'city-centre' }),
        expect.objectContaining({ id: 'newcomer-housing', parentId: 'civic-residential' }),
      ]),
    );
    const city = state.body.locationState.locations.find(
      (location) => location.id === 'new-harbor',
    )!;
    expect(city.hotspots.map((hotspot) => hotspot.targetLocationId)).toEqual(city.childLocationIds);
    await closeTestServer(server, database);
  });
  it('keeps the existing residential id and enters each district or zone through validated city routes', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'city-seven-routes', 'City Seven Routes');
    for (const id of [
      'harbor',
      'market-district',
      'industrial-district',
      'civic-residential',
      'city-centre',
      'transit-hub',
      'outskirts',
    ]) {
      const entered = await action(origin, account.cookie, 'navigate', { locationId: id });
      expect(entered.status).toBe(200);
      expect((await entered.json()).locationState.currentLocationId).toBe(id);
      expect(
        (await action(origin, account.cookie, 'navigate', { locationId: 'new-harbor' })).status,
      ).toBe(200);
    }
    const state = (await locations(origin, account.cookie)).body.locationState;
    expect(state.discoveredLocationIds).toEqual(
      expect.arrayContaining(
        state.locations.find((place) => place.id === 'new-harbor')!.childLocationIds,
      ),
    );
    expect(
      (await action(origin, account.cookie, 'navigate', { locationId: 'civic-hall' })).status,
    ).toBe(400);
    await closeTestServer(server, database);
  });
  it('navigates only connected routes and records a first visit once', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'city-route-user', 'City Route');
    const invalid = await action(origin, account.cookie, 'navigate', {
      locationId: 'fishing-pier',
    });
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({
      error: { code: 'LOCATION_NOT_REACHABLE' },
    });
    const unknown = await action(origin, account.cookie, 'navigate', { locationId: 'not-a-place' });
    expect(unknown.status).toBe(400);
    await expect(unknown.json()).resolves.toMatchObject({ error: { code: 'LOCATION_NOT_FOUND' } });
    const invalidPin = await action(origin, account.cookie, 'pins', {
      locationId: 'new-harbor',
      pinned: true,
    });
    expect(invalidPin.status).toBe(400);
    await expect(invalidPin.json()).resolves.toMatchObject({
      error: { code: 'LOCATION_NOT_PINNABLE' },
    });
    expect(
      (await action(origin, account.cookie, 'navigate', { locationId: 'harbor' })).status,
    ).toBe(200);
    const districtPin = await action(origin, account.cookie, 'pins', {
      locationId: 'harbor',
      pinned: true,
    });
    expect(districtPin.status).toBe(200);
    expect((await districtPin.json()).locationState.pinnedLocationIds).toContain('harbor');
    expect(
      (await action(origin, account.cookie, 'navigate', { locationId: 'fishing-pier' })).status,
    ).toBe(200);
    await action(origin, account.cookie, 'navigate', { locationId: 'harbor' });
    await action(origin, account.cookie, 'navigate', { locationId: 'fishing-pier' });
    const state = await locations(origin, account.cookie);
    expect(state.body.locationState).toMatchObject({
      currentLocationId: 'fishing-pier',
      discoveredLocationIds: expect.arrayContaining(['harbor', 'fishing-pier']),
    });
    expect(
      database
        .prepare(
          "SELECT count(*) AS count FROM character_discovered_locations WHERE location_id = 'fishing-pier'",
        )
        .get() as { count: number },
    ).toEqual({ count: 1 });
    await closeTestServer(server, database);
  });
  it('serializes repeated and competing navigation requests without duplicate discoveries', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'city-double-nav', 'City Double Navigate');
    const repeated = await Promise.all([
      action(origin, account.cookie, 'navigate', { locationId: 'harbor' }),
      action(origin, account.cookie, 'navigate', { locationId: 'harbor' }),
    ]);
    expect(repeated.map((response) => response.status).sort()).toEqual([200, 400]);
    expect(
      database
        .prepare(
          "SELECT count(*) AS count FROM character_discovered_locations WHERE location_id = 'harbor'",
        )
        .get() as { count: number },
    ).toEqual({ count: 1 });

    const competing = await Promise.all([
      action(origin, account.cookie, 'navigate', { locationId: 'fishing-pier' }),
      action(origin, account.cookie, 'navigate', { locationId: 'boat-market' }),
    ]);
    expect(competing.map((response) => response.status).sort()).toEqual([200, 400]);
    expect(
      database
        .prepare(
          "SELECT count(*) AS count FROM character_discovered_locations WHERE location_id IN ('fishing-pier', 'boat-market')",
        )
        .get() as { count: number },
    ).toEqual({ count: 1 });
    await closeTestServer(server, database);
  });
  it('persists discoveries, pins, and the character location after restart', async () => {
    const { database, databasePath, origin, server } = await startTestServer();
    const account = await register(origin, 'location-restart', 'Location Restart');
    await action(origin, account.cookie, 'navigate', { locationId: 'harbor' });
    await action(origin, account.cookie, 'navigate', { locationId: 'fishing-pier' });
    expect(
      (await action(origin, account.cookie, 'pins', { locationId: 'fishing-pier', pinned: true }))
        .status,
    ).toBe(200);
    await closeTestServer(server, database);
    const restartedDatabase = openDatabase(databasePath);
    const restarted = await listen(restartedDatabase, 'test');
    const state = await locations(restarted.origin, account.cookie);
    expect(state.body.locationState).toMatchObject({
      currentLocationId: 'fishing-pier',
      discoveredLocationIds: expect.arrayContaining(['fishing-pier']),
      pinnedLocationIds: ['fishing-pier'],
    });
    const character = await fetch(`${restarted.origin}/api/character`, {
      headers: { Cookie: account.cookie },
    });
    await expect(character.json()).resolves.toMatchObject({
      character: { currentLocation: 'Fishing Pier', currentLocationId: 'fishing-pier' },
    });
    expect(
      (
        await fetch(`${restarted.origin}/api/auth/logout`, {
          method: 'POST',
          headers: { Cookie: account.cookie },
        })
      ).status,
    ).toBe(200);
    const relogged = await fetch(`${restarted.origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'location-restart', password: 'test-password' }),
    });
    expect(relogged.status).toBe(200);
    expect((await locations(restarted.origin, cookie(relogged))).body.locationState).toMatchObject({
      currentLocationId: 'fishing-pier',
      discoveredLocationIds: expect.arrayContaining(['fishing-pier']),
      pinnedLocationIds: ['fishing-pier'],
    });
    await closeTestServer(restarted.server, restartedDatabase);
  });
  it('quick-navigates discovered places and persists unpinning', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'quick-nav-user', 'Quick Navigate');
    expect(
      (await action(origin, account.cookie, 'quick-navigate', { locationId: 'refinery' })).status,
    ).toBe(400);
    await action(origin, account.cookie, 'navigate', { locationId: 'harbor' });
    await action(origin, account.cookie, 'navigate', { locationId: 'fishing-pier' });
    await action(origin, account.cookie, 'pins', { locationId: 'fishing-pier', pinned: true });
    expect(
      (await action(origin, account.cookie, 'quick-navigate', { locationId: 'new-harbor' })).status,
    ).toBe(200);
    expect(
      (await action(origin, account.cookie, 'quick-navigate', { locationId: 'fishing-pier' }))
        .status,
    ).toBe(200);
    expect(
      (await action(origin, account.cookie, 'pins', { locationId: 'fishing-pier', pinned: false }))
        .status,
    ).toBe(200);
    expect((await locations(origin, account.cookie)).body.locationState.pinnedLocationIds).toEqual(
      [],
    );
    await closeTestServer(server, database);
  });
  it('caps distinct pins atomically while allowing repeats, removal, and legacy pins', async () => {
    const { database, origin, server } = await startTestServer();
    const account = await register(origin, 'pin-limit-user', 'Pin Limit');
    const harborPlaces = [
      'fishing-pier',
      'boat-market',
      'freight-terminal',
      'fishing-store',
      'harbor-contracts-office',
    ];
    await action(origin, account.cookie, 'navigate', { locationId: 'harbor' });
    for (const id of harborPlaces) {
      expect((await action(origin, account.cookie, 'navigate', { locationId: id })).status).toBe(
        200,
      );
      expect(
        (await action(origin, account.cookie, 'pins', { locationId: id, pinned: true })).status,
      ).toBe(200);
      await action(origin, account.cookie, 'navigate', { locationId: 'harbor' });
    }
    expect(
      (await action(origin, account.cookie, 'pins', { locationId: harborPlaces[0], pinned: true }))
        .status,
    ).toBe(200);
    await action(origin, account.cookie, 'navigate', { locationId: 'new-harbor' });
    await action(origin, account.cookie, 'navigate', { locationId: 'market-district' });
    for (const id of ['market-square', 'traders-row']) {
      await action(origin, account.cookie, 'navigate', { locationId: id });
      await action(origin, account.cookie, 'navigate', { locationId: 'market-district' });
    }
    const competing = await Promise.all(
      ['market-square', 'traders-row'].map((locationId) =>
        action(origin, account.cookie, 'pins', { locationId, pinned: true }),
      ),
    );
    expect(competing.map((response) => response.status)).toEqual([400, 400]);
    for (const result of competing)
      await expect(result.json()).resolves.toMatchObject({ error: { code: 'PIN_LIMIT_REACHED' } });
    expect(
      (await locations(origin, account.cookie)).body.locationState.pinnedLocationIds,
    ).toHaveLength(5);
    expect(
      (await action(origin, account.cookie, 'pins', { locationId: harborPlaces[0], pinned: false }))
        .status,
    ).toBe(200);
    expect(
      (await action(origin, account.cookie, 'pins', { locationId: 'market-square', pinned: true }))
        .status,
    ).toBe(200);
    const id = account.body.character.id;
    database
      .prepare(
        'INSERT INTO character_pinned_locations (character_id, location_id, pinned_at) VALUES (?, ?, ?)',
      )
      .run(id, 'traders-row', new Date().toISOString());
    expect(
      (await locations(origin, account.cookie)).body.locationState.pinnedLocationIds,
    ).toHaveLength(6);
    const legacyAddition = await action(origin, account.cookie, 'pins', {
      locationId: harborPlaces[0],
      pinned: true,
    });
    expect(legacyAddition.status).toBe(400);
    await expect(legacyAddition.json()).resolves.toMatchObject({
      error: { code: 'PIN_LIMIT_REACHED' },
    });
    expect(
      (await action(origin, account.cookie, 'pins', { locationId: 'traders-row', pinned: true }))
        .status,
    ).toBe(200);
    expect(
      (await action(origin, account.cookie, 'pins', { locationId: 'traders-row', pinned: false }))
        .status,
    ).toBe(200);
    await closeTestServer(server, database);
  });
  it('isolates discovery and pins between accounts', async () => {
    const { database, origin, server } = await startTestServer();
    const alpha = await register(origin, 'places-alpha', 'Places Alpha');
    const beta = await register(origin, 'places-beta', 'Places Beta');
    await action(origin, alpha.cookie, 'navigate', { locationId: 'harbor' });
    await action(origin, alpha.cookie, 'navigate', { locationId: 'fishing-pier' });
    await action(origin, alpha.cookie, 'pins', { locationId: 'fishing-pier', pinned: true });
    expect((await locations(origin, beta.cookie)).body.locationState).toMatchObject({
      currentLocationId: 'new-harbor',
      discoveredLocationIds: ['new-harbor'],
      pinnedLocationIds: [],
    });
    expect(
      (await action(origin, beta.cookie, 'pins', { locationId: 'fishing-pier', pinned: true }))
        .status,
    ).toBe(400);
    await closeTestServer(server, database);
  });
});
