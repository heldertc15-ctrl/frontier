# FRONTIER — ARCHITECTURE

## Runtime

Frontier is a TypeScript browser application with two runtime processes during development:

- a React client built and served by Vite;
- a Node.js HTTP server that owns APIs and persistent game state.

Production builds compile the client to `dist/` and the server to `dist-server/`. The Node server
serves both `/api/*` and the built single-page application.

## Persistence

Local development uses SQLite through Node's built-in `node:sqlite` module. The default database
is `data/frontier.sqlite`; it is local runtime state and is not committed. Schema initialization and
seed operations are idempotent. Future gameplay stages must keep authoritative state changes on the
server and use transactions for scarce items or currency.

F01 adds `accounts`, one-to-one `characters`, and `sessions`. Session cookies contain opaque random
tokens; only SHA-256 token hashes are persisted. Passwords are salted and scrypt-derived. Character
state is read from the server through the session endpoint, so the sidebar never owns an independent
copy of gameplay state. The development-only state endpoint supports persistence verification and is
not available in production.

F02 adds a server-owned item-definition catalog and `character_items` rows. A row represents an
individual item or a stack, with its quantity, carried/locker location, and equipped state. All item
use, equipment changes, and locker transfers run on the server in SQLite transactions; the client
only submits an item instance id and validated action parameters. Ordinary carried inventory is capped
at ten occupied rows; allowlisted nonproduction admins have 50 carried rows and 50 locker rows.
The New Harbor locker is location-gated by the character's authoritative location.
Stack transfers update both source and destination inside one transaction. Full-source merges delete
the source row; partial merges decrement it. Capacity counts occupied rows, so a compatible merge may
enter a full carried inventory while a transfer requiring a new row is rejected. The locker is
available throughout the New Harbor city hierarchy and remains inaccessible once a future stage
introduces locations outside it.
Dragging one stack onto another stack of the same definition calls a separate server merge action.
It locks both owned rows, fills the chosen target to its definition cap, moves fish specimen rows
with their identities intact, and deletes the source only when emptied. Source overflow remains in
its original container.
Item rows have a nullable `sort_index` for player-arranged display order in each container. The
server validates a reorder request against the exact current set of owned instance IDs inside one
immediate SQLite transaction. `sort_index` values are positions with gaps in both carried inventory
and the ordinary unbounded locker. The client exposes ten ordinary locker spaces or 50 admin spaces;
occupied positions beyond the minimum remain visible without a trailing buffer. Moving a row between containers clears its old
position, so incoming items fill the first open space. Existing rows with no position keep their
original creation order until placed in available spaces.

F03 adds a server-owned New Harbor location catalog in `server/locations.ts` and two character-owned
tables: `character_discovered_locations` and `character_pinned_locations`. Definitions include a
stable id, parent/child routing, display copy, optional artwork path, pin/discovery rules, and
coordinate-ready hotspot metadata. The browser receives definitions and state but submits only a
target id; the server validates direct routes, discovered-only quick navigation, and pin eligibility
before atomically recording a first visit and current location.

`docs/art/` contains reference material only, never runtime artwork. The approved New Harbor
production image and seven full-canvas transparent cutouts are in `src/assets/locations/`.
`locationArtwork.ts` holds the corresponding 2560×1440 SVG hit paths and named label anchors.
Base image, cutouts, paths, and labels share one measured proportional contain transform and
rendered-image offsets. The whole 16:9 scene fits with a dark surround; named route controls stay
available independently of artwork. Cutout alpha
is visual only. Named SVG/HTML controls provide pointer and keyboard input. All seven district and
zone scenes use separate supplied 2560×1440 illustrations; Harbor and Industrial retain point
landmarks, while other scenes use named routes. Fishing Pier selects one of twelve supplied place
scenes from effective server time-of-day and sea-state conditions;
Fishing Store selects its supplied Dawn/Day/Dusk/Night interior from the shared world's effective
`conditions.timeOfDay`, with no map hotspots or sea-dependent variant. Both place scenes reuse
load-before-fade transitions while the surrounding context stays mounted. Other places continue to use
their parent scene where no specific artwork exists. Entered districts,
zones, and places are pin-eligible; pin additions are capped in a SQLite write transaction.

