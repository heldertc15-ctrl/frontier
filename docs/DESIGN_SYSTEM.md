# Frontier design system

The presentation source of truth is [UI_TARGET.md](UI_TARGET.md). These are component rules for
that target. F00-F02 remain completed foundations. The F03 repair applies the viewport shell and
drawer pattern in `src/styles.css`; the owner approved revision `cb28a156bf7e` on 2026-09-23.

## Foundations

- System sans-serif stack (Segoe UI first); body 14px with 1.55 line height.
- Panel headings 16px; supporting copy 12px. Keep location headings compact so the world dominates.
- Use 4px spacing increments, generally 10-12px within panels and 12-16px between meaningful groups.
- Authenticated-shell tokens: charcoal canvas `#18232b`, slate HUD/context `#23343e`, inset
  `#314753`, primary text `#eef5f6`, muted text `#b9cbd1`, border `#405560`, and restrained
  selection accent `#70b9ca`. Inventory and Account drawers retain lighter local surfaces with
  dark text and their own muted/border tokens.
  Verify contrast in use, particularly text over imagery; use opaque backing for essential copy.
- Natural artwork supplies visual richness. No fantasy ornament, heavy decorative shadows,
  financial-dashboard styling, neon overload, or fabricated player statistics.
  Use a restrained warm accent for earned catch feedback, not every action.
- Panels use subtle 1px borders and modest radii; route rows use separators and selection backing
  instead of individual cards. Controls use 5px radii. Retain established component
  behavior without preserving the rejected sage/cream website shell.

## Shell and responsive layout

The authenticated shell fills the browser content viewport: compact top navigation, persistent
left character HUD, dominant world scene, and right contextual panel. No fixed article-width cap,
large welcome or connection card, or stacked inventory section. Use the dimensions and overflow
rules in UI_TARGET.md. The central world does not scroll as a document; lists and drawers can
scroll internally. Do not clip controls to achieve this.

On narrow screens, place a compact character summary above a proportionate scene and one full-width
bounded activity/context panel with complete named routes and explicit enter controls. Gear choices
use a modal sheet/dialog. Favor one clear content scroll area rather than stacking desktop sidebars.
Minimum width is 320px; also review at 390px and preserve reachability at zoom/short heights.
Preserve semantic header, navigation, aside, main, sections, and heading order. The signed-out
account form may use a bounded page and document scrolling.

## Components and accessibility

- `.button.primary` identifies the main action; `.button.secondary` handles recovery or a secondary
  action. Existing 40px controls may remain; target at least 44px for touch. Disabled controls have
  readable text and a visible reason.
- `.input` has an explicit label, visible focus, and an invalid border via `aria-invalid`, paired
  with descriptive error text. Pending submissions prevent duplicate mutations.
- `.panel`, `.panel-heading`, and `.badge` remain useful grouping/status primitives. Compact headers
  must distinguish a previewed destination from the player's actual location.
- `.item-slot` retains visible item name, quantity, and equipped/category information; icons are
  decorative. F00's six decorative slots never define capacity. Actual capacity comes from the server.
- Use a visible high-contrast focus outline that contrasts with both panel types. `aria-current` denotes
  the actual current location/navigation context; `aria-pressed` may denote selected items/regions.
  Text and shape supplement color. Keep the skip link targeting the focusable main area.
- Drawers follow UI_TARGET.md's modal focus, Escape/close, return-focus, browser Back, and pending
  mutation rules. No draggable desktop-window system is required.

## States and feedback

The P01-PLACEMENT room uses the shared world stage and context panel. The context lists carried and
placed furniture instances, shows the candidate cell, rotation and text reason for occupied or
out-of-bounds footprints, and offers explicit Rotate, Place, Cancel and Move controls. Pixi floor
graphics and facing markers are functional placeholders. A modal drawer suspends floor input and
preserves the draft. Saving, recovery and empty states use text and accessible controls.
The active preview leads the context, with its rotated dimensions, snapped cell, one-tile nudge
controls and a text validation reason. The Pixi ghost has a translucent directional block over
outlined footprint cells. On narrow screens, a floor-adjacent action strip keeps Rotate, Place
and Cancel visible during touch placement; the full context remains below the scene.

