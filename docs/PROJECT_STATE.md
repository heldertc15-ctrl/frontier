# FRONTIER — PROJECT STATE

Update this file at the beginning and end of every development stage.

## Current selected stage

**Stage:** P01-PLACEMENT (bounded furniture-placement slice)  
**Status:** READY_FOR_ASTRA_UI_DESIGN  
**Last implementation owner/model:** Codex (P01 placement slice)  
**Last UI refinement owner/model:** Codex (P01 visual review and polish)  
**Last updated:** 2026-09-28  
**A01 owner visual approval:** PENDING  
**A01 final MVP verification:** PENDING  
**P01-PLACEMENT owner visual approval:** PENDING  
**P01-PLACEMENT final MVP verification:** PENDING  
**Recorded F03 owner approval/reviewed revision:** 2026-09-23; `cb28a156bf7ee9a08a73efcedecb1f325ee176360e2ba50d65ac275a2b9a206b`  
**Recorded F03 final verification:** PASSED on 2026-09-23; `npm run check` passed (59 tests)

On 2026-09-27 the owner selected the bounded P01 furniture-placement slice for implementation and
waived F06 **for this slice only**. F02 and F03 remain required and are `MVP_PASSED`. Full P01
remains `BLOCKED` on F06. The slice includes carried-furniture selection, grid preview, placement,
rotation, movement, collision and authoritative persistence using guarded development fixtures.
It excludes purchases, economy integration and property storage. Ordinary characters receive no
free property. A01 retains its `READY_FOR_SOL_PASS_TEST` status, pending owner visual approval and
final MVP verification; all A01 verification history below remains recorded.

P01-PLACEMENT owner-requested farming follow-up — 2026-09-28: added a second transparent farm-bed
axis view and selected it for 90°/270° placements. Added a fixed-orientation tomato crop fixture
that allowlisted admins can add, plant in any open square of a bed, and return to inventory.
Crop-to-bed placement is persisted and follows bed moves; beds with crops cannot be returned until
the crops are removed. Clicking empty room space or outside the room floor clears object selection.
This adds bounded fixture behavior only, not crop growth, harvesting, or production acquisition.
The owner clarified that the supplied screenshot showed the yard background failing to load until a
time-of-day change. Initial scene loading now requests the already-selected server phase even when
it equals the renderer's initial phase, and avoids duplicate requests for the same loading phase.
New UI and art need visual refinement; no tests or browser review were run. Owner visual approval
and final slice verification remain pending. Status: `READY_FOR_ASTRA_UI_DESIGN`.

P01-PLACEMENT owner UI correction — 2026-09-28: simplified crop planting to use the furniture
placement draft. The only crop fixture is the 1×1 tomato plant; its sprite uses a red/green ghost
and highlights the target bed square, and it can be committed only on an open square of a farming
bed. Removed the separate crop picker and per-square buttons. Farming beds no longer react to pointer
hover. Crop-specific browser review and tests remain pending; status stays
`READY_FOR_ASTRA_UI_DESIGN`.

P01-PLACEMENT owner art follow-up — 2026-09-28: integrated the supplied Dawn, Day, Dusk and Night
yard backgrounds. The plot receives the effective server phase through the existing world snapshot,
loads a changed image before replacing the current one, and ignores stale image loads. The artwork
shares one canvas size and keeps the existing 8×8 projection, grid and placement state. Focused
client coverage verifies phase switching and existing plot registration; owner visual approval and
final slice verification remain pending. No gameplay, API or save-data rules changed. Status:
`READY_FOR_SOL_PASS_TEST`.

P01-PLACEMENT owner-requested temporary art experiment — 2026-09-28: added the supplied framed
farm-bed reference as an allowlisted nonproduction room fixture, with a transparent cutout and
sprite geometry calibrated to the bed's ground corners against the 2×2 grid. The bed no longer has
a redundant tile slab underneath. Re-running the fixture provisions one copy into an existing room
when absent. The selected plot now restores within the tab after page refresh, and Back clears the
saved view. This is a visual test only; crops cannot be placed on the bed and no farming rules were
introduced. Owner visual approval and final slice verification remain pending.

P01-PLACEMENT owner-requested room controls — 2026-09-28: added a selected-object action that returns
the same furniture instance to carried inventory, with server-side host, ownership, capacity and
revision checks. Added a Build menu for allowlisted nonproduction admins, listing current furniture
definitions and creating an instance in carried inventory for the existing placement flow. Build
is blocked in production and nonadmins receive an empty catalog. Command receipts make builds and
removals safe to retry. This extends placement test tooling only; property purchase, production
acquisition and storage remain outside this slice. No tests or browser acceptance review were run
for this follow-up. Owner visual approval and P01-PLACEMENT final MVP verification remain pending.

P01-PLACEMENT owner-requested farm-bed rendering fix — 2026-09-28: changed the temporary bed artwork
from one shared sprite to one sprite per placed instance, with depth ordering and cleanup when an
instance leaves the room. Updated the Pixi test mock for its container layer. Build/lint and browser
review were not rerun for this follow-up; owner visual approval remains pending.

P01-PLACEMENT owner-requested hover and lighting refinement — 2026-09-28: placed objects now receive
a soft warm surface outline and wash on pointer hover, retained while selected. Added restrained
Dawn amber, Day neutral, Dusk orange and Night blue lighting passes over object surfaces; on the
yard, lighting follows the successfully loaded scene phase. This is presentation-only and uses the
existing effective server time-of-day. No tests or browser review were run; owner visual approval
and final P01-PLACEMENT verification remain pending. Status: `READY_FOR_SOL_PASS_TEST`.

P01-PLACEMENT owner lighting feedback — 2026-09-28: the owner reported that the phase wash was too
subtle on the farm-bed sprite. Increased the per-phase surface wash and added Dawn/Day/Dusk/Night
sprite tints so the bed artwork itself responds to the currently loaded scene phase. Build and
lint pass; browser review and owner visual approval remain pending.

P01-PLACEMENT owner overlay feedback — 2026-09-28: removed the footprint-shaped lighting fill from
the farm-bed sprite and reduced Dawn/Dusk/Night tint strength. Phase lighting now follows the art's
transparent sprite bounds instead of tinting the grid-shaped footprint. Production build and focused
lint passed; browser review and owner visual approval remain pending.

P01-PLACEMENT owner night-lighting follow-up — 2026-09-28: after reviewing the moonlit yard, the
owner reported that the farm-bed sprite still looked too much like daylight. Increased the Dusk and
Night tint strength directly on the transparent sprite while leaving the footprint wash disabled.
Production build and focused lint passed; browser review and owner visual approval remain pending.

P01-PLACEMENT owner-requested phase transition refinement — 2026-09-28: yard backgrounds now load
before a one-second eased crossfade, matching the Fishing Pier transition. The placed-object phase
lighting (including the farm-bed sprite tint) blends in step with the background. Existing plot
registration and placement state remain unchanged. No test or browser review was run for this
follow-up; owner visual approval and final P01-PLACEMENT verification remain pending. Status:
`READY_FOR_SOL_PASS_TEST`.

P01-PLACEMENT owner art integration — 2026-09-27: adding the supplied Day yard to the selected
8×8 owned plot while preserving the existing grid, furniture and server rules. Status `ASTRA_UI`
during this visual pass; rendered verification and owner approval remain pending.

P01-PLACEMENT owner-requested visual follow-up — 2026-09-27: reviewed the rendered room and refined
its visual hierarchy, footprint diagrams, inventory/placed groups, primary action contrast,
keyboard hints and concise status copy. Pixi now draws a quieter slate floor with thin grid lines,
a shallow front edge, a transparent canvas over the backdrop and triangular facing cues. The
renderer still uses procedural furniture; no sprite or time-lighting pipeline was added.
[The AI room art guide](ROOM_ART_ASSET_GUIDE.md) defines proposed calibration, four directional
views, registered phase backgrounds and runtime lighting for future integration.

[The visual polish review pack](../artifacts/p01-placement-visual-polish/REVIEW.md) records before/
after views, all five acceptance sizes, and move, overlap and reload states. Desktop documents
had no overflow; narrow layouts retained document scrolling and floor-adjacent controls without
horizontal overflow. The inventory drawer preserved the draft at all five sizes. The isolated
browser flow verified rotation, placement, movement, blocked overlap, cancellation, keyboard
controls and persisted positions after reload. `npm run check` passed formatting, lint, typecheck,
**290 tests across 35 files**, and build; the existing large-bundle advisory remains. This pass
does not repeat the earlier interrupted-save or touch-emulation review. Physical touch testing,
owner visual approval and final slice MVP verification remain **PENDING**. F02/F03, the slice-only
F06 waiver, full-P01 blocker and A01 history are preserved. Review source SHA-256 prefixes:
`PropertyRoom.tsx edb92c2b5416314d`, `RoomCanvas.tsx 0712b1ba2c06b277`,
`room.css 056db7fb1c62e290`. Status: `READY_FOR_SOL_PASS_TEST`.

Earlier P01-PLACEMENT UI refinement handoff — 2026-09-27: the carried and placed pickers now show each
instance's footprint or saved cell, with the active preview and selected object controls ahead of
the lists. Pixi draws a translucent directional block over every preview cell and a distinct
valid/invalid footprint; selected saved furniture remains individually highlighted. Text explains
overlap and room-edge failures, while the Place action remains disabled for invalid candidates.
The context offers one-tile isometric nudges, rotation, save and cancel, with a compact touch
action strip beside the floor at narrow widths. Loading, saving, uncertain-result retry, error,
empty, success and selected states are visible without replacing the confirmed layout. The shared
HUD, world/context shell and modal inventory drawer remain in place. Game rules, server contracts,
schemas and APIs did not change.

Exact-size rendered captures and instructions are in
[the P01 placement review pack](../artifacts/p01-placement-ui-review/REVIEW.md): **1366×768,
1440×900, 1920×1080, 320×640 and 390×640**. At each desktop size the document had no scroll,
the room canvas occupied more than half the available world width, and the 1366px context used
internal scrolling. Narrow layouts allowed document scrolling to keep the floor, touch controls
and context reachable, with no horizontal overflow. The shared inventory drawer opened and closed
within all five viewports without discarding the draft. The isolated browser flow confirmed a touch
tap updates the draft before the explicit Place action, a move survives reload, and an overlapping
ghost blocks placement. A simulated connection interruption retained the confirmed room and
exposed same-action retry; its retry succeeded. `npm run check` passed format, lint, typecheck,
**290 tests across 35
files**, and the production build on 2026-09-27. The existing large-bundle advisory remains.
These are emulated browser captures and interactions; physical touch hardware and owner appearance
approval remain unverified. **P01-PLACEMENT owner visual approval: PENDING. Final MVP verification:
PENDING.** This is a UI handoff at `READY_FOR_SOL_PASS_TEST`, not a full P01 pass. Full P01 remains
`BLOCKED` on F06; A01's status and earlier verification history are unchanged. Review candidate
source hashes (SHA-256 prefixes): `PropertyRoom.tsx be8bbc8b9ea079ea`,
`RoomCanvas.tsx 610481c1c3363c4e`, `room.css 5118de92445b2eb3`.

