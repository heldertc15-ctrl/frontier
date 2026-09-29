// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRequestHandler } from './app.js';
import { createAccount, createSession } from './auth.js';
import { createCharacter } from './character.js';
import { openDatabase, seedDatabase } from './database.js';
import { navigateLocation } from './locations.js';

async function listen(server: ReturnType<typeof createServer>): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No server address');
  return `http://127.0.0.1:${address.port}`;
}

async function nextState(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  let text = '';
  while (!text.includes('\n\n')) {
    const result = await reader.read();
    if (result.done) throw new Error('World stream ended');
    text += decoder.decode(result.value, { stream: true });
  }
  const line = text
    .split('\n\n')[0]
    .split('\n')
    .find((item) => item.startsWith('data: '));
  if (!line) throw new Error('World event had no data');
  return JSON.parse(line.slice(6)) as {
    conditions: { timeOfDay: string; seaState: string };
  };
}

describe('shared world events', () => {
  const directories: string[] = [];
  afterEach(() => {
    delete process.env.FRONTIER_ADMIN_USERNAMES;
    for (const directory of directories.splice(0))
      rmSync(directory, { recursive: true, force: true });
  });

  it('pushes committed overrides to players on separate server instances and persists them', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'frontier-world-events-'));
    directories.push(directory);
    const databasePath = path.join(directory, 'game.sqlite');
    const firstDatabase = openDatabase(databasePath);
    seedDatabase(firstDatabase);
    const admin = createAccount(firstDatabase, 'operator', 'test-password');
    const player = createAccount(firstDatabase, 'player', 'test-password');
    createCharacter(firstDatabase, admin.id, 'Operator');
    createCharacter(firstDatabase, player.id, 'Player');
    for (const account of [admin, player]) {
      expect(navigateLocation(firstDatabase, account.id, 'harbor')).toHaveProperty('state');
      expect(navigateLocation(firstDatabase, account.id, 'fishing-pier')).toHaveProperty('state');
    }
    const adminCookie = `frontier_session=${createSession(firstDatabase, admin.id)}`;
    const playerCookie = `frontier_session=${createSession(firstDatabase, player.id)}`;
    const secondDatabase = openDatabase(databasePath);
    const firstServer = createServer(createRequestHandler(firstDatabase, 'test'));
    const secondServer = createServer(createRequestHandler(secondDatabase, 'test'));
    const abortAdmin = new AbortController();
    const abortPlayer = new AbortController();
    process.env.FRONTIER_ADMIN_USERNAMES = 'operator';
    try {
      const [firstOrigin, secondOrigin] = await Promise.all([
        listen(firstServer),
        listen(secondServer),
      ]);
      expect((await fetch(`${firstOrigin}/api/world/events`)).status).toBe(401);
      const adminStream = await fetch(`${firstOrigin}/api/world/events`, {
        headers: { Cookie: adminCookie },
        signal: abortAdmin.signal,
      });
      const playerStream = await fetch(`${secondOrigin}/api/world/events`, {
        headers: { Cookie: playerCookie },
        signal: abortPlayer.signal,
      });
      expect(adminStream.headers.get('content-type')).toContain('text/event-stream');
      expect(playerStream.headers.get('cache-control')).toBe('no-store');
      const adminReader = adminStream.body!.getReader();
      const playerReader = playerStream.body!.getReader();
      await Promise.all([nextState(adminReader), nextState(playerReader)]);

      const changed = await fetch(`${firstOrigin}/api/fishing/admin/conditions`, {
        method: 'POST',
        headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ seaState: 'Dangerous', timeOfDay: 'Dusk' }),
      });
      expect(changed.status).toBe(200);
      const [adminView, playerView] = await Promise.all([
        nextState(adminReader),
        nextState(playerReader),
      ]);
      expect(adminView.conditions).toMatchObject({ seaState: 'Dangerous', timeOfDay: 'Dusk' });
      expect(playerView.conditions).toEqual(adminView.conditions);
      const freshPlayerView = await fetch(`${secondOrigin}/api/world/state`, {
        headers: { Cookie: playerCookie },
      });
      expect((await freshPlayerView.json()).conditions).toEqual(adminView.conditions);
    } finally {
      abortAdmin.abort();
      abortPlayer.abort();
      firstServer.closeAllConnections();
      secondServer.closeAllConnections();
      await Promise.all([
        new Promise<void>((resolve) => firstServer.close(() => resolve())),
        new Promise<void>((resolve) => secondServer.close(() => resolve())),
      ]);
      firstDatabase.close();
      secondDatabase.close();
    }
  }, 10_000);
});
