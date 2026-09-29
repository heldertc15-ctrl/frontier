import fs from 'node:fs';
import path from 'node:path';

import { loadConfig, loadLocalEnvironment } from '../server/config.js';
import { createAccount } from '../server/auth.js';
import { createCharacter } from '../server/character.js';
import { openDatabase, seedDatabase } from '../server/database.js';

loadLocalEnvironment();
const config = loadConfig();
const dataRoot = path.resolve(process.cwd(), 'data');
const databasePath = path.resolve(config.databasePath);

if (!databasePath.startsWith(`${dataRoot}${path.sep}`)) {
  throw new Error(`Reset is restricted to database files inside ${dataRoot}.`);
}

for (const suffix of ['', '-shm', '-wal']) {
  fs.rmSync(`${databasePath}${suffix}`, { force: true });
}

const database = openDatabase(databasePath);
try {
  seedDatabase(database);
  const account = createAccount(database, 'frontier-dev', 'frontier-dev');
  createCharacter(database, account.id, 'Avery Vale');
  console.log(`Reset and seeded Frontier development database at ${databasePath}`);
  console.log('Development account: frontier-dev / frontier-dev (character: Avery Vale)');
} finally {
  database.close();
}