P01-PLACEMENT implementation handoff — 2026-09-27: schema 15 preserves existing item/specimen
rows while adding owned rooms, one placement per item, and durable request receipts. The server
validates the exact current host, owner, carried or placed item instance, trusted footprint,
bounds, occupancy, revision and request key in an immediate transaction. Successful commands
persist exact grid coordinates and four orientations; repeated commands do not advance revision.
Allowlisted nonproduction fixture tooling provides an 8×8 room and three nonstackable pieces;
ordinary characters receive no property. React keeps confirmed state separate from a draft and
handles uncertain outcomes by replaying the same command. A lazy PixiJS 8 room layer draws the
floor, individual procedural objects, facing markers and valid/invalid ghost cells. The existing
HUD, context layout, inventory drawer and city renderer remain in place.

`npm run check` passed formatting, lint, typecheck, **288 tests across 35 files**, and a production
build on 2026-09-27. Focused server tests cover ownership, current host, invalid inputs,
collisions, rotation, moves, stale revisions, replay/key reuse, fixture authorization and
populated-database migration with fish children. Component tests cover pointer snapping,
duplicate activation, draft validation and modal suspension. An isolated local browser review
at the available **255×356** viewport confirmed fixture creation, keyboard placement/rotation,
collision feedback, movement, reload persistence and draft preservation through the inventory
drawer. The browser control available for this pass did not expose the requested 1366×768,
1440×900, 1920×1080, 320×640 or 390×640 viewport overrides; those rendered acceptance sizes,
physical touch and owner appearance review remain for UI refinement. Browser click automation
did not reliably deliver a click even to ordinary buttons, so pointer click is covered by the
RoomCanvas event test, not claimed as a live browser check. No full-P01 purchase, production
acquisition, removal or property storage criterion is claimed. Full P01 stays `BLOCKED` on F06.

Current A01 Reel Pull and sound follow-up — 2026-09-27: REEL! now resolves the current fishing
attempt immediately in the server transaction, using the normal bait consumption, catch roll,
inventory update, trace, and next-attempt schedule. The response includes the confirmed result;
duplicate or stale activation cannot resolve the attempt again. The fish-caught cue now uses the
same Web Audio gain (0.5) as the Reel Pull cue. Focused tests passed (48 across four files), and
`npm run check` passed formatting, lint, typecheck, 276 tests across 28 files, and a production
build. Live browser audio and rendered visual review remain pending. Owner visual approval and full
A01 MVP verification remain pending; status stays `READY_FOR_SOL_PASS_TEST`.

Earlier A01 catch-sound follow-up — 2026-09-27: copied the owner's 82,057-byte water-exit MP3
unchanged into bundled audio. A newly confirmed catch in the current fishing session plays it once;
restored and duplicate snapshots and no-catch attempts stay silent. At the Pier, separate Reel event
and Fish caught checkboxes appear in the Character sidebar, or in Account when the sidebar is compact.
Choices default on and persist per character in browser storage; muting stops active playback. Audio
failure cannot affect a catch. The source and bundled SHA-256 hashes matched. Focused tests passed
(37 across four files), then `npm run check` passed formatting, lint, typecheck, 276 tests across
28 files, and a production build containing the new MP3. Live browser audio and rendered visual
review remain pending. Owner visual approval and complete A01 MVP verification remain pending;
status stays `READY_FOR_SOL_PASS_TEST`.

Earlier A01 Reel Pull sound follow-up — 2026-09-27: copied the owner's 71,468-byte M4A unchanged
into bundled audio. The client unlocks and preloads it on a player gesture, stretches decoded playback
to the configured five-second offer, joins late prompts at the corresponding offset, and stops on
use, clearing, expiry, or panel unmount. A restored prompt stays silent, duplicate polling cannot
replay the cue, and unavailable audio does not affect gameplay. Windows recognized the supplied file
as approximately four seconds; source and copied SHA-256 hashes matched. Focused audio/panel tests
passed (25 across two files), and `npm run check` passed with formatting, lint, typecheck, 268 tests
across 26 files, and a production build containing the M4A. Browser playback inspection was attempted
but the in-app browser blocked the local media URL, so actual browser decoding/playback remains
unverified. Owner visual approval and full A01 MVP verification remain pending; status stays
`READY_FOR_SOL_PASS_TEST`.

Earlier A01 timing follow-up — 2026-09-27: the configured neutral catch-attempt duration is now
30 seconds. Reel Pull offers expire five seconds after server creation, or at the cast deadline if
sooner; expiry does not shorten or resolve the cast. The progress panel shows a draining five-second
bar and a restrained matching cyan-to-gold pulse on the message, bar, and action, with a static
reduced-motion presentation. The public event includes its authoritative expiry and window duration.
Focused fishing/UI tests passed (86 across four files), followed by `npm run check`: formatting,
lint, typecheck, 265 tests across 25 files, and a production build. The build retained its existing
large-chunk advisory. These automated checks do not constitute owner review of the rendered UI;
A01 owner visual approval and full MVP verification remain pending. Status stays
`READY_FOR_SOL_PASS_TEST`.

Current A01 idle-preview follow-up — 2026-09-27: the owner supplied a fishing gear WebP for the
activity panel before Prepare tackle. The initial view now uses that cutout in a dark dockside
showcase instead of the small Basic Fishing Rod image. Preparation and active Fishing retain their
existing artwork and flow. Local browser review at 1440×900 and 390×640 confirmed the artwork,
invitation, and Prepare tackle action remain legible and reachable; the temporary review account
was removed afterward. `npm run check` passed with formatting, lint, typecheck, 261 tests across
25 files, and a production build. Owner visual approval remains pending; A01 stays
`READY_FOR_SOL_PASS_TEST`.

Current A01 event follow-up — 2026-09-27: the owner retired Surface Activity. Natural fishing
opportunities now offer Reel Pull only; the admin force control accepts Reel Pull only. Surface
Activity no longer modifies species weights, its prompt and weight diagnostics are removed, and
saved historical offers are hidden and rejected on activation. The five active-hour windows and
Reel Pull timing effect remain. `npm run check` passed with formatting, lint, typecheck, 261 tests
across 25 files, and a production build. This check also made the earlier fish stack merge test
assert source and target quantities by stack identity, independent of inventory ordering. Owner
visual approval and full A01 MVP verification remain pending; status stays
`READY_FOR_SOL_PASS_TEST`.

Current A01 stack merge follow-up — 2026-09-27: dropping a stackable item onto another stack of
the exact same definition now fills the chosen target to its cap and leaves overflow in the source,
within or across carried inventory and city locker. The server validates ownership and stack rules
in one immediate transaction, moves fish specimen identities with the fish, and deletes a fully
absorbed source. UI feedback distinguishes merge targets from ordinary swaps. `npm run check`
passed with formatting, lint, typecheck, 272 tests across 25 files, and a production build.
The subsequent event follow-up above supersedes the earlier Surface Activity recommendation.
Owner visual approval and full A01 MVP verification remain pending; status stays
`READY_FOR_SOL_PASS_TEST`.

Current A01 inventory follow-up — 2026-09-27: the empty city locker now uses the drawer's dark
palette. The locker grid no longer creates trailing slots when an item is moved to its last visible
position. Server-authorized nonproduction admins have 50 carried and 50 locker stack slots, with
transfer and admin spawn limits enforced server-side; ordinary accounts retain ten carried slots
and unbounded locker storage. `npm run check` passed on 2026-09-27 with formatting, lint,
typecheck, 266 tests across 24 files, and a production build. The owner screenshot shows the
previous white state, not approval of this result. A01 owner visual approval and final verification
remain pending; status stays `READY_FOR_SOL_PASS_TEST`.

Current A01 art follow-up — 2026-09-27: the owner supplied nine WebP cutouts for Heavy Game Rod,
Surfcasting Rod, Shrimp Bait, Fish Chunks Bait, Red Mullet, Seabass, Conger Eel, Barracuda, and
Swordfish. They are installed in `public/assets/items/` and mapped through the existing item
definitions and fishing catch art. All nine files opened as RGBA WebP images; no game rules,
schemas, or catch calculations changed. This replaces the expansion's generic visuals for those
entries. Copied files match the supplied originals by SHA-256. `npm run check` passed with 262
tests across 23 files and a production build on 2026-09-27. Owner review of the updated rendering
remains pending; A01 stays
`READY_FOR_SOL_PASS_TEST`.

Earlier A01 UI follow-up — 2026-09-27: the owner supplied a screenshot of the Preparation panel
without species percentages and explicitly directed that every eligible species contribute to the
total score while only discovered species show a percentage. The server preview now returns each
discovered fish's conditional share of the complete normal eligible pool. Undiscovered fish remain
silhouettes with no percentage; overall catch success, selection weights, and discovery rules are
unchanged. The panel labels shares as conditional on catching a fish. Focused calculation, preview,
and panel tests cover the denominator and hidden values. `npm run check` passed with **262 tests
across 23 files** and a production build on 2026-09-27; an unrelated buyer focus test passed on
repeat after one intermittent suite failure. The owner's screenshot documents the prior omission,
not approval of this revision. **Owner visual approval and full A01 MVP verification remain
PENDING.** A01 is `READY_FOR_SOL_PASS_TEST`; no later stage began.

Earlier A01 expansion — 2026-09-26: integrated the owner's eight-fish, five-bait, four-rod
condition matrix in the existing fishing configuration and calculation path. A zero on any axis
excludes the fish from preview and catches; positive factors scale the existing weighted picker
after the unchanged catch-success roll. The catalog, preparation selectors, discoveries,
specimens, inventory, buyer, and guarded catch-pool test controls include the expanded content.
Existing IDs and saved items remain valid. New fish weight ranges, buyer prices, base rarity,
and new rod success chances are provisional pending owner balance direction; the condition matrix
itself is exact. Expanded items have coded fallback visuals where no art was supplied.
`npm run check` passed on 2026-09-26 with **261 tests across 23 files** and a production build.
The existing bundle-size advisory remains. Owner visual approval and full A01 MVP verification
remained pending at that handoff; A01 was `READY_FOR_ASTRA_UI_DESIGN`, with no later stage selected.

Earlier A01 extension — 2026-09-26: implemented the owner's lightweight fishing random-event
request, limited to Reel Pull, Surface Activity, and authorized testing controls. F02 and F03 were
rechecked as `MVP_PASSED`; no later stage is selected. This request supersedes older A01 exclusions
of optional fishing events. Schema 14 persists a per-character active-hour clock, five windowed
opportunities, natural history, and attempt-bound offers. Heartbeats confirm live time; offline
expiry/restart adds none, and explicit stop/departure records the final live interval. Refresh and
new sessions retain the cycle. Only one offer is shown per cast, with pending opportunities held.

