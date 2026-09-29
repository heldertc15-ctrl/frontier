# Frontier UI target

## Authority and scope

This is the presentation target for the F03 repair and later interfaces. It incorporates the owner's
2026-09-24 shared-shell handoff and the 2026-09-26 owner-directed A01 fishing progress and optional-event extensions.
The authoritative attempt ring below replaces the older progress prohibition; neutral duration
configuration yields the current 30-second base attempt. Earlier F03 approval of revision `cb28a156bf7e` is recorded in
[PROJECT_STATE.md](PROJECT_STATE.md). Gameplay belongs
in [GAME_DESIGN.md](GAME_DESIGN.md), component behavior in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), and
stage gates in [DEVELOPMENT_CHECKLIST.md](DEVELOPMENT_CHECKLIST.md).

The supplied `UI_TARGET_REFERENCE.png` shows the intended composition and feel: compact dark top
navigation, a persistent left character HUD, a dominant illustrated world, a highlighted district,
and a right contextual panel. The reference is in the review pack, not a required runtime asset.
Keep **Frontier / New Harbor**, existing geography, real server values, and available destinations.
Do not copy Havenport branding, browser chrome, invented stats, welcome cards, or unbuilt features.

## Browser viewport composition

- The authenticated world fills the browser content viewport, without the Fullscreen API. There is
  no article-width container, large welcome/connection banner, footer, or inventory below the city.
- Desktop: compact navigation above three regions: persistent left HUD, flexible central world,
  and right contextual panel. Start around 48px for navigation, 176px for the HUD and 336px for
  context; tune against real content at the acceptance sizes without reducing readable text.
- The map is the largest continuous surface, uses the available height below navigation, and
  occupies more than half the content width at each desktop acceptance size with drawers closed.
  It must read as the game world, not a small illustration inside a large card.
- The HUD groups character identity and level, readable HP/XP values, credits, activity state,
  the server's shared Frontier time and effective phase, and a compact **Inventory n/total** trigger.
  The world-stage header supplies current location, Back to parent, and pin state. Do not repeat
  location in the HUD. Large balances must fit; any compact amount retains the full accessible value.
  Use authoritative values; do not invent bonuses, next-level thresholds, unread counts, or
  unlocks from the reference.
- The right panel contains a selected destination preview, readable description, explicit enter
  action, and child routes on city/district views. Keep the authoritative location, Back action,
  and pin control in the world-stage header, stable across previews. Entered
  places do not repeat sibling destinations. Quick Travel opens a separate drawer from top navigation
  for pinned shortcuts. Distinguish selection from the server's current location with text.
- In ordinary desktop world use there is no vertical or horizontal document scroll. Route lists,
  Quick Travel, HUD overflow, item lists, and drawers scroll internally where needed. Main world
  content is not one tall scrolling page. Keep panel headings, close controls, and key actions
  reachable. Clipping required controls does not satisfy this requirement.
- Fit the whole 16:9 scene without distortion, with a restrained dark surround when the world
  surface has another ratio. Images, cutouts, and overlays share one measured contain transform
  and rendered-image bounds. Preserve composition across condition variants and keep named routes
  available. No fit/fill toggle or pan/zoom controls are part of this pass.
- Keep gameplay destinations and compact Quick Travel visible. Account belongs in a quiet profile
  menu; authorized Fishing test tools retain a labeled entry. Normal server-online status needs no
  permanent emphasis; show connection failures without obscuring controls.

## District interaction contract

Use actual district-area geometry on the city overview, aligned to its production artwork.
A larger rectangle around a label is not a district region. Keep readable named HTML controls as
keyboard/touch equivalents. Existing district/place point anchors may be reused where they match
specific landmarks; the new deliverable is the overview's district-area hit/highlight geometry.

| Input/state                                                         | Presentation                                                          | Server effect                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| Hover district or focus its named control                           | Transient area outline/tint; right panel stays unchanged              | None                                                     |
| Pointer leaves or focus leaves that destination                     | Remove transient emphasis; right panel stays unchanged                | None                                                     |
| Click/tap region, or Enter/Space on its named control               | Persist selection and preview; keep a clear selection indicator       | None                                                     |
| Activate explicit `Enter [destination]`                             | Show pending state; commit current location only after server success | Existing validated navigation action                     |
| Activate an explicitly labeled return or discovered/pinned shortcut | Show pending state and arrival/error feedback                         | Existing validated navigation or quick-navigation action |

