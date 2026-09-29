/* global fetch, WebSocket, setTimeout, Buffer, console */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const targets = await fetch('http://127.0.0.1:9229/json').then((r) => r.json());
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('No Chrome page target');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolveOpen, reject) => {
  socket.addEventListener('open', resolveOpen, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolveResult, rejectResult } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) rejectResult(new Error(JSON.stringify(message.error)));
  else resolveResult(message.result);
});
function command(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolveResult, rejectResult) => {
    pending.set(id, { resolveResult, rejectResult });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression, label) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await evaluate(expression)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function setSize(width, height) {
  await command('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await new Promise((r) => setTimeout(r, 200));
}
async function capture(name, width, height) {
  await setSize(width, height);
  const metrics = await evaluate(`(() => {
    const scene = document.querySelector('.location-art');
    const image = document.querySelector('.scene-stage > img');
    const context = document.querySelector('.location-context');
    const rect = (node) => node ? { x: node.getBoundingClientRect().x, y: node.getBoundingClientRect().y, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height } : null;
    return { viewport: [innerWidth, innerHeight], document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], scene: rect(scene), image: rect(image), context: rect(context), current: document.querySelector('.location-body > h4')?.textContent, enter: document.querySelector('.enter-destination')?.textContent, drawer: !!document.querySelector('.inventory-drawer[open]') };
  })()`);
  const result = await command('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  const path = resolve('artifacts/f03-review', `${name}-${width}x${height}.png`);
  await writeFile(path, Buffer.from(result.data, 'base64'));
  console.log(JSON.stringify({ path, ...metrics }));
}
await command('Page.enable');
await command('Runtime.enable');
await command('Page.navigate', { url: 'http://localhost:5173/' });
await until("document.readyState === 'complete' && !!document.querySelector('.app-shell')", 'app');
const username = `f03-shell-${Date.now().toString(36)}`;
const registration = await evaluate(
  `fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: ${JSON.stringify(username)}, password: 'shell-review-local', characterName: 'Shell Review' }) }).then(async r => ({ ok: r.ok, status: r.status, body: await r.json() }))`,
);
if (!registration.ok) throw new Error(`Registration failed: ${JSON.stringify(registration)}`);
await command('Page.reload', { ignoreCache: true });
await until(
  "!!document.querySelector('.location-art img') && !!document.querySelector('.place-card')",
  'city scene',
);
console.log(`Review account: ${username}`);
for (const [width, height] of [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
  [320, 640],
]) {
  await capture('city', width, height);
}
await evaluate(
  "Array.from(document.querySelectorAll('.place-card')).find(el => el.textContent.includes('Harbor District'))?.click()",
);
await until("!!document.querySelector('.enter-destination')", 'selected Enter action');
for (const [width, height] of [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
  [320, 640],
]) {
  await capture('selected-harbor', width, height);
}
await evaluate('document.querySelector(\'a[href="#inventory"]\')?.click()');
await until("!!document.querySelector('.inventory-drawer[open]')", 'inventory drawer');
for (const [width, height] of [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
  [320, 640],
]) {
  await capture('inventory', width, height);
}
await evaluate("document.querySelector('.inventory-drawer .drawer-close')?.click()");
await until("!document.querySelector('.inventory-drawer[open]')", 'inventory close');
await evaluate("document.querySelector('.enter-destination')?.click()");
await until(
  "document.querySelector('.location-body > h4')?.textContent === 'Harbor District'",
  'Harbor arrival',
);
console.log(
  'Harbor routes: ' +
    (await evaluate(
      "Array.from(document.querySelectorAll('.place-card-title')).map(el => el.textContent).join(', ')",
    )),
);
await capture('harbor', 1440, 900);
await evaluate("document.querySelector('.location-back')?.click()");
await until(
  "document.querySelector('.location-body > h4')?.textContent === 'New Harbor'",
  'city return',
);
for (const name of ['Industrial District', 'Market District', 'Civic & Residential']) {
  await evaluate(
    `Array.from(document.querySelectorAll('.place-card')).find(el => el.textContent.includes(${JSON.stringify(name)}))?.click()`,
  );
  await until("!!document.querySelector('.enter-destination')", `selected ${name}`);
  await evaluate("document.querySelector('.enter-destination')?.click()");
  await until(
    `document.querySelector('.location-body > h4')?.textContent === ${JSON.stringify(name)}`,
    `${name} arrival`,
  );
  console.log(
    name +
      ' routes: ' +
      (await evaluate(
        "Array.from(document.querySelectorAll('.place-card-title')).map(el => el.textContent).join(', ')",
      )),
  );
  await capture(name.toLowerCase().replaceAll(/[^a-z]+/g, '-'), 1440, 900);
  await evaluate("document.querySelector('.location-back')?.click()");
  await until(
    "document.querySelector('.location-body > h4')?.textContent === 'New Harbor'",
    'city return',
  );
}
socket.close();