Reel Pull shortens the existing deadline to at most five seconds remaining without another
resolution path. Surface Activity modestly adjusts only the current eligible species weights;
the provisional 1.25 multiplier and zero-disable setting are central configuration. Timing,
probability, bait, fish weight, capacity, discoveries, and rewards retain their existing rules
except for the explicitly activated event effect. Server validation, atomic writes, repeat-safe
event IDs, and session event revisions prevent duplicate effects or stale UI restoration.

The existing progress area now shows compact optional prompts with pending, failure, reconnect,
and success feedback. Authorized tools provide both force actions, live clock/schedule/count,
current prompt, and normal/boosted eligible weights. Forced prompts leave natural opportunities
and history untouched. `npm run check` passed on 2026-09-26: formatting, lint, typecheck,
**249 tests across 22 files**, and production build. The existing bundle-size advisory remains.

[Focused review evidence](../artifacts/a01-random-events/REVIEW.md) records isolated browser
checks, measured desktop/narrow layouts, screenshots, and source hashes. Browser checks exercised
both forced prompts, current-attempt activation, no-catch continuation, a later awarded catch,
restart recovery without automatic restart, preserved schedule, and narrow keyboard access.
These implementation checks do not replace full A01 acceptance or owner visual approval.
**Owner visual approval: PENDING. Final A01 MVP verification: PENDING.** A01 is
`READY_FOR_ASTRA_UI_DESIGN`; no later stage began and F00–F03 history remains intact.

Earlier A01 refinement — 2026-09-26: implemented the owner's supplied fishing composition in the
existing context after confirmed Start, with a cyan clockwise ring, fish silhouette, compact
conditions/loadout, retained catch/summary, and reachable inline-confirmed Stop. F02/F03 were
rechecked as `MVP_PASSED`; only A01 was worked on. The owner's explicit progress direction replaces
the older timer prohibition across design, checklist, API, architecture, and presentation documents.

Schema 13 persists each attempt's start, deadline, and duration. Independent rod/time/sea timing
configuration is neutral (all multipliers 1, baseline 60,000 ms); catch-chance balance is unchanged.
Duration is fixed when scheduled; catch probability uses conditions at resolution. Client progress
anchors to server time and a monotonic clock, freezes on connection loss, rejects stale responses,
and waits at full for the server. Deadline reconciliation uses at most one read and one retry per
attempt, alongside the existing heartbeat. No local completion mutates gameplay or restarts fishing.

`npm run check` passed on 2026-09-26: formatting, lint, typecheck, **212 tests across 20 files**, and
production build. Focused coverage includes neutral/configured timing, persisted schedules,
mid-attempt condition changes, unsuccessful/forced attempts, refresh/reconnect, stale responses,
pending actions, stopping, and bounded reconciliation after a delayed response corrects the clock.
Rendered review measured **1366×768, 1440×900, 1920×1080, 1280×720, 390×844, and 320×640** CSS
viewports, with no horizontal overflow and a reachable Stop action. An isolated review character
completed preparation/start, natural no-catch, forced successful catch, refresh recovery, retained
latest catch after a later no-catch, Escape cancellation/focus return, confirmed Stop, and stopped
reload persistence. No browser console errors or warnings were reported in that review.

[Review evidence and source fingerprint](../artifacts/a01-attempt-progress/REVIEW.md) distinguish
rendered checks from automated coverage and remaining broader A01 acceptance. Dedicated physical
touch/screen-reader and alternate OS reduced-motion/zoom testing were not performed. The progress
display has no decorative motion and exposes non-live numeric progress with phase-only announcements.
**Owner visual approval: PENDING** for this exact result; approval date/reviewed owner revision are
not recorded. **Final A01 MVP verification: PENDING.** A01 remains `READY_FOR_SOL_PASS_TEST`; no later
stage began and recorded F03 approval/verification remain intact.

Earlier A01 sound follow-up: the owner supplied a specific Cash Register (Kashing!) MP3 and
requested it replace the previous sample. It has been copied unchanged into the existing bundled
audio path; source information and the preview now identify the supplied file. Sale timing and
playback safeguards are unchanged. SHA-256 comparison verified a byte-for-byte copy of the
33,155-byte supplied file; the browser decoded its 1.996916-second duration with no media error.
`npm run check` passed on 2026-09-26 (formatting, lint, typecheck, 187 tests, and production build).
The build emits a new content-hashed MP3 URL. Final A01 MVP verification and approval of the
complete rendered experience remain pending; the supplied sound is the owner's explicit selection.

