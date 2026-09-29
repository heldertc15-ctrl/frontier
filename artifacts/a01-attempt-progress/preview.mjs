import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import { openDatabase, seedDatabase } from '../../dist-server/server/database.js';
import { createAccount } from '../../dist-server/server/auth.js';
import { createCharacter } from '../../dist-server/server/character.js';
import { createRequestHandler } from '../../dist-server/server/app.js';
import { adminInventoryMutation, tickFishing } from '../../dist-server/server/fishing.js';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { setInterval, clearInterval } from 'node:timers';

// Disposable isolated review world; never opens the player's frontier.sqlite.
const database = openDatabase('data/a01-attempt-review.sqlite');
process.env.FRONTIER_ADMIN_USERNAMES = 'attempt-review';
seedDatabase(database);
if (!database.prepare('SELECT id FROM accounts WHERE username = ?').get('attempt-review')) {
  const account = createAccount(database, 'attempt-review', 'frontier-review-2026');
  const character = createCharacter(database, account.id, 'Rowan Vale');
  database
    .prepare("UPDATE characters SET current_location = 'fishing-pier' WHERE id = ?")
    .run(character.id);
  for (const [definitionId, quantity] of [
    ['basic_fishing_rod', 1],
    ['worm_bait', 120],
  ]) {
    adminInventoryMutation(database, account.id, 'attempt-review', {
      requestKey: randomUUID(),
      action: 'add',
      definitionId,
      quantity,
    });
  }
}
const api = createHttpServer(createRequestHandler(database, 'test'));
api.listen(3107, '127.0.0.1');
const timer = setInterval(() => tickFishing(database), 1000);
const vite = await createViteServer({
  server: {
    host: '127.0.0.1',
    port: 5177,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3107' },
  },
});
await vite.listen();
vite.printUrls();
process.on('SIGINT', () => {
  clearInterval(timer);
  api.close();
  void vite.close();
  database.close();
});
