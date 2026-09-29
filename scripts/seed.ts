import { loadConfig, loadLocalEnvironment } from '../server/config.js';
import { createAccount, getAccountByUsername } from '../server/auth.js';
import { createCharacter, getCharacter } from '../server/character.js';
import { openDatabase, seedDatabase } from '../server/database.js';

loadLocalEnvironment();
const config = loadConfig();
const database = openDatabase(config.databasePath);

try {
  seedDatabase(database);
  const username = 'frontier-dev';
  const account =
    getAccountByUsername(database, username) ?? createAccount(database, username, 'frontier-dev');
  if (!getCharacter(database, account.id)) {
    createCharacter(database, account.id, 'Avery Vale');
  }
  console.log(`Seeded Frontier development database at ${config.databasePath}`);
  console.log('Development account: frontier-dev / frontier-dev (character: Avery Vale)');
} finally {
  database.close();
}