Selection persists until another selection or a successful navigation establishes the new context.
Hover never changes or erases it. Opening or closing a drawer preserves it. For a failed navigation, retain
selection and the last confirmed location; announce the error and offer recovery. On uncertain
request timeouts, refresh authoritative state before retrying a mutation.

Preview does not discover, pin, travel, move the character, or start an activity. Use
`/api/locations/navigate` for existing adjacent routes and `/api/locations/quick-navigate` only for
eligible discovered shortcuts. A preview is not permission to enter. If a destination cannot be
entered from the current location, explain why and expose the valid existing route. Only
server-defined destinations get navigation controls; illustrated buildings alone create no routes.
`aria-current="location"` identifies the actual location; selection uses a separate text/state cue.
The world-stage current-location heading, a visible Back to parent control beside it, HUD, and named
routes provide orientation without breadcrumbs. Previewing another destination never changes the
Back control's target.

## Shared drawers and panels

- Inventory opens from the HUD/quick slots or compact navigation as a reusable drawer over the
  world. Reuse F02 item slots, details, capacity, quantity transfers, use/equip actions, and feedback.
  Opening/closing never navigates away, resets location/selection/camera, or restarts/stops activity.
- Use one dismissible drawer at a time. Focus goes to its heading or first useful control, stays
  within a modal drawer, and returns to the opener on close. Make the underlying content inert
  while modal. Escape, a visible close button, and touch dismissal controls must work. Dismissal
  never cancels or duplicates an in-flight server action; pending/results remain reconciled.
- Existing `#inventory` links must open the drawer, not replace the world. Browser Back should
  dismiss it without causing gameplay navigation. Keep account access and the skip link working.
  Choose the smallest change to existing hash handling; no routing framework is required.
- Carried inventory is accessible wherever the character is, subject to item/action validation.
  Storage contents and transfers stay gated by their authoritative location. A closed gate shows
  a location requirement, not cached contents or a remote transfer action.
- **Known implementation limit:** GET `/api/inventory` currently rejects the whole response outside
  New Harbor. F03 reuses that contract in the existing city. F04 must separate carried access from
  protected storage before enabling regional travel; see [API_CONTRACTS.md](API_CONTRACTS.md).
  This documentation pass does not fix the endpoint or claim carried access already works abroad.
- Character/Knowledge, commerce, activity details, and larger future interfaces reuse this panel
  pattern or the right context area. Wider overlays may temporarily cover more map, but close back
  to the preserved world. Do not create separate website pages or a draggable window manager.

## A01 Fishing panel target

