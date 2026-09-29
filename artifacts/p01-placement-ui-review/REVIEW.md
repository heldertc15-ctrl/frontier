# P01-PLACEMENT UI review — 2026-09-27

This pack shows the bounded furniture-placement slice in Frontier's existing world/HUD/context
shell. It uses an isolated nonproduction room fixture. Owner visual approval and final slice
verification remain pending; full P01 remains blocked on F06.

## Open a fixture room

1. In local development, set `NODE_ENV=development` and
   `FRONTIER_ADMIN_USERNAMES=<your exact development username>` in `.env`, then restart the server.
   The fixture route is restricted to that explicit allowlist and is unavailable in production.
2. Run `npm run dev` and open `http://localhost:5173`.
3. Sign in as the allowlisted development account. At New Harbor, select **Open development test
   room** in the destination context. This creates or reopens the 8×8 room and provides test
   furniture. If an owned room is already listed, **Open Placement test room** also opens it.
4. Select a carried piece in **Arrange furniture**. Move the preview with the pointer, arrow keys
   or one-tile nudge controls; rotate with **Rotate 90°** or R. A valid mouse click places directly.
   On touch, tap a tile to aim and use **Place at tile**. Enter saves from focused room controls;
   Escape or **Cancel** drops the unsent draft. Select saved furniture to move it. **Inventory**
   opens the shared drawer and leaves the draft intact.

Ordinary new characters receive no room. This test entry does not grant production property,
enable purchases, or add storage.

## Exact viewport captures

All five PNG files have the named pixel dimensions. They show a rotated bench preview at cell
`(3,2)` with its `1×2` footprint. The screenshots were captured from an isolated local build in
headless Chrome with Playwright. The in-app browser was also inspected, but its screenshot surface
cropped desktop right edges despite reporting the correct CSS viewport, so the exact-size files
below are the review evidence.

| CSS viewport | Room preview                      | Review observation                                                                    |
| ------------ | --------------------------------- | ------------------------------------------------------------------------------------- |
| 1366×768     | [PNG](room-preview-1366x768.png)  | No document scroll; context scrolls internally.                                       |
| 1440×900     | [PNG](room-preview-1440x900.png)  | No document scroll; full context visible.                                             |
| 1920×1080    | [PNG](room-preview-1920x1080.png) | No document scroll; room remains dominant.                                            |
| 320×640      | [PNG](room-preview-320x640.png)   | Floor and touch actions share one view; vertical page scroll keeps context reachable. |
| 390×640      | [PNG](room-preview-390x640.png)   | Same touch flow with no horizontal overflow.                                          |

Additional states: [320px inventory drawer](room-drawer-320x640.png),
[1366px inventory drawer](room-drawer-1366x768.png),
[touch preview](room-touch-preview-390x640.png),
[saved move](room-saved-move-1366x768.png), and
[blocked overlap](room-invalid-1366x768.png). A simulated connection interruption shows
[reconciliation with the same-action retry](room-connection-error-1366x768.png).

The room canvas measured 854, 928 and 1408 CSS pixels wide at the three desktop sizes and occupied
more than half the available world region. Document scroll dimensions equaled the desktop viewport
dimensions. The drawer opened and closed within the viewport at all five sizes, without losing
the draft. At 320 and 390px, document height exceeded the viewport as intended, with no horizontal
overflow. A touch-emulated tap changed the candidate cell without sending a placement; the explicit
Place button remained available. The review flow saved a bench, reloaded it, moved it to `(4,2)`,
and blocked an overlapping chair preview. Physical touch hardware was not tested.
After a simulated interrupted placement, the confirmed bench stayed visible and the retry control
reconciled the original chair command. The saving state and same-key replay are covered by the
component and server tests; no live network timeout was induced.

`npm run check` passed formatting, lint, typecheck, 290 tests across 35 files, and the production
build. Vite's existing large-chunk advisory remains. The review helper is [capture.py](capture.py)
and expects a fresh isolated database served on port 3004. Candidate source SHA-256 prefixes:
`PropertyRoom.tsx be8bbc8b9ea079ea`, `RoomCanvas.tsx 610481c1c3363c4e`,
`room.css 5118de92445b2eb3`.
