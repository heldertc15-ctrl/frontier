import console from 'node:console';
import crypto from 'node:crypto';
const base = 'http://localhost:3101';
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
await api('/api/auth/register', {
  username: 'handoff-review',
  password: 'frontier-review-2026',
  characterName: 'Rowan Vale',
});
await api('/api/character/development-state', { credits: 999999999 }, 'PATCH');
for (const locationId of ['harbor', 'fishing-pier'])
  await api('/api/locations/navigate', { locationId });
for (const [definitionId, quantity] of [
  ['basic_fishing_rod', 1],
  ['crab_bait', 72],
])
  await api('/api/fishing/admin/inventory', {
    requestKey: crypto.randomUUID(),
    action: 'add',
    definitionId,
    quantity,
  });
await api('/api/fishing/admin/conditions', {
  timeOfDay: 'Dawn',
  seaState: 'Calm',
  weather: 'Sunny',
});
console.log('Isolated review character prepared.');