The authenticated shell keeps World mounted in a fixed viewport. The compact HUD and contextual
panel frame the scene, starting around 48px navigation, 176px HUD, and 336px context. The
world-stage header owns current location, Back to parent, and pin controls; the HUD groups character
resources, activity, clock, and Pack capacity without repeating location. City/district route lists
scroll within the panel. Place views omit sibling
route lists. Only pinned shortcuts appear in the top-navigation Quick Travel modal drawer;
the server retains discovered-location navigation eligibility under its existing contract.
Hover/focus only emphasizes the scene
control. Click or keyboard activation selects a destination and updates the context panel without
mutating game state. Explicit entry calls the existing validated navigation API.
Inventory and Account use native modal dialogs over the mounted world. The inventory panel remains
mounted while closed, preserving its pending mutation and result state. The `#inventory` hash opens
the drawer; browser Back or dismissal returns to the world without a gameplay transition.
The authorized Fishing tools use a nonmodal native dialog positioned as a bounded floating window;
pointer and keyboard controls move and resize it while the world remains interactive. The shared
character HUD and Pier scenery/condition panel use the public `/api/world/state` snapshot. An
authenticated SSE `/api/world/events` connection pushes changes in the global game minute,
effective conditions, or sea forecast. Each server instance checks the persistent shared world
row while it has listeners; an admin override publishes immediately on its own instance and other
instances observe it on their next check. Reconnects get an initial snapshot, with 10-second HTTP
polling as a fallback. These reads do not refresh Fishing session liveness.
Scene image swaps retain the prior image until the incoming source loads, then animate the
incoming image's opacity over the prior scene for one second. Reduced motion uses a static change.
Artwork captions are not rendered over any world scene.

## Presentation and renderer boundaries

The [UI target](UI_TARGET.md) supersedes the older shell presentation rules. The F03 repair changes
the React shell, scene metadata, location UI, and inventory presentation while retaining React/Vite,
Node HTTP, SQLite, authentication, discovery, pins, and authoritative mutations. City district
regions are aligned to the canonical city image. Harbor and Industrial use point landmarks on
their own scenes; Market, Residential, City Centre, Transit Hub, and Outskirts use their own scenes
with complete named route controls. No camera or additional rendering framework is installed.

Do not infer absence of these foundations from earlier screenshots or replace the app wholesale.
The F03 city artwork and interaction pairing received owner approval and final verification on
2026-09-23. No artwork generation is part of A01's sea refinement.

F04 has a separate required contract correction: current GET `/api/inventory` denies the entire
response outside New Harbor. Carried reads/actions must remain available with geographically
protected storage, including safe mutation responses. This is planned, not implemented; see
[API_CONTRACTS.md](API_CONTRACTS.md). F03 does not depend on F04 or perform this backend work.

The owner-authorized P01-PLACEMENT slice uses lazy-loaded PixiJS 8 inside the existing React world
stage for one isometric room grid. React owns the context picker, keyboard/touch controls, draft,
requests, and reconciliation; Pixi draws the floor, individual placeholders, facing markers and
ghost footprints, then sends only cell/selection intents. The city/district illustration renderer
remains separate. `shared/roomGeometry.ts` supplies pure footprint and collision rules to both
client preview and server validation; `src/room/roomProjection.ts` maps the fitted floor to pixels.

Schema 15 widens `character_items.location` to `room` through a checked SQLite table rebuild that
preserves existing rows and fish specimen children. `rooms` owns host/location, dimensions and a
revision; `room_placements` stores one `{itemId,x,y,rotation}` per item instance; `room_commands`
retains successful request-key receipts. Room reads use a transaction. Every placement/move takes
an immediate transaction, rechecks ownership and location, loads trusted catalog footprints,
validates occupancy, changes the item/layout, increments revision and records the receipt. The
client keeps the confirmed snapshot while editing and replays the same command after an uncertain
network result. A modal inventory drawer suspends room input without discarding the draft.

