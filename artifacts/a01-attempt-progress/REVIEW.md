# A01 authoritative fishing progress review — 2026-09-26

Scope: A01 only. F02 and F03 remain `MVP_PASSED`. This is refinement evidence, not owner visual
approval or complete A01 MVP certification. Owner visual approval and final MVP verification remain
**PENDING**. The reviewed source is listed in [source-sha256.json](source-sha256.json).

The supplied reference is recreated with coded controls in the existing context. The server fixes
each attempt's start, deadline, and duration. Neutral timing defaults remain 60 seconds; rod/time/sea
duration multipliers are separate from catch chance. A completed ring waits for an authoritative
result, with a deadline read and one retry plus the existing heartbeat. No local rewards, bait use,
attempt resolution, or automatic restart is introduced.

## Automated verification

`npm run check` passed: Prettier, ESLint, TypeScript, **212 tests / 20 files**, production build.
Vite's existing large-chunk warning remains informational. Focused additions verify:

- Persisted timing payloads, every neutral rod/condition combination, independent configurable
  durations, fixed schedules across mid-attempt condition/config changes, migration/reopen, invalid
  timing rollback, and unchanged resolution-time probability.
- Unsuccessful/forced attempts, idempotency, final bait, missing equipment, full inventory, stopped
  timing, heartbeat expiry, and no offline catch-up through server regression coverage.
- Monotonic restoration, same-attempt polling/rerender, remount/refresh/tab resume, connection freeze
  and confirmed recovery, older responses, attempt rollback, and stopped-session resurrection.
- Full-ring waiting with no mutation, bounded deadline reads, correction after delayed response,
  pending Start/Stop, retained catch after failure, stop confirmation, and progress accessibility.

## Rendered verification

Used the in-app browser with an isolated `data/a01-attempt-review.sqlite` world at
[local review](http://127.0.0.1:5177/). The normal player database was not used for test mutations.
`preview.mjs` starts its API/Vite and real one-second fishing timer; `setup.mjs` prepares review
equipment, and optional `--force` invokes the existing authorized attempt path. Neither changes
production balance. Review login: `attempt-review` / `frontier-review-2026` (local test account).

All dimensions below were measured with `innerWidth`/`innerHeight`, not inferred from saved image
dimensions. The browser's 1.1 device scale required corresponding viewport-tool sizing. Its capture
provider emits JPEGs and downscales some images; those encoding effects are not application blur.

| CSS viewport | Evidence                                                   | Measured result                                               |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------- |
| 1440×900     | [Active](active-1440x900.jpg), [catch](catch-1440x900.jpg) | World/HUD remain visible; no document overflow                |
| 1366×768     | [Active](active-1366x768.jpg)                              | No document overflow; content scrolls inside panel            |
| 1920×1080    | [Active](active-1920x1080.jpg)                             | No document overflow; restored catch and progress             |
| 1280×720     | [Active](active-1280x720.jpg)                              | Footer within viewport; results reachable by internal scroll  |
| 390×844      | [Active](active-390x844.jpg)                               | No horizontal overflow; scrollable panel and reachable footer |
| 320×640      | [Active](active-320x640.jpg)                               | No horizontal overflow; keyboard reaches sticky Stop footer   |

The Stop target measured about 46 CSS px high. Keyboard Enter opened inline confirmation; Escape
returned focus to Stop without stopping. Confirming showed pending feedback and then the retained
server-confirmed summary. Reload preserved the stopped state with zero attempt rings.
Nominal CSS color-pair calculations give primary text/slate 12.03:1, muted text/slate 7.87:1,
and cyan ring/track 4.87:1. These calculations supplement visual inspection, not a whole-app
accessibility certification of every translucent background.

- [Inline confirmation](stop-confirmation-1440x900.jpg)
- [Latest catch retained through no-catch](no-catch-retained-1440x900.jpg)
- [Confirmed stopped summary](stopped-1440x900.jpg)

Live flow: selected carried rod/bait, confirmed Start, observed a natural unsuccessful attempt,
forced a successful Mackerel catch through the authorized API, refreshed mid-cycle, observed a later
unsuccessful attempt retain that Mackerel, canceled Stop, confirmed Stop, and reloaded stopped
results. The ring restarted only after returned attempt state changed. Browser console error/warning
inspection returned none. The [visual comparison](../../design-qa.md) covers source fidelity.

## Limits and remaining gates

No dedicated physical touch, screen-reader, alternate OS reduced-motion, or zoom session was run.
Numeric progress is outside live regions; only phase text is announced. The ring/fish use no
decorative animation, and existing reward animation respects reduced motion. Keyboard focus and
touch-target dimensions were checked; this does not certify those unperformed device tests.
Full-ring delayed-server and reconnect/stale-response paths were tested deterministically, not
through a browser network throttle. Broader uncompleted A01 checklist items remain open.

Owner approval of this rendered revision is **PENDING**. Do not infer it from these checks.