Loading, empty, disabled, selected, pending, success, and error states must be explicit. Unknown
character values use a readable unavailable label, never fabricated values. Unimplemented actions
remain disabled with an explanation. Do not add unbuilt reference-image navigation as fake features.

Connection checking is a compact status; no persistent success banner occupies the authenticated
world. Errors offer retry without hiding gameplay controls. Existing ten-second request timeouts,
cleanup against obsolete responses, and the fatal error boundary's reload action remain.
Use live announcements for actual arrivals, first discoveries, inventory outcomes, and errors.
Reduced motion disables pulses/lifts and animated camera transitions. Missing artwork retains
complete named route access in the context panel.

For the bounded room editor, use exact-footprint diagrams as picker affordances, never as a claim
of finished object artwork. Preserve readable selected/invalid states, dark text on the pale primary
placement action, and compact keyboard keycaps. Inventory and placed groups use names and counts;
instance IDs stay internal. The world floor remains spatially distinct from the surrounding panel.

## F01 account and character UI

Signed-out account forms use a single column on a bounded surface (540px maximum), persistent labels,
and field hints linked through `aria-describedby`. Pending submissions name the action in progress.
Success/error messages use status/alert announcements; relevant errors remain after authentication.
Authenticated account access uses the shared panel pattern and returns to the preserved world.

Character initials are decorative. Long names wrap; numeric values use tabular figures. HP includes
an accessible progress element with numeric value and maximum. XP shows its real total without an
invented threshold. Development controls remain secondary and limited to development client builds.

## F02 inventory components in the F03 drawer

F02's verified possession logic is retained. F03 presents Inventory & storage in a HUD/navigation modal
drawer as specified in UI_TARGET.md. Slots, a capacity meter, item details, and locally accessible
locker controls remain; opening inventory keeps the world mounted underneath.

Slots show icon, name, one quantity badge, and healing/category/equipped text. Do not repeat the
quantity in the visible name; accessible names retain the item name and quantity. Empty slots reflect server
capacity. Selection uses a clear border plus `aria-pressed`; equipment also has an explicit label.
Native title tooltips supplement visible information, never conceal required details.
Fish stack cards place their total recorded weight at the lower right as a number with `kg`, with
no label. Sum the specimens in that stack; if any weight is missing, show `— kg` with an accessible
unknown-weight description. Keep the Trophy cue at lower left and the total in the drag preview.
Drag feedback lifts a full copy of the item card while the source remains visibly subdued. Carried
and locker grids highlight an occupied swap target or an open position; ordinary locker spaces extend
only when storage needs more positions, while authorized admins see 50 fixed spaces. The empty locker
message uses the drawer's dark palette and remains a full-card drop target;
cross-container drops transfer the complete stack and use the same pending/error feedback as the
storage action.
Matching stackable cards highlight a merge target. Dropping onto one fills that chosen target to
its cap, leaving overflow in the dragged stack; this works across containers as well. Show pending,
success, and error feedback from the server response.

Item selection opens a compact, dark framed game-style detail card: small art beside the name,
readable item category and location, short flavor description, and actual use effects. Fish display
Fish and bait displays Bait, never the internal Tool category. Omit the quantity/stack-size facts
table, oversized icon block, repeated status badges, and instructional section headings. Keep Use,
Equip, and fish inspection actions relevant to that item. Store…/Take… reveal transfer controls only on
request, with a labeled quantity input, All button and explicit submit. Selecting another item or
stack replaces the previous inspection and closes its transfer controls. A fish stack opens its own
collection immediately in one click; a non-fish item opens its compact summary.
Disabled actions explain full health, capacity, equipped
restrictions, or items that must be carried. HP and inventory update from server responses, not
optimistic mutations. Loading/errors are independent of sign-in and offer Refresh items. Repeat
actions are disabled while pending; results and errors appear beside the inventory with live feedback.

