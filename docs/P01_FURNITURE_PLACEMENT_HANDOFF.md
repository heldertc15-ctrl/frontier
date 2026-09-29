# Frontier furniture placement — implementation handoff for Codex Sol

Execution note (2026-09-27): the owner subsequently authorized the bounded P01-PLACEMENT slice
with F06 waived for this slice only. The functional implementation and current stage evidence are
recorded in [PROJECT_STATE.md](PROJECT_STATE.md); the original plan below remains a planning
reference, not the current status.

Prepared 2026-09-27 from the working tree. **Planning only; nothing implemented or runtime-tested.**
Read `AGENTS.md` and source-of-truth docs, and recheck paths/schema before execution.

**Execution gate:** A01 remains selected at `READY_FOR_SOL_PASS_TEST`. P01 is `BLOCKED`: F02 and F03
are `MVP_PASSED`, but F06 is only `READY`. Do not start coding until the owner selects an eligible
stage, or explicitly authorizes a bounded placement slice and revises its dependency/scope gate.
Do not start F06 automatically. This handoff does not change those statuses.

Scope: inventory selection, grid snapping, ghost preview, click-to-place, 90-degree rotation,
footprints, collision checks, moving furniture, invalid-placement feedback and persistent
`{itemId, x, y, rotation}`. Full P01 also requires purchase, storage and other acceptance criteria;
this editor alone cannot pass P01.
See [stage board](PROJECT_STATE.md#stage-board), [P01 checklist](DEVELOPMENT_CHECKLIST.md#p01--property-purchase-and-personal-homestead),
[property design](GAME_DESIGN.md#27-property-and-homesteads), and [renderer boundaries](UI_TARGET.md#artwork-and-renderer-boundaries).

## 1. Existing architecture and integration points

| Existing file                                                          | Observed behavior / relevance                                                                                                                                                     |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`, `vite.config.ts`, `src/main.tsx`                       | React 19 / TypeScript / Vite 7 / Node >=24. StrictMode + error boundary. No renderer, router or state-store dependency.                                                           |
| `src/App.tsx`                                                          | Session character, global busy state, modal drawers/hash navigation, inventory invalidation counter; callbacks into `LocationsPanel`.                                             |
| `src/components/LocationsPanel.tsx`                                    | Fetch/navigation/selection; `.location-atlas` contains `.world-stage` and `.location-context`. Images + SVG/HTML overlays use a measured contain transform. Room insertion point. |
| `src/components/locationArtwork.ts`, `src/components/SceneryImage.tsx` | Static metadata and load/fade behavior; city assets in `src/assets/locations/`. Preserve this renderer.                                                                           |
| `src/components/InventoryPanel.tsx`                                    | Own fetch/local state; DOM pointer-capture drag performs reorder/merge/transfer, not spatial placement. Item-card helpers are private.                                            |
| `src/world-refinement.css`, `src/shell-refinement.css`                 | Responsive world/context and HUD layout.                                                                                                                                          |
| `server/app.ts`, `server/auth.ts`                                      | Native HTTP, cookie sessions, explicit protected-route prefixes, `{error:{code,message}}`, 16 KiB body limit.                                                                     |
| `server/database.ts`                                                   | Schema **14**; `node:sqlite` DatabaseSync, WAL/FKs/busy timeout, inline migrations; `data/frontier.sqlite`.                                                                       |
| `server/inventory.ts`, `server/inventoryLayout.ts`                     | Authoritative catalog/instances; `sort_index` is inventory order, not spatial position.                                                                                           |
| `server/locations.ts`, `server/character.ts`                           | Static location catalog/current location; synthetic `room:<id>` locations would break routing.                                                                                    |
| `server/fishBuyer.ts`, `server/worldEvents.ts`                         | Transactional request-key precedent; SSE covers world conditions only.                                                                                                            |
| `server/server.test.ts`, `src/App.test.tsx`, `vitest.config.ts`        | Real HTTP/temp SQLite and React Testing Library patterns; jsdom default, Node server tests.                                                                                       |

There are no furniture definitions, directional furniture assets, rooms, ownership or layout tables
yet. `public/assets/items/` contains inventory art, not furniture sprite sets. GET `/api/inventory`
currently rejects the entire response outside New Harbor; internal `getInventory()` itself returns
locker contents without a geographic guard. Do not leak those through a room response or claim the
planned F04 carried/storage separation is already implemented.

## 2. Recommended architecture and model

Use **React + TypeScript + PixiJS 8**, installed/pinned during authorized implementation. Pixi owns
floor/objects/ghost rendering and input intents; React owns snapshots, reducer, requests, picker
and accessible controls. Node/SQLite remains authoritative. Add no other engine/state/router wrapper.

Mount a lazy-loaded `PropertyRoom` in the existing world/context composition. Keep a nonmodal
**carried-furniture picker in the room context panel**, populated from server inventory. Existing
Inventory remains the shared modal drawer: while open, suspend room input and preserve the draft.
Do not drag through that drawer; its underlying world is inert.

Proposed bounded scope: nonstackable floor furniture (`quantity=1`), rectangular footprints,
four orientations, one floor layer, no overlapping cells. Stacking, wall attachment, irregular
footprints, avatars/pathfinding, buying furniture and removing/picking up placed items are separate
work. These limits bound this slice; they do not redefine full P01.

```ts
type Rotation = 0 | 90 | 180 | 270;
type Placement = { itemId: string; x: number; y: number; rotation: Rotation };
type Footprint = { width: number; depth: number }; // positive integer cell counts
```

`itemId` is **`character_items.id` / `InventoryItem.instanceId`**, never the definition ID or a
new ID generated on each placement. Identical chairs remain distinct owned instances.
Server furniture metadata extends the existing item catalog with a footprint and an artwork key;
the client receives this metadata, rather than maintaining a second rule catalog.
Sprite paths and orientation-specific pivots belong in a client artwork manifest.

Proposed tables:

| Table/change      | Required fields and invariants                                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rooms`           | `id` PK, `owner_character_id` FK, `location_id`, positive integer `width/depth`, nonnegative integer `revision`, timestamps. Host location is server-validated.                                             |
| `room_placements` | `item_id` PK/FK to `character_items`, `room_id` FK/index, nonnegative integer `x/y`, `rotation` CHECK in 0/90/180/270. One instance can exist in at most one layout. Restrict deletion of referenced items. |
| `room_commands`   | `character_id` FK, `request_key`, canonical signature, `room_id` FK, `applied_revision`, timestamp; UNIQUE `(character_id, request_key)`. Retain successful receipts.                                       |
| `character_items` | Allow locations `inventory`, `locker`, `room`. Placed items: quantity 1, unequipped, `sort_index=NULL`, exactly one placement. Inventory responses exclude room rows.                                       |

Bind rooms to an **existing host place**; list/read/edit only owned rooms at the character's exact
current host location. Opening is an in-shell view, not a new global location. Explicit Back returns
to the host; navigation/logout clears room state. Production creation must connect to P01's earned
acquisition; fixtures may provision test rooms, never gifts to ordinary new characters.

## 3. Coordinates, footprints and rendering

Persist zero-based integer grid coordinates. `(x,y)` is the minimum corner of the **rotated**
footprint bounds, not a sprite center or screen pixel. Rotation keeps that corner fixed; revalidate
there without nudging the object into a valid cell.

For base dimensions `(w,d)`, use `(rw,rd)=(w,d)` at 0/180 degrees and `(d,w)` at 90/270.
Occupied cells are every `(x+u,y+v)` where `0 <= u < rw`, `0 <= v < rd`.
A 2x1 item at `(3,2,90)` occupies `(3,2)` and `(3,3)`.
For orientation markers/art alignment, transform base cell `(u,v)` as:

| Degrees | Rotated local cell |
| ------- | ------------------ |
| 0       | `(u,v)`            |
| 90      | `(d-1-v,u)`        |
| 180     | `(w-1-u,d-1-v)`    |
| 270     | `(v,w-1-u)`        |

Define shared pure `rotatedFootprint`, `occupiedCells`, and `validatePlacement` functions; client
preview and server validation call the same code. The server supplies trusted dimensions/items.

For logical tile width `tw`, height `th` (use 2:1, e.g. 64x32 for functional fixtures), and origin
`(ox,oy)`, project a continuous floor point `(gx,gy)`:

```text
sx = ox + (gx - gy) * tw/2
sy = oy + (gx + gy) * th/2
gx = (sx - ox)/tw + (sy - oy)/th
gy = (sy - oy)/th - (sx - ox)/tw
tile = (floor(gx), floor(gy))
```

Invert the room container's fit/translation first. Prefer Pixi `event.global` then the room
container's `toLocal`; if using DOM events, map the canvas client rectangle to renderer logical
screen coordinates first. Do not multiply by device pixel ratio twice. Half-open cell bounds make
edges deterministic; negative/outside points remain invalid rather than clamping onto the floor.
Cell centers use `(x+0.5,y+0.5)`. Project all four corners to draw each diamond.

Each orientation needs a ground-contact pivot and correctly authored view. Position that pivot at
the projected front footprint corner `(x+rw,y+rd)`, using a consistent pixels-per-tile scale.
Switch the sprite view on rotation; setting `sprite.rotation = Math.PI/2` rotates flat artwork in
the screen plane and is incorrect for isometric furniture. Until art exists, use identifiable
procedural block placeholders with a visible facing marker for all four orientations.

Render floor, ordered objects, then noninteractive footprint/ghost overlays. For multi-cell
objects, do not rely on `x+y` alone: a long object can otherwise cover a short object in front.
Compare pairs whose projected floor horizontal intervals overlap. With exclusive `maxX/maxY`,
draw A before B when `A.maxX <= B.minX` or `A.maxY <= B.minY`; topologically order those constraints,
using front-corner depth then item ID for unconstrained ties. Test long adjacent footprints.
Use the reverse resulting draw order for object hit testing. Keep artwork within its declared
floor extent horizontally; assets needing interleaved overhangs require split sprites, outside
this slice. Report ordering cycles rather than silently treating an approximate sort as correct.

Pixi's [application lifecycle](https://pixijs.com/8.x/guides/components/application) uses async
`Application.init()`. Guard late initialization/asset loads after unmount, dispose listeners,
ResizeObserver, ticker and renderer, and avoid destroying shared cached textures accidentally.
Resize the renderer to its container and refit the whole room with padding for object height;
saved grid positions never change. Handle renderer/asset failure with readable retry controls.
Use stage hit areas / `globalpointermove` for preview across empty floor; v8 pointer moves otherwise
depend on hit testing ([events](https://pixijs.com/8.x/guides/components/events),
[coordinate transforms](https://pixijs.com/8.x/guides/concepts/scene-graph)).

## 4. Placement state machine and input

Keep the last confirmed snapshot separate from the draft. Suggested reducer states:

| State                        | Behavior / transitions                                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `idle` / `selected(itemId)`  | Click an existing object or its accessible list entry to select. Move starts `previewMove` at its current anchor/rotation. Choosing carried furniture starts `previewNew`; it does not consume the item.                                   |
| `previewNew` / `previewMove` | Store candidate anchor (nullable before targeting), rotation and validation reason. Pointer movement changes snapped cells only. Move renders the original as subdued, with a separate ghost; original persisted placement remains intact. |
| `submitting`                 | Freeze one immutable command and key. Disable further placement/movement mutations; do not optimistically remove inventory or change the confirmed layout.                                                                                 |
| `reconciling`                | Outcome unknown after timeout/disconnection. Retain command/key and confirmed state; retry the same command and refresh before accepting another mutation.                                                                                 |

On confirmed success adopt the snapshot, invalidate ordinary inventory, announce success, and
select the placed object. Do not automatically stamp another copy. Definitive validation failure
returns to preview with a reason; stale-state failure refreshes/revalidates before continuing.
If ownership/location/item eligibility disappears, discard the draft and show the server reason.

- **Mouse:** valid primary click on floor commits the preview. Invalid click makes no request and
  explains why. Selecting an object must not also place it in the same event. Ignore secondary
  buttons, drags, duplicate activation and pointer-up originating outside the surface.
- **Keyboard:** selection seeds a new draft at `(0,0)` and validates without searching for free space.
  ArrowRight/Left adjust x, ArrowDown/Up adjust y; R/Rotate adds 90 modulo 360; Enter/Place commits;
  Escape/Cancel drops an unsent draft. Shortcuts apply only to focused room controls, not text inputs/drawers.
- **Touch:** tap a tile to position the ghost; explicit Place, Rotate and Cancel remain reachable.
  Ignore extra pointers and `pointercancel`; scrolling a panel must not place an item.
- Leaving the floor disables canvas-click placement and hides the hover cursor, but retains the
  draft/footprint for explicit keyboard/touch Place. UI never places through; modals suspend room input.
- Cancel/Back before submission restores the original without an API call. Once submitted,
  dismissal/abort is not server cancellation; reconcile any outcome on return. Freeze navigation
  during the normal short submission; logout/unmount still requires safe reconciliation on reload.

Show translucent object plus every footprint cell, with outline/pattern and text distinguishing
valid, occupied and out-of-bounds states. Keep valid/invalid feedback independent of color.
Provide loading, empty inventory, selected, saving, success, unavailable and recoverable-error
states. Publish snapped-cell changes to React, not raw pointer positions every frame.

## 5. Collision and occupancy

Derive `Map<cellKey,itemId>` from confirmed placements using shared geometry. Do not persist a
second occupancy grid. A candidate succeeds only if all its cells satisfy
`0 <= x < room.width`, `0 <= y < room.depth` and none belongs to another item.
Touching edges is valid. For moves exclude **only the moving instance**, after confirming it is
already in this room; all other objects remain obstacles. The ghost never reserves cells.

For these small rooms, rebuilding occupancy per snapshot/server mutation is sufficient. Run all
server reads, validation and writes under `BEGIN IMMEDIATE`; two requests for the same cell/item
cannot both validate against an old layout. A forged client `valid` flag, dimensions or artwork
must never influence the result. Cap server-configured room dimensions/catalog footprints to
bounded values, and reject malformed/unsafe integers before allocating occupancy structures.

## 6. Persistence and API requirements

Proposed protected, `Cache-Control: no-store` routes:

| Route                           | Contract                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/rooms`                | Available owned room summaries at the character's current host location; derive character/location from session.                                       |
| `GET /api/rooms/:roomId`        | Authoritative room dimensions/revision, placements joined with definition IDs, furniture definitions and a carried-only inventory snapshot.            |
| `POST /api/rooms/:roomId/place` | `{itemId,x,y,rotation,expectedRevision,requestKey}`; require an owned, carried, unequipped furniture instance, quantity 1, with no existing placement. |
| `POST /api/rooms/:roomId/move`  | Same payload; require that owned instance already placed in this room. Also handles rotation in place.                                                 |

Return `{room, definitions, placements, carriedInventory, command?}`; the optional command receipt
contains key and applied revision. `carriedInventory` contains `capacity`, `usedSlots` and `items`,
never locker contents. Room placement coordinates remain exactly the four requested fields;
definition IDs are joined metadata. Never accept an entire client layout as an overwrite.

Require a 1–128 character request key and nonnegative safe-integer revision. Sign the canonical
`{action,roomId,itemId,x,y,rotation,expectedRevision}` so keys cannot replay across rooms/routes.
Build GET snapshots in a read transaction to keep revision, inventory and placements consistent.

In one immediate transaction: re-read owner/location; check command key/signature; check expected
room revision; load trusted item/catalog; validate footprint; mutate; increment revision once;
record receipt; build the authoritative response; commit. Same key + same payload returns the
saved acknowledgement with a current snapshot even if the expected revision is now old. Reusing
a key with different payload returns `409 REQUEST_KEY_REUSED`. Check retries before revision,
but do not bypass current authorization. Failed transactions leave no partial placement/receipt.

Placement updates the existing item to `location='room'`, clears display slot, and inserts its
placement atomically. Move changes only coordinates/rotation. Repeating a command never consumes
another item or increments revision twice. Reject stale new commands with `409 ROOM_CHANGED`.
Use stable validation errors (`VALIDATION_ERROR`, `ROOM_UNAVAILABLE`, `ITEM_NOT_AVAILABLE`,
`OUT_OF_BOUNDS`, `SPACE_OCCUPIED`) and the existing error envelope. Foreign/missing room responses
must not disclose another player's contents. The client must preserve error codes, not only text.

Timeout does not prove failure. Replay the **same key and exact payload**, then reconcile; a GET
alone cannot prove an earlier in-flight request will never commit. Ignore lower room revisions
and late responses for another character/room. Refresh on entry, focus/reconnect and conflicts;
no room WebSocket/SSE expansion is needed. Persist each confirmed action, not on unload or in
localStorage. Reload restores confirmed furniture, never an unsent ghost.

Schema migration must widen the existing `character_items.location` CHECK while preserving rows
and child fish specimens. At startup, outside a transaction, disable FK enforcement; transactionally
create replacement table, copy all columns/IDs exactly, drop old, rename replacement, recreate
indexes/triggers, run `foreign_key_check`, then commit and restore/assert FK enforcement in finally.
Do not rename the old table first or drop it with cascades enabled. Roll back on validation failure;
record the next schema version only after success. Follow SQLite's
[table rebuild procedure](https://www.sqlite.org/lang_altertable.html#otheralter).

Harden existing inventory entry points: `transferItem` currently accepts any owned row whose
location differs from destination. Explicitly allow only inventory/locker at both its initial and
locked re-read, reject placed rows, and recheck geography under lock. Audit merge/use/equip/reorder
and guarded admin mutations as well. Preserve admin deletion's inventory/locker restriction.
Never delete a room item through those paths. Do not alter starter kits, fish identities or stack rules.
If footprint definitions change later, validate/migrate affected saved layouts explicitly;
never silently rotate, shift, drop or overlap old furniture.

## 7. Exact file plan

Paths are relative to the repository root. New files below are proposed, not present today.

| Action                       | Files                                                                                                                                                                          | Responsibility                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create                       | `shared/roomTypes.ts`, `shared/roomGeometry.ts`, `shared/roomGeometry.test.ts`                                                                                                 | DTOs, rotations, footprints, occupancy validation and unit tests; no Node/DOM/Pixi imports.                                                                                             |
| Create                       | `server/furniture.ts`, `server/rooms.ts`, `server/rooms.test.ts`, `server/roomMigration.test.ts`                                                                               | Furniture metadata, room reads/commands/access, transaction/retry tests, populated-database migration tests.                                                                            |
| Create                       | `src/components/PropertyRoom.tsx`, `src/components/PropertyRoom.test.tsx`                                                                                                      | Room controller and context picker/controls/object list, request reconciliation, status and accessibility.                                                                              |
| Create                       | `src/room/RoomCanvas.tsx`, `src/room/RoomRenderer.ts`, `src/room/RoomCanvas.test.tsx`                                                                                          | React lifecycle wrapper, imperative Pixi rendering/hit testing/intents; lifecycle tests with adapter mocked.                                                                            |
| Create                       | `src/room/roomProjection.ts`, `src/room/roomProjection.test.ts`, `src/room/depthOrder.ts`, `src/room/depthOrder.test.ts`                                                       | Projection/inverse and deterministic multi-cell draw order tests.                                                                                                                       |
| Create                       | `src/room/placementReducer.ts`, `src/room/placementReducer.test.ts`, `src/room/furnitureArtwork.ts`, `src/room/room.css`                                                       | Draft lifecycle, art view/pivot manifest, scoped layout/feedback styles.                                                                                                                |
| Modify                       | `server/database.ts`, `server/inventory.ts`, `server/app.ts`                                                                                                                   | Migration/tables, furniture definitions and room-location hardening, auth guard/routes and safe carried response.                                                                       |
| Modify                       | `src/components/LocationsPanel.tsx`, `src/components/LocationsPanel.test.tsx`                                                                                                  | Load available rooms at host; owned-room open/back branch; preserve normal location behavior and selection.                                                                             |
| Modify                       | `src/App.tsx`, `src/App.test.tsx`                                                                                                                                              | Forward modal-open/input-suspension state and existing busy/inventory invalidation callbacks to room branch.                                                                            |
| Modify                       | `server/server.test.ts`, `server/inventoryCapacity.test.ts`, `server/inventoryMerge.test.ts`                                                                                   | HTTP authorization/error tests; reject room-item use through existing inventory flows; regression coverage.                                                                             |
| Modify                       | `package.json`, `package-lock.json`, `tsconfig.app.json`, `tsconfig.server.json`, `tsconfig.test.json`                                                                         | Add only `pixi.js`; include shared modules/tests appropriately. Composite NodeNext server imports shared files with `.js` specifiers; exclude tests from production build.              |
| Modify during implementation | `docs/ARCHITECTURE.md`, `docs/API_CONTRACTS.md`, `docs/GAME_DESIGN.md`, `docs/UI_TARGET.md`, `docs/DESIGN_SYSTEM.md`, `docs/DEVELOPMENT_CHECKLIST.md`, `docs/PROJECT_STATE.md` | Record chosen renderer/contracts/rules/states and actual stage evidence; align P01's older drag wording with the owner's click-to-place objective. Preserve prior verification history. |

Import room CSS from `PropertyRoom`; no global stylesheet rewrite. The chosen context picker does
not require changing `InventoryPanel`, the static artwork registry, the location catalog or character
location schema. Approved sprite files can later go under `src/assets/furniture/<definitionId>/`;
do not generate an art package as a prerequisite to proving placement.

## 8. Ordered execution

1. Satisfy the stage/scope gate and host/acquisition contract. Fixtures: 8x8 room, 1x1/2x1/2x2 blocks.
2. Build shared contracts/geometry, projection and depth ordering with focused tests.
3. Add metadata/migration/fixtures; verify populated schema-14 preservation and repeat opening.
4. Implement protected API, atomic writes/retries/revisions and inventory hardening; test competing requests.
5. Add reducer/controller, accessible context picker and reconciliation; integrate room entry/invalidation.
6. Connect lazy Pixi rendering/input/resizing/cleanup. Verify orientation/pivots before using supplied art.
7. Run focused tests then `npm run check`, browser acceptance, regression fixes and evidence/docs updates.
8. Stop at implementation handoff: `READY_FOR_ASTRA_UI_DESIGN` and exact final phrase
   `READY FOR ASTRA UI DESIGN — <STAGE_ID>`. Do not invent a stage ID, pass full P01 from this slice,
   or infer owner visual approval.

## 9. Acceptance and edge cases

- Preview makes no writes; valid placement transfers exactly one selected instance. Identical
  furniture instances remain distinct. Invalid clicks make no request; forged API equivalents fail.
- Test 2x1 → 1x2 at 90/270, four-turn identity, every edge/corner, edge-touching objects, negative/
  fractional/unsafe inputs and rotation out of bounds. Invalid positions are never automatically nudged.
- Move across the original footprint succeeds; another object's cells stay blocked. Cancel/rejection
  retains the original. Repeated clicks cannot duplicate or consume another item.
- Race two tabs/connections for a cell/item; one succeeds. Retry lost success once, reject key reuse
  across payloads/rooms/actions, reject stale revisions, and ignore late obsolete responses.
- Reject foreign room/item, wrong location, non-furniture, locker/equipped/unavailable/already-placed
  items. Inventory/admin routes cannot extract/delete placed items; no remote storage leaks.
- Refresh/relogin/server restart preserve exact state/counts. Migration preserves item/specimen IDs,
  quantities, equipment and sort slots; repeated opening is idempotent with FK enforcement active.
- Resize/zoom/DPR retain aligned input/ghost/sprites. Long multi-cell objects behind small foreground
  objects sort/select correctly; all orientation views stay grounded.
- Drawer open/close preserves draft and blocks underlying input; browser Back retains existing drawer
  dismissal. Room exit uses explicit Back. Test focus return, keyboard-only placement, touch and cancellation.
- Exercise loading/empty/saving/success/error/reconnect, missing assets/renderer failure, StrictMode
  late cleanup, repeated entry/exit and reduced motion. All placement actions have accessible controls.
- Review **1366x768, 1440x900, 1920x1080, 320x640 and 390x640**: dominant world, intact HUD/context,
  reachable controls, no ordinary-desktop document scroll. Capture owner-review evidence.
- Recheck auth, navigation/pins, inventory actions, fishing and buyer. No free starting property.
  Record actual checks, pending owner approval and unfinished full-P01 criteria separately.

Release inputs still needed: selected eligible scope/stage, production host/acquisition connection,
room dimensions/catalog content and approved directional artwork. The functional fixture values
above are test data, not invented economy, progression or production property rules.
