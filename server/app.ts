import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import {
  buildRoomItem,
  placeRoomCrop,
  removeRoomCrop,
  provisionRoomFixture,
  roomCommand,
  roomSnapshot,
  roomSummaries,
} from './rooms.js';

import {
  accountForSession,
  authenticateAccount,
  clearSessionCookie,
  createAccount,
  createSession,
  createSessionCookie,
  readSessionToken,
  removeSession,
  validatePassword,
  validateUsername,
} from './auth.js';
import {
  createCharacter,
  getCharacter,
  updateDevelopmentCharacter,
  validateCharacterName,
} from './character.js';
import { readSchemaVersion } from './database.js';
import { fishBuyerState, sellFish } from './fishBuyer.js';
import {
  activateFishingEvent,
  adminAllowed,
  adminFishingData,
  adminInventoryMutation,
  fishingPreview,
  fishingState,
  forceFishing,
  forceFishingEvent,
  overrideConditions,
  resetFishDiscoveries,
  resetFishingAfterRestart,
  startFishing,
  stopFishing,
  touchFishing,
} from './fishing.js';
import {
  getInventory,
  mergeStacks,
  reorderItems,
  setEquipped,
  transferItem,
  useItem,
} from './inventory.js';
import { getLocationState, isCityLocation, navigateLocation, setLocationPin } from './locations.js';
import { clockSnapshot } from './seaState.js';
import { createWorldEvents } from './worldEvents.js';

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
};
export function contentTypeFor(filePath: string): string {
  return contentTypes[path.extname(filePath)] ?? 'application/octet-stream';
}
type Environment = 'development' | 'test' | 'production';

function sendJson(response: ServerResponse, status: number, body: unknown, cookie?: string): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(cookie ? { 'Set-Cookie': cookie } : {}),
  });
  response.end(JSON.stringify(body));
}
function sendError(response: ServerResponse, status: number, code: string, message: string): void {
  sendJson(response, status, { error: { code, message } });
}
async function readJson(request: IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > 16_384) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(buffer);
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
function serveBuiltClient(requestPath: string, response: ServerResponse): boolean {
  const buildRoot = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(buildRoot)) return false;
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const candidate = path.resolve(buildRoot, relativePath);
  const safeCandidate = candidate.startsWith(`${buildRoot}${path.sep}`) ? candidate : '';
  const filePath =
    safeCandidate && fs.existsSync(safeCandidate) && fs.statSync(safeCandidate).isFile()
      ? safeCandidate
      : path.join(buildRoot, 'index.html');
  response.writeHead(200, {
    'Content-Type': contentTypeFor(filePath),
  });
  fs.createReadStream(filePath)
    .on('error', (error) => {
      console.error('Static file response error', error);
      response.end();
    })
    .pipe(response);
  return true;
}