The room loads one of the owner's Dawn, Day, Dusk or Night yard images into the Pixi stage beneath
the transparent grid, furniture and ghost layers for 8×8 owned plots. `App.tsx` supplies the shared
world snapshot through `LocationsPanel` and `PropertyRoom`; the room uses its effective
`conditions.timeOfDay`, including server overrides. It loads a changed phase before crossfading the
current background over one second, matching the Fishing Pier's eased transition; stale loads cannot
replace a newer phase. Furniture lighting blends across that same transition. All four images use
the same fitted projection and plot geometry; other room sizes and initial asset-load failure retain the
procedural floor. Furniture remains procedural except for an owner-requested temporary farm-bed
visual fixture used by the guarded nonproduction test room. It is rendered as an anchored sprite;
each placed instance has its own sprite. A separate Pixi surface-lighting pass applies a subdued
Dawn, Day, Dusk or Night wash to placed objects and follows the loaded yard phase. Hover and active
selection draw a warm outline and wash over the object's projected surface. Its green/red ghost tint
is presentation feedback only.
The fixture has no crop compatibility or farming behavior. `LocationsPanel` keeps the selected room
ID in tab-scoped session storage, so a
refresh restores the open plot; using Back clears that view without changing the character's saved
host location. Phase is presentation state and adds no clock, layout fields or gameplay rules.
[ROOM_ART_ASSET_GUIDE.md](ROOM_ART_ASSET_GUIDE.md) records the yard registration and future
directional-sprite guidance.

Rooms and furniture enter this slice through allowlisted nonproduction fixtures. Its Build menu
lists current furniture and crop fixtures for allowlisted admins and creates test instances in
carried inventory before placement. Farming-bed crops use a separate persistent attachment table,
fixed crop orientation, unique bed squares, and atomic place/return commands. A bed with crops cannot
be returned until they are removed. Placed instances can be atomically returned to carried inventory.
Build remains unavailable in production; ordinary starter property is not granted. Production
property acquisition, purchase and storage remain full-P01 work, which still depends on F06. F04's carried/locker API correction remains
planned and is not represented as complete by the room's carried-only snapshot.

## A01 Fishing v1 implementation

The owner-directed Fishing Store buyer is a bounded A01 extension over existing fish specimens.
Schema 12 adds `npc_fish_sales` with a per-character request key, payload signature, paid amount,
and specimen quote snapshot. A server transaction verifies the character is physically at the
Fishing Store, owns the selected carried specimen IDs in one fish stack, calculates each price from
the authoritative weight/Trophy threshold, removes specimens and updates stack quantity, credits,
and sale history together. Repeated identical keys return the saved payment without paying twice.
The buyer's GET offers expose only carried fish. This does not introduce general merchant stock or
purchase logic.

The buyer's sale confirmation gesture silently resumes a lazily created Web Audio context.
`src/audio/cashRegister.ts` loads and decodes the bundled `src/assets/audio/cash-register.mp3`
sample, caches its buffer, and plays it only from the successful mounted sale-response handler,
once per confirmed intent. The file ships through Vite with the app; playback makes no third-party
request. Failed loads can retry on the next confirmation, and playback delayed more than 500ms
after the confirmed outcome is skipped. It is not tied to rendering or world updates. Audio
failures never affect the authoritative sale/receipt. Source attribution ships in
`public/asset-credits.html`, linked from Account; production serves MP3 as `audio/mpeg`.

