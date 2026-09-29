import console from 'node:console';
import crypto from 'node:crypto';
import process from 'node:process';

const base = 'http://localhost:3102';
let cookie = '';
async function api(path, body) {
  const response = await globalThis.fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}
const credentials = { username: 'trophy-review', password: 'frontier-review-2026' };
if (process.argv[2] === 'setup') {
  await api('/api/auth/register', { ...credentials, characterName: 'Rowan Vale' });
  for (const locationId of ['harbor', 'fishing-pier'])
    await api('/api/locations/navigate', { locationId });
  for (const [definitionId, quantity] of [
    ['basic_fishing_rod', 1],
    ['worm_bait', 120],
  ])
    await api('/api/fishing/admin/inventory', {
      requestKey: crypto.randomUUID(),
      action: 'add',
      definitionId,
      quantity,
    });
  await api('/api/fishing/admin/conditions', { timeOfDay: 'Dawn', seaState: 'Calm' });
} else {
  await api('/api/auth/login', credentials);
  const { inventory } = await api('/api/inventory');
  let { fishing } = await api('/api/fishing');
  if (fishing.status !== 'active') {
    ({ fishing } = await api('/api/fishing/start', {
      rodItemId: inventory.items.find((item) => item.id === 'basic_fishing_rod').instanceId,
      baitItemId: inventory.items.find((item) => item.id === 'worm_bait').instanceId,
    }));
  }
  const count = process.argv[2] === 'collection' ? 13 : 1;
  for (let index = 0; index < count; index++) {
    ({ fishing } = await api('/api/fishing/admin/force', {
      requestKey: crypto.randomUUID(),
      forceSuccess: true,
      forceTrophy: index === count - 1,
      expectedAttemptCount: fishing.attempts,
    }));
  }
  console.log(
    JSON.stringify({
      status: fishing.status,
      catches: fishing.catches,
      latestCatch: fishing.latestCatch,
    }),
  );
}
console.log('Isolated review ready.');