export function createRequestHandler(
  database: DatabaseSync,
  environment: Environment = 'development',
) {
  resetFishingAfterRestart(database);
  const worldEvents = createWorldEvents(database);
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname.startsWith('/api/fishing') || url.pathname.startsWith('/api/fish-buyer'))
        response.setHeader('Cache-Control', 'no-store');
      const token = readSessionToken(request.headers.cookie);
      const account = accountForSession(database, token);
      if (request.method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, {
          status: 'ok',
          database: 'ready',
          schemaVersion: readSchemaVersion(database),
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/session') {
        sendJson(response, 200, {
          authenticated: Boolean(account),
          ...(account
            ? {
                account: { username: account.username },
                character: getCharacter(database, account.id),
              }
            : {}),
        });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/auth/register') {
        const body = await readJson(request);
        const username = validateUsername(body?.username);
        const password = validatePassword(body?.password);
        const name = validateCharacterName(body?.characterName);
        if (!username || !password || !name) {
          sendError(
            response,
            400,
            'VALIDATION_ERROR',
            'Provide a username, password, and character name in the required format.',
          );
          return;
        }
        try {
          database.exec('BEGIN');
          const newAccount = createAccount(database, username, password);
          const character = createCharacter(database, newAccount.id, name);
          database.exec('COMMIT');
          sendJson(
            response,
            201,
            { account: { username: newAccount.username }, character },
            createSessionCookie(
              createSession(database, newAccount.id),
              environment === 'production',
            ),
          );
        } catch (error) {
          database.exec('ROLLBACK');
          if (error instanceof Error && error.message.includes('UNIQUE constraint failed'))
            sendError(response, 409, 'USERNAME_TAKEN', 'That username is already in use.');
          else throw error;
        }
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/auth/login') {
        const body = await readJson(request);
        const username = validateUsername(body?.username);
        const password = validatePassword(body?.password);
        const login =
          username && password ? authenticateAccount(database, username, password) : null;
        if (!login) {
          sendError(response, 401, 'INVALID_CREDENTIALS', 'Username or password is incorrect.');
          return;
        }
        sendJson(
          response,
          200,
          { account: { username: login.username }, character: getCharacter(database, login.id) },
          createSessionCookie(createSession(database, login.id), environment === 'production'),
        );
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
        if (account) stopFishing(database, account.id);
        removeSession(database, token);
        sendJson(response, 200, { authenticated: false }, clearSessionCookie());
        return;
      }
      if (
        !account &&
        (url.pathname.startsWith('/api/character') ||
          url.pathname.startsWith('/api/inventory') ||
          url.pathname.startsWith('/api/locations') ||
          url.pathname.startsWith('/api/world') ||
          url.pathname.startsWith('/api/fishing') ||
          url.pathname.startsWith('/api/fish-buyer') ||
          url.pathname.startsWith('/api/rooms'))
      ) {
        sendError(response, 401, 'AUTH_REQUIRED', 'Sign in to access character data.');
        return;
      }
      const authenticatedAccount = account;
      if (url.pathname.startsWith('/api/fishing/admin')) {
        if (environment === 'production') {
          sendError(response, 404, 'NOT_FOUND', 'The requested API endpoint does not exist.');
          return;
        }
        if (!adminAllowed(environment, authenticatedAccount!.username)) {
          sendError(
            response,
            403,
            'ADMIN_REQUIRED',
            'Developer or admin authorization is required.',
          );
          return;
        }
        if (request.method === 'GET' && url.pathname === '/api/fishing/admin/access') {
          sendJson(response, 200, { authorized: true });
          return;
        }
        if (request.method === 'GET' && url.pathname === '/api/fishing/admin') {
          sendJson(response, 200, {
            ...adminFishingData(database, authenticatedAccount!.id),
            fishing: fishingState(database, authenticatedAccount!.id),
            inventory: getInventory(database, authenticatedAccount!.id),
          });
          return;
        }
        if (request.method === 'POST' && url.pathname === '/api/fishing/admin/force') {
          const body = await readJson(request);
          const result = forceFishing(
            database,
            authenticatedAccount!.id,
            authenticatedAccount!.username,
            body?.requestKey,
            body?.forceSuccess,
            body?.expectedAttemptCount,
            body?.forceTrophy,
          );
          if ('error' in result) sendError(response, 400, result.error, result.message);
          else
            sendJson(response, 200, {
              fishing: result.state,
              inventory: getInventory(database, authenticatedAccount!.id),
              character: getCharacter(database, authenticatedAccount!.id),
            });
          return;
        }
        if (request.method === 'POST' && url.pathname === '/api/fishing/admin/event') {
          const body = await readJson(request);
          const result = forceFishingEvent(database, authenticatedAccount!.id, body ?? {});
          if ('error' in result) sendError(response, 400, result.error, result.message);
          else
            sendJson(response, 200, {
              fishing: result.state,
              character: getCharacter(database, authenticatedAccount!.id),
              inventory: getInventory(database, authenticatedAccount!.id),
            });
          return;
        }
        if (request.method === 'POST' && url.pathname === '/api/fishing/admin/conditions') {
          const body = await readJson(request);
          const result = overrideConditions(database, body ?? {});
          if ('error' in result) sendError(response, 400, result.error, result.message);
          else {
            console.info(
              'fishing_condition_override',
              JSON.stringify({
                actor: authenticatedAccount!.username,
                action: Object.hasOwn(body ?? {}, 'seaState')
                  ? body?.seaState === null
                    ? 'clear'
                    : 'force'
                  : 'other_conditions',
                timestamp: result.serverTime,
                previousOverride: result.previousOverride,
                newOverride: result.overrideState,
                previousTimeOverride: result.previousTimeOverride,
                newTimeOverride: result.timeOverrideState,
                sea: result.sea,
                gameTime: result.gameTime,
                conditions: result.conditions,
              }),
            );
            worldEvents.publishIfChanged();
            sendJson(response, 200, result);
          }
          return;
        }
        if (request.method === 'POST' && url.pathname === '/api/fishing/admin/discoveries/reset') {
          const result = resetFishDiscoveries(
            database,
            authenticatedAccount!.id,
            authenticatedAccount!.username,
          );
          if ('error' in result)
            sendError(
              response,
              404,
              result.error ?? 'NOT_FOUND',
              result.message ?? 'Character not found.',
            );
          else sendJson(response, 200, { ...result, discoveredFish: [] });
          return;
        }
        if (request.method === 'POST' && url.pathname === '/api/fishing/admin/inventory') {
          const body = await readJson(request);
          const result = adminInventoryMutation(
            database,
            authenticatedAccount!.id,
            authenticatedAccount!.username,
            body ?? {},
          );
          if ('error' in result) sendError(response, 400, result.error, result.message);
          else
            sendJson(response, 200, {
              inventory: getInventory(database, authenticatedAccount!.id),
              fishing: fishingState(database, authenticatedAccount!.id),
            });
          return;
        }
      }
      if (request.method === 'GET' && url.pathname === '/api/world/clock') {
        sendJson(response, 200, clockSnapshot(database));
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/world/state') {
        response.setHeader('Cache-Control', 'no-store');
        sendJson(response, 200, worldEvents.snapshot());
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/world/events') {
        worldEvents.subscribe(response);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/fishing') {
        sendJson(response, 200, { fishing: touchFishing(database, authenticatedAccount!.id) });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/fishing/event') {
        const body = await readJson(request);
        const result = activateFishingEvent(database, authenticatedAccount!.id, body?.eventId);
        if ('error' in result) sendError(response, 400, result.error, result.message);
        else
          sendJson(response, 200, {
            fishing: result.state,
            character: getCharacter(database, authenticatedAccount!.id),
          });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/fish-buyer') {
        const buyer = fishBuyerState(database, authenticatedAccount!.id);
        if (!buyer.available)
          sendError(
            response,
            403,
            'BUYER_UNAVAILABLE',
            'Visit the Fishing Store to sell carried fish.',
          );
        else sendJson(response, 200, { buyer });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/fish-buyer/sell') {
        const body = await readJson(request);
        const result = sellFish(
          database,
          authenticatedAccount!.id,
          body?.stackId,
          body?.specimenIds,
          body?.requestKey,
        );
        if ('error' in result)
          sendError(
            response,
            result.error === 'BUYER_UNAVAILABLE'
              ? 403
              : result.error === 'FISH_UNAVAILABLE' || result.error === 'REQUEST_KEY_REUSED'
                ? 409
                : 400,
            result.error,
            result.message,
          );
        else sendJson(response, 200, result);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/fishing/preview') {
        if (
          [...url.searchParams.keys()].some((key) => !['rodItemId', 'baitItemId'].includes(key)) ||
          url.searchParams.getAll('rodItemId').length !== 1 ||
          url.searchParams.getAll('baitItemId').length !== 1
        ) {
          sendError(response, 400, 'VALIDATION_ERROR', 'Provide one rod and one bait item ID.');
          return;
        }
        const result = fishingPreview(
          database,
          authenticatedAccount!.id,
          url.searchParams.get('rodItemId'),
          url.searchParams.get('baitItemId'),
        );
        if ('error' in result)
          sendError(
            response,
            400,
            result.error ?? 'VALIDATION_ERROR',
            result.message ?? 'Invalid fishing preview.',
          );
        else sendJson(response, 200, result);
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/fishing/start') {
        const body = await readJson(request);
        const result = startFishing(
          database,
          authenticatedAccount!.id,
          body?.rodItemId,
          body?.baitItemId,
        );
        if ('error' in result) sendError(response, 400, result.error, result.message);
        else
          sendJson(response, 200, {
            fishing: result.state,
            character: getCharacter(database, authenticatedAccount!.id),
          });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/fishing/stop') {
        const result = stopFishing(database, authenticatedAccount!.id);
        if ('error' in result) sendError(response, 400, result.error, result.message);
        else
          sendJson(response, 200, {
            fishing: result.state,
            character: getCharacter(database, authenticatedAccount!.id),
          });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/character') {
        sendJson(response, 200, {
          character: getCharacter(database, authenticatedAccount!.id),
        });
        return;
      }
      if (url.pathname === '/api/rooms/admin/fixture' && request.method === 'POST') {
        if (environment === 'production') {
          sendError(response, 404, 'NOT_FOUND', 'The requested API endpoint does not exist.');
          return;
        }
        if (!adminAllowed(environment, authenticatedAccount!.username)) {
          sendError(
            response,
            403,
            'ADMIN_REQUIRED',
            'Developer or admin authorization is required.',
          );
          return;
        }
        const result = provisionRoomFixture(database, authenticatedAccount!.id, environment);
        if ('error' in result) sendError(response, result.status, result.error, result.message);
        else sendJson(response, 200, result);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/rooms') {
        sendJson(response, 200, { rooms: roomSummaries(database, authenticatedAccount!.id) });
        return;
      }
      const roomMatch =
        /^\/api\/rooms\/([a-zA-Z0-9-]+)(?:\/(place|move|remove|build|crop|crop-remove))?$/.exec(
          url.pathname,
        );
      if (roomMatch) {
        const [, roomId, action] = roomMatch;
        if (request.method === 'GET' && !action) {
          const result = roomSnapshot(database, authenticatedAccount!.id, roomId, environment);
          if ('error' in result) sendError(response, result.status, result.error, result.message);
          else sendJson(response, 200, result);
          return;
        }
        if (request.method === 'POST' && (action === 'place' || action === 'move')) {
          const result = roomCommand(
            database,
            authenticatedAccount!.id,
            roomId,
            action,
            await readJson(request),
            environment,
          );
          if ('error' in result) sendError(response, result.status, result.error, result.message);
          else sendJson(response, 200, result);
          return;
        }
        if (request.method === 'POST' && action === 'remove') {
          const result = roomCommand(
            database,
            authenticatedAccount!.id,
            roomId,
            'remove',
            await readJson(request),
            environment,
          );
          if ('error' in result) sendError(response, result.status, result.error, result.message);
          else sendJson(response, 200, result);
          return;
        }
        if (request.method === 'POST' && action === 'build') {
          const result = buildRoomItem(
            database,
            authenticatedAccount!.id,
            roomId,
            await readJson(request),
            environment,
          );
          if ('error' in result) sendError(response, result.status, result.error, result.message);
          else sendJson(response, 200, result);
          return;
        }
        if (request.method === 'POST' && (action === 'crop' || action === 'crop-remove')) {
          const result =
            action === 'crop'
              ? placeRoomCrop(
                  database,
                  authenticatedAccount!.id,
                  roomId,
                  await readJson(request),
                  environment,
                )
              : removeRoomCrop(
                  database,
                  authenticatedAccount!.id,
                  roomId,
                  await readJson(request),
                  environment,
                );
          if ('error' in result) sendError(response, result.status, result.error, result.message);
          else sendJson(response, 200, result);
          return;
        }
      }
      if (request.method === 'GET' && url.pathname === '/api/inventory') {
        const character = getCharacter(database, authenticatedAccount!.id);
        if (!character || !isCityLocation(character.currentLocationId)) {
          sendError(
            response,
            403,
            'LOCKER_UNAVAILABLE',
            'The city locker is only available in New Harbor.',
          );
          return;
        }
        sendJson(response, 200, {
          inventory: getInventory(database, authenticatedAccount!.id, environment),
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/locations') {
        sendJson(response, 200, {
          locationState: getLocationState(database, authenticatedAccount!.id),
        });
        return;
      }
      if (
        request.method === 'POST' &&
        (url.pathname === '/api/locations/navigate' ||
          url.pathname === '/api/locations/quick-navigate')
      ) {
        const body = await readJson(request);
        const operation = navigateLocation(
          database,
          authenticatedAccount!.id,
          body?.locationId,
          url.pathname.endsWith('quick-navigate'),
        );
        if ('error' in operation) {
          sendError(response, 400, operation.error, operation.message);
          return;
        }
        sendJson(response, 200, {
          locationState: operation.state,
          character: getCharacter(database, authenticatedAccount!.id),
        });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/locations/pins') {
        const body = await readJson(request);
        const operation = setLocationPin(
          database,
          authenticatedAccount!.id,
          body?.locationId,
          body?.pinned,
        );
        if ('error' in operation) {
          sendError(response, 400, operation.error, operation.message);
          return;
        }
        sendJson(response, 200, { locationState: operation.state });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/inventory/transfer') {
        const body = await readJson(request);
        const operation = transferItem(
          database,
          authenticatedAccount!.id,
          body?.itemId,
          body?.destination,
          body?.quantity,
          environment,
        );
        if ('error' in operation) {
          sendError(
            response,
            operation.error === 'LOCKER_UNAVAILABLE' ? 403 : 400,
            operation.error,
            operation.message,
          );
          return;
        }
        sendJson(response, 200, { inventory: operation.state });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/inventory/merge') {
        const body = await readJson(request);
        const operation = mergeStacks(
          database,
          authenticatedAccount!.id,
          body?.sourceId,
          body?.targetId,
          environment,
        );
        if ('error' in operation) {
          sendError(
            response,
            operation.error === 'LOCKER_UNAVAILABLE' ? 403 : 400,
            operation.error,
            operation.message,
          );
          return;
        }
        sendJson(response, 200, { inventory: operation.state, moved: operation.moved });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/inventory/reorder') {
        const body = await readJson(request);
        const operation = reorderItems(
          database,
          authenticatedAccount!.id,
          body?.location,
          body?.itemIds,
          environment,
        );
        if ('error' in operation) {
          sendError(
            response,
            operation.error === 'LOCKER_UNAVAILABLE' ? 403 : 400,
            operation.error,
            operation.message,
          );
          return;
        }
        sendJson(response, 200, { inventory: operation.state });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/inventory/use') {
        const body = await readJson(request);
        const operation = useItem(database, authenticatedAccount!.id, body?.itemId);
        if ('error' in operation) {
          sendError(response, 400, operation.error, operation.message);
          return;
        }
        sendJson(response, 200, { inventory: operation.state, character: operation.character });
        return;
      }
      if (
        request.method === 'POST' &&
        (url.pathname === '/api/inventory/equip' || url.pathname === '/api/inventory/unequip')
      ) {
        const body = await readJson(request);
        const operation = setEquipped(
          database,
          authenticatedAccount!.id,
          body?.itemId,
          url.pathname.endsWith('/equip'),
        );
        if ('error' in operation) {
          sendError(response, 400, operation.error, operation.message);
          return;
        }
        sendJson(response, 200, { inventory: operation.state });
        return;
      }
      if (request.method === 'PATCH' && url.pathname === '/api/character/development-state') {
        if (environment === 'production') {
          sendError(response, 404, 'NOT_FOUND', 'The requested API endpoint does not exist.');
          return;
        }
        const body = await readJson(request);
        const character = updateDevelopmentCharacter(database, authenticatedAccount!.id, {
          credits: body?.credits as number | undefined,
          hp: body?.hp as number | undefined,
          characterXp: body?.characterXp as number | undefined,
        });
        if (!character) {
          sendError(
            response,
            400,
            'VALIDATION_ERROR',
            'Development state values must be safe whole numbers within character limits.',
          );
          return;
        }
        sendJson(response, 200, { character });
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        sendError(response, 404, 'NOT_FOUND', 'The requested API endpoint does not exist.');
        return;
      }
      if (!serveBuiltClient(url.pathname, response))
        sendError(
          response,
          503,
          'CLIENT_NOT_BUILT',
          'The browser client is unavailable. Run npm run dev or npm run build.',
        );
    } catch (error) {
      console.error('Unhandled request error', error);
      if (!response.headersSent)
        sendError(response, 500, 'INTERNAL_ERROR', 'An unexpected server error occurred.');
      else response.end();
    }
  };
}
