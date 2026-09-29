import type { ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { seaSnapshot, type PublicWorldSnapshot } from './seaState.js';

/** One stream per connected player; the database remains the source of truth. */
export function createWorldEvents(database: DatabaseSync) {
  const listeners = new Set<ServerResponse>();
  let interval: NodeJS.Timeout | null = null;
  let lastKey = '';

  function snapshot(): PublicWorldSnapshot {
    const { serverTime, conditions, sea, gameTime } = seaSnapshot(database);
    return { serverTime, conditions, sea, gameTime };
  }

  function key(state: PublicWorldSnapshot): string {
    return JSON.stringify({
      gameTime: state.gameTime,
      conditions: state.conditions,
      sea: state.sea,
    });
  }

  function publishIfChanged(): void {
    if (listeners.size === 0) return;
    const state = snapshot();
    const nextKey = key(state);
    if (nextKey === lastKey) return;
    lastKey = nextKey;
    const message = `data: ${JSON.stringify(state)}\n\n`;
    for (const listener of listeners) listener.write(message);
  }

  function subscribe(response: ServerResponse): void {
    // Reconcile existing listeners before a new connection replaces the comparison key.
    publishIfChanged();
    const initial = snapshot();
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.write(`data: ${JSON.stringify(initial)}\n\n`);
    lastKey = key(initial);
    listeners.add(response);
    response.on('close', () => {
      listeners.delete(response);
      if (listeners.size === 0 && interval) {
        clearInterval(interval);
        interval = null;
        lastKey = '';
      }
    });
    if (!interval) {
      interval = setInterval(() => {
        try {
          publishIfChanged();
        } catch (error) {
          console.error('World event refresh failed', error);
        }
      }, 1000);
    }
  }

  return { snapshot, subscribe, publishIfChanged };
}
