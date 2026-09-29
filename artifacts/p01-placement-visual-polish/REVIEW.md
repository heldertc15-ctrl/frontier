# P01-PLACEMENT visual polish review

Reviewed 2026-09-27 after the owner's request to inspect and improve the implemented room.
This is a bounded UI refinement. Owner visual approval, physical touch testing and final slice
MVP verification remain pending. No artwork, backend mechanics, schemas or API changes were made.

## Evidence and changes

The rendered baseline had visually dominant grid lines, dense controls, exposed instance hashes
and furniture choices that were difficult to scan. The refinement reduces floor contrast, adds
a shallow floor edge and backdrop, replaces the facing dot with a directional triangle, and gives
the picker footprint diagrams, clearer grouping, count badges and visible selection. Placement
has a stronger primary action, concise feedback and keycap hints. These diagrams and furniture
blocks are procedural placeholders, not final object art.

- [Before, 1440×900](01-before-desktop.png)
- [After, matching initial preview](02-after-desktop.png)
- [Final scene with saved furniture and a new preview](final-desktop.png)
- [Move preview](move-preview.png)
- [Blocked overlap](invalid-overlap.png)
- [Saved placement and move after reload](saved-after-reload.png)

## Acceptance sizes

All captures are from the same isolated development fixture. The bench draft remained at cell
`3,2`, rotation `90`, with its `1×2` footprint through inventory drawer open/close at every size.

| Viewport  | Room capture                                                 | Layout observation                                                                      |
| --------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 1366×768  | [Preview](preview-1366x768.png)                              | No document scroll; context scrolls internally; canvas 854px wide                       |
| 1440×900  | [Preview](preview-1440x900.png)                              | No document scroll; canvas 928px wide                                                   |
| 1920×1080 | [Preview](preview-1920x1080.png)                             | No document scroll; canvas 1408px wide                                                  |
| 320×640   | [Preview](preview-320x640.png), [drawer](drawer-320x640.png) | No horizontal overflow; document scroll keeps context accessible; floor actions visible |
| 390×640   | [Preview](preview-390x640.png), [drawer](drawer-390x640.png) | No horizontal overflow; document scroll keeps context accessible; floor actions visible |

[DOM measurements](viewport-metrics.json) record the viewport, document bounds and canvas widths.
Narrow content widths exclude the 15px vertical scrollbar. Captures use explicit viewport clips
at narrow sizes and a full-page capture at 1920×1080 to avoid the browser's default screenshot
rescaling/cropping. These are browser viewport checks, not physical-device testing.

## Interaction verification

1. Choose a carried bench, nudge to `3,2`, rotate to `90`; preview swaps from `2×1` to `1×2`.
2. Open and close inventory at all five sizes; preserve draft cell, rotation and selected instance.
3. Place the bench, reload, reopen the fixture; saved bench remains at `3,2,90`.
4. Select the saved bench, begin moving, nudge to `4,2`, and save; confirmed position updates.
5. Preview a carried chair at `4,2`; red overlap feedback appears and Place is disabled.
6. Cancel; the chair remains carried and the saved bench position is unchanged.
7. Choose the chair; keyboard arrows move to `2,2`, R rotates to `90`, Enter saves.
8. Reload; the bench remains `4,2,90`, the chair remains `2,2,90`, and only the table remains carried.

All listed interactions passed. Earlier interrupted-save and touch-emulation evidence remains in
[the previous UI review](../p01-placement-ui-review/REVIEW.md); it was not repeated in this pass.

`npm run check` passed formatting, lint, typecheck, **290 tests across 35 files**, and production
build. The pre-existing large-bundle advisory remains. A second source review found no actionable
UI regression or asset-anchor math error. This is not the final stage acceptance declaration.

## Review environment and revision

The browser used an isolated local API at port 3005, a Vite preview at
`http://127.0.0.1:5175`, and `data/p01-visual-review.sqlite`. The ordinary development database
was not used. The synthetic allowlisted account was `room-visual`, character `Room Review`.
The preview tab is left open for review while these local processes are available.

To reproduce with a normal development account, set `NODE_ENV=development` and the exact account
username in `FRONTIER_ADMIN_USERNAMES`, restart the development server, sign in, and choose
**Open development test room** at New Harbor (or **Open Placement test room** once created).
The fixture remains unavailable to ordinary non-allowlisted accounts and production.

Source SHA-256 at review:

| File                              | SHA-256                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| `src/components/PropertyRoom.tsx` | `edb92c2b5416314d288125f8d9c625afa28f5c97c8486b5f55f6d6c35bafbceb` |
| `src/room/RoomCanvas.tsx`         | `0712b1ba2c06b277d58c109e7117de3286ede111b2ff79b68e27e103eacbf7fe` |
| `src/room/room.css`               | `056db7fb1c62e290481db8395e34c3c0359ee2b3aaea03bc7dac1d232e173e64` |

## Next art delivery

Follow [the proposed room art guide](../../docs/ROOM_ART_ASSET_GUIDE.md). Produce one Day room
and one asymmetric 2×1 object in four neutral transparent views, validate those in a separately
authorized asset integration, then extend to other objects and any required Dawn/Dusk/Night
backgrounds. The present renderer does not load these future assets or apply time lighting yet.

Status: `READY_FOR_SOL_PASS_TEST`. Owner approval pending. Full P01 remains blocked on F06;
the bounded slice waiver and A01 verification history are preserved.
