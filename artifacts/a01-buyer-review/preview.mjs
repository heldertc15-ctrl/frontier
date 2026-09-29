import { createServer as createHttpServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { openDatabase, seedDatabase } from '../../dist-server/server/database.js';
import { createAccount } from '../../dist-server/server/auth.js';
import { createCharacter } from '../../dist-server/server/character.js';
import { insertFishSpecimen } from '../../dist-server/server/fishSpecimens.js';
import { createRequestHandler } from '../../dist-server/server/app.js';

const database = openDatabase('data/buyer-ui-review.sqlite');
seedDatabase(database);
if (!database.prepare('SELECT id FROM accounts WHERE username = ?').get('buyer-review')) {
  const account = createAccount(database, 'buyer-review', 'frontier-review-2026');
  const character = createCharacter(database, account.id, 'Rowan Vale');
  database
    .prepare("UPDATE characters SET current_location = 'fishing-store' WHERE id = ?")
    .run(character.id);
  for (const [species, weights] of [
    ['mackerel', [0.281, 0.405, 0.682, 0.754]],
    ['sardine', [0.065, 0.088, 0.091, 0.102, 0.108, 0.126]],
    ['bluefin_tuna', [42.35, 76.971, 218.45]],
  ]) {
    const id = randomBytes(16).toString('hex');
    const now = new Date().toISOString();
    database
      .prepare(
        `INSERT INTO character_items (id, character_id, definition_id, quantity, location, equipped, created_at, updated_at) VALUES (?, ?, ?, ?, 'inventory', 0, ?, ?)`,
      )
      .run(id, character.id, species, weights.length, now, now);
    for (const weight of weights) insertFishSpecimen(database, id, weight, 'catch');
  }
}
const api = createHttpServer(createRequestHandler(database, 'test'));
api.listen(3103);
const vite = await createViteServer({
  server: { port: 5176, strictPort: true, proxy: { '/api': 'http://localhost:3103' } },
});
await vite.listen();
vite.printUrls();
