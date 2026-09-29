# A01 fishing random events — implementation review

Date: 2026-09-26. Scope: Reel Pull, Surface Activity, persistent active-time scheduling, and the
existing authorized Fishing test tools. F02/F03 were verified `MVP_PASSED`; no other stage started.
Owner visual approval and full A01 MVP acceptance remain pending. This is an implementation handoff.

## Validation

`npm run check` passed: formatting, lint, typecheck, 249 tests across 22 files, and production build.
The build retains its existing large-chunk advisory; no new dependency was added.

- 18 scheduler/weight tests cover all five windows, exact due boundaries, immediate 60-minute
  rollover, queued opportunities from earlier cycles, preserved anti-repeat history, disabled event
  types, weighted selection, modest normalized Surface weighting, and eligible-only pools.
- 13 event integration tests cover live-only accounting, explicit stop intervals, offline/restart
  recovery, database reopen and legacy upgrade, duplicate/cross-connection resolution, ignored
  prompts, late Reel activation, current-attempt Surface cleanup, invalid/stale intent, and guarded
  HTTP access. Existing fishing, inventory, discovery, buyer/audio, and world tests remain passing.
- Client tests exercise prompt delivery during countdown without repeated inventory loading,
  pending double activation, server-confirmed Reel timing, same-timestamp revision rollback,
  attempt-scoped Surface feedback, failed-action retry, reconnect disabling, and live admin refresh
  across consecutive casts.

## Browser checks

Ran `node --import tsx artifacts/a01-random-events/preview.mjs` against the separate
`data/a01-random-event-review.sqlite` world on ports 3108/5178. The player's database was not opened.

Prepared real carried rod/bait and started fishing through the UI. Opened Account → Fishing test
tools and forced Reel Pull, then activated REEL! from the central progress area. Its event cleared,
the same cast resolved once, and one bait was consumed. Forced Surface Activity on a following
cast and activated CAST TOWARD IT; the persisted trace showed the modest weights, unchanged 20%
base success probability, one bait, and no catch. Both forced prompts left the natural count at
0/5 and retained the same generated schedule. Later casts continued, including a Mackerel catch
retained in the session summary. Ignoring a later Surface prompt also allowed ordinary continuation.

Restarted the review server, reloaded, and verified the session stopped with its restart reason,
no prompt/modifier, and retained event cycle/schedule. A new explicitly started session resumed
that cycle. Additional captures used the guarded force endpoint with the same review account.
No UI-only inventory or alternate event execution was used. Confirmed Stop through the existing
inline prompt on the narrow layout and verified the saved Session complete summary and retained
Mackerel catch. The temporary browser tab and review server were closed after testing.

Measured CSS viewports: 1366×768, 1440×900, 1920×1080, 1280×720, 390×844, and 320×640; all reported
zero horizontal document overflow. The browser's existing scale required larger viewport overrides
to obtain the measured CSS sizes. At 1280×720 the Stop button bottom was 704px; at 320×640 it was
624px. Keyboard navigation brought the event and Stop actions into view on narrow screens; event
buttons measured approximately 44px high. See [layout measurements](layout.json).

The captures show the existing scene, progress area, optional prompt, retained catch, and reachable
Stop action. Screenshots are browser-rendered raster evidence, with the browser capture scale;
their filenames describe the measured CSS viewport. Dedicated touch, screen reader, and OS
reduced-motion sessions were not performed. Hour-long scheduling was exercised with controlled
time in tests, not a continuous real-time browser run. An initial browser-tool setup recorded a
MutationObserver error; no corresponding MutationObserver exists in the application source, and
no additional error was observed after the direct-page reload.

## Tuning and review boundary

`server/fishingConfig.ts` → `randomEvents` contains windows, cycle duration, event weights,
anti-repeat limit, five-second Reel target, Surface multiplier, and species rarity biases.
At multiplier 1.25, Worm Bait changes 0.70/0.25/0.05 to approximately
0.67066/0.26946/0.05988. Zero or one is neutral. The ordinary eligible pool is always built first.

Only one offer is allowed per cast; a used event also holds later opportunities until the next
cast. The admin force buttons explain that state. Current-cycle counts exclude deferred
opportunities originating in earlier cycles. Event time uses the existing 45-second liveness
bound; no autonomous timer tick earns unconfirmed offline time.

Source fingerprints are in [source-sha256.json](source-sha256.json). No owner approval is inferred
from these checks. A01 is `READY_FOR_ASTRA_UI_DESIGN`.