Earlier A01 sound correction (sample superseded by the owner's supplied file): the owner rejected the synthesized cue as an unconvincing cash
register. It has been replaced with the bundled Cha Ching Register sample by Muska666 from
SoundBible (CC BY 3.0). Attribution ships with the app and is linked from Account. The recording
plays at 65% gain only after confirmed sales, retaining duplicate/retry/cancel protections.
Failed asset loading or decoding remains silent and can retry on the next confirmation.
`npm run check` passed on 2026-09-26: formatting, lint, typecheck, 187 tests across 17 files,
and production build including the 21 KB MP3. A browser playback check loaded the 2.0778-second
file, played it through to `ended`, and reported no media error. Audio tests cover loading/decode
failure recovery, cache reuse, one playback, blocked audio, delayed suppression, and cleanup;
existing buyer tests retain the confirmed-sale-only checks. The replacement is
[`src/assets/audio/cash-register.mp3`](../src/assets/audio/cash-register.mp3), with provenance in
the adjacent README. Approval of the replacement sound and final A01 MVP verification remain pending.

Earlier A01 UI follow-up (sound superseded after owner rejection): added the owner-requested cash-register cue to server-confirmed fish
sales. The cue is synthesized locally without downloads or dependencies; browser audio is unlocked
silently by confirmation. Review/cancel/failure remain silent, and sound failures cannot block the
trade. `npm run check` passed on 2026-09-26 (formatting, lint, typecheck, 183 tests across 17 files,
and production build). Buyer tests cover one cue after success/retry, silence while pending or on
failure/cancel/unmount, and no repeat on duplicate submission or rerender. Audio tests cover the
0.8-second waveform, bounded amplitude, buffer reuse, single playback, and blocked/unsupported
audio. A [playable preview](../artifacts/a01-sale-sound/cash-register-preview.wav) was exported from
the production synthesizer for owner listening; speaker output was not manually certified. Owner
approval and final A01 MVP verification remain pending.

Earlier A01 UI follow-up: the owner replaced the original store asset with four time-of-day
variants. The stale import caused Vite's missing-file error. It now references the supplied
Dawn/Day/Dusk/Night files, selected by the effective server phase used in the HUD. The existing
scenery transition preserves the buyer panel and selections. `npm run check` passed on 2026-09-25
(formatting, lint, typecheck, 178 tests, and production build). New regression coverage checks all
variants, Day fallback, effective phase changes, sea independence, and retained buyer context.
An isolated browser review rendered all four phases at 1440×900, verified HUD agreement and
unchanged selected fish/offer, and restored the review clock override afterward.
[Phase screenshots and evidence](../artifacts/a01-store-variants/REVIEW.md) are recorded; owner
visual approval of this rendering and final A01 MVP verification remain pending.

Earlier A01 UI follow-up: the owner approved the supplied Fishing Store interior image on
2026-09-25 and requested its implementation. Entering the store now displays that unchanged
2560×1440 image in the world surface, with the buyer alongside it and no inherited Harbor map
labels. The full scene fits through the existing contain transform; Back to Harbor District
remains available. No API, rules, or schema changes were needed. `npm run check` passed
(formatting, lint, typecheck, 174 tests, production build). Browser review verified entry, exit,
1440×900 desktop, and 390×844 narrow rendering with no horizontal overflow.
[Rendered evidence](../artifacts/a01-store-interior/REVIEW.md) is recorded separately from the
owner's approval of the source image; approval of this rendered integration and final A01 MVP
verification remain pending.

Earlier A01 UI refinement: the Fishing Store buyer now has a portrait and contextual dialogue,
compact stack cards, one illustrated appraisal, selectable specimens, and an Ordinary only shortcut.
A persistent offer footer leads to an in-panel confirmation and a credits-earned receipt. Trophy
selection receives warm emphasis and explicit confirmation. Keyboard cancellation restores focus;
failed ambiguous sales retain the same request key for safe retry. Pricing, sale contracts, and
inventory rules are unchanged. PNG delivery was added for the merchant portrait.

This refinement passed `npm run check` on 2026-09-25: formatting, lint, typecheck, 174 tests,
and production build. Nine buyer interaction tests cover selection, confirmation, focus, receipt,
refresh, and recovery. An isolated local review completed a Trophy sale for 170 Cr, verified the
balance update, continued trading, and checked ordinary-only selection and keyboard cancellation.
Rendered review covered 1440×900, 1366×768, 1920×1080, 1280×720, 390×844, and 320×640 CSS
viewports. [Review evidence and screenshots](../artifacts/a01-buyer-review/REVIEW.md) record the
reviewed source hashes. Owner visual approval and final A01 MVP verification remain pending;
these checks do not approve appearance or mark A01 passed.

Latest owner-directed A01 extension: the existing Fishing Store now has a fish-buying NPC in the
right context. Carried fish can be sold by specimen or stack using server quotes and an inline
confirmation. Ordinary prices are fixed per species; Trophy prices use increasing species-specific
credits/kg rates. Sales atomically remove specimens, update credits, and record a repeat-safe sale
key; locker fish are excluded until carried. F06's general economy remains separate. Owner visual
approval and final A01 MVP verification remain pending.

The fish-buyer pass passed `npm run check` on 2026-09-25: formatting, lint, typecheck,
166 tests, and production build. Focused coverage includes all three provisional price curves,
single/stack sales, stale and foreign specimens, retry idempotency, authenticated API behavior,
legacy UUID stack IDs, and inline UI confirmation. This automated result does not constitute owner
visual approval.

Earlier A01 UI follow-up: the owner marked the bottom-right area of fish inventory cards for a
compact total weight. Carried and locker fish stacks now show the sum of their recorded specimens
as a bare kg value in that corner, including the whole-card drag preview. Unknown historical
weights show `— kg` rather than an incomplete total; non-fish cards show no weight. Focused tests
cover totals, refresh, large weights, unknown weights, and the drag preview. `npm run check` passed
on 2026-09-25 (formatting, lint, typecheck, 160 tests, and production build). Owner visual approval
and final A01 MVP verification remain pending.

Earlier A01 UI follow-up: the owner highlighted the redundant Largest weight line in a species
summary row. Current and stopped session rows now show only species, quantity, and Trophy count;
the unused heaviest-weight field was removed from the public summary contract. The latest catch and
individual fish inspection still show weights. Focused tests confirm the removed row text and
summary shape. `npm run check` passed on 2026-09-25 (formatting, lint, typecheck, 159 tests, and
production build). Owner visual approval and final A01 MVP verification remain pending.

Earlier A01 UI follow-up: the owner supplied reference screenshots of the species summary and latest
catch card for the current-session preview. Active Fishing now shows the latest catch first, then
the shared species summary labeled Current session; the redundant count row was removed. The
stopped panel keeps the same order and labels the summary Session complete. The server now supplies
the persisted awarded-catch breakdown during active sessions as well as stopped ones. Focused UI
and server tests verify both states and their ordering. `npm run check` passed on 2026-09-25
(formatting, lint, typecheck, 159 tests, and production build). Owner visual approval and final
A01 MVP verification remain pending; the supplied screenshots are direction, not approval of this
revised rendering.

Earlier A01 UI follow-up: the Stop Fishing confirmation now replaces the action inside the Fishing
panel footer. It stays in the activity panel without a viewport modal or backdrop; Keep fishing and
Escape still cancel without a stop request and return focus to the Stop action. The server action
and authoritative catch summary are unchanged. The panel interaction test verifies its placement,
cancel paths, and single confirmed request. `npm run check` passed on 2026-09-25 (formatting, lint,
typecheck, 158 tests, and production build). Owner visual approval and final A01 MVP verification
remain pending.

Earlier A01 owner follow-up: Stop Fishing now opens a keyboard-accessible confirmation. Cancel or
Escape keeps the session running without a stop request; confirmation sends one server action. The
stopped panel shows a per-species summary of awarded catches and Trophy counts, or a zero-catch
message, derived from persisted attempt records so later inventory changes do not rewrite the haul.
The latest-catch card remains above the summary while at the Pier. Focused server
and UI tests cover confirmation, canceled requests, saved summaries, and reload. `npm run check`
passed on 2026-09-25 (formatting, lint, typecheck, 158 tests, and production build). Owner visual
approval and final A01 MVP verification remain pending.

Earlier A01 owner follow-up: successful travel out of Fishing Pier now records a departure event for
the latest session, whether still active or already stopped. The public Fishing state is idle after
departure and on return, so the previous stop notice, catch count, and latest-catch card disappear.
Completed session/attempt records and caught inventory remain persisted. The supplied screenshot
showed the stale stopped-session panel; server and panel regression tests cover the reset.
`npm run check` passed on 2026-09-25 (formatting, lint, typecheck, 157 tests, and production build).
Owner visual approval and final A01 MVP verification remain pending.

Earlier A01 UI follow-up: the empty locker message is now a visible whole-card drop target. Dragging
between carried inventory and locker transfers the complete stack through the existing server
action; in-container drops still swap or fill slots. The reverse locker-to-pack path and empty
locker drop are covered by interaction tests. `npm run check` passed on 2026-09-25 (formatting,
lint, typecheck, 155 tests, and production build). Owner visual approval and final A01 MVP
verification remain pending.

Earlier A01 UI follow-up: carried and locker fish stack cards now show the shared Trophy badge and
a warm border whenever any authoritative specimen in that stack is Trophy. Drag previews keep the
same cue, and it disappears after the last Trophy leaves the stack. No stack rule, schema, or API
changes were needed. `npm run check` passed on 2026-09-25 (formatting, lint, typecheck, 153
tests, and production build). Owner visual approval and final A01 MVP verification remain pending.

Earlier A01 UI follow-up: player-facing fish weights and species range endpoints now show three
decimals when three-decimal rounding stays below 10 kg and two otherwise. Latest-catch text, older saved catch messages,
stack rows, and accessibility labels share one formatter; stored precision and Trophy rules are
unchanged. `npm run check` passed on 2026-09-25 (formatting, lint, typecheck, 152 tests, and
production build). Owner visual approval and final A01 MVP verification remain pending.

Earlier A01 UI correction: repeated fish-stack selection still rendered one React inspector, but its
sticky positioning inside the scrolling inventory dialog could leave visible panel copies. The
inspector now scrolls normally and remounts its container on stack changes; switching stacks
replaces the collection and resets its list. Component coverage asserts a single collection and
container replacement through repeated switches. Owner visual
approval and full A01 MVP verification remain pending. `npm run check` passed on 2026-09-25
(formatting, lint, typecheck, 146 tests, and production build).

Earlier A01 owner follow-up: authorized admins can select and confirm deletion of one carried or
locker item/stack in the inventory drawer or Fishing test tools. The existing server mutation now
accepts owned locker targets for full deletion, preserving its audit and idempotency path, fish
specimen cleanup, and ordinary-view refresh. The Remove quantity action remains carried-only.
`npm run check` passed on 2026-09-25 (formatting, lint, typecheck, 146 tests, and production
build). Owner visual approval and final MVP verification remain pending.

Earlier A01 UI follow-up: known fish weights, including latest catch messages, stack details,
range endpoints, and accessibility labels, displayed exactly three decimal places in kg before the
current magnitude rule superseded that format. Existing
persisted catch messages render from the saved specimen weight at the new precision. Successful
inventory reorder no longer shows a confirmation notice; pending and error feedback remain.
`npm run check` passed on 2026-09-25 (formatting, lint, typecheck, 142 tests, and production
build). Owner visual approval and final MVP verification are still pending.

## Valid statuses

- BLOCKED
- READY
- SOL_BUILD
- READY_FOR_ASTRA_UI_DESIGN
- ASTRA_UI
- READY_FOR_SOL_PASS_TEST
- SOL_PASS_TEST
- MVP_PASSED
- MVP_FAILED

## Stage board

| ID            | Stage                                                       | Status                    | Dependencies            | Notes                                                              |
| ------------- | ----------------------------------------------------------- | ------------------------- | ----------------------- | ------------------------------------------------------------------ |
| F00           | Repository, Quality Gates, and Game Shell                   | MVP_PASSED                | None                    | All F00 MVP acceptance criteria passed on 2026-09-21               |
| F01           | Account, Character, and Persistent Player State             | MVP_PASSED                | F00                     | All F01 acceptance criteria passed on 2026-09-21                   |
| F02           | Inventory, Items, Consumables, and City Locker              | MVP_PASSED                | F01                     | All F02 MVP acceptance criteria passed on 2026-09-21               |
| F03           | City, Districts, Places, Discovery, and Pins                | MVP_PASSED                | F01                     | Approved Pier revision and final verification passed on 2026-09-23 |
| F04           | Regional Travel and Traveling State                         | READY                     | F02, F03                | Dependencies passed; not selected                                  |
| F05           | Character XP, Levels, Knowledge Points, and Knowledge Atlas | READY                     | F01                     | Unlocked by F01; not started                                       |
| F06           | Basic NPC Economy                                           | READY                     | F02, F03                | Dependencies passed; not selected                                  |
| A01           | Fishing: Complete Vertical Slice                            | READY_FOR_SOL_PASS_TEST   | F02, F03                | Known catch shares added; owner approval pending                   |
| P01-PLACEMENT | Bounded Furniture Placement Slice                           | READY_FOR_ASTRA_UI_DESIGN | F02, F03                | Crop fixture and second bed axis added; visual refinement pending  |
| A02           | Mining: Complete Vertical Slice                             | BLOCKED                   | F02, F03, F04, F05, F06 |                                                                    |
| A03           | Refining: Complete Vertical Slice                           | BLOCKED                   | A02, F05, F06           |                                                                    |
| A04           | Blacksmithing: Complete Vertical Slice                      | BLOCKED                   | A03, F05, F06           |                                                                    |
| A05           | Hunting: Complete Vertical Slice                            | BLOCKED                   | F02, F04, F05           |                                                                    |
| V01           | Personal Vehicles, Cargo, Fuel, Durability, and Upgrades    | BLOCKED                   | F02, F04, F06           |                                                                    |
| P01           | Property Purchase and Personal Homestead                    | BLOCKED                   | F02, F03, F06           |                                                                    |
| P02           | Property Infrastructure                                     | BLOCKED                   | P01, F05                |                                                                    |
| M01           | Player Marketplace                                          | BLOCKED                   | F02, F06                | A04 recommended                                                    |
| C01           | Automatic Combat and PvE Encounter                          | BLOCKED                   | F01, F02, F05           | Gear can initially be seeded                                       |
| E01           | Expedition: Complete Vertical Slice                         | BLOCKED                   | F02, F04, F05           | C01/V01 recommended                                                |
| S01           | Chat, Local Presence, Profiles, and Player Interaction      | READY                     | F01, F03                | Dependencies passed; not selected                                  |
| N01           | Full New-Player Onboarding                                  | BLOCKED                   | F01-F06, A01, C01       | S01 recommended                                                    |
| O01           | Offline Progression and Login Summary                       | BLOCKED                   | F01 + timed activity    | A03/P01/E01 recommended                                            |
| L01           | Shipping and Logistics                                      | BLOCKED                   | F02, F04                | V01/M01 recommended                                                |
| PVP01         | Opt-In Shipment Interception                                | BLOCKED                   | L01, C01                |                                                                    |
| R01           | Retirement and Legacy                                       | BLOCKED                   | F05                     | Several activities recommended                                     |
| MON01         | Premium Membership and Tradeable Voucher                    | BLOCKED                   | F01, F06                | M01/O01 recommended                                                |
| W01           | Frontier Discovery, Land Claims, and World Expansion        | BLOCKED                   | E01, P01                | M01 recommended                                                    |

## Ready-stage selection rule

A stage becomes `READY` when:

- all required dependencies are `MVP_PASSED`;
- no known blocking decision remains.

Recommended dependencies do not block the stage.

When multiple stages are READY, select the next one deliberately. Do not automatically choose the lowest ID.

## Active-stage notes

Use this section for temporary implementation notes only.

### A01 locker placement, full-card drag, and admin clear — 2026-09-25

- Owner requested the same swap/open-space behavior inside the locker. It now has saved slot
  positions and visible open spaces that extend with stored items. Dragging another locker card
  swaps positions; dropping into open space keeps the card there. The floating preview reproduces
  the complete source card—art, quantity, name, category, and dimensions—while the source is subdued.
- The existing allowlisted Fishing Debug Console now offers a confirmed **Clear Locker** action.
  Its idempotent, audited server mutation deletes only the current operator character's stored
  stacks and their dependent fish specimens; carried items and other characters remain. The normal
  inventory and fishing views reconcile after the action. The locker itself remains available.
- `npm run check` passed: formatting, lint, typecheck, **142 tests**, and production build. New tests
  cover locker occupied/empty drops, complete drag content, saved locker gaps across database reopen,
  confirmed admin UI, authorization, auditing, idempotency, and fish specimen cleanup. The owner's
  supplied screenshot documented the name-only drag preview; no authenticated live browser visual
  acceptance of this revision is claimed.
- A01 remains `READY_FOR_SOL_PASS_TEST`. **Owner visual approval: PENDING** for this revision;
  final A01 MVP verification remains pending. F00–F03 statuses are unchanged; no later stage began.

### A01 inventory card sorting — 2026-09-25

- Owner requested drag-and-drop sorting, then clarified that the whole item card should drag without
  an icon and that empty carried slots should accept drops. Carried cards now swap when dropped on
  another card and retain the exact target slot when dropped on an empty one. Locker cards reorder
  within the locker. Focused cards also move with Alt + arrow keys. Dragging does not open item
  details or change a fish collection.
- Added server-owned `sort_index` positions and `POST /api/inventory/reorder`, validating a complete
  owned item set in a transaction. Positions survive reload/restart; older databases migrate without
  changing initial order. Transfers clear the old position, so incoming carried items use the first
  free slot; the follow-up above extends this to locker open spaces. Item quantities, specimens, equipment and capacity rules
  are unchanged.
- `npm run check` passed: formatting, lint, typecheck, **139 tests**, and production build. Tests
  cover pointer and keyboard sorting, exact empty-slot placement, persistence, schema migration,
  stale/foreign lists, and remote locker rejection. A temporary in-app browser review reached only a
  narrow sign-in pane; its documented review account credentials were rejected, so no authenticated
  desktop/mobile visual acceptance is claimed.
- A01 returns to `READY_FOR_SOL_PASS_TEST`. **Owner visual approval: PENDING** for this result;
  final A01 MVP verification remains pending. F00–F03 statuses are unchanged; no later stage began.

### A01 compact item cards and direct stack switching — 2026-09-25

- Owner requested less item detail clutter and automatic replacement of the previous stack view,
  then clarified that fish must remain accessible with one click. A fish tile immediately opens
  its own collection, resets list scroll and selects its heaviest fish. Another stack replaces it;
  non-fish items show a compact dark framed card with name, category, short flavor and actual effects.
  Removed the quantity/stack-size table and long storage instructions. Store…/Take… reveal transfer
  controls only when needed; changing items resets those controls. No second inspection click is
  required from a fish tile. No gameplay/API/schema changes.
- `npm run check` passed: formatting, lint, typecheck, **134 tests**, production build. Isolated
  browser review confirmed direct stack switching, compact summaries, storage disclosure and narrow
  access; six acceptance-size layouts had no horizontal document overflow. See the
  [review pack](../artifacts/a01-item-tooltip-review/REVIEW.md) for screenshots, candidate fingerprint
  and the desktop capture-service limitation.
- A01 remains `READY_FOR_SOL_PASS_TEST`. **Owner visual approval: PENDING** for the revised result;
  no approval date or reviewed revision is inferred. Complete final MVP verification remains pending.
  F00–F03 and their recorded verification remain unchanged; no later stage started.

### A01 Trophy and fish collection UI refinement — 2026-09-25

- Owner requested stronger Trophy feedback, engaging fish stack inspection, and removal of duplicate
  inventory quantities. Completed gold Trophy catch cards with brief reduced-motion-aware sweep,
  larger weight, polite announcement, and retained stopped results. Inventory now uses an illustrated
  selected specimen, one range bar, compact descending rows, and single quantity badges. Manual
  refresh preserves selection and Close returns to the current item tile.
- Added only the backward-compatible `latestCatch.trophy` flag from the existing server classifier;
  rules, schema, balance, rewards, and approved assets remain unchanged. F02/F03 dependencies remain
  `MVP_PASSED`; no later stage started.
- Candidate `a597cc1ff620da2940f92a5977c2f25d819be0edc152ce8f6905a195345a7e79` passed
  `npm run check`: formatting, lint, typecheck, **132 tests**, and production build. Isolated live
  review captured 1920×1080, 1440×900, 1366×768, 1280×720, 390×844, and 320×640; no horizontal
  document overflow, reachable Stop, full-stack keyboard selection, and stopped Trophy retention.
  See the [review pack](../artifacts/a01-trophy-review/REVIEW.md) for screenshots and actual limits.
- A01 is `READY_FOR_SOL_PASS_TEST`. **Owner visual approval: PENDING** for this candidate; no approval
  date or owner-reviewed revision is recorded. Complete final MVP verification also remains pending.
  Earlier F03 approval and verification history are preserved.

### A01 owner follow-up: weight display and Trophy test control — 2026-09-25

- Player-facing fish weights and range endpoints now display `x.xx kg`; stored weights retain
  precision for sorting, gradient position, and the 95th-percentile Trophy classification.
- The authorized force-next-attempt tool can force a Trophy, implying a successful catch and
  sampling weight from the species' top 5% through the ordinary validated, atomic attempt path.
  A01 remains `READY_FOR_ASTRA_UI_DESIGN`; owner visual approval and final MVP verification remain
  pending. `npm run check` passed: formatting, lint, typecheck, 123 tests and production build.

### A01 owner-directed specimen revision — 2026-09-25

- The owner replaced the Basic Rod base chance with 20%, bait cap with 120, and unlimited fish
  stacks with ten-fish species stacks. Each awarded catch now persists an individual weighted
  specimen; the shared configurable distribution determines sampling and its 95th-percentile Trophy
  distinction. Inventory inspection lists one stack's fish with weight bars. Selected bait is bound
  to its original stack through final-bait resolution; ignored events remain nonblocking and no
  event prompts are currently implemented.
- Schema 10 migrates oversized legacy fish stacks without deleting fish. It recovers weights from
  successful attempt traces where possible and labels others unknown. Old traces cannot prove which
  surviving fish they describe. If splitting exceeds carried slots, excess stacks move to the city
  locker, with counts recorded in `app_metadata.fish_specimen_migration`.
- `npm run check` passed: formatting, lint, typecheck, 121 tests and production build. This
  changed result awaits UI refinement and explicit
  owner visual approval; the prior handoff and verification history below remains historical.

### A01 owner follow-up — 2026-09-24

- The owner requested a stable Pier scene size during Start Fishing, removal of weather, faster
  location fades, colored status icons, Inventory naming, phase-start clock overrides, and a
  qualitative sea outlook. The shared world schema drops the obsolete condition column on opening;
  the fishing probability now uses only rod, time, and sea modifiers. Overrides display 05:00,
  08:00, 17:00, or 20:00. Owner follow-up: these hours now anchor a running clock, so the time
  and effective phase advance after selection; clearing returns to the underlying UTC schedule.
- `npm run check` passed with 113 tests, formatting, lint, typecheck, and production build.
  The running database migrated to schema 9; a read-only check of its active override showed
  08:17 → 08:18 across ten simulated real seconds.
  A live local review at the Pier measured the scene at
  341.52×192.10 and header at 56.59 before and after Start Fishing, with no horizontal overflow at
  the review browser's 828×465 effective viewport. The fresh preview showed the Inventory labels,
  colored icons, and qualitative sea outlook. The temporary review account and supplies were removed.
  Owner visual approval and complete A01 MVP acceptance remain **PENDING**.

### A01 browser-game UI handoff — 2026-09-24

- Owner explicitly requested implementation of the supplied Frontier UI handoff. A01 remains the
  sole selected stage; F02/F03 dependencies and their recorded approvals remain passed.
- Completed compact shell/HUD, world location/Back/pin header, centered contained scenes and
  aligned overlays, distinct Prepare tackle entry, equipment dialog/sheet, one conditions row,
  forecast details, stable actions, prominent catch feedback, and separate interruption results.
  Authoritative mechanics, schemas/APIs, clock timing and supplied assets are unchanged.
- Fixed duplicate-action/reconciliation handling, character updates after an ambiguous committed
  Start, and late replies after leaving the activity. Connection loss retains confirmed rewards;
  restart recovery reports the actual server reason and does not resume automatically.
- Candidate `948786be38ac291179532865437e1f6388abf68cdcce91dab52d7d275ad7d717` passed
  `npm run check`: formatting, lint, typecheck, 109 tests and production build. Live isolated review
  covered real catch/no-catch bait consumption, stop, restart, connection loss, missing gear/Pack,
  keyboard focus, navigation/pins/admin access, large balance, longest available rod and quantity 100.
- Rendered 1920×1080, 1440×900, 1366×768, 1280×720, 390×844 and 320×640. Desktop documents
  fit their viewports; narrow layouts have one vertical scroll and no horizontal overflow. The
  mobile footer becomes sticky only after entering the activity area, preserving its heading.
  Before/after captures, measurement details and remaining verification limits are in
  [the review pack](../artifacts/a01-handoff/REVIEW.md). Captures are browser-downsampled JPEGs.
- Owner visual approval and the complete final MVP acceptance remain **PENDING** for this candidate;
  reduced-motion runtime emulation, dedicated screen-reader/touch/200% zoom and long-list stress
  review are not certified here. No later stage was started. F00–F03 approvals remain intact.

### A01 owner UI revision — 2026-09-24

- Owner-reported crossfade correction: the browser inserted the incoming image at full opacity,
  making the earlier CSS transition look like a swap. The incoming scene now runs a one-second
  opacity animation over the retained, fully opaque prior scene after loading. Live isolated
  admin review sampled intermediate opacity for both a forced sea change and a time override;
  reduced-motion settings still use a static change. `npm run check` passed with 104 tests,
  format, lint, typecheck, and production build. Owner approval of this result is **PENDING**.
- Follow-up integration fix: shared public world snapshots now stream to connected players and
  are polled as a fallback. Admin overrides and scheduled condition changes update the global HUD,
  Pier artwork, and Fishing condition display without waiting for the 15-second Fishing session
  refresh. Server-authoritative Fishing resolution and persisted overrides remain the source of
  truth. The image crossfade now gives cached incoming art a painted transparent frame before
  revealing it. Two-player, two-server propagation has automated coverage. Owner review of this
  changed presentation remains **PENDING**. `npm run check` passed with 104 tests, format, lint,
  typecheck, and production build; the complete A01 acceptance flow remains pending.

- Owner asked for the authorized tools to stop covering the whole screen, for scenery changes to
  crossfade, and for all scene captions to disappear. Frontier time now belongs in the shared HUD
  rather than the Fishing activity panel; the sea forecast remains local. The tools now open in a
  bounded nonmodal window with pointer/keyboard move and resize controls, so the world remains
  interactive. Scenery retains its prior image until the next loads, then crossfades unless reduced
  motion is requested. A read-only shared clock endpoint supplies the HUD without changing Fishing
  session liveness or sea state.
- An isolated live review checked the world and HUD at 1366×768, 1440×900, 1920×1080, and
  320×640 without document-level horizontal overflow. It confirmed no scene captions, a scene
  crossfade with previous-image cleanup, the nonmodal window at desktop/mobile sizes, background
  destination interaction, and keyboard move/resize. Automated checks passed with 99 tests,
  format, lint, typecheck, and production build. Pointer dragging/resizing and the complete A01
  gameplay acceptance flow remain for the final pass. Owner visual approval of this revision is
  **PENDING**; no MVP pass is inferred.

### A01 owner expansion — 2026-09-24

- Owner requested a shared six-days-per-real-day Frontier clock, use of supplied Pier artwork for
  time/sea combinations, and a personal admin reset for fish discovery. They confirmed that caught
  species become permanently discovered per character and undiscovered possible catches remain
  black silhouettes labeled `???`. The implementation is functionally ready for A01 UI review;
  owner visual approval and final MVP verification remain pending. F02/F03 approvals remain intact.
- Schema 7 records first awarded catches per character. The preview reveals caught species and
  shows undiscovered species as silhouettes; the authorized reset clears only the signed-in
  operator's discovery rows. The shared UTC-anchored Frontier clock runs six complete days per
  real UTC day and provides the exact Dawn/Day/Dusk/Night boundaries. A nullable admin override
  changes effective time without stopping the scheduled clock.
- All twelve supplied Pier scenes are selected from effective time and sea conditions. The owner
  renamed the day assets; their current paths are used in the build. Live review on an isolated
  test account confirmed the automatic Day scene, an admin-forced Dusk scene, the `???` silhouettes,
  the personal reset confirmation, and return to the scheduled clock. The pier was reviewed at
  1366×768, 1440×900, 1920×1080, and 320×640, with no document-level horizontal overflow.
  `npm run check` passed on 2026-09-24 with 96 tests, format, lint, typecheck, and production build.
  Keyboard/touch/error recovery, the complete A01 MVP flow, and owner visual approval remain for
  later gates; no MVP pass is inferred.

### A01 authoritative sea-state implementation — 2026-09-24

- Kept A01 selected; F02/F03 remain `MVP_PASSED`. Schema 6 adds a UTC-aligned half-hour sea
  block start, committed next state, and nullable persistent override to the shared Fishing Pier
  singleton. Legacy `sea_state` becomes initial scheduled current on first locked access. The
  server advances every missed block under `BEGIN IMMEDIATE`; it does not replay Fishing attempts.
- Resolution uses effective sea at its actual timestamp. A shared calculation now serves attempts
  and a validated, reward-free Preparation preview. Ordinary Fishing responses expose one public
  forecast and server time. Admin force/clear affects the shared Pier; schedule advancement continues
  beneath overrides. Existing time/weather behavior, catch balance, species, liveness, and inventory
  rules were retained.
- The Fishing panel now shows the scheduled transition in Preparation and active sessions, refreshes
  at the boundary and on tab resume, and retains selections/results on refresh failures. The admin
  drawer shows scheduled/effective states and controls force/clear. `npm run check` passed on
  2026-09-24: format, lint, typecheck, 90 tests, and production build. Tests include an independent
  process contending on the same SQLite file at a boundary, rollback/restart/missed-block cases,
  overrides, preview validation, and panel refresh reconciliation.
- Rendered review at 1366×768, 1440×900, 1920×1080, and 320×640 and owner visual approval remain
  pending. The complete A01 MVP acceptance flow has not been rerun against a live rendered build.
  No owner approval or final MVP pass is inferred from automated checks. Hand off this A01 result
  for UI review before the final SOL pass test.

### A01 owner review corrections — 2026-09-23

- Follow-up game-feel refinement: replaced form-like equipment rows with two illustrated slots,
  framed the static species preview, retained item art during active fishing, and emphasized the
  latest catch with species artwork and authoritative weight. Added a reduced-motion-aware active
  indicator and sticky Stop control. Previous session feedback clears on entering Preparation.
  Game rules, assets, APIs, persistence, and F03 approval are unchanged.
- Browser review covered 1366×768, 1440×900, 1920×1080, and 320×640 CSS-pixel viewports with no
  document overflow. Verified selection, Escape focus return, start, authorized forced catch,
  drawer dismissal, narrow internal scrolling, and explicit stop. The existing review account
  consumed two Worm Bait (18 to 16), caught one Sardine, and was left idle in Preparation.
  [Latest review captures](../artifacts/a01-game-ui-review/REVIEW.md) supersede earlier Fishing
  presentation captures. Owner visual approval and final MVP verification remain **PENDING**;
  A01 remains `READY_FOR_SOL_PASS_TEST`.
- Follow-up verification: `npm run check` passed formatting, lint, TypeScript, **82 tests**, and
  production build. Reviewed candidate SHA-256: `FishingPanel.tsx`
  `bc51f29dc8ead3081db0363604f05fb7c05e434bd770ab15336d228cf839505d`;
  `styles.css` `b7dd49bb2caf1da40089a8f8c7344dd827ca244f3eeef6b3be53f4d7328e0146`.
  These supersede earlier A01 presentation fingerprints; no owner approval is inferred.

- The owner reported inventory quantities escaping their slots, pale/dark green Fishing control
  hover states, and an overlong Quick Travel list. Those visual changes were made on the same A01
  review candidate. **Owner visual approval remains PENDING** until this corrected result is
  reviewed; A01 remains `READY_FOR_SOL_PASS_TEST`, with final MVP verification still pending.
- Item artwork now yields width to the fixed quantity label inside each slot. In the live browser,
  every carried quantity stayed within its slot at 600×450 and 320×640 CSS pixels, including
  illustrated rod, bait, and fish items. Fishing primary,
  secondary, hover, expanded, and disabled controls now use the dark slate/teal panel palette. A
  rendered 1440×900 preparation capture shows the corrected hovered Rod and disabled Start states.
- Quick Travel now lists pinned locations only. The empty and one-pin live states were checked;
  unpinned discoveries no longer appear, and the current pinned location remains labeled and cannot
  travel to itself. The development review account's temporary pin was removed after capture.
  Arrival feedback now tells players to pin a discovered place to add it to Quick Travel. The
  server's discovery, pin, and navigation contracts remain unchanged.
- `npm run check` passed after the corrections: formatting, lint, TypeScript, **82 tests**, and
  production build. A new UI test covers pinned-only and empty Quick Travel. Current correction
  captures are in the [review gallery](../artifacts/a01-ui-review/REVIEW.md).
- Current corrected-candidate SHA-256: `LocationsPanel.tsx`
  `344e70f879f33ad1bb4e096ba16efcdd5c50ee9c16eed69582e50e448ff54073`;
  `LocationsPanel.test.tsx` `b35f0058c09fa9b93d6e15e19ee83594d2ebd4bf2ae569ca656737479e9c8cd0`;
  `styles.css` `71f38b03bbcf38db42a3bf4c4c9f0fe54a9178fb7577afc0d574f5dacbf16337`.
  These supersede the earlier A01 presentation fingerprints below. No owner approval is inferred.

### A01 UI refinement handoff — 2026-09-23

- Selected A01 only; F02/F03 remain `MVP_PASSED`. UI pass complete, status
  `READY_FOR_SOL_PASS_TEST`. Owner visual approval: **PENDING**; final MVP verification: **PENDING**.
- Refined the existing Pier context with illustrated Rod/Bait rows, compact eligible-item pickers,
  selected labels, a static three-species preview, labeled conditions, catch count/latest weight,
  and stopped-session feedback. Updated the entered Pier's presentation copy. No server, balance,
  API, persistence, admin-tool, asset, or deferred-feature changes.
- Keyboard focus enters Preparation/choices and returns to the slot after selection, Close, or
  Escape. Confirmed start/stop focuses the activity heading; polling does not steal focus. Missing
  or stale supplies explain disabled commitment. Failed initial loads offer recovery only, failed
  refreshes retain confirmed state, and requests have a ten-second timeout.
- Browser checks used the existing `frontier-dev` review account: physical Pier entry, empty picker,
  local preparation, keyboard selection/Escape, server-confirmed start, catch/remaining bait,
  admin drawer dismissal while active, and explicit stop. The existing authorized inventory tool
  added one Reinforced Fishing Rod and 20 Worm Bait; one forced success and one scheduled catch
  completed, leaving 18 bait and two Sardines. Fishing was stopped at the end of review.
- Rendered **1366×768, 1440×900, 1920×1080, and 320×640 CSS-pixel** viewports. Desktop document
  dimensions equal the viewport; the narrow panel uses internal scrolling with sticky location/Back
  and reachable equipment/Stop controls. The browser's 1.5 device scaling was compensated and DOM
  dimensions checked. [Review gallery](../artifacts/a01-ui-review/REVIEW.md) contains saved captures.
- `npm run check` passed: formatting, lint, TypeScript, **81 tests**, and production build. Four new
  UI tests cover focus/selection, stale inventory, active-state error recovery, and initial loading
  failure. Existing backend acceptance tests remain passing; this is not the final MVP pass.
- Candidate SHA-256 fingerprints: `FishingPanel.tsx`
  `311017615ff63676b5b424242970296248c991cbc573471267500d88b18716fb`;
  `LocationsPanel.tsx` `3a62a6586bf33cd539df3d58e4021e7e0c9a255108b6e9d167c7247a13629d34`;
  `styles.css` `ccc47b4eda20f901a6202f7f7b5b2c54ce793687697ac885491215dccdcacdff`.
  These identify the review candidate, not an owner-approved revision. F03's earlier approval stays intact.

### A01 functional implementation handoff — 2026-09-23

- The F02/F03 `MVP_PASSED` gate was verified and only A01 was selected. The existing New Harbor →
  Harbor District → Fishing Pier hosts the activity; no other stage was started.
- Server-owned Fishing v1 uses the configured 60-second attempts, rod/condition success formula,
  bait species tables, and ordinary-biased weight ranges. SQLite persists session results, attempt
  traces, stop events, and atomic bait/catch mutations. Each species uses one carried stack. Navigation,
  explicit stop/logout, liveness timeout, and restart stop without offline catch-up.
- The Pier context implements local Preparation, carried rod/bait pickers, a static Possible Catches
  area, and an active panel with server-confirmed values. Supplied item art is installed; the approved
  daytime Pier scene and world/HUD shell remain in place. UI refinement and owner review are pending.
- Nonproduction Fishing Debug Console and inventory testing tool require a server allowlisted account
  (`FRONTIER_ADMIN_USERNAMES`). Normal accounts receive no debug payload or controls; production
  admin routes are absent. Inventory mutations and forced attempts use idempotency keys. A01 makes
  no Character XP or Knowledge Point mutation and includes no NPC selling, regional travel, or Coast Pier.
- `npm run check` passed on 2026-09-23: formatting, lint, typecheck, 75 automated tests, and the
  production build. Acceptance coverage includes both rods across all configured
  conditions, each bait/species, capacity outcomes, stale supplies, departure, liveness/restart,
  idempotency, and direct authorization. This is an implementation handoff, not final MVP verification
  or visual approval.
- The existing local SQLite database exposed an A01 startup migration gap: older Fishing tables lacked
  `request_key`. Schema initialization now adds the missing columns before their indexes. The retained
  database starts successfully, both the API and Vite proxy return health `200`, and an upgrade test
  preserves preexisting audit rows. A01 remains at the same UI design handoff status.
- The owner-required Fishing testing entry point is now a dedicated **Fishing test tools** drawer,
  labeled **DEV / ADMIN** in the top navigation only after the allowlisted server access check.
  The ignored local `.env` authorizes the existing `admin` and `frontier-dev` accounts. The full
  guarded HTTP action was verified against an isolated SQLite database: both rods and all three
  baits appeared in `/api/inventory` as carried items and remained after database reopen.
  Anonymous, ordinary authenticated, and production access denials are covered. `npm run check`
  passed on 2026-09-23 with 77 tests, formatting, lint, typecheck, and production build. The local
  API and Vite proxy health checks returned `200`. UI refinement and owner visual approval remain
  pending.

### Goals

- F01 is complete: account registration/login/logout, opaque sessions, one persistent character per
  account, authoritative sidebar state, and the polished account experience passed MVP verification.
  F03's approved repair and final verification are complete. F04, F05, F06, and S01 remain eligible
  for separate selection. A01 v1 was subsequently selected and reached its implementation handoff.
- F02 implementation adds authoritative item stacks/instances, ten carried slots, New Harbor locker
  gating, equipment toggling, consumable healing, starter provisions, persistence, and functional
  inventory controls. Its UI refinement and final verification are recorded complete; reuse them.
- F03 adds the New Harbor city hierarchy (Harbor, Market, Industrial, Residential, City Centre,
  Transit Hub, and Outskirts), representative places, persistent current location, first-visit discovery, pins,
  and server-validated connected/quick routes. Static definitions support optional approved artwork
  and future HTML/SVG hotspot overlays without embedding interactions in images. The functional
  Places panel has an earlier revised UI/art pass on record. The approved repair provides an
  aligned seven-region city overlay, click selection with explicit entry, a fixed
  world/HUD/context shell, and a modal inventory drawer. The current
  shell uses proportional cover scene geometry, compact overlays and command navigation, a
  denser character HUD, and a dark contextual panel. All seven districts/zones now have the newly
  supplied 2560×1440 scene images. Fishing Pier now has the approved daytime place scene. Harbor
  and Industrial retain point controls; city/district views retain named routes. Entered places
  keep a parent Back action without a sibling-destination list. Quick Travel now opens a separate
  modal drawer instead of occupying the contextual panel. The canonical city image and aligned
  cutouts remain installed and unchanged. It does not implement travel or activities.
- Owner review candidate `cb28a156bf7e` covers `server/locations.ts`, `src/App.tsx`,
  `src/components/LocationsPanel.tsx`, `src/components/locationArtwork.ts`, `src/styles.css`,
  and all nineteen production WebP assets in `src/assets/locations/`, sorted by path. Each path
  and newline precedes its file bytes in the SHA-256 input. Earlier candidates remain recorded below.
- Current browser review covered the simplified Pier at 1366×768, 1440×900, 1920×1080, and
  320×640 without document overflow. The Quick Travel drawer was checked at 1440×900 and 320×640;
  pinned quick navigation, modal Escape/Back dismissal, focus return, and pin restoration passed.
  The preceding Harbor, city, and inventory captures remain in the earlier review pack. The owner
  approved this candidate on 2026-09-23; final verification passed the same day.

### Risks / unresolved questions

- No essential F03 product decision or approval gate remains. Later stages require separate selection.
- F04 must separate carried access from locker access before regional travel: current GET inventory
  rejects the entire response outside New Harbor. This is not fixed by F03's drawer.
- P01 will choose its focused property renderer later; Phaser is a candidate only. This decision
  does not block F03. Property uses separate isometric objects, while city scenes stay static.

- Node 24 currently emits an experimental-feature warning for its built-in SQLite module; the API is isolated behind `server/database.ts` so it can be replaced without changing game contracts if needed.

### Test accounts / seed data

- `npm run reset` and `npm run seed` provision the idempotent local development account
  `frontier-dev` with password `frontier-dev` and character `Avery Vale`.

### Handoff notes

#### 2026-09-23 A01 v1 dependency correction — no implementation

- The owner revised A01 v1's prerequisites to **F02 and F03 only**, both `MVP_PASSED`; F01 is
  transitive through those stages. A01 is therefore **`READY`**, not selected or started. F04/F05/F06
  remain separate `READY` stages. All completed statuses and the current selected F03 stay unchanged.
- A01 uses the existing New Harbor → Harbor District → Fishing Pier. F05-dependent Character XP
  rewards, Knowledge Points, fishing Knowledge bonuses, NPC fish selling, regional travel, and a
  Coast Fishing Pier remain deferred until separately scoped integration after the relevant stages pass.
- This correction supersedes the earlier A01 blocked gate below and older blocked/conditional-XP
  guidance in supporting documents. Future A01 handoffs must verify only F02/F03, not F04/F05/F06.
- Only the checklist, project state, and conflicting game-design text changed. No code, app, tests,
  builds, artwork, or new stage work; historical approvals and verification records are preserved.

#### 2026-09-23 A01 v1 documentation reconciliation — no implementation

Historical record: its dependency gate is superseded by the correction immediately above.

- Reconciled the owner-approved Fishing v1 lock in [GAME_DESIGN.md](GAME_DESIGN.md#15-fishing),
  with matching A01 checklist, planned architecture/API requirements, and panel/component guidance.
  The initial location is the existing New Harbor → Harbor District → Fishing Pier. No second Coast
  pier, optional events, fish discovery/journal, Knowledge fishing bonuses, or other deferred systems
  belong to this slice. Authorized Fishing/inventory testing tools are specified, not implemented.
- Dependency audit: F02 and F03 are `MVP_PASSED`; F04, F05, and F06 are `READY`, not passed.
  A01 therefore remains **`BLOCKED`** on the unchanged dependency list. F04's Coast travel work
  remains separate. Do not bypass it or begin another dependency stage from the A01 handoff.
- F03 remains the current selected/completed stage. A01 has no implementation, runtime verification,
  or rendered visual approval from this pass. Owner approval covers the specification only; the
  recorded F03 approval/revision and all historical test evidence below are unchanged.
- Scope was Markdown reconciliation only: no code, assets, item data, schema, or completed behavior
  changed; no app, build, or tests were run and no artwork was generated. A future implementation
  handoff must first recheck that every dependency is `MVP_PASSED`, then explicitly select only A01.

#### 2026-09-23 F03 owner approval and final verification — candidate `cb28a156bf7e`

- The owner explicitly approved F03 on 2026-09-23 after review of the latest Pier simplification.
  The approved runtime fingerprint is unchanged from the presented candidate.
- `npm run check` passed on the approved revision: formatting, lint, typecheck, all 59 tests, and
  production build. The F03 API integration tests verify the New Harbor → Harbor → Pier route,
  one-time discovery, pin/quick navigation, restart and relogin persistence, route rejection,
  competing transitions, the five-pin limit, and account isolation. UI interaction tests and the
  captured desktop/narrow review evidence cover the presentation and drawer behavior.
- F03 is `MVP_PASSED`. F04, F06, and S01 now meet their documented dependencies and are `READY`;
  no subsequent stage has been selected or started.

#### 2026-09-23 F03 Pier context simplification — candidate `cb28a156bf7e`

- Removed the persistent Your places block from the right panel and removed sibling destinations
  from entered place views. Fishing Pier retains its approved scene, authoritative location,
  parent Back action, description, and unavailable fishing notice.
- Quick Travel is now an on-demand modal drawer from top navigation. It retains pinned and other
  discovered shortcuts, unpin controls, the server-derived five-pin count, and validated travel.
  Browser Back and Escape dismiss it; successful travel closes it and returns focus to the opener.
- `artifacts/f03-pier-simplified/` contains Pier captures rendered at 1366×768, 1440×900,
  1920×1080, and 320×640, plus Quick Travel at 1440×900 and 320×640. The browser capture
  service clipped a few vertical pixels from the 1440 capture and downsampled the complete
  1920×1080 view to 1280×720; the downsampled image is labeled in its filename. Measured
  document dimensions matched each CSS viewport without overflow.
  `npm run check` passed on 2026-09-23: formatting, lint, typecheck, 59 tests, and production
  build. Owner visual approval and final verification remain pending.

#### 2026-09-23 F03 Fishing Pier presentation — candidate `bbfdb5db8c2a`

- Installed the owner-supplied daytime Pier scene. Place-specific artwork takes precedence over
  the parent scene, while other places keep the established fallback. Fishing remains unavailable;
  no A01 activity state, rewards, or API was added.
- Hover/focus now changes scene emphasis only. Click/keyboard activation selects a destination in
  the right panel, and explicit Enter uses the existing validated route. Added consistent coded
  navigation/route icons, clearer HUD type, distinct preview styling, dark inventory presentation,
  and a Quick Travel entry. Entered districts, zones, and places can be pinned under the existing
  atomic five-pin server limit; New Harbor itself remains ineligible.
- `artifacts/f03-pier-refinement/` contains Pier captures at all four acceptance sizes, city and
  Harbor at 1440×900, and inventory at 1366×768. Browser DOM measurements matched each requested
  viewport with no document overflow. The 320px context and saved-place panels scroll internally.
  `npm run check` passed on 2026-09-23: formatting, lint, typecheck, 59 tests, and production build.
  These are implementation evidence; owner visual approval and final verification remain pending.

#### 2026-09-22 F03 supplied location scenes — candidate `68abedb67736`

- Installed the seven owner-supplied 2560×1440 illustrations for Harbor, Market, Industrial,
  Residential, City Centre, Transit Hub (train station), and Outskirts. Their existing location IDs,
  server routes, city master, and aligned city cutouts remain intact. Retuned the Harbor and
  Industrial point labels to the new scenes; the other scenes retain named destination controls.
- Browser navigation loaded every scene and its caption at 1440×900, with the Back control and all
  existing child routes available. At 1366×768, 1440×900, 1920×1080, and 320×640, measured
  viewport and document dimensions matched without document overflow. Full-composition browser
  captures are in `artifacts/f03-location-scenes/`; desktop captures are downsampled by the browser
  capture service. The 320×640 Harbor and Outskirts captures include visible Back controls.
- `npm run check` passed on 2026-09-22: formatting, lint, typecheck, 58 tests, and production build.
  The seven-scene rendering and named-route test was added. Owner visual approval for this exact
  candidate remains **PENDING**; final verification remains pending as a separate gate.

#### 2026-09-22 F03 visible Back control — candidate `6892ec83ede6`

- Owner reported that the route back from the current location was not apparent. Moved the
  existing parent navigation action into the persistent current-location block and styled it as
  a full-width `Back to [parent]` button. It stays tied to the authoritative current location while
  another destination is previewed; no route contract or backend mechanic changed.
- Browser checks completed Fishing Pier → Harbor District → New Harbor using the new control.
  The button was visible within the context panel at 1366x768 and 320x640, with no document
  overflow. Captures: `artifacts/f03-navigation-repair/back-district-1366x768.jpg` and
  `artifacts/f03-navigation-repair/back-place-320x640.jpg`. Focused tests cover the same return
  sequence and preview independence. `npm run check` passed (formatting, lint, typecheck,
  57 tests, production build). Owner visual approval remains **PENDING**.

#### 2026-09-22 F03 navigation and pin repair — candidate `1e148a1c5908`

- Replaced fit/fill mode with automatic proportional cover and removed the breadcrumb strip. The
  current-location heading remains the navigation focus target; explicit parent returns and named
  routes remain available under artwork crop. Removed full-canvas cutout/focus filters that could
  paint a rectangular artifact; region-shaped fill/stroke and named-control focus remain.
- The pin action now stays with the actual current location while previewing, with eligibility copy
  and a real Pinned n/5 count. A SQLite write transaction rejects a sixth distinct pin with
  `PIN_LIMIT_REACHED`, permits idempotent repeats and unpinning, and retains legacy pins above five.
- Captures in `artifacts/f03-navigation-repair/` include `city-{1366x768,1440x900,1920x1080,320x640}.jpg`,
  `district-hover-selection-focus-1440x900.jpg`, `pinned-5-of-5-1440x900.jpg`,
  `pin-limit-1440x900.jpg`, `outskirts-selected-320x640.jpg`, and Harbor, Industrial, and
  Outskirts fallback views. Browser measurements found exact viewport/document sizes, no desktop
  overflow, seven region paths, no fit toggle or breadcrumbs, and 842/916/1396px map widths at
  the desktop sizes. All seven regions accepted keyboard selection without moving the character.
  The test account's temporary pins and location were restored after capture.
- `npm run check` passed on 2026-09-22: formatting, lint, typecheck, 56 tests, and production build.
  Direct API tests cover concurrent additions, idempotency, legacy saves, capacity restoration, and
  restart/relogin persistence. Owner visual approval for this candidate is **PENDING**; F03 remains
  `READY_FOR_SOL_PASS_TEST` until review and final verification of the approved result.

#### 2026-09-22 F03 canonical city artwork — candidate `27db5715f2d4`

- Installed the approved 2560×1440 city master and seven same-canvas transparent production cutouts.
  Opaque cutout pixels match the base image to under one RGB level mean absolute difference.
  Centralized simplified SVG hit geometry and coded label anchors in `locationArtwork.ts`; alpha is
  never the only click/focus target.
- Kept the existing `civic-residential` stable ID for Residential District and `newcomer-housing`.
  Added `city-centre` with Civic Hall as its child. Added `transit-hub` and `outskirts` as enterable
  city zones with future functionality described but no regional travel. No database migration was
  required; existing discoveries, pins, and current location IDs remain valid.
- Live browser checks at 1366x768, 1440x900, and 1920x1080 found no document overflow and zero
  rendered base/cutout rectangle delta after resize. Fill/fit also retained exact alignment. Each
  of seven locations passed hover preview, keyboard focus, selection without navigation, explicit
  Enter, confirmed arrival, and return. The 320x640 fallback retained all route cards. No browser
  console errors were reported.
- `npm run check` passed (formatting, lint, typecheck, 53 tests, production build). The owner has
  accepted the general shell direction, but has not approved this new city artwork candidate.
  Keep F03 non-passed until that exact visual result is approved and final verification is run.

#### 2026-09-22 F03 bounded shell refinement — candidate `cb96c909602f`

- New city, selected Harbor, and open-inventory screenshots at all four acceptance sizes are in
  `artifacts/f03-review/` (for example `city-1366x768.png`, `city-1440x900.png`,
  `city-1920x1080.png`, `city-320x640.png`, and corresponding `selected-harbor-*` and
  `inventory-*` files). Harbor, Industrial, Market fallback, and Civic fallback captures at
  1440x900 are also recorded. These captures supersede the earlier presentation candidate for
  owner review; the older check history below is retained.
- The image and overlays now share a measured proportional fill/fit transform. At 1366x768,
  1440x900, and 1920x1080, the 56px top HUD, 224px left HUD, and 300px right panel leave a
  continuous world area of 842px, 916px, and 1396px respectively. Document width and height
  matched each viewport in browser measurements. All four city districts remained visible and
  named routes remained available under crop and missing-image fallback.
- The redundant location strip and scene header were replaced with compact world overlays. The
  command bar, character summary, dark context rows, saved-place sections, and drawer surface
  were inspected at desktop and 320x640. A browser check found and fixed focus return after
  browser Back closes a drawer.
- `npm run check` passed for this revision on 2026-09-22 (formatting, lint, typecheck, 51 tests,
  build). `artifacts/f03-review/verify.mjs` passed fill/fit, resize geometry, keyboard district
  selection, touch selection, reduced motion, failed navigation preserving state, drawer Back/focus
  and selection preservation, pin/refresh persistence, one-action pinned navigation, and missing
  imagery route fallback. The browser review used a separate local review account and did not
  reset player data. Owner visual approval remains `PENDING`; final verification of an approved
  presentation remains separate.

#### 2026-09-22 F03 presentation repair

- Added a fixed desktop game viewport with 224px HUD, flexible map, and 300px contextual panel.
  Lists scroll inside the panel. No ordinary desktop document scroll was observed at the three
  acceptance sizes.
- City polygons and HTML labels preview/select four server-defined districts; explicit entry uses
  the existing validated API. District places use named scene controls, and missing artwork retains
  route controls. Failed navigation retains selection and confirmed location.
- Inventory and Account are modal drawers over the mounted world. Inventory state, current location,
  and selection survive drawer dismissal. Direct `#inventory` entry, browser Back, Escape, close
  control, and focus return were checked in the browser.
- `npm run check` passed on 2026-09-22: formatting, ESLint, typecheck, 51 tests, and production
  build. Browser checks covered city, Harbor, Industrial, Market/Civic fallback, narrow tap
  selection, route entry, drawer behavior, and the desktop/narrow captures. Owner appearance
  approval is still pending; these checks do not close F03.

#### 2026-09-22 documentation alignment

- Current target: `docs/UI_TARGET.md`; corrected design system, gameplay clarifications, stage plan,
  agent workflow, and art/architecture/API boundaries. Only Markdown changed.
- No code/assets changed, no app/build/test execution, no generated artwork, and no fresh runtime
  or visual verification. All pre-existing completed checks and stage dependencies are preserved.
- At the time of this documentation alignment, the next task was the bounded F03 repair. That
  repair is now recorded above; the separate owner approval field remains pending.

#### Recorded earlier F03 handoff, not certification of the new target

The following records the earlier implementation and its reported checks. In particular, separate
Pack & storage hash surfaces and the earlier visual review are historical facts, not the target.

- F03 revised UI/art pass replaces the labeled reference derivatives with newly generated clean
  production environments: `src/assets/locations/new-harbor.webp`, `harbor.webp`, and
  `industrial.webp`. Source references remain unchanged and are not runtime imports. Prompts and
  provenance are recorded in the asset directory README. All names and interaction states are HTML.
- Desktop World now fits a viewport with a persistent character sidebar, central scene, and
  contextual routes/place details plus saved places. World, Pack & storage, and Account are
  hash-selected surfaces. Mobile uses compact character information and complete route buttons.
- Existing APIs, database models, discovery, pins, navigation validation, and inventory behavior
  are preserved. Market/Civic use the clean city overview. Industrial's only interactive destinations
  remain Refinery, Workshops, and Warehouse Yard.
- Verification: formatting, lint, typecheck, 51 tests, and production build pass. Browser review
  covered 1440×900 desktop fit, clean city/Harbor imagery, keyboard navigation, mobile fallback,
  inventory access and browser back. Final verification must cover the forthcoming repaired and owner-approved presentation.
- Previous F03 MVP approval is superseded by this requested correction; dependent stages remain
  blocked until repair, explicit owner visual approval, and renewed F03 verification. No later stage was started.

#### Recorded F02 and earlier handoffs

- F02 Astra: selectable slot grid, server-reported capacity and empty slots, equipped labels,
  item metadata panel, healing preview/feedback, quantity transfers, local locker presentation,
  and loading/empty/disabled/error/success states. Uses existing design tokens and APIs.
- F02 verification: `npm run check` passed with all 23 existing tests plus six new UI tests
  (29 total). Browser checks covered equip/unequip, both transfer directions, full-health
  restrictions, actual 25 HP healing and sidebar update, and desktop/narrow layouts.
- Final F02 Sol pass fixed the whole-stack merge duplication bug by deleting a fully merged source
  row in the same transaction that increments its destination. Compatible merges can enter a full
  pack without occupying a new slot; incompatible/new instances still respect the ten-slot limit.
- F02 final verification passed all 37 automated tests plus formatting, lint, typecheck, and the
  production build. Coverage includes invalid quantities, capacity, split/whole merges, conservation
  under repeated requests and refresh, incompatible items, last-item consumption, equipment state,
  persistence, remote locker rejection, server authority, and separate-account isolation.
- The existing GET inventory contract rejects the entire request outside New Harbor. Astra displays
  that server message and offers refresh; it does not introduce remote access or new endpoints.
- Local browser review character: `f02-ui-review` / `frontier-test-ui` (Rowan Vale); review operations
  used this account only.

- F01 Astra pass: refined account forms with field guidance, pending controls, visible success/error
  announcements, sign-out feedback, and missing-character recovery copy. Sidebar now has initials,
  wrapping identity, prominent credits, HP meter, total XP, and the actual active status.
- Preserved backend, session cookies, SQLite models, validation, API contracts, and all existing tests.
  Browser inspection covered seeded login/logout, desktop layout, and 375px layout. Final Sol should
  run the full MVP acceptance sequence; subsequent stages remain blocked.
- Astra verification: `npm run check` passed (formatting, lint, typecheck, all 14 existing tests,
  and production build). No backend files or test assumptions were changed during this pass.
- Final Sol verification passed: `npm run check`, `npm run reset`, and `npm run seed`; 18 automated
  tests cover creation, login/logout, user isolation, restart persistence, expired sessions,
  duplicate-account rejection, and the production restriction on the development state endpoint.

- React/Vite shell provides a header, character sidebar, main content, responsive fallback, and live server status. Preserve the `/api/health` contract and server-authoritative architecture.
- Astra established the shell palette, typography, spacing, controls, badges, inventory placeholders, loading/empty/disabled/error/success states, responsive layouts, and keyboard focus. See `docs/DESIGN_SYSTEM.md`.
- Connection checking now has a ten-second client timeout and retry action; API and persistence contracts are unchanged.
- Astra verification: `npm run check` passed, with desktop and narrow browser inspection.
- `npm run check`, `npm run reset`, `npm run seed`, and production runtime verification pass.
- Final Sol verification passed from a clean `npm ci`: formatting, ESLint, typecheck, 11 tests,
  production build, development boot, production HTTP/API checks, database initialization,
  environment rejection, keyboard navigation, desktop rendering, and responsive CSS review.
- Sol hardened health-response validation, static-file handling, connection announcements, and the
  cross-platform development launcher.
- F01 has a functional registration/login form, session-aware character sidebar, sign-out control,
  and local-development state editor. Astra should refine identity, HP, XP, credits, location, status,
  empty/login, loading, error, and success states without changing APIs or game rules.
- F01 Sol verification passed: `npm run check`, `npm run reset`, `npm run seed`, and server/API tests
  covering persistence, session behavior, validation, and separate-account isolation.
