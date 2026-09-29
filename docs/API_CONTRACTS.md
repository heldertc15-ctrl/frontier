# FRONTIER — API CONTRACTS

All APIs use JSON. Errors have the following shape:

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "Human-readable summary"
  }
}
```

## `GET /api/health`

Confirms that the server is running and the local database is initialized.

### Response: `200 OK`

```json
{
  "status": "ok",
  "database": "ready",
  "schemaVersion": 15
}
```

## Unknown API route

Any unknown `/api/*` route returns `404` with error code `NOT_FOUND`.

## Account session

`POST /api/auth/register` accepts `{ "username", "password", "characterName" }`, creates one
account and its initial character atomically, and establishes an HttpOnly, SameSite session cookie.
Usernames are 3–24 alphanumeric, underscore, or hyphen characters; passwords are 8–128 characters;
character names are 2–24 permitted name characters. Duplicate usernames return `409 USERNAME_TAKEN`.

`POST /api/auth/login` accepts `{ "username", "password" }` and establishes a fresh session.
Invalid credentials return `401 INVALID_CREDENTIALS`. `POST /api/auth/logout` revokes the current
session and clears the cookie.

`GET /api/session` always returns `200`. Anonymous response: `{ "authenticated": false }`.
Authenticated response includes `{ "authenticated": true, "account": { "username" }, "character" }`.

## Character

`GET /api/character` returns `{ "character": Character }` for the current session and returns
`401 AUTH_REQUIRED` without one. `Character` has `id`, `name`, `credits`, `hp`, `maxHp`,
`characterXp`, `characterLevel`, `currentLocation`, `currentLocationId`, and `activeStatus`.
`currentLocation` is the display name; `currentLocationId` is the stable server location id.

In development and test environments only, `PATCH /api/character/development-state` accepts any
combination of `credits`, `hp`, and `characterXp` as validated non-negative whole numbers (HP may not
exceed max HP). It returns the resulting `{ "character": Character }`. This is verification tooling,
not a gameplay reward API, and returns `404` in production.

## Inventory and city locker

Placed room furniture is excluded from `GET /api/inventory` and every inventory reorder,
merge, transfer, use, equip, and guarded admin deletion path. City locker location rules remain
unchanged. Furniture definitions in the item catalog include a server-owned rectangular footprint
and artwork key; fixture furniture has quantity one and cannot stack.

## P01-PLACEMENT room API

All routes require a session and return `Cache-Control: no-store`. The room is available only to
its owner at the character's exact current host location. A missing, foreign, or remote room returns
`404 ROOM_UNAVAILABLE` without its contents. Opening a room is an in-shell view; it does not change
the character's location.

- `GET /api/rooms` returns `{ "rooms": RoomSummary[] }` for the current host location. Each
  summary has `id`, `name`, `locationId`, `width`, `depth`, and `revision`.
- `GET /api/rooms/:roomId` returns `{ room, definitions, buildCatalog, cropCatalog, placements,
crops, placedItems, carriedInventory }`. `buildCatalog` contains current furniture definitions only for allowlisted
  nonproduction admins; it is empty for other accounts. `placements[]` contains `{ itemId, x, y,
rotation }`, where `itemId` is the owned `character_items.id`. `placedItems[]` joins IDs, definition IDs and names for
  presentation. `cropCatalog` lists the single fixed-orientation 1×1 tomato plant development
  fixture for allowlisted admins, and `crops[]` identifies each crop instance, its bed, and its
  bed-local square. Planting uses the same snapped placement preview as furniture; only open squares
  inside a farming bed are valid. Farming beds themselves do not respond to pointer hover.
  `carriedInventory` has
  `capacity`, `usedSlots` and carried `items`; it never
  includes locker contents. The read is transactionally consistent.
- `POST /api/rooms/:roomId/place` and `/move` take `{ itemId, x, y, rotation,
expectedRevision, requestKey }`. Coordinates are zero-based integer minimum corners of the
  rotated footprint. Rotation is exactly 0, 90, 180 or 270. Place requires one unequipped,
  carried furniture instance; move requires that instance already in this room. The server
  checks bounds and occupancy, changes the exact instance, increments the room revision once,
  and returns the current room snapshot plus `command: { requestKey, appliedRevision }`.
  All checks and writes run in one immediate SQLite transaction.

`POST /api/rooms/:roomId/remove` takes `{ itemId, expectedRevision, requestKey }`. It returns the
same placed furniture instance to carried inventory. Ownership, current host, revision and capacity
are checked server-side; the placement, item location, revision and replay receipt commit atomically.

`POST /api/rooms/:roomId/build` takes `{ definitionId, expectedRevision, requestKey }`. Only an
allowlisted nonproduction admin can use it. It creates a nonstackable furniture or crop fixture in
carried inventory, checks capacity, advances the revision and records an idempotent receipt. It
cannot create items in production or expose test catalog entries to ordinary accounts.

`POST /api/rooms/:roomId/crop` takes `{ itemId, bedItemId, x, y, expectedRevision, requestKey }`.
The crop is the carried 1×1 tomato fixture; the bed must be a placed farming bed, and `x`/`y` select
one of its four squares. Crop orientation is fixed. The server atomically checks ownership, slot vacancy,
revision and item state, then persists the crop attachment. `POST /api/rooms/:roomId/crop-remove`
takes `{ itemId, expectedRevision, requestKey }` and returns that crop instance to carried inventory.
The bed follows crop placements when moved and cannot be returned while crops remain planted.

`requestKey` is 1–128 characters and unique per character. The server signs the action, room,
item or definition, coordinates, rotation and expected revision. Retrying the same key and
payload returns its saved acknowledgement with the current snapshot; another payload returns
`409 REQUEST_KEY_REUSED`.
A new command with an old revision returns `409 ROOM_CHANGED`. Other stable errors include
`VALIDATION_ERROR`, `ITEM_NOT_AVAILABLE`, `ITEM_NOT_BUILDABLE`, `INVENTORY_FULL`, `ADMIN_REQUIRED`,
`OUT_OF_BOUNDS`, `SPACE_OCCUPIED`, `CROP_NOT_AVAILABLE`, `CROP_SPACE_OCCUPIED`, and
`FARM_BED_HAS_CROPS`. A timed-out client replays its exact command/key before
accepting another mutation.

`POST /api/rooms/admin/fixture` exists only in nonproduction and requires the existing explicit
admin allowlist. It idempotently creates an owned 8×8 room at the operator's current host and
places three test furniture instances plus one temporary farm-bed fixture in carried inventory,
subject to capacity. Calling it again adds the farm-bed fixture to an existing room if it is missing.
It is unavailable to ordinary characters and returns `404` in production. This remains test tooling,
not property acquisition or a gameplay reward.

### Current implemented contract

`GET /api/inventory` returns `{ "inventory": Inventory }` for an authenticated character within New
Harbor. `Inventory` contains `capacity` (10 normally; 50 for allowlisted nonproduction admins),
`lockerCapacity` (null for ordinary accounts; 50 for admins), `usedSlots`, `items`, and `locker`; an item
contains its instance id, definition metadata, quantity, location, and equipped state. Fish items
also include `specimens[]` for that stack: `{ id, weightKg, weightKnown, trophy, minKg, maxKg,
position }`. Carried and locker items include a `slotIndex` display position. `weightKg` and `position` are null only for historical/admin fish without a known
weight. `trophy` is derived from the species distribution's 95th percentile; `position` is the
clamped fraction of the species numerical min/max range. The numeric payload retains sampled
precision; ordinary UI uses three decimal places when three-decimal rounding stays below 10 kg
and two otherwise. Outside New
Harbor this endpoint returns `403 LOCKER_UNAVAILABLE` so locker contents cannot be remotely read.

`POST /api/inventory/reorder` accepts `{ "location": "inventory" | "locker", "itemIds": [...] }`.
For carried inventory, `itemIds` has `max(capacity, usedSlots)` positions containing every current
instance ID once and `null` for empty slots. Locker lists use the same nullable positions, with
`max(minimum visible slots, stored stack count, furthest occupied position + 1)` entries, where the
minimum is ten ordinarily or 50 for admins. Moving to the last visible cell does not add cells. Compact locker lists
without nulls remain accepted for compatibility. The
server validates ownership and the complete current set atomically, persists the order, and returns
`{ "inventory": Inventory }`. Duplicate/malformed lists return `VALIDATION_ERROR`; lists made stale
by an item change or containing another player's item return `INVENTORY_CHANGED`. Locker access is
subject to the existing New Harbor gate (`403 LOCKER_UNAVAILABLE`). Reordering changes no item
contents, quantities, or equipped state. An item entering either container takes the first free
position.

`POST /api/inventory/merge` takes `{ "sourceId", "targetId" }` for two distinct owned stacks of the
same stackable item, in either the same container or across carried inventory and the city locker.
The server fills the target up to its item-definition cap and leaves overflow in the source's
original position; a completely absorbed source is deleted. Fish specimen IDs and weights move
with their fish. The transaction returns `{ "inventory": Inventory, "moved": number }`.
Incompatible, foreign, or unavailable pairs return `STACK_NOT_COMPATIBLE`; a full target returns
`STACK_FULL`; malformed or identical IDs return `VALIDATION_ERROR`. The New Harbor locker gate
still applies. Repeating a completed merge cannot add more than the target cap.

`POST /api/inventory/transfer` accepts `{ "itemId", "destination": "inventory" | "locker",
"quantity" }`. It requires New Harbor, validates ownership, positive whole quantity, stack limits,
and carried capacity, then atomically updates the relevant stack(s). Admin locker transfers are capped
at 50 stored stacks. Invalid operations return stable errors including `INVENTORY_FULL`,
`LOCKER_FULL`, `ITEM_NOT_AVAILABLE`, `ITEM_EQUIPPED`, and `LOCKER_UNAVAILABLE`.
Compatible stacks merge without occupying a new slot, including when carried inventory is otherwise
full. Fish transfers fill partial destination stacks to 10 before making another stack and move the
selected specimens with their identities and weights. A merge consumes or decrements the source stack in the same transaction, so retries with a
stale item instance fail without duplicating items.

`POST /api/inventory/use` accepts `{ "itemId" }`, only permits a carried usable consumable, consumes
one server-side, and returns the updated inventory plus character. `POST /api/inventory/equip` and
`POST /api/inventory/unequip` accept `{ "itemId" }` and only operate on carried compatible equipment.

### Planned F04 separation, not implemented

Before regional travel is enabled, separate carried inventory access from locker access. An
authenticated player outside New Harbor must be able to read carried items/capacity and perform
otherwise-valid carried use/equip/unequip actions without exposing locker contents. Audit the
inventory returned by mutation responses as well as GET; a safe read must not turn into a storage
leak after an action. Locker reads and both transfer directions remain server-location-gated.

During F04 implementation, choose and document an explicit unavailable-locker representation or a
separate storage read endpoint. Do not present either as the current response schema. Clear/hide
previously loaded storage on losing access; never use cached contents as remote storage. Arrival
outside New Harbor, travel state, return, refresh, and separate-account isolation must verify this
separation. Item ownership, capacity, atomicity, and existing error semantics remain enforced.
F03's drawer uses the current city contract; it must not change the API to claim this fix is done.

## City locations

`GET /api/locations` returns `{ "locationState": LocationState }` for the authenticated character.
`LocationState` contains the authoritative `currentLocationId`, all static location definitions,
`discoveredLocationIds`, and `pinnedLocationIds`. A definition includes `id`, `name`, `description`,
`kind`, `parentId`, optional `artworkPath`, `childLocationIds`, coordinate-ready `hotspots`,
`discoveryState`, and `pinEligible`.
`kind` is `city`, `district`, `zone`, or `place`. New Harbor has five district children
(Harbor, Market, Industrial, Residential, City Centre) and two zone children (Transit Hub,
Outskirts). The existing `civic-residential` ID now names Residential District; `city-centre` is
new. Civic Hall's parent is City Centre, while Newcomer Housing remains in Residential District.
Zones use the same validated adjacent navigation contract and currently have no child routes.

`POST /api/locations/navigate` accepts `{ "locationId" }` and permits only an adjacent parent or
child route. It records a first visit and returns `{ "locationState", "character" }`.
`POST /api/locations/quick-navigate` accepts the same payload but permits only an already-discovered
city location. `POST /api/locations/pins` accepts `{ "locationId", "pinned" }`; it only permits
discovered pin-eligible districts, zones, and places, and returns `{ "locationState" }`. The starting
city is not pin-eligible. Invalid requests return `400` with
stable codes including `LOCATION_NOT_FOUND`, `LOCATION_NOT_REACHABLE`, `LOCATION_NOT_DISCOVERED`,
and `LOCATION_NOT_PINNABLE`. A sixth distinct pin returns `400 PIN_LIMIT_REACHED`; repeating an
existing pin remains idempotent at capacity. The five-pin check and write are atomic. Existing
saves with more than five pins retain them, but cannot add another until below the limit.

## A01 Fishing v1 contract

The owner-directed Fishing Store buyer adds authenticated, no-store routes:

- `GET /api/fish-buyer` requires physical `fishing-store` presence and returns `{ buyer: { available,
offers } }`. Each carried fish stack offer contains `stackId`, `speciesId`, `name`, `artworkPath`,
  `totalCredits`, and specimen quotes `{ id, weightKg, trophy, credits, creditsPerKg }`.
  `creditsPerKg` is null for ordinary or unknown-weight fish; locker contents are not offered.
- `POST /api/fish-buyer/sell` takes `{ stackId, specimenIds, requestKey }`, selecting 1–10 distinct
  specimens in one carried stack. The server validates ownership, location, and current specimen
  membership, then removes the fish and credits the character atomically. It returns
  `{ creditsEarned, inventory, character, buyer }`. A repeated key with the same selection returns
  the original earned amount and current state without another credit; a different selection under
  that key fails. Stale or foreign selections fail without mutation. Sales grant no XP or Knowledge.

The owner-approved [A01 v1 design lock](GAME_DESIGN.md#15-fishing) defines gameplay and provisional
configuration. All routes require an authenticated account and use the standard error envelope.

- `GET /api/world/clock` returns `{ "serverTime", "gameTime", "timeOfDay" }` for the shared
  Frontier HUD at every location. `gameTime` has the same fields as the Fishing snapshot and
  starts an override at its phase-start hour with minute zero, then continues advancing.
  `timeOfDay` is the effective phase,
  including an authorized override. This read does not touch
  Fishing session liveness, advance sea state, or expose admin override metadata.
- `GET /api/world/state` returns the public authoritative `{ "serverTime", "gameTime",
"conditions", "sea" }` snapshot, including effective Pier conditions and the committed sea
  forecast. It reconciles elapsed sea blocks, but does not refresh Fishing session liveness or
  expose override metadata. `GET /api/world/events` streams the same snapshot as SSE `data:` events
  on connection and whenever the game minute, effective conditions, or sea forecast changes.
  Server instances check the shared database while clients are connected, so admin changes made
  through another instance propagate. The client reconnects automatically and polls
  `/api/world/state` every 10 seconds as a fallback. Both routes require a session and return
  `Cache-Control: no-store`.
- `GET /api/fishing` returns `{ "fishing": FishingState }` and refreshes active-session liveness.
  `FishingState` has `status` (`idle`, `active`, `stopped`), `sessionId`, selected item IDs/names,
  `baitRemaining`, authoritative `conditions` (`timeOfDay`, `seaState`), `catches`,
  `attempts`, `latestCatch` (`species`, `weightKg`, `trophy`) or null, `latestResult`, and `stopReason`.
  `catchSummary` is an array of awarded fish grouped by species, with `species`, `count`, and
  `trophyCount`; it is populated during active and stopped sessions from
  persisted attempt records and empty when no fish have been awarded or the state is idle.
  `latestCatch.trophy` is derived server-side from the persisted weight and the same species
  distribution used for inventory specimens, including restored and stopped session results.
  `activeAttempt` is `{ "startedAt": string, "deadlineAt": string, "durationMs": number }`
  while active and `null` while idle/stopped. The timestamps are UTC ISO strings; `durationMs`
  is the positive duration scheduled by the server, and the deadline is start plus duration.
  Reel Pull can atomically resolve the current attempt early. A successful activation response
  contains the completed result and, if Fishing remains active, the next scheduled attempt.
  `sessionId` plus the resolved `attempts` count identifies the current attempt. Reads return the
  persisted timing; they do not start or reschedule an attempt. A due unresolved attempt may remain
  active with a deadline at or before `serverTime`, so clients show Checking for a bite… until a
  newer authoritative result confirms whether another attempt was scheduled.
  It also returns `serverTime` (UTC ISO timestamp), `gameTime` (`day`, `hour`, `minute`,
  `scheduledPhase`, `nextPhase`, `nextPhaseAt`), and `sea` with `zoneId: "fishing-pier"`,
  `blockStartedAt`, `blockEndsAt`, `scheduledCurrentState`, and `nextState`. `conditions.seaState`
  is the effective gameplay state. The sea object has exactly one future state. Values without a
  current session are null or zero. `randomEvent` is null or `{ id, type, message, buttonLabel,
sessionId, attempts, expiresAt, windowMs }`, where `type` is `reel_pull`; the identifiers bind
  it to the current attempt. `expiresAt` is the UTC ISO expiry, capped by the current attempt deadline,
  and `windowMs` is the configured five-second response window. `eventRevision` is a persisted
  increasing session revision used to reject
  stale responses, including responses with the same millisecond timestamp. No RNG, schedule,
  rarity weights, override metadata, or debug field is returned.
- `GET /api/fishing/preview?rodItemId=…&baitItemId=…` requires physical Pier presence and valid
  owned carried item instances with positive bait quantity. It returns `{ "preview": { rodItemId,
baitItemId, rod, bait, serverTime, conditions, gameTime, sea, seaEffect, possibleSpecies } }` from one
  schedule snapshot. Catalog names and artwork paths are server supplied; `seaEffect` is improved,
  neutral, or reduced. Preview consumes nothing and starts no activity. Each possible species has
  a per-character `discovered` flag. Discovered entries also have `catchSharePercent`, equal to
  `100 × speciesWeight / sum(all eligible speciesWeights)` for the preview snapshot. The denominator
  includes undiscovered species. Undiscovered entries omit this field and
  render as black silhouettes labeled `???`. It may initialize or advance the sea schedule.
  The list includes only species with positive time, sea, bait, and rod weights; a zero on any axis
  excludes a species. The authorized test panel can inspect the same calculation for arbitrary
  combinations without changing the live world.
  This share is conditional on a successful catch using the normal eligible pool. The preview
  does not expose the overall catch-success probability, RNG rolls, or admin diagnostics.
- `POST /api/fishing/start` takes `{ "rodItemId", "baitItemId" }`; returns `{ "fishing", "character" }`.
  A repeated request for the same active selection returns that session. A different selection
  while active returns `ALREADY_FISHING`; invalid position/items return `FISHING_NOT_READY`.
- `POST /api/fishing/stop` takes an empty body, is repeatable, and returns `{ "fishing", "character" }`.
  The client confirms an explicit stop before sending this request; canceling sends none.
  Successful location navigation and logout also stop fishing. Prepare tackle is a local
  Preparation transition and does not call an activity API.
- `POST /api/fishing/event` takes `{ "eventId" }` as intent to activate the current prompt.
  Success returns `{ "fishing", "character" }`. Unknown/foreign IDs and pending events whose
  attempt is no longer valid or whose five-second response window expired return
  `400 EVENT_UNAVAILABLE`; malformed IDs return
  `400 VALIDATION_ERROR`. Retrying an owned used/cleared event returns current state without effects.
  The server validates account ownership, liveness, physical Pier presence, carried selections,
  and the current unresolved attempt under the same transaction as the effect. Reel Pull resolves
  that attempt immediately through the ordinary catch and bait pipeline; the response includes its
  result and next attempt or stop state. It does not alter species weights or add an extra roll.
  Historical Surface Activity offers are hidden
  and rejected on activation.
  Duplicate/obsolete IDs cannot affect the next attempt. Ordinary event state exposes no debug
  probabilities or natural schedule. Prompts are optional and disappear on use/expiry/resolution/stop.
- Attempts run in the server timer, never from client-submitted elapsed time or rewards. A completed
  attempt transaction consumes bait, records the result/trace, and adds at most one fish. A new
  fish stack at full capacity records `Fishing stopped: inventory full.` after bait consumption.
  Active sessions require a GET heartbeat within 45 seconds. Server restart ends active sessions
  without missed-attempt replay. A01 makes no Character XP or Knowledge mutation.
  Duration is scheduled from the server's base `attemptIntervalMs` and the independent
  `attemptTiming.rodDurationMultipliers`, `timeOfDayDurationMultipliers`, and
  `seaStateDurationMultipliers`. The base is 30,000 ms and every timing multiplier remains 1;
  no approved speed balance values exist. Existing chance modifiers do not affect timing. The
  chosen duration is fixed while unresolved except when an activated Reel Pull resolves early;
  timing-condition changes apply to the next schedule,
  while catch probability continues to use conditions at resolution. Forced attempts resolve
  through the same authoritative pipeline and expose any newly scheduled timing in the response.

- Read: return authoritative activity/session state, current time of day/sea, selected
  carried rod/bait and remaining bait, session catches, latest catch/weight, and any stop reason.
  Ordinary responses omit probability calculations, RNG rolls, debug logs, overrides, and admin controls.
- Prepare: Prepare tackle is a local panel transition. It creates no running server
  activity and consumes nothing. Eligible item choices come from real carried inventory.
- Commit: Start fishing submits selected rod/bait identities as intent. The server
  validates session ownership, physical Fishing Pier location, activity eligibility, and current
  carried item validity/quantity before setting `FISHING`. Reject forged, stored, foreign, stale,
  or ineligible selections. Duplicate commitment must not create concurrent fishing sessions.
- Resolve: only the server schedules/resolves attempts. Apply the ordered validation, one-bait
  consumption, success roll, conditional species roll, weight generation, capacity check, inventory
  mutation, and session record in the design lock. Clients never submit elapsed time as earned
  attempts, catch outcomes, weights, reward amounts, or probabilities.
- Capacity: merge catches into an eligible carried stack of the same species with fewer than ten
  fish, including at full slot capacity. A new stack needs a slot after bait consumption. If none
  exists, commit the consumed bait and recorded capacity stop without inserting an overflow fish; return exactly
  **Fishing stopped: inventory full.** Other item limits and storage rules stay intact.
- Selected bait: each active session references one carried bait stack ID. Each valid attempt uses
  one bait from that stack, including unsuccessful attempts. The final bait resolves its attempt and
  then stops the session; another bait stack is never chosen automatically.
- Specimens: each awarded catch inserts one persisted fish specimen in the same transaction as
  bait, stack quantity, session outcome, and discovery. A known weight is sampled from the
  configured species distribution, with Trophy derived from its 95th percentile. Admin-spawned
  fish have explicit unknown weights rather than synthetic catches.
  - Stop: explicit Stop Fishing is safe to repeat. Successful departure by adjacent navigation,
    quick navigation, or any other location-changing path stops fishing server-side. A failed
    departure or destination preview does not. After successful Pier departure, `GET /api/fishing`
    returns an idle public state with no prior session count, catch, result, or stop notice, including
    after returning to the Pier; completed rows remain persisted. Serialize departure/stop against
    attempts so nothing resolves after the committed stop. Invalid/missing selected supplies stop
    before a new bait charge.
- Reliability: persist completed attempt/session results with bait/catch mutations atomically.
  Claim each logical attempt once across timer,
  retry, concurrent tab, and forced-attempt paths. Reconnection/restart reconciles persisted state
  without offline accrual or replaying missed attempts. Use existing error-envelope conventions.
- UI reconciliation: return or refresh the authoritative character, inventory, and fishing session
  after mutations, including tool actions; stale picker selections cannot authorize an attempt.
  The ring anchors to response `serverTime` and monotonic elapsed time between updates, never
  client wall-clock changes. Refresh, poll, rerender, reconnect, and tab resume use the current
  attempt identity/timing, without locally awarding results or starting another cycle. Discard
  older snapshots, lower same-session attempt counts, and active snapshots that would reopen a
  confirmed stopped session. Reaching a deadline requests bounded reconciliation while retaining
  the existing 15-second heartbeat; it never submits an attempt or treats completion as success.
  Request errors preserve confirmed results and make uncertainty explicit; stopped state never
  automatically restarts.
  Never expose storage contents through the new responses when storage access is unavailable.

## A01 development/admin tooling

The Fishing Debug Console and inventory testing tool require a signed-in account whose username
is listed in `FRONTIER_ADMIN_USERNAMES` in a nonproduction server process. Ordinary login or a
development client build is insufficient. Production returns `404` for these routes; an
unauthorized authenticated account receives `403 ADMIN_REQUIRED`.

- `GET /api/fishing/admin` returns the current character's last 100 attempt traces and stop events,
  last 50 inventory audit entries, item definitions, Fishing configuration, current inventory,
  and Fishing state. This payload is never part of the ordinary Fishing response.
- `GET /api/fishing/admin/access` returns `{ "authorized": true }` for a signed-in allowlisted
  nonproduction account. The client uses it to reveal the dedicated **Fishing test tools**
  development/admin navigation entry. It uses the same `401`/`403 ADMIN_REQUIRED`/production `404`
  gate as the admin actions; visibility never grants access by itself.
- `POST /api/fishing/admin/force` takes `{ "requestKey", "forceSuccess", "expectedAttemptCount",
"forceTrophy"? }`; `forceTrophy` is an optional boolean defaulting to false. When true it implies
  success and samples the selected species' top 5% distribution before the normal insertion check.
  `requestKey` is an
  8–100 character alphanumeric/underscore/hyphen idempotency key for one session. Returns
  `{ "fishing", "inventory", "character" }`. The expected count claims the next unresolved
  attempt and prevents a scheduled/forced race from resolving it twice. It uses the normal pipeline
  and records `forceTrophy` in the privileged attempt trace.
- `POST /api/fishing/admin/event` takes `{ type, sessionId, expectedAttemptCount, requestKey }`
  to show Reel Pull (`reel_pull`) for a valid active
  attempt. A request key identifies one force intent; session/count prevent a delayed intent
  affecting another cast. Allow only one offer per attempt, including after a prompt is used;
  reject additional forcing until the next cast. Forced prompts use the same
  activation endpoint and effect as natural prompts, without changing the natural schedule.
- The admin snapshot's `randomEvents` contains `cycleDurationMs`, `elapsedMs`, `nextEventInMs`,
  `triggeredCount`, `scheduleMs`, `currentEvent`, and `canForce`. The count measures natural opportunities shown in the
  current source cycle, not forced prompts or deferred opportunities from an earlier cycle.
  `canForce` requires a valid live attempt with no prior offer.
- `POST /api/fishing/admin/conditions` accepts one or more of `timeOfDay`, `seaState`
  from the configured enums. `seaState: null` or `timeOfDay: null` clears that shared Pier override;
  omission leaves it
  unchanged. It returns effective `conditions`, `gameTime`, public `sea`/`serverTime`, and admin-only previous
  and new override values. The underlying schedule advances in the same transaction, including
  under a persistent override. Unknown fields, schedule writes, and invalid values are rejected.
  A time override anchors the running clock at 05:00, 08:00, 17:00, or 20:00.
  The clock and effective phase continue to advance; clearing returns to the UTC schedule.
  Condition changes are attributed in structured console logs, not a persisted condition audit.
- `POST /api/fishing/admin/discoveries/reset` takes an empty JSON body and clears only the
  operator character's persisted fish discoveries. It returns `{ "removed", "discoveredFish": [] }`.
  Repeating it is safe; caught fish, inventory, attempts, and other characters are unchanged.
- `POST /api/fishing/admin/inventory` requires a unique 8–100 character `requestKey` with each
  action and accepts `{ "action": "add", "definitionId", "quantity" }`,
  `{ "action": "remove", "itemId", "quantity" }`, `{ "action": "delete", "itemId" }`, or
  `{ "action": "clear" }` (carried only), or `{ "action": "clear_locker" }` (stored only). Successful actions return `{ "inventory", "fishing" }`. Mutations
  affect only the operator's current character and use normal capacity, item, and stack rules.
  `delete` accepts an owned item/stack in either carried inventory or the city locker; `remove`
  remains carried-only. Both the admin selector and an authorized selected-card control require
  confirmation before deletion. Ordinary clients never receive this control.
  Every accepted or rejected mutation writes an audit entry. Repeating a request key returns its
  prior outcome without applying the mutation again. Clearing the locker deletes its stored stacks
  and fish specimens for the operator's character, leaving carried items and other characters alone.
  No capacity override is offered.

### Fishing Debug Console

Prefer structured server logs plus an authorized development/admin view. Each attempted resolution
must expose/log the following, including validation failures and no-catch/stop results. Fields for
steps not reached are explicitly not evaluated; do not fabricate RNG values for a rejected attempt.

| Required field                           | Meaning                                                             |
| ---------------------------------------- | ------------------------------------------------------------------- |
| Timestamp and attempt/session identifier | Correlate a single resolution and its retries                       |
| Character/player ID                      | Authoritative subject of the attempt                                |
| Fishing Pier/location validation result  | Actual location and eligibility result                              |
| Selected rod and bait                    | The selected item identities/definitions                            |
| Bait quantity before/after               | Evidence of exactly one consumption, or none on rejection           |
| Current time of day and sea state        | The authoritative condition snapshot used                           |
| Rod base chance                          | Configured success base                                             |
| Applied condition modifiers              | Time and sea multipliers                                            |
| Computed final catch probability         | Product used for this attempt                                       |
| RNG success roll; success/failure        | Actual roll and outcome                                             |
| Species weights on success               | Eligible four-condition pool after zero exclusions                  |
| Species RNG roll; selected fish          | Actual conditional selection, when reached                          |
| Generated weight                         | Catch weight and units, when reached                                |
| Inventory mutation/result                | Merge/new stack, quantities/slots, rejection, or capacity stop      |
| XP mutation, if implemented              | Actual F05 change; otherwise explicitly not implemented/no mutation |
| Stop reason                              | Why the activity terminated, if applicable                          |

Controls must provide **Force next fishing attempt**, independent time-of-day/sea-state
overrides, and optionally **Force next attempt to succeed**. Validate overrides against the configured
enums. Forced resolution uses the same validation, consumption, capacity, persistence, and idempotency
path as scheduled resolution; it cannot race the timer into a second reward. Mark forced attempts,
forced success, and condition overrides in logs with the authorized actor. Distinguish a forced
success from a natural RNG result. Stop and authorization failures remain enforceable.

### Inventory testing tool

Provide a searchable selector from the **currently defined** server item catalog, a quantity field,
and Add/Remove/Delete Stack/Clear Inventory/Clear Locker actions for the authorized operator's current character.
Optionally provide Set Quantity. Include all four rods, five baits, and eight fish in the installed A01 catalog.
The selector is not limited to those eight items.

- Add spawns the chosen quantity into carried inventory through the same authoritative persistence
  and item/stack rules used by gameplay. Non-stackable items remain separate instances.
- Remove subtracts a chosen quantity from an owned carried stack; Delete Stack removes the selected
  carried or locker stack; Clear Inventory removes carried items only. Clear Locker removes stored items only after a
  visible confirmation; neither action affects other characters. Optional Set
  Quantity applies the same definition and capacity validation, with an explicit zero/delete rule.
- Validate authorization, current character/ownership, item definition or target stack, positive
  whole quantities for Add/Remove, allowed quantities for optional Set, availability, stack rules,
  and capacity. Reject unknown items, stale targets, fractions, negatives, overflow, and removals
  beyond the available quantity without partial mutations. Use safe numeric bounds and enforce the
  ten-fish stack and 120-bait stack caps.
- Preserve ordinary carried capacity by default. If a development capacity override is offered,
  label it explicitly, require authorization, and log its use; no silent bypass. A capacity override
  never bypasses authorization, ownership, quantity validity, or creates fake client state.
- Commit each mutation atomically to the real inventory. Reconcile equipped/selected references
  through server logic when removing items, including an active fishing selection, so the next
  attempt cannot consume missing bait or use a deleted rod. Do not fabricate catches, weights, or
  discovery records when spawning a generic fish stack for a capacity test.
- Immediately refresh/reconcile the normal inventory UI, character capacity, picker availability,
  and active Fishing panel from the persisted result. No manual database edits or separate testing
  inventory are needed. Concurrent attempts/tool changes and retries must not duplicate items or
  leave partial state; refresh/relogin preserves the result.
- Log **every admin inventory mutation** in development logs: timestamp, authorized actor, current
  character ID, action, item/stack identity where applicable, requested quantity, before/after
  quantities and slots, any capacity override, and outcome/error. Clear Inventory records the removed
  stacks; rejected requests record failure without a mutation. Do not log session secrets.
