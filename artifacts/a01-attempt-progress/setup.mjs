import console from 'node:console';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
const base = 'http://127.0.0.1:3107';
let cookie = '';
async function api(path, body, method = 'POST') {
  const response = await globalThis.fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}
await api('/api/auth/login', { username: 'attempt-review', password: 'frontier-review-2026' });
const { inventory } = await api('/api/inventory', null, 'GET');
for (const [definitionId, quantity] of [
  ['basic_fishing_rod', 1],
  ['worm_bait', 120],
]) {
  if (!inventory.items.some((item) => item.id === definitionId))
    await api('/api/fishing/admin/inventory', {
      requestKey: randomUUID(),
      action: 'add',
      definitionId,
      quantity,
    });
}
await api('/api/fishing/admin/conditions', { timeOfDay: 'Day', seaState: 'Calm' });
if (process.argv.includes('--force')) {
  const { fishing } = await api('/api/fishing', null, 'GET');
  await api('/api/fishing/admin/force', {
    requestKey: randomUUID(),
    forceSuccess: true,
    expectedAttemptCount: fishing.attempts,
    expectedSessionId: fishing.sessionId,
  });
}
console.log('Isolated review tackle and conditions ready.');
