/* global fetch, WebSocket, setTimeout, console */
const page = (await fetch('http://127.0.0.1:9229/json').then((r) => r.json())).find(
  (item) => item.type === 'page',
);
if (!page) throw new Error('No review page');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => {
  const response = JSON.parse(data);
  if (!response.id || !pending.has(response.id)) return;
  const { resolve, reject } = pending.get(response.id);
  pending.delete(response.id);
  if (response.error) reject(new Error(JSON.stringify(response.error)));
  else resolve(response.result);
});
function command(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression, label) {
  for (let i = 0; i < 50; i++) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${label}`);
}
function assert(condition, label) {
  if (!condition) throw new Error(`Failed: ${label}`);
  console.log(`PASS ${label}`);
}
await command('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await command('Page.reload');
await until("!!document.querySelector('.location-body > h4')", 'location load');
if (await evaluate("document.querySelector('.location-body > h4')?.textContent !== 'New Harbor'")) {
  await evaluate("document.querySelector('.location-breadcrumbs button')?.click()");
}
await until("document.querySelector('.location-body > h4')?.textContent === 'New Harbor'", 'city');
assert(
  await evaluate("document.querySelectorAll('.district-region').length === 4"),
  'four city regions',
);
await evaluate("document.querySelector('.scene-fit')?.click()");
assert(
  await evaluate(
    "document.querySelector('.scene-stage').getBoundingClientRect().width <= document.querySelector('.location-art').getBoundingClientRect().width + 1",
  ),
  'Fit transform contains scene',
);
await evaluate("document.querySelector('.scene-fit')?.click()");
assert(
  await evaluate(
    "document.querySelector('.scene-stage').getBoundingClientRect().height >= document.querySelector('.location-art').getBoundingClientRect().height - 1",
  ),
  'Fill transform covers scene',
);
await command('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});
assert(
  await evaluate(
    "getComputedStyle(document.querySelector('.district-region')).transitionDuration === '0s'",
  ),
  'reduced motion',
);
await command('Emulation.setEmulatedMedia', { features: [] });
await command('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
const touchPoint = await evaluate(
  "(() => { const r = Array.from(document.querySelectorAll('.place-card')).find(el => el.textContent.includes('Industrial District')).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()",
);
await command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
await command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await until(
  "document.querySelector('.enter-destination')?.textContent.includes('Industrial District')",
  'touch selection',
);
assert(
  await evaluate("document.querySelector('.character-sidebar').textContent.includes('New Harbor')"),
  'touch selection does not navigate',
);
await command('Emulation.setTouchEmulationEnabled', { enabled: false });
await evaluate(
  "Array.from(document.querySelectorAll('.district-region')).find(el => el.getAttribute('aria-label').includes('Harbor District')).focus()",
);
await command('Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'Enter',
  code: 'Enter',
  windowsVirtualKeyCode: 13,
});
await command('Input.dispatchKeyEvent', {
  type: 'keyUp',
  key: 'Enter',
  code: 'Enter',
  windowsVirtualKeyCode: 13,
});
await until(
  "document.querySelector('.enter-destination')?.textContent.includes('Harbor District')",
  'keyboard selection',
);
assert(
  await evaluate(
    "!!Array.from(document.querySelectorAll('.place-card[aria-pressed=true]')).find(el => el.textContent.includes('Harbor District'))",
  ),
  'keyboard selects district',
);
assert(
  await evaluate("document.querySelector('.character-sidebar').textContent.includes('New Harbor')"),
  'preview does not navigate',
);
await evaluate('document.querySelector(\'a[href="#inventory"]\')?.click()');
await until("!!document.querySelector('.inventory-drawer[open]')", 'inventory open');
await evaluate('history.back()');
await until("!document.querySelector('.inventory-drawer[open]')", 'Back closes drawer');
await until("document.activeElement?.getAttribute('href') === '#inventory'", 'focus return');
assert(
  await evaluate("document.activeElement?.getAttribute('href') === '#inventory'"),
  'drawer focus returns to Pack',
);
assert(
  await evaluate(
    "document.querySelector('.enter-destination')?.textContent.includes('Harbor District')",
  ),
  'drawer retains selection',
);
await evaluate(
  "window.__f03Fetch = fetch; window.fetch = (...args) => String(args[0]).includes('/api/locations/navigate') ? Promise.reject(new Error('Review network failure')) : window.__f03Fetch(...args)",
);
await evaluate("document.querySelector('.enter-destination')?.click()");
await until("!!document.querySelector('.places-error')", 'failed request');
assert(
  await evaluate(
    "document.querySelector('.character-sidebar').textContent.includes('New Harbor') && !!document.querySelector('.enter-destination')",
  ),
  'failed entry retains current location and selection',
);
await evaluate('window.fetch = window.__f03Fetch');
await until("!!document.querySelector('.enter-destination:not(:disabled)')", 'Enter ready');
await evaluate("document.querySelector('.enter-destination')?.focus()");
await command('Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'Enter',
  code: 'Enter',
  windowsVirtualKeyCode: 13,
});
await command('Input.dispatchKeyEvent', {
  type: 'char',
  key: 'Enter',
  code: 'Enter',
  text: '\r',
  unmodifiedText: '\r',
  windowsVirtualKeyCode: 13,
});
await command('Input.dispatchKeyEvent', {
  type: 'keyUp',
  key: 'Enter',
  code: 'Enter',
  windowsVirtualKeyCode: 13,
});
await until(
  "document.querySelector('.location-body > h4')?.textContent === 'Harbor District' && document.querySelector('.character-sidebar').textContent.includes('Harbor District')",
  'Harbor arrival',
);
await evaluate(
  "Array.from(document.querySelectorAll('.place-card')).find(el => el.textContent.includes('Fishing Pier'))?.click()",
);
await until("!!document.querySelector('.enter-destination:not(:disabled)')", 'pier Enter ready');
await evaluate("document.querySelector('.enter-destination')?.click()");
await until(
  "document.querySelector('.location-body > h4')?.textContent === 'Fishing Pier'",
  'pier arrival',
);
await until(
  "!!document.querySelector('.current-place-actions button:not(:disabled)')",
  'pin ready',
);
await evaluate(
  "Array.from(document.querySelectorAll('.current-place-actions button')).find(el => el.textContent.includes('Pin place'))?.click()",
);
await until(
  "document.querySelector('.current-place-actions button')?.textContent.includes('Unpin place')",
  'pin',
);
await command('Page.reload');
await until(
  "document.querySelector('.location-body > h4')?.textContent === 'Fishing Pier'",
  'persistent place',
);
await until(
  "document.querySelector('.current-place-actions button')?.textContent.includes('Unpin place')",
  'persistent pin',
);
assert(
  await evaluate(
    "document.querySelector('.current-place-actions button')?.textContent.includes('Unpin place')",
  ),
  'pin and location persist on refresh',
);
await evaluate("document.querySelector('.location-breadcrumbs button')?.click()");
await until(
  "document.querySelector('.location-body > h4')?.textContent === 'New Harbor'",
  'city shortcut',
);
await evaluate(
  "Array.from(document.querySelectorAll('.saved-place-link')).find(el => el.textContent.includes('Fishing Pier'))?.click()",
);
await until(
  "document.querySelector('.location-body > h4')?.textContent === 'Fishing Pier'",
  'pinned shortcut',
);
assert(
  await evaluate(
    "document.querySelector('.character-sidebar').textContent.includes('Fishing Pier')",
  ),
  'one-action pinned navigation',
);
await evaluate("document.querySelector('.location-breadcrumbs button')?.click()");
await until(
  "document.querySelector('.location-body > h4')?.textContent === 'New Harbor'",
  'city return',
);
await evaluate("document.querySelector('.location-art img').src = '/missing-f03-review.webp'");
await until("!!document.querySelector('.art-unavailable')", 'art failure fallback');
assert(
  await evaluate("document.querySelectorAll('.place-card').length === 4"),
  'named routes survive missing image',
);
socket.close();