Within the drawer, details sit beside the grid only when space permits; otherwise they stack and
scroll internally. Selecting an item provides a keyboard-accessible path to details; do not lose
focus outside the drawer. Empty inventory/locker, missing selection, and signed-out states explain the
next useful action. Storage contents are cleared/hidden when location authorization is lost.

Selecting any fish stack immediately opens its catch collection in the existing inspector, replacing
the previous stack's view and resetting its list scroll. No second inspection button is required.
Show the species name,
one stack count, an illustrated selected fish, and descending selectable weight rows with stable ties.
Select the heaviest fish initially; retain selection by specimen ID on refresh. Earned Trophy fish
use a shared gold cup badge and warm art backing, with no invented records or rewards. Fish stack
cards in carried inventory and the locker show the shared Trophy badge and a restrained
gold border when any current specimen is Trophy; the complete card drag preview carries the same cue.
Show each row's
weight once; the selected fish alone has the compact green-yellow-orange-red range bar, a visible
position arrow, labeled endpoints, and an accessible text description. Back returns to item actions,
where Inspect fish reopens the collection; Close returns focus to the selected item tile.
The inspector is a single non-sticky view inside the scrolling inventory drawer and moves above
the grid on narrow screens; switching stacks replaces it without leaving painted copies.
Unknown historical/admin weights say so
instead of displaying a made-up size. Refresh an open list as inventory changes while preserving
the selected specimen when it remains in that stack. The drawer never stops Fishing.
Display known fish weights and range endpoints with three decimals when they round below 10 kg
at that precision; use two when they reach 10 kg or more.

Carried items are intended to remain accessible everywhere. The current entire-response New Harbor
GET gate remains a known F04 correction, not an F03 backend change. Never display cached locker or
property contents remotely to work around it; see [API_CONTRACTS.md](API_CONTRACTS.md).

## F03 world, preview, and places

Keep the authoritative current-location heading, pin action, and Back to parent control in the
world-stage header. The Back control remains tied to that location when another destination is
previewed in the context panel. The HUD omits duplicate location text. Actual arrivals
update these only from the server response; first visits receive discovery feedback. Preview and
selection are local UI state, with a separately labeled enter action as defined in UI_TARGET.md.

`locationArtwork.ts` pairs the canonical city image with seven aligned, transparent full-canvas
cutouts, SVG area paths, and coded labels. Harbor and Industrial destinations retain point anchors.
Hover/focus emphasizes the cutout without changing context; activation selects, and explicit Enter
navigates. Selected cutouts remain emphasized. Named route controls remain available when artwork
or hotspot geometry is absent. The measured viewport uses one proportional contain transform for
base art, region paths, labels, and cutouts. Fit the whole 16:9 scene with a dark surround; derive
overlays from the rendered image bounds and preserve that composition across condition variants.

Production images in `src/assets/locations/` must contain no baked text, labels, logos, or UI. Art
references and continuity rules live in `docs/art/frontier_f03_art_package/`. All seven districts
and zones have separate supplied scenes and a clear current-location heading. Fishing Pier uses its approved
time/sea scene; Fishing Store uses its supplied Dawn/Day/Dusk/Night interior matching the effective
HUD phase beside the buyer context, without Harbor map labels. Phase changes crossfade after the
new image loads, honoring reduced motion and preserving the buyer's selection. Other places use
their parent scene until approved artwork is supplied. Industrial's
existing navigable destinations remain Refinery, Workshops, and Warehouse Yard. Do not introduce
specialist routes because the illustration depicts their buildings.

Use restrained cutout opacity and region-shaped tint/outline without full-canvas filters. Artwork
and geometry are versioned together; preserve alignment under contain scaling and resize.