A01 is selected under the corrected F02/F03 gate; its [v1 specification](GAME_DESIGN.md#15-fishing)
is implemented as a bounded functional slice. It retains React/Vite, the Node HTTP server, SQLite, the verified F02
inventory, and F03's **New Harbor → Harbor District → Fishing Pier**. Do not add a Coast pier,
replace the shell, or introduce a generic gathering framework for this single activity.

Use a bounded server-owned Fishing service with configuration for the 30-second base attempt duration,
eligible rods/baits, success bases, world-condition enums/chance modifiers, the four-axis fish condition matrix, and
weight ranges/distribution. `fishingConfig.attemptTiming` keeps rod, time-of-day, and sea-state duration
multipliers separate from catch chance. Every timing multiplier remains 1 until specific speed values
are approved; existing probability modifiers never imply speed. At scheduling, the service reads
effective time/sea and the selected rod to fix that attempt's duration. At resolution, it reads
the current effective conditions for catch probability; player setup cannot set either snapshot.
Developer/admin overrides are privileged server
operations. The obsolete condition column is removed from the world table during database opening.

Schema 7 extends the existing `fishing_world_state` singleton with a UTC-aligned current block
start, persisted next state, and nullable override. The legacy sea value becomes initial scheduled
current on first locked access. `server/seaState.ts` acquires `BEGIN IMMEDIATE` before reading for
standalone state/preview reads; attempt resolution uses its transaction-internal accessor. It
advances every elapsed 30-minute block, promotes the committed forecast first, and never rewinds
on a backward clock. SQLite, with a bounded busy wait, owns the schedule; no process timer owns it.
The override can mask effective sea while underlying transitions continue. Sea recovery never
replays stopped or missed Fishing attempts. `fishingCalculation.ts` supplies the same rod/condition
probability and eligible weighted species pool to attempt resolution and the bounded, non-mutating preview.
The preview normalizes every eligible species weight against the complete pool and returns a
conditional percentage only for species already discovered by that character. This display value
does not change the separate catch-success roll or the persisted attempt result.
`gameTime.ts` derives a shared 24-hour game clock from UTC epoch milliseconds: 10 real minutes
per game hour, four real hours per game day. Its half-open Dawn/Day/Dusk/Night boundaries and next
phase time are returned with each Fishing snapshot. A nullable persisted time override and its
UTC anchor shift the running clock to the selected phase's starting hour. The effective phase and
next phase timestamp advance with that clock until the override is cleared. The legacy static
`time_of_day` column is retained for upgrade compatibility but no longer drives gameplay. The clock
needs no process timer or persisted tick. Schema 8 removes the obsolete condition column from older
databases; new databases begin with only time and sea conditions. Schema 9 adds the override anchor
and anchors existing saved overrides at database upgrade time.

Persist committed session/attempt results alongside real inventory changes. Each logical attempt
has a single resolution identity so timers, retries, multiple tabs, and developer-forced attempts
cannot consume/reward twice. Validate location, `FISHING`, and carried selections before consumption;
apply the design-lock order in a transaction. Serialize start/stop, location departure, inventory
changes, and attempts against the same persisted state. Failed rolls consume one bait; validation
rejections consume none. Capacity stops record the consumed bait and failed insertion safely.
Schema initialization adds missing A01 `request_key` columns before building idempotency indexes when
upgrading an earlier local Fishing database, preserving existing rows.

Schema 13 adds persisted `attempt_started_at` and `attempt_duration_ms` alongside
`next_attempt_at`. Legacy rows reconstruct start from their saved deadline minus the historical
60,000 ms duration without altering completed results. New tables default to 30,000 ms, and each new
schedule saves all three values
in the same transaction. Timing-condition/configuration changes never rewrite an in-flight attempt;
the next schedule uses the new timing conditions. The public `activeAttempt` contains `startedAt`,
`deadlineAt`, and `durationMs` for active sessions and is null for idle/stopped state. Its identity
is the session ID plus resolved attempt count, so an unsuccessful or forced resolution is also a
new cycle when the server schedules another attempt.

Schema 14 adds `fishing_random_event_clocks`, `fishing_random_events`, and the session's
`event_revision`. The owner-directed random-event extension keeps its small scheduler in
`server/fishingRandomEvents.ts`, with tuning under `fishingConfig.randomEvents`. A per-character
persisted clock survives stop/start and refresh; active-session heartbeats confirm elapsed fishing
time within the existing liveness bound; explicit Stop/departure confirms the final bounded interval.
Stale reconnects, autonomous ticks, and restarts add no offline time. Generate
five timestamps in separate configured windows, carry due opportunities until a valid attempt can
show one Reel Pull prompt, and generate a fresh schedule at 60 active minutes. Forced prompts do not
change the schedule. Only a
live GET heartbeat offers/dequeues a natural prompt. An attempt receives at most one offer, even
after use; pending opportunities wait for later casts. Counts retain an opportunity's source cycle.

Natural and admin-forced prompts share persisted identity and activation logic. The five-second response
window derives from the event's persisted `created_at` and is capped at the current attempt deadline;
heartbeat clears expired prompts, while reads hide them and activation rejects them. Activation validates
the live current attempt in a transaction. Reel Pull sets that attempt's deadline to the activation
time and runs the ordinary resolution in the same transaction, including its bait, catch, inventory,
and next-attempt updates. It does not change eligible species weights or success probability, or add
an extra attempt or reward. Clear the prompt on
resolution or termination. Historical Surface Activity offers are hidden and rejected on activation;
historical used rows cannot modify catch selection. Persist a monotonic per-session event revision
(zero for a new session) so stale same-attempt responses cannot restore a consumed prompt or
pre-Reel deadline. The schedule remains admin-only.
The supplied M4A Reel Pull cue is bundled with the client. Web Audio is unlocked on a player gesture
and caches its decoded buffer; playback rate fills the configured five-second window. A newly observed
event starts at the offset implied by authoritative remaining time, while cleared/used/expired offers
stop playback. Initial restored offers stay silent, and audio failure has no effect on Fishing state.
The fish-catch cue and Reel Pull cue use the same Web Audio gain of 0.5.
The supplied fish-catch MP3 is decoded and cached by `src/audio/fishCatch.ts` after a player gesture.
The client plays it only when a newer authoritative Fishing snapshot increases the current session's
catch count and reports a latest catch; restoring a session or receiving duplicate snapshots stays
silent. Reel and catch cues have separate, default-on preferences in browser `localStorage`, keyed by
character ID. The Character sidebar exposes them at desktop sizes and the Account drawer exposes them
on smaller screens. Muting stops an active cue, and audio availability never affects game state.

Schema 10 adds `fish_specimens`, with one ID, weight (nullable only for historical/admin fish), source,
and stack foreign key per fish. Fish stacks hold at most 10 and bait stacks at most 120. The same
transaction updates specimen membership and stack quantity for catches, transfers, and admin changes.
Weight and derived Trophy status never affect stack compatibility. Catch weight sampling uses the
species' configured truncated exponential distribution; the 95th percentile of that definition
classifies Trophy. The species min/max range separately drives the inventory gradient position.
The client derives a stack-card Trophy cue from `specimens[].trophy` on each inventory response;
there is no separate persisted stack tier.
The authorized force-attempt path can sample from the top 5% of that same distribution and implies
a successful roll; it does not bypass equipment, bait, capacity, or attempt idempotency. Persisted
weights retain sampling precision; player-facing kg strings use three decimals when rounding to
three still shows less than 10 kg, and two otherwise, including saved catch messages.
The public latest-catch snapshot derives its `trophy` boolean through the same server classifier
as inventory specimens, so restored and stopped session results retain the distinction without
another persisted field or client-side rule.
The one-time upgrade splits oversized legacy fish stacks. It recovers recorded successful catch
weights from attempt traces where available and marks all unmatched fish as unknown. Old traces do
not identify the particular surviving fish, so recovered weights are associated deterministically,
without a claim of exact historical identity. Excess carried stacks are moved to the city locker
when splitting would exceed ten slots; counts and a migration report are retained in metadata.
Migrated specimen timestamps record migration, not purported catch times. No fish are silently
deleted or assigned invented historical weights. The locker remains subject to
its existing New Harbor access rule.
`character_discovered_fish` records one first awarded catch per species and character in the same
transaction as inventory/session results. The preview reads those records and sends a discovery
flag for silhouette rendering. The authorized personal reset deletes only these rows; it retains
inventory, attempt traces, and other characters' discoveries.

Fishing runs only in active sessions. The Pier panel refreshes inventory/full context every 15
seconds and reads lightweight Fishing state every two seconds while active to deliver prompts; the
server checks liveness every second and stops a session after 45 seconds without a heartbeat.
Each committed attempt that leaves its session active fixes the next start, duration, and deadline
from the independent timing configuration (currently 30 seconds for all rods/conditions). Restart stops any persisted active
session before serving requests. No elapsed time is replayed. Explicit logout and successful
navigation also stop. Successful Pier departure records a departure event for the most recent
session, even if it had already stopped. The public Fishing snapshot then presents an idle state
on departure and return; completed sessions and attempts remain in SQLite. XP is not mutated in A01.
A current session's catch summary is derived from its persisted awarded-attempt traces, so later
item transfers or deletions do not rewrite what the session caught. The explicit Stop button uses
client confirmation before calling the existing server action; the server remains authoritative.

The React client transforms the existing right context panel through initial, Preparation, and
active Fishing states. Prepare tackle is local; Start fishing commits the existing API. Two equipment
sockets open bounded carried-item pickers, anchored overlays on desktop and modal sheets/dialogs
on narrow screens, with focus return on selection or dismissal. The action footer stays in place
while content scrolls. One conditions row uses the effective snapshot; the sea outlook expresses the
committed next state in short qualitative language. The owner-authorized cyan attempt ring uses the
response's `serverTime` sampled at receipt and `performance.now()` elapsed time thereafter. Repeated
polls and rerenders preserve its authoritative schedule. It fills clockwise, clamps at completion,
and shows Checking for a bite… until the server confirms a result and any next cycle. At the deadline
the client requests a bounded refresh with one retry, alongside the active Fishing state reads;
no animation frame triggers a request or resolves gameplay. On resume/reconnect, reconcile state
before showing a new cycle. Older snapshots, same-session count rollback, and reopening a confirmed
stopped session are rejected. Progress is accessible without frame-by-frame live announcements;
reduced motion disables decorative movement while retaining accurate values. Connection errors keep
uncertainty visible and preserve results without a fabricated restart. The normal inventory drawer
continues to work independently. Do not add a new page or a close/collapse control for the active
Fishing context; keep server state authoritative in both HUD and panel.

Structured attempt traces, stop events, and admin inventory audit rows are persisted. The restricted
Fishing Debug Console and inventory testing view follow [API_CONTRACTS.md](API_CONTRACTS.md#a01-developmentadmin-tooling).
The dedicated Fishing test tools drawer is exposed only after the server confirms the signed-in
account's allowlist membership through `/api/fishing/admin/access`. Inventory mutations continue
through the guarded server endpoint and refresh the ordinary Inventory view.
Both require server-verified developer/admin authorization and the existing production-disabled
development-tool boundary. New debug controls must not inherit ordinary-player access just because
the app is running in development. Inventory tools mutate the same persisted carried or locker
inventory and immediately reconcile ordinary UI; they do not maintain a second client inventory.
Clear Locker uses the existing idempotent audited mutation path and deletes only stored rows for the
operator's character; dependent fish specimens cascade. Every admin inventory mutation is validated
and logged, including any explicitly offered capacity override.
The same guarded `delete` mutation targets one owned carried or locker instance. The normal inventory
drawer exposes it only after the server confirms admin access, and both that drawer and the debug
selector ask for confirmation. Deleting a fish stack cascades its specimens; carried capacity and
active Fishing views reconcile from the persisted result.

All four rod, five bait, and eight fish assets are in `public/assets/items/`, including the
owner-supplied expansion art. The twelve Pier variants live in
`src/assets/locations/fishing-pier/`. `locationArtwork.ts` maps effective time and sea to those
images. Deferred systems do not justify speculative routes or dependencies.

## Configuration

Server configuration is read from environment variables and validated on startup. Supported values
are documented in `.env.example`. Defaults are suitable for local development; secrets and `.env`
files are never committed.

## Error boundaries

The browser root is wrapped in a React error boundary. The server converts request failures into a
stable JSON error envelope and terminates on uncaught process-level errors so a process supervisor
can restart it.

## Quality gates

`npm run check` runs formatting verification, linting, TypeScript checking, automated tests, and the
production build. Vitest covers both browser and server code. The owner approved the F03 repair
on 2026-09-23, and final verification passed the same runtime revision with all 59 tests and the
production build. Approval and verification are recorded as separate gates in `PROJECT_STATE.md`.

The development launcher invokes the installed TypeScript and Vite CLIs directly. Vite treats port
5173 as strict so the documented address cannot silently change when another process owns the port.
