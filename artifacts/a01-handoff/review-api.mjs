import console from 'node:console';
import crypto from 'node:crypto';
import process from 'node:process';
const base = 'http://localhost:3101';
const login = await globalThis.fetch(base + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'handoff-review', password: 'frontier-review-2026' }),
});
if (!login.ok) throw new Error('Review login failed.');
const cookie = login.headers.get('set-cookie').split(';')[0];
async function api(path, body) {
  const reply = await globalThis.fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { cookie, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await reply.json();
  if (!reply.ok) throw new Error(JSON.stringify(data));
  return data;
}
const command = process.argv[2];
if (command === 'gear') {
  await api('/api/fishing/admin/inventory', {
    action: 'add',
    definitionId: 'reinforced_fishing_rod',
    quantity: 1,
    requestKey: crypto.randomUUID(),
  });
} else if (command === 'force-success') {
  const { fishing } = await api('/api/fishing');
  await api('/api/fishing/admin/force', {
    requestKey: crypto.randomUUID(),
    forceSuccess: true,
    expectedAttemptCount: fishing.attempts,
  });
} else if (command === 'empty-bait') {
  const { inventory } = await api('/api/inventory');
  for (const item of inventory.items.filter((i) => i.id === 'crab_bait'))
    await api('/api/fishing/admin/inventory', {
      action: 'delete',
      itemId: item.instanceId,
      requestKey: crypto.randomUUID(),
    });
} else if (command === 'restore-bait') {
  await api('/api/fishing/admin/inventory', {
    action: 'add',
    definitionId: 'crab_bait',
    quantity: 100,
    requestKey: crypto.randomUUID(),
  });
} else if (command === 'conditions') {
  await api('/api/fishing/admin/conditions', {
    timeOfDay: 'Dusk',
    seaState: 'Moderate',
    weather: 'Cloudy',
  });
} else if (command === 'restore-conditions') {
  await api('/api/fishing/admin/conditions', {
    timeOfDay: 'Dawn',
    seaState: 'Calm',
    weather: 'Sunny',
  });
}
const { fishing } = await api('/api/fishing');
console.log(
  JSON.stringify({
    status: fishing.status,
    attempts: fishing.attempts,
    bait: fishing.baitRemaining,
    catches: fishing.catches,
    latest: fishing.latestResult,
  }),
);
