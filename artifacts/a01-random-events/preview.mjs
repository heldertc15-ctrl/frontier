import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import { openDatabase, seedDatabase } from '../../server/database.ts';
import { createAccount } from '../../server/auth.ts';
import { createCharacter } from '../../server/character.ts';
import { createRequestHandler } from '../../server/app.ts';
import {
  adminInventoryMutation,
  resetFishingAfterRestart,
  tickFishing,
} from '../../server/fishing.ts';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { setInterval, clearInterval } from 'node:timers';

// A separate local review world; never opens the player's frontier.sqlite.
const database = openDatabase('data/a01-random-event-review.sqlite');
process.env.FRONTIER_ADMIN_USERNAMES = 'event-review';
seedDatabase(database);
resetFishingAfterRestart(database);
if (!database.prepare('SELECT id FROM accounts WHERE username = ?').get('event-review')) {
  const account = createAccount(database, 'event-review', 'frontier-review-2026');
  const character = createCharacter(database, account.id, 'Rowan Vale');
  database
    .prepare("UPDATE characters SET current_location = 'fishing-pier' WHERE id = ?")
    .run(character.id);
  for (const [definitionId, quantity] of [
    ['basic_fishing_rod', 1],
    ['worm_bait', 120],
  ]) {
    adminInventoryMutation(database, account.id, 'event-review', {
      requestKey: randomUUID(),
      action: 'add',
      definitionId,
      quantity,
    });
  }
}
const api = createHttpServer(createRequestHandler(database, 'test'));
api.listen(3108, '127.0.0.1');
const timer = setInterval(() => tickFishing(database), 1000);
const vite = await createViteServer({
  server: {
    host: '127.0.0.1',
    port: 5178,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3108' },
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
