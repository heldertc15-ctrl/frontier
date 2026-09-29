import { createServer } from 'node:http';

import { createRequestHandler } from './app.js';
import { loadConfig, loadLocalEnvironment } from './config.js';
import { openDatabase, seedDatabase } from './database.js';
import { tickFishing } from './fishing.js';

function startServer(): void {
  loadLocalEnvironment();
  const config = loadConfig();
  const database = openDatabase(config.databasePath);
  seedDatabase(database);

  const server = createServer(createRequestHandler(database, config.environment));
  const fishingTimer = setInterval(() => tickFishing(database), 1000);

  server.on('error', (error) => {
    console.error('Frontier server error', error);
    process.exitCode = 1;
  });

  server.listen(config.port, () => {
    console.log(`Frontier server listening on http://localhost:${config.port}`);
  });

  const shutdown = () => {
    clearInterval(fishingTimer);
    server.close(() => {
      database.close();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', (error) => {
    console.error('Uncaught server exception', error);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled server rejection', reason);
    process.exit(1);
  });
}

startServer();