The Pier's world-stage header keeps current location and Back to Harbor District reachable beside
the A01 Fishing context, including its active state.
Place views do not repeat sibling destinations. Quick Travel opens from
top navigation as a modal drawer; the right context does not contain a persistent saved-places block.
The drawer shows only pinned shortcuts, labels the current destination, shows the real Pinned n/5
count (including legacy saves above five), and keeps explicit quick-navigation and unpin controls.
Entered districts, zones, and places can be pinned. Empty pins explain how to save a location.
Pending mutations, loading, errors, uncertain timeouts, and refresh recovery retain
text feedback without returning to page-length world scrolling.

## A01 Fishing components

At the Fishing Store, the right context hosts the dockside buyer's portrait and short dialogue.
Compact stack buttons show fish art, quantity, total quoted credits, and any Trophy cue. The first
stack is appraised initially; choosing another replaces the single illustrated appraisal and its
unsubmitted confirmation. Specimen toggles show weight, quoted credits, and Trophy status with
`aria-pressed`; All fish and Ordinary only offer quick selection. All specimens in a newly chosen
stack start selected. The showcase highlights selected Trophies and shows the server's credits/kg
rate when one Trophy is selected. These choices never calculate new prices or grant extra rewards.

Keep the quoted total and Review offer action anchored below the scrolling catch content. Review
opens an inline confirmation showing the selected count, included Trophies, and credits to receive.
Focus its heading; Keep fish or Escape returns focus to Review offer without selling. A confirmed
sale locks selection and repeat submission while pending. Success focuses a Deal made receipt with
the actual earned credits, sold fish, and Trophy count; Trade more fish returns to the remaining
catch. Honor reduced motion for the receipt reveal and retain visible keyboard focus.
Play the bundled cash-register recording, with its recognizable mechanical cha-ching, when a sale
is confirmed by the server, alongside the
receipt. Review, cancellation, pending requests, and failed sales stay silent. A successful retry
may play the cue once when its outcome is first confirmed. Sound is supplemental; unavailable or
blocked audio must never prevent the sale or its visible receipt.

Loading, empty, pending, success, and error states stay in context. Refresh reconciles selected
specimens and invalidates an unsubmitted offer if its fish or total changed. A rejected stale sale
refreshes offers; an uncertain network or server outcome retains its selection and request key for
Retry sale, even if a refresh shows no fish remaining. Prevent changing or canceling that uncertain
intent until it is reconciled. Empty inventory explains how to bring locker fish into the pack and
offers the inventory drawer. The shell, world, server pricing, and sale contracts remain intact.