The Fishing Store's owner-directed fish buyer appears in the existing right context only when
physically at that store. A portrait and brief dialogue introduce the merchant. Compact carried-stack
buttons feed one illustrated appraisal; switching stacks replaces it. All fish and Ordinary only
shortcuts accompany individual specimen toggles, server quotes, and Trophy cues. A single selected
Trophy shows its quoted credits/kg rate. Keep the offer total and Review offer action anchored below
the scrolling catch, then replace that action with an inline confirmation. Success shows a focused
earned-credit receipt and Trade more fish, while the world and HUD stay visible. Confirmation focuses
its heading; Keep fish and Escape return focus to Review offer. Pending and uncertain sales retain
their intent for safe retry; refreshed stale selections cannot submit an obsolete confirmation.
Loading, empty, and error recovery stay in the panel, with reduced motion honored. Empty inventory
explains how to bring locker fish into the pack. See the [buyer component contract](DESIGN_SYSTEM.md#a01-fishing-components)
for selection, focus, and reconciliation details; pricing and sale rules remain server-authoritative.

The [owner-approved A01 v1 design lock](GAME_DESIGN.md#15-fishing) defines this panel. A01's
functional implementation replaces the F03 unavailable notice. Prior F03 approval does not approve
the A01 rendering; owner visual approval is pending.

- Only physical presence at **New Harbor → Harbor District → Fishing Pier** exposes **Fishing**
  and **Prepare tackle** automatically in the right context panel. A destination preview is insufficient.
- Before **Prepare tackle**, show the owner's supplied fishing gear artwork as the focal image in
  a compact dark dockside preview. Keep the invitation text and action readable at narrow widths;
  the standalone Basic Fishing Rod art belongs to equipment choices, not this initial preview.
- **Prepare tackle** opens **Preparation** without committing an activity. Show exactly **Rod**
  and **Bait** as two side-by-side equipment sockets with category, image, and readable name;
  bait also shows its quantity. Empty sockets are available choices, not disabled controls. Use a
  selected border and checkmark instead of separate Select/Selected strips. Each socket opens a
  bounded picker of eligible carried items, not the full inventory drawer. Anchor choices within
  the desktop viewport; use a dialog/sheet on narrow screens. Choices scroll internally and never
  displace the action footer. Selection, Escape, and Close return focus to the originating socket.
  Put **Possible Catches** below them. Undiscovered species remain visible as black silhouettes
  labeled **???** on a contrasting backing. Their accessible label must say Undiscovered fish,
  without exposing a hidden name. An awarded catch permanently reveals the species for that character. The
  known tile then shows its percentage of the normal eligible catch pool beneath the name. All
  eligible fish, including undiscovered ones, contribute to the denominator; unknown tiles show no
  percentage. Label the percentages as shares when a fish is caught, separate from the chance of
  catching anything on a given attempt. The
  authorized admin reset restores silhouettes without removing inventory or session history.
- Show one readiness message that identifies missing equipment or explains a stale selection.
  With valid selections, **Start fishing** commits server-side. Transform this same panel
  into **Fishing…** with a small fish icon and **Your line is in the water. Good luck!** after server
  confirmation; keep the world and HUD mounted. Recreate the supplied 2026-09-26 reference as crisp,
  responsive UI: a dark translucent blue/slate surface, subtle border, rounded corners, white primary
  text, muted secondary text, and a prominent cyan circular progress ring with rounded ends and a
  fish silhouette inside. The ring sits above the catch results, with **Waiting for a bite…** and
  **Each attempt consumes 1 bait.** below it. Retain selected rod, selected bait and remaining
  quantity in a compact row, one conditions row (effective phase and sea), a prominent illustrated
  latest catch/weight, then the compact current-session species summary. Use a full-width **Stop
  Fishing** button with a small stop icon. Keep its footer stable and reachable while content scrolls.
  The global HUD shows Frontier time and phase. Do not embed the screenshot.
- The ring measures the current server-scheduled attempt, filling clockwise from empty to full
  using its persisted start, deadline, and duration. A confirmed Reel Pull immediately completes that
  attempt and starts the next server-scheduled attempt if Fishing continues.
  Anchor it to server time and a monotonic client
  clock between updates; polling, rerendering, refresh, and tab resume must preserve correct progress.
  At full progress show **Checking for a bite…** until authoritative state confirms a result and
  any next cycle. Completion causes no local attempt, bait use, reward, or promised catch. Preserve
  that behavior for unsuccessful and admin-forced attempts, and reject stale responses that would
  restore an older cycle or revive a stopped session. Connection uncertainty stays explicit and
  never creates continued cycles or an automatic restart. Expose accessible progress values without
  announcing every frame; reduced motion removes decorative movement while retaining accurate progress.
  This owner direction supersedes the earlier prohibition on attempt progress indicators.
- An offered Reel Pull replaces the waiting status with a restrained cyan-to-gold pulse, a five-second
  draining timer bar in the same colors, and the compact REEL! action. The offer disappears at server
  expiry or cast resolution. Play the supplied short Reel Pull cue across the remaining offer window;
  stop it when the player reels. Keep the timer readable without animation when reduced motion is
  requested.
- At Fishing Pier, the Character sidebar includes separate Reel event sound and Fish caught sound
  controls. On narrow layouts where the sidebar is compact, expose those controls in Account. A
  confirmed catch uses the supplied water-exit cue at the same playback gain as Reel Pull; muted or
  unavailable audio leaves all visual
  feedback and fishing results intact.
- Earned Trophy catches use a gold cup badge, warm card backing, larger weight, and a brief light
  sweep with reduced-motion fallback. The server's Trophy flag supplies the distinction; announce it
  politely without moving focus. Retain the latest card through no-catch attempts and stopped results
  while the player remains at the Pier. A successful departure clears all prior session activity
  from this panel, including when the player returns.
  Inventory uses the same badge and warm selected-fish treatment. Do not add rewards or record tiers.
- Stop Fishing first replaces the panel's action area with an in-panel confirmation and **Keep
  fishing** / **Stop and view catch** choices. It does not cover the world or leave the activity
  panel. Cancel/Escape returns focus to Stop Fishing without sending a request. After server
  confirmation, retain the same species-by-species catch summary with total, count, and Trophy
  count, now labeled Session complete. An empty session says no fish were caught. Keep
  the latest catch card above the summary until the player leaves the Pier or starts preparation again.
- The active Fishing context has **no collapse/close control**, including in the narrow fallback.
  Keep the location heading and Back to Harbor District reachable; a successful departure stops
  fishing. The separate inventory drawer/pickers retain their own dismissal/focus behavior; dismissing
  those overlays does not stop the activity or close its context.
- Non-fish inventory item clicks show a compact game-style detail card with name, type, short
  description, real use effects, and relevant actions. Storage quantities appear only after
  Store…/Take…. Switching items or stacks replaces the previous view and closes its storage controls. Keep keyboard/touch
  access; essential actions must not depend on hovering.
- The inventory drawer shows each fish stack as a species and a single quantity badge, capped at ten.
  A stack containing any Trophy fish shows the shared Trophy badge and a warm card edge in carried
  inventory, locker storage, and the whole-card drag preview. Ordinary stacks have no Trophy cue.
  Each fish card shows the sum of its recorded specimen weights at bottom right as a bare number
  and `kg`, using the shared weight formatter. If any specimen weight is unknown, show `— kg`
  rather than a misleading partial total; accessible text identifies it as unknown. Non-fish cards
  show no weight.
  Whole item cards can be dragged to arrange carried or locker positions. The floating drag preview
  shows the entire original card, including art, quantity, name, and category. Dropping onto a
  different item swaps positions within a container; dropping onto a stack of the exact same
  stackable item fills that target to its cap and leaves overflow in the source, even across
  containers. Dropping into an empty carried or locker space leaves the card there. The
  ordinary locker adds positions only when stored items require them; an admin locker has 50 positions.
  Moving an item to the last visible position does not add more spaces. Dropping a carried card into the locker,
  including its empty state, or a locker card into carried inventory transfers the whole stack
  through the existing inventory action. Focused cards can also move with Alt + arrow keys.
  Sorting does not select the tile or alter the fish stack view.
  One click on a stack immediately opens only its own fish collection, including partial stacks;
  no second inspection button is required. Switching stacks resets the list scroll and selection.
  Keep one non-sticky inspector in the scrolling drawer so previous stack panels do not remain visible.
  Rows sort heaviest first, retain equal-weight
  order, and show each numeric kg weight once with Trophy where applicable. The selected specimen
  has an illustrated detail card and a compact labeled min/max weight
  bar with an arrow. Back and Close are keyboard accessible. Opening or dismissing this inspector
  leaves an active Fishing session untouched; an open list refreshes after stack mutations. Show
  known weights and range endpoints that round below 10 kg with three decimals (`0.123 kg`, `9.999 kg`)
  and weights reaching 10 kg or more with two (`42.12 kg`, `242.46 kg`), while sorting and Trophy use stored precision.
  Authorized admins can delete a selected carried or locker item/stack after a clear confirmation;
  no delete control appears for ordinary players.
- Show readable setup errors, missing carried equipment, pending actions, no-catch feedback, and
  stopped results. Use exactly **Fishing stopped: inventory full.** for that stop. No Manual/Auto
  choice, energy meter, mandatory reeling minigame, or raw RNG percentages.
- The owner-directed optional events appear inside the central progress/status area during a cast.
  Retain the silhouette/ring; replace Waiting for a bite… with **Your rod jerks hard!** and **REEL!**.
  Keep the treatment compact,
  with no modal or large overlay. Confirm effects from the server, disable pending/disconnected
  actions, and preserve accessible status, visible focus, and reachable Stop. Ignoring a prompt
  leaves the countdown and normal catch table unchanged. Admin forcing and schedule
  diagnostics remain exclusively in the authorized testing window.
- In Preparation and active Fishing, show conditions once near the title and a short qualitative sea outlook derived from the committed next state. Do not show a precise
  transition time. An override can mask the scheduled
  state past the boundary; the forecast must not promise an effective sea change. On an expired or
  failed refresh, mark it as awaiting confirmation. Keep the outlook separate from attempt progress.
  Keep selected equipment, focus, active session, Stop, and Back available across refreshes.
- Select the supplied Fishing Pier scene for the effective Dawn/Day/Dusk/Night and
  Calm/Moderate/Dangerous combination. Preserve the 2560×1440 world geometry and context shell;
  use supplied approved item art. Normal players never see Fishing debug
  logs, probabilities, forced attempts, condition overrides, or inventory testing controls.
- Crossfade Pier condition changes over one second and location moves over about 120 ms, with a
  static swap under reduced-motion settings. Keep
  the previous scene visible while the incoming image loads. Do not overlay artwork captions on
  any world scene; location and navigation context remain in the world-stage header.
- Separate an interruption notice and actual reason from the retained session result. Reconcile
  temporary connection loss before declaring a stop, preserve earned results, and never restart
  automatically. Pending Start/Stop cannot be duplicated; navigation makes the existing consequence
  clear: leaving the Pier stops fishing. Do not add routine confirmation dialogs.
- Authorized Fishing test tools open as a bounded, nonmodal window. Drag its header or use the
  Move control's arrow keys to reposition it; drag the resize grip or use its arrow keys to resize.
  Keep the world usable behind it and its controls internally scrollable at narrow sizes.

Apply **1366×768, 1440×900, 1920×1080**, **320×640**, and a **390px-wide** narrow review during
A01 visual refinement; also check footer reachability at **1280×720**. Keep compact picker options
and the non-collapsible activity controls reachable
through bounded internal scrolling and keyboard/touch input. A01 refinement captures and UI checks
are recorded in [PROJECT_STATE.md](PROJECT_STATE.md); owner visual approval remains pending.

## Styling and input

Use restrained dark slate/charcoal navigation, HUD, and contextual framing, with subtly differentiated
inset surfaces,
natural artwork, and a controlled blue/teal selection accent. Retain useful controls and semantics;
the rejected pale sage website palette is not mandatory. Avoid fantasy ornament, heavy bevels,
neon glow, cinematic RPG framing, stock dashboards, and decorative fake data.

Every route and action is operable without hover. Keyboard focus visibly highlights the associated
region and named control; Enter/Space selects, and a separately focused enter button navigates.
Tab order follows navigation, HUD, world destinations, then context. Provide a skip link and concise
live feedback for actual arrivals, discoveries, errors, and mutations without noisy hover announcements.

Touch uses tap to select, then the visible enter action. Use at least 44px touch targets, enlarge
small landmark controls through equivalent list entries, and provide text cues as well as color.
Reduced motion removes lifts, pulses, and camera animation while retaining instant state feedback.
Normal text should meet 4.5:1 contrast; focus and control boundaries must remain distinguishable.

At narrow widths, replace the left column with a compact character summary and Inventory trigger;
keep a proportionate scene above one full-width bounded activity/context panel. Equipment choices
use a modal dialog/sheet. Favor one clear content scroll area and preserve state across resizing.
Keep named destinations,
enter/close controls, status, and storage restrictions available. At 320px minimum width, lists
scroll within their panels and fields must remain reachable with the software keyboard. If extreme
zoom or a short viewport needs document scrolling to avoid clipping, allow it; the no-scroll gate
applies to ordinary desktop world use, not forced hiding on constrained screens.

Loading, empty, disabled, selected, pending, success, and error states use real data and readable
copy. Failed artwork removes unusable overlays and exposes the complete named route list in the
context area. Failed API requests retain confirmed state and provide retry/refresh; never fabricate
arrival, inventory, or successful loading. Compact connection errors must not obscure controls.

## Artwork and renderer boundaries

The city and districts remain large static illustrations plus coded overlays. No city tile assembly
or whole-game engine migration is required. Reuse recorded production assets under
`src/assets/locations/`; this review did not visually certify those binaries. Production art has
no baked text, branding, labels, buttons, or stats. Do not regenerate all artwork automatically.

The approved New Harbor master now has seven aligned transparent cutouts. Hover/focus uses restrained
cutout emphasis and area feedback; selection retains a stronger state. The base stays visible. Labels,
hit areas, and actions remain coded controls. Avoid moving a cutout far enough to expose a gap in the
base image. All seven district and zone destination scenes have separate illustrations. Fishing Pier
uses the supplied twelve-scene time/sea set. Fishing Store uses its four supplied interior variants
selected by the effective server Dawn/Day/Dusk/Night phase shown in the HUD,
preserving its full composition and Back to Harbor District beside the buyer context; no Harbor
map labels overlay the interior. Phase changes reuse the existing load-before-fade transition
without resetting the buyer. Other places retain the parent-scene fallback. The A01 Fishing
context appears only while physically at that Pier.

Version and approve each artwork/geometry pair together. Store geometry relative to that asset's
intrinsic dimensions; apply the same proportional contain scale and offsets to the
image, hit regions, labels, and aligned cutouts. Verify after resize or any artwork/variant change. Canonical geography and
landmarks remain in [CITY_LAYOUT.md](art/frontier_f03_art_package/CITY_LAYOUT.md).

The P01-PLACEMENT slice embeds a PixiJS 8 isometric grid in this world shell. Separate objects use
server-owned footprints, depth order, 90-degree facing markers, a snapped ghost, and saved layouts.
The room context offers carried-furniture selection and explicit Rotate, Place, Cancel and Move
controls; keyboard arrows/R/Enter/Escape and touch remain reachable. Procedural blocks stand in
for directional artwork during functional implementation. Full P01 will add approved object art,
acquisition and storage. This renderer does not replace static city/district scenes.
In the bounded slice's UI refinement, the active preview and footprint reason appear before the
furniture lists. At narrow widths a compact action strip stays directly below the floor, so a tap
can aim the ghost and the explicit Place action remains in view. Desktop context lists scroll
internally when needed; the shared inventory drawer suspends floor input and preserves the draft.

The 8×8 plot uses the owner's registered Dawn, Day, Dusk or Night yard image beneath the coded grid
and individual procedural furniture. Select the phase from the effective server world conditions,
including overrides; do not use the browser clock. Load a new image before transitioning, then
crossfade the yard over one second with the same eased transition as the Fishing Pier. Crossfade
the furniture lighting with the image so the scene and placed objects change phase together.
Preserve the grid geometry, selection and placement draft through phase changes.
Nonmatching rooms and initial image-load failure retain the slate floor. Furniture rows show
schematic footprint diagrams and clear selection cues; internal instance IDs remain out of the
visible picker. Keep the primary Place action legible and the short touch strip beside the floor.
Pointer hover draws a soft warm outline and surface wash around the corresponding placed object;
selection retains that emphasis after the pointer moves. Apply a restrained Dawn amber, neutral
Day, Dusk orange, or Night blue lighting wash to furniture surfaces. For image-based furniture,
apply the color to the sprite itself; do not lay a footprint-shaped color tile over its artwork.
For the yard, blend the wash with the successfully loaded background phase so delayed artwork
cannot show mismatched lighting and beds do not snap to their new tint before the scene.
Directional object sprites remain future art integration; see the [room art guide](ROOM_ART_ASSET_GUIDE.md).

## F03 acceptance and stop condition

The checked items below record the earlier F03 implementation and browser evidence in
[PROJECT_STATE.md](PROJECT_STATE.md), including its original cover composition. Owner appearance
approval and final verification were completed separately on 2026-09-23. They do not verify or
approve the later A01 handoff changes above.

- [x] At **1366x768, 1440x900, and 1920x1080**, the normal world has no document scroll, a dominant
      map, persistent HUD, readable context, and no clipped controls or large website margins.
- [x] City and all seven district/zone scenes keep existing
      valid routes usable; all seven city regions align after resizing under automatic cover.
- [x] Hover, focus, click, and touch follow the preview/select/enter contract. Previews make no
      gameplay mutation and never change current location or discovery state.
- [x] Inventory opens/closes over the world with selection/camera/activity intact; hash links,
      browser Back, Escape, keyboard focus return, and touch controls behave consistently.
- [x] Reused auth, item use, equip/unequip, quantity/stack transfers, capacity, discovery, pins,
      quick navigation, persistence, and server validation remain correct. F04 storage separation stays
      explicitly pending; do not weaken gates to make the drawer appear usable outside the city.
- [x] The current-location pin action shows eligibility and Pinned n/5; a sixth distinct pin is
      disabled in the UI and rejected by the server while unpinning remains available.
- [x] Narrow fallback, 320px minimum, keyboard navigation, reduced motion, long lists/names,
      loading, request errors, and missing artwork remain usable.
- [x] Capture the desktop compositions and a narrow fallback for owner review; record the candidate
      presentation fingerprint in PROJECT_STATE.md.
- [x] Record the owner's reviewed revision and outcome in PROJECT_STATE.md. Automated passes are not
      approval.
- [x] **Owner visual approval: APPROVED** for revision `cb28a156bf7e` on 2026-09-23.
- [x] Final verification passed for the same approved presentation; F03 is MVP_PASSED.

F03 is complete. Do not start F04, F05, activities, property rendering, or new artwork work
automatically.
