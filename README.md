# Frontier

Frontier is a persistent browser sandbox. This repository currently contains its application
foundation and development documentation.

## Requirements

- Node.js 24 or newer
- npm 11 or newer

## Local development

```sh
npm install
npm run reset
npm run dev
```

Open <http://localhost:5173>. The Vite development server proxies API requests to the Node server on
port 3001.

Copy `.env.example` to `.env` to override local server configuration. The server and database tools
load it automatically; values supplied by the invoking shell take precedence.

### Test Fishing v1 locally

Set `FRONTIER_ADMIN_USERNAMES` in `.env` to the exact username of a development account and restart
the server. This checkout's local, ignored `.env` allows the existing `admin` and `frontier-dev`
accounts. Open <http://localhost:5173>, sign in with one of those accounts, then select the
**Fishing test tools** item labeled **DEV / ADMIN** in the top navigation. In **Inventory testing
tool**, choose a **Defined item** (such as Basic Fishing Rod or Worm Bait), set **Quantity**, and
press **Add**. Open **Pack** to see the item in real carried inventory. Repeat for a rod and bait,
then enter New Harbor → Harbor District → Fishing Pier to prepare and start Fishing. The same tool
offers forced attempts and condition overrides. Use **Force Calm**, **Force Moderate**, or
**Force Dangerous** to test effective sea, then **Clear override / return to schedule**. The
scheduled next state and boundary continue advancing under an override. The navigation entry appears only after the server
confirms authorization; ordinary accounts cannot use the endpoints, and production has no admin routes.
The Time of day control can force a phase or return to the shared Frontier clock. **Reset my fish
discoveries** clears only the signed-in operator's discovered-species reveal state; it keeps fish
inventory and previous catches.

## Commands

- `npm run dev` starts the client and server in watch mode.
- `npm run seed` initializes or refreshes idempotent development seed data.
- `npm run reset` recreates the local database under `data/` and seeds it.
- `npm run check` runs every required quality gate.
- `npm run build` creates the production client and server builds.
- `npm start` serves the production build after `npm run build`.

See the [documentation index](docs/README.md) and [agent instructions](AGENTS.md) for project rules.