Follow [GAME_DESIGN.md section 15](GAME_DESIGN.md#15-fishing) for mechanics and
[UI_TARGET.md](UI_TARGET.md#a01-fishing-panel-target) for the in-place panel flow.
A01's owner-authorized handoff sets the following presentation target; rendered verification and
owner visual approval are recorded separately in [PROJECT_STATE.md](PROJECT_STATE.md).
The idle Pier activity view uses the owner's supplied fishing gear cutout as a prominent image in
its dark dockside preview, with the invitation and Prepare tackle action still easy to reach.
Preparation and active Fishing show one compact conditions row (effective phase and sea).
A concise sea outlook uses qualitative staying/changing copy from the committed next state.
Do not show an exact transition time. An override may
mask the scheduled change. Failed or expired boundary refreshes mark the forecast as awaiting
confirmation and offer refresh without resetting equipment or session controls. The sea outlook
is separate from the authoritative attempt-progress ring. Preparation's possible species come from the validated server preview after both
items are selected.

| Incoming state | Staying               | Changing                   |
| -------------- | --------------------- | -------------------------- |
| Calm           | Calm waters holding   | Calm waters ahead          |
| Moderate       | Choppy seas holding   | Moderate seas ahead        |
| Dangerous      | Rough seas persisting | Dangerous seas approaching |

Preparation uses two side-by-side equipment sockets with category, image, readable name, and bait
quantity. The whole socket is one button. Empty sockets use visible muted art and Choose rod/bait;
selected sockets use a border and checkmark, without Select/Selected strips. Names may wrap to two
lines. Open choices are bounded overlays anchored within the desktop viewport, or modal sheets/dialogs
on narrow screens; their lists scroll without moving the conditions or action footer. Use one
readiness message, explain missing/stale supplies, and expose the existing Inventory action when useful.

The owner-directed 2026-09-26 active panel uses a dark translucent blue/slate surface with a subtle
border, rounded corners, white primary text, and muted secondary text. After confirmed Start fishing,
show a small fish icon beside **Fishing…**, then **Your line is in the water. Good luck!**. A prominent
cyan ring with rounded ends and a centered fish silhouette measures the actual attempt clockwise
from empty to full. Place **Waiting for a bite…** and **Each attempt consumes 1 bait.** under the ring.
Keep compact loadout, bait remaining, and conditions; place progress above latest catch/weight and
the current-session species summary with its total. This replaces the earlier ambient-only progress
restriction. Build the reference composition from responsive UI, not an embedded image.

Use the server's fixed attempt timing and server-time anchor, advancing elapsed time with a monotonic
clock. Polling and rerendering must not restart the animation. At the deadline, retain the full ring
and show **Checking for a bite…** until the server confirms a result and any next scheduled cycle.
Reconcile promptly with bounded requests, never a frame-driven polling loop. Unsuccessful and forced
attempts follow the same reconciliation; stale responses cannot rewind the cycle or revive a stopped
session. Errors identify connection uncertainty and preserve confirmed results without simulating
continued cycles. A progressbar has a meaningful accessible name, bounded value, and concise status;
only meaningful state changes are announced. Reduced motion removes decorative animation while
retaining accurate progress values. Use the full-width **Stop Fishing** footer button with a small
stop icon, visible focus, readable contrast, and touch-sized controls.

The latest catch uses an illustrated card with the magnitude-aware kg format. The server's
Trophy flag adds a gold cup badge, warm border and backing, a single brief light sweep, and a polite
Trophy announcement. Reduced motion disables the sweep. Keep the last catch visible through
no-catch results and in the stopped summary, including final-bait resolution. These presentation
distinctions grant no additional reward. Catch updates preserve focus. Start/Stop
remain in a stable footer with sufficient content clearance. The redundant Pier description stays
hidden while Fishing occupies the context. An interruption reason is separate from retained session
results; preparing again dismisses the previous summary without deleting server history. Stop
Fishing swaps the panel footer action for an inline confirmation; it stays in the activity panel,
with the world visible. Cancel and Escape return focus to the Stop button.
During active Fishing, list awarded catches by species with counts and Trophy
count from the saved attempt record below the latest catch. Retain that order after the server
confirms a stop, changing Current session to Session complete. An empty session gets a clear
no-catch message.

Pickers focus the first eligible choice (or Close when empty), mark selected choices in text, and
return focus on selection, Close, or Escape. Preparation and confirmed start/stop transitions focus
their headings; background result updates do not steal focus. Stale supplies explain the disabled
commit action. Failed initial loads do not offer preparation; refresh errors preserve confirmed state.
The context scrolls internally while the world-stage location/Back header remains reachable,
including at 320px width.

- **Preparation:** Prepare tackle opens exactly two labeled equipment slots, Rod and Bait.
  Each opens a compact eligible-item picker using actual carried items and quantities. Reuse item
  presentation primitives without opening the full inventory drawer. Provide loading, no eligible
  items, stale selection, selected, and error states; explain why Start fishing is disabled.
- **Picker input:** use visible names, keyboard/touch selection, clear focus, and bounded scrolling.
  Escape/close dismisses the picker and returns focus to its equipment slot without committing
  Fishing. Pending server actions cannot be duplicated by dismissal or repeated activation.
- **Possible Catches:** use the validated server preview. Undiscovered fish appear as black
  silhouettes labeled `???`; an awarded catch permanently reveals that species for the character.
  Show a discovered fish's conditional share beneath its name. Undiscovered tiles show no percentage;
  their scores remain in the denominator so displayed shares may sum to less than 100%.
  Use a contrasting backing and an accessible Undiscovered fish label without hidden-name disclosure.
  The authorized personal reset returns them to silhouettes. No first-catch reward or journal is added.
- **Commit and active state:** Start fishing submits valid carried selections; reflect
  `FISHING` only after confirmation. In the same context show Fishing…, the authoritative attempt
  ring and status, selected rod, selected bait/quantity, sea state, session catch count,
  latest catch/weight, and Stop Fishing.
  Frontier time and its effective phase live in the shared HUD at every location.
  An optional Reel Pull prompt replaces the waiting message in the central
  progress area, with a five-second draining bar and one compact REEL! button. The message, bar, and
  button pulse gently between cyan and warm gold; reduced motion leaves a static, legible bar. Hide
  the prompt at server expiry. Keep the silhouette/ring and
  ordinary countdown; ignoring a prompt has no penalty. Disable duplicate/pending or disconnected
  activation, show errors in context, and confirm applied actions from the server. Do not steal
  focus for background prompts. Play the supplied Reel Pull recording once for a newly observed
  offer, aligned to the remaining window and stopped on use/expiry; a restored prompt on refresh
  stays silent. Clicking REEL! resolves the current attempt immediately and shows the confirmed
  result and next attempt or stop state. Blocked audio never affects the visual prompt. No
  Manual/Auto, energy meter, overall
  catch odds, or raw RNG labels.
  A newly confirmed fish catch plays the supplied water-exit cue. At the Pier, place separate
  Reel event sound and Fish caught sound checkboxes in the left Character sidebar; show the same
  settings in Account where the sidebar collapses. Both default on, save per character in this
  browser, use equal playback gain, and leave visual fishing feedback available when muted.
- **Stopping and feedback:** no close/collapse control exists for the active Fishing context. Keep
  location/Back and Stop Fishing reachable on desktop and narrow screens. Ordinary inventory drawer
  dismissal still preserves the activity. Confirm the explicit stop choice before submitting it;
  then confirm the result from the server, announce no-catch and result
  feedback without stealing focus, and show exactly Fishing stopped: inventory full. when applicable.
  A request error preserves the last confirmed state and offers reconciliation rather than fabricated
  success. Session results are not a Fisher's Journal or persistent fish discovery screen.
- **Restricted developer/admin views:** keep the Fishing Debug Console and searchable inventory
  testing tool distinct from normal-player controls and render them only for authorized operators.
  The dedicated **Fishing test tools** top navigation entry carries a **DEV / ADMIN** label on
  desktop and appears only after a positive server authorization check.
  Use labeled item/quantity fields and Add, Remove, Delete Stack, Clear Inventory, and optional Set
  Quantity actions. Any optional development capacity override is visibly labeled. Show authoritative
  results/errors and update the real inventory immediately. UI hiding complements, never replaces,
  the server authorization and logging requirements in [API_CONTRACTS.md](API_CONTRACTS.md#a01-developmentadmin-tooling).
  Authorized operators also see a small DEV / ADMIN delete control below the selected inventory or
  locker item, with an explicit item/stack and location confirmation. Ordinary players never see it.
  The tools use a nonmodal floating window with a draggable header, keyboard Move control,
  pointer/keyboard resize grip, bounded size, internal scrolling, and a visible close button.

Use the existing dark context surfaces, type, spacing, focus treatment, and supplied approved item
assets. Condition values use text. The Pier scene follows the effective time/sea combination from
the same authoritative Fishing condition snapshot as the panel; the game clock refreshes at its
phase boundary. Scenery changes crossfade after the new image loads, except under reduced motion;
no world scene displays an image caption. Keep later fish traits, additional discovery systems,
loadouts, and extra equipment slots out of these components.
