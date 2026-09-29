# FRONTIER — COMPARTMENTALIZED DEVELOPMENT CHECKLIST

This plan is designed for **feature-complete vertical stages**, not broad technical layers.

Each stage should leave the game in a **testable MVP state**. A stage is not complete because the backend exists or because the UI looks good. It is complete only when the full player-facing slice works end to end.

## Workflow for every implementation stage

Roles are model-neutral. Existing machine-readable statuses and exact handoff phrases are retained
for compatibility, not as a requirement to use a named model or reasoning level. Select effort to
match the task. Follow [AGENTS.md](../AGENTS.md) and [UI_TARGET.md](UI_TARGET.md).

**Documentation-only exception:** an authorized documentation pass reads relevant evidence, edits
only authorized Markdown, and checks consistency, links, dependencies, and its diff. It does not
implement a stage, generate assets, install dependencies, launch/build the app, or run tests.

### Phase A - Implementation

The implementation agent should:
- read the relevant game design, checklist, project state, and UI target;
- implement the selected functional slice with server authority, validation, and persistence;
- use the shared shell/components for a functional UI and add practical automated coverage;
- document new contracts/decisions and stop before a separate visual refinement pass.

When functionally ready, set `READY_FOR_ASTRA_UI_DESIGN` and output exactly:

`READY FOR ASTRA UI DESIGN — <STAGE_ID>`

### Phase B - UI refinement

The UI agent should:
- preserve backend behavior and contracts;
- refine the selected slice using the viewport world and panel/drawer patterns in UI_TARGET.md;
- implement loading, empty, disabled, error, success, active, selected, and completed states;
- preserve keyboard/touch access and responsive behavior;
- avoid adding mechanics or rebuilding verified foundations;
- capture the requested review evidence and record owner visual approval separately.

After the scoped UI pass, set `READY_FOR_SOL_PASS_TEST` and output exactly:

`READY FOR SOL PASS TEST — <STAGE_ID>`

### Phase C - Owner visual approval

For F03's presentation repair, the owner must explicitly approve the rendered composition at the
specified sizes. Record PENDING, APPROVED, or CHANGES_REQUESTED with date and reviewed revision in
PROJECT_STATE.md as a separate field, not a new stage status. Tests and agent visual review never
substitute for owner approval. If approval is pending, keep the stage non-passed and report the gate.
Any subsequent material presentation change requires review of that changed result.

### Phase D - Final verification

The verification agent should:
- review UI changes and repair integration/regressions;
- run the existing formatting/lint/typecheck/test/build gates and stage acceptance flows;
- confirm required owner approval covers the result being verified;
- update PROJECT_STATE.md with evidence, not assumed success.

Only with all acceptance and required owner approval complete, set `MVP_PASSED` and end exactly:

`MVP PASSED — <STAGE_ID>`

For a functional failure, set `MVP_FAILED` and end exactly:

`MVP FAILED — <STAGE_ID>: <short reason>`

Do not automatically begin another stage. A pending owner review alone is not a functional failure.

## Shared interface inheritance

Later stages extend the existing world, HUD, right context panel, and reusable drawers. Stage terms
such as screen, view, browser, or setup mean a surface within this shell, not a separate website
page. Preserve world/location, selection/camera, and activity state when opening or closing panels.
Do not build future Character/Knowledge, market, travel, activities, or property during F03.
Dependencies below remain authoritative. `Unlocks` lines are forward pointers, not extra prerequisites
or automatic READY transitions. In particular, F03 repair introduces no F04 or P01 dependency.

---

# FOUNDATION TRACK

These stages should be completed first because almost every later stage depends on them.

---

## F00 — Repository, Quality Gates, and Game Shell

**Dependencies:** none

### Goal
Create a stable development base that every later agent can safely modify.

### Build
- [x] Initialize browser application with TypeScript.
- [x] Configure formatting, linting, typechecking, and test runner.
- [x] Configure environment-variable handling.
- [x] Establish database/dev persistence approach.
- [x] Create global error handling.
- [x] Create seed/reset tooling for local development.
- [x] Add `/docs` structure.
- [x] Add `AGENTS.md`.
- [x] Add `PROJECT_STATE.md`.
- [x] Add a simple app shell with placeholder header/sidebar/main area.
- [x] Add automated smoke test confirming app boots.

### UI refinement
- [x] Establish the base modern-clean browser-game visual language.
- [x] Define spacing, typography, surfaces, buttons, forms, item-slot styling, badges, status states.
- [x] Make the shell responsive without turning it into a mobile-first app.
- [x] Avoid cinematic RPG styling.

### MVP acceptance
- [x] Fresh clone/install boots successfully.
- [x] Lint passes.
- [x] Typecheck passes.
- [x] Tests pass.
- [x] App shell renders.
- [x] Seed/reset command works.
- [x] Documentation entry points exist.

**Unlocks:** F01

---

## F01 — Account, Character, and Persistent Player State

**Dependencies:** F00

### Goal
A user can enter the game and has one persistent character with the basic state needed by later systems.

### Build
- [x] Authentication/session flow.
- [x] Create/load character.
- [x] Persist character name.
- [x] Persist money.
- [x] Persist HP/max HP.
- [x] Persist Character XP and Character Level.
- [x] Persist current location.
- [x] Persist active status.
- [x] Character sidebar data API/state.
- [x] Developer seed character.

### UI refinement
- [x] Character identity area.
- [x] Level + XP presentation.
- [x] HP presentation.
- [x] Credits/money.
- [x] Current location.
- [x] Active-status treatment.
- [x] Sensible empty/first-login states.

### MVP acceptance
- [x] New account creates a character.
- [x] Refresh/logout/login preserves the same character.
- [x] Changing money/XP/HP persists.
- [x] Sidebar always reflects server state.
- [x] Two test accounts remain isolated.

**Unlocks:** F02, F03

---

## F02 — Inventory, Items, Consumables, and City Locker

**Dependencies:** F01

### Goal
Build the complete basic possession loop before any gathering activity exists.

### Build
- [x] Item definitions.
- [x] Item instances/stacks as appropriate.
- [x] Limited carried inventory.
- [x] Slot/capacity enforcement.
- [x] Basic item metadata.
- [x] Equip/unequip support where applicable.
- [x] Consumable-use action.
- [x] HP-restoring consumable.
- [x] City locker storage.
- [x] Transfer inventory → locker.
- [x] Transfer locker → inventory.
- [x] Prevent remote locker access when player is not in the correct location.
- [x] Seed basic tools, food, clothing, and bandage.

### UI refinement
- [x] Inventory grid.
- [x] Item details.
- [x] Equipped vs carried treatment.
- [x] Locker transfer experience.
- [x] Capacity feedback.
- [x] Consumable use feedback.
- [x] Tooltips without visual clutter.

### MVP acceptance
- [x] Player with 10 slots cannot carry an 11th occupied slot.
- [x] Items transfer correctly between inventory and locker.
- [x] Refresh preserves all item locations.
- [x] Consumable restores HP and is consumed.
- [x] Player outside city locker location cannot access locker contents.

**Unlocks:** F04, A01, A02, A03

---

## F03 — City, Districts, Places, Discovery, and Pins

The bounded presentation repair, including the Pier refinement, is `MVP_PASSED`. The owner
approved revision `cb28a156bf7e` on 2026-09-23, and final verification passed on the same
revision. F00-F02 remain `MVP_PASSED`. The repair reuses F02 components without changing stage
dependencies.

**Dependencies:** F01

### Goal
Create the core location-navigation model.

### Build
- [x] Main city definition.
- [x] District definitions.
- [x] Sublocation definitions.
- [x] City → District → Location routing.
- [x] Location access rules.
- [x] Discovered Places registry.
- [x] Pin/favorite locations.
- [x] Persistent pinned locations.
- [x] Quick navigation to already-discovered city locations.
- [x] Seed Harbor, Market, Industrial, Residential, and City Centre districts, plus Transit Hub and
  Outskirts city zones.

### UI refinement
- [x] Main city screen.
- [x] District view.
- [x] Sublocation cards/hotspots.
- [x] Places navigation.
- [x] Pinned locations.
- [x] Location header/banner pattern that later activities can reuse.

### MVP acceptance
- [x] Player can navigate New Harbor → Harbor District → Fishing Pier.
- [x] First visit records a discovered location exactly once.
- [x] Player can pin a discovered place.
- [x] A pinned place becomes a one-click quick-access location.
- [x] Refresh and relogin preserve the current location, discoveries, and pins.
- [x] Invalid, repeated, and competing transitions are rejected without duplicate discoveries.

### F03 presentation repair

The shell repair is implemented. The owner accepted its general direction and authorized a bounded
canonical New Harbor artwork/location alignment. Use [UI_TARGET.md](UI_TARGET.md) as the detailed
presentation target. This pass adds the approved city master, seven cutouts and city locations;
it does not start regional travel, property, activities, or a later stage.

- [x] Refine existing viewport overrides into the shared top navigation, left HUD, dominant world,
  and right contextual panel; remove conflicting website width/stacking and banner treatments.
- [x] Apply the reference-aligned slate/charcoal framing, dark contextual panel, and controlled accents.
- [x] Add actual area geometry for all seven city districts/zones, aligned with the canonical image;
  reuse existing point anchors for places where appropriate.
- [x] Keep hover/focus as transient scene feedback; click or keyboard activation selects and updates
  the contextual preview. Selection makes no location/discovery mutation; explicit entry uses existing validated actions.
- [x] Reuse F02 inventory grid/details/actions inside a HUD/navigation drawer that preserves the
  world, location, selection/camera, and activity state; handle hash entry/back and focus return.
- [x] Keep storage gating, server-derived results, pending-action protection, pins/discovered
  shortcuts, and auth intact. F04's carried/storage API split remains deferred.
- [x] Add usable keyboard/touch controls, reduced motion, narrow-screen panels, internal overflow,
  and complete named-route fallback for missing imagery or unavailable region geometry.

### Repair acceptance and owner gate

- [x] Review **1366x768, 1440x900, and 1920x1080**: no document scroll in ordinary desktop world
  use, no clipped controls, map dominates, HUD persists, and context remains readable.
- [x] Check base/cutout/region/label alignment after resizing under automatic cover; verify city and
  all seven supplied district/zone scenes with their existing navigation.
- [x] Check hover, focus, selection, and explicit Enter for all seven canonical city locations;
  Transit Hub and Outskirts expose future functionality without enabling F04.
- [x] Keyboard/touch can preview, select, and explicitly enter; previews never move the character
  or add discoveries. Failed entry retains the last authoritative location and offers recovery.
- [x] Inventory opens/closes without leaving/resetting the world; use/equip/transfers/capacity and
  pending results remain correct. Drawer Escape/close, focus return, and browser Back work.
- [x] Narrow fallback down to 320px, reduced motion, long lists/names, loading, failed requests,
  and failed images retain all necessary controls and geographic storage restrictions.
- [x] Reverify existing F03 navigation/discovery/pin/persistence acceptance and directly affected
  F01/F02 behavior under the existing final quality gate, without reopening completed stages.
- [x] Show the current-location pin action and Pinned n/5 count; block a sixth distinct pin in the
  UI and atomically on the server while allowing unpinning and legacy counts above five.
- [x] Keep a prominent Back to parent action with the current-location controls on district and
  place screens, including narrow layouts and previews of other destinations.
- [x] Use the approved daytime Fishing Pier asset as a place-specific scene, keep fishing visibly
  unavailable, and preserve parent-scene fallback for places without artwork.
- [x] Allow entered districts, zones, and places to use the same server-validated five-pin limit.
- [x] Remove the persistent Your places block from the context panel and the sibling-destination
  list from entered places. Show pinned shortcuts in an on-demand Quick Travel drawer; the owner's
  later A01 review correction removed unpinned discovered entries from that drawer.
- [x] **Owner visual approval: APPROVED.** Requested desktop and narrow-screen evidence was
  presented; the explicit approval, date, and reviewed revision are in PROJECT_STATE.md.
- [x] Final verification passed for the same approved presentation before F03 became MVP_PASSED.

Stop after the F03 final handoff. Do not start F04, F05, P01, or a new asset pass automatically.

**Unlocks:** F04, A01, A02, A03, S01

---

## F04 — Regional Travel and Traveling State

**Dependencies:** F02, F03

### Goal
Make geography and preparation matter.

### Build
- [ ] Satellite-location model.
- [ ] Seed first satellite location: Coast; do not create a second Fishing Pier there for A01.
- [ ] Travel-option model.
- [ ] Walking.
- [ ] Public transport.
- [ ] Travel cost.
- [ ] Travel duration.
- [ ] Departure validation.
- [ ] Traveling state.
- [ ] Arrival resolution.
- [ ] Return travel.
- [ ] Restrict stationary activities while traveling.
- [ ] Permit safe passive UI actions while traveling, such as chat/market browsing later.
- [ ] Preserve carried inventory during travel.
- [ ] Before enabling travel outside New Harbor, separate carried GET/use/equip/unequip access
  from protected locker contents, including safe mutation responses; update API_CONTRACTS.md.
- [ ] Keep locker reads/transfers server-location-gated; clear unavailable cached storage in the
  shared drawer. Do not grant remote property/locker access.

### UI refinement
- [ ] Destination selection in the world context panel or shared drawer, retaining world state.
- [ ] Travel-method comparison.
- [ ] Clear time/cost/capacity implications.
- [ ] Traveling state with ETA.
- [ ] Arrival feedback.
- [ ] Return-trip experience.

### MVP acceptance
- [ ] Player can walk from city to Coast.
- [ ] Player can take paid transport from city to Coast.
- [ ] Credits are charged correctly.
- [ ] Arrival occurs only when travel completes.
- [ ] Player cannot read cached/server locker contents or transfer locker items while at Coast.
- [ ] Carried items remain readable and valid use/equip/unequip actions work at Coast and during
  travel; action responses do not reveal storage or relax ownership/capacity rules.
- [ ] Return to New Harbor restores authorized locker access; refresh/login and account isolation
  preserve the same carried-versus-storage boundary.
- [ ] Player can return to city.
- [ ] State survives refresh during travel.

**Unlocks:** A03, V01, E01 (regional travel integration for Fishing is later, not an A01 v1 gate)

---

## F05 — Character XP, Levels, Knowledge Points, and Knowledge Atlas

**Dependencies:** F01

### Goal
Complete the character-build system that all future activities feed into.

### Build
- [ ] XP curve.
- [ ] Level calculation.
- [ ] Knowledge Point awards.
- [ ] Knowledge ability definitions.
- [ ] Categories/tags for search and organization.
- [ ] Ability ranks.
- [ ] Knowledge Point cost.
- [ ] Independent ability upgrades, without prerequisite branches or fixed combination careers.
- [ ] Purchase/unlock action.
- [ ] Server-side effect hooks.
- [ ] Free-form search/filter.
- [ ] Retraining/respec queue.
- [ ] Full eventual point refund.
- [ ] Retraining cooldown/timers with full Knowledge Point refunds.
- [ ] Early-game experimentation protection/free retrain rules if retained.
- [ ] Seed a diverse set of abilities rather than one branch.

### UI refinement
- [ ] Do **not** make a branching tree.
- [ ] Present a searchable/browsable knowledge catalog in the shared Character/Knowledge panel, preserving world context.
- [ ] Strong search.
- [ ] Category filters.
- [ ] “Owned / available / retraining” states.
- [ ] Ability detail panel with rank/effect/cost.
- [ ] Player build overview.
- [ ] Make experimentation feel inviting.

### MVP acceptance
- [ ] Awarding XP can level a character.
- [ ] Level award grants correct Knowledge Points.
- [ ] Player can buy unrelated abilities in any order.
- [ ] Ability effect is actually applied to a test rule.
- [ ] Player can upgrade an owned ability.
- [ ] Player can begin retraining.
- [ ] Ability deactivates/refunds according to chosen retraining rule.
- [ ] Full refund eventually returns all spent points.

**Unlocks:** all activity stages except A01 v1 (its F05 progression integration is deferred)

---

## F06 — Basic NPC Economy

**Dependencies:** F02, F03

### Goal
Provide the minimum stable economic floor needed before the player market exists.

### Build
- [ ] NPC merchant model.
- [ ] NPC stock.
- [ ] Buy from NPC.
- [ ] Sell eligible items to NPC.
- [ ] Price definitions.
- [ ] Transaction validation.
- [ ] Money transfer.
- [ ] Inventory capacity checks.
- [ ] Transaction history.
- [ ] Seed basic food, bait, basic tools, consumables.

### UI refinement
- [ ] Merchant panel within the shared world/context or drawer pattern.
- [ ] Buy/sell tabs.
- [ ] Item quantity controls.
- [ ] Price summary.
- [ ] Clear failure states.
- [ ] Transaction confirmation without unnecessary modal spam.

### MVP acceptance
- [ ] Player can buy bait.
- [ ] Credits decrease.
- [ ] Item enters inventory.
- [ ] Player can sell an eligible item.
- [ ] Credits increase.
- [ ] Cannot buy without credits/capacity.
- [ ] Buying/selling grants no Character XP, Knowledge Points, or trading level.
- [ ] Transaction persists after refresh.

**Unlocks:** A02, A04, N01 (the bounded A01 Fishing Store buyer does not complete this stage)

---

# FIRST PLAYABLE ACTIVITY TRACK

These are **vertical feature slices**. Each activity is built completely enough to play, not grouped under a generic “gathering” stage.

---

## A01 — Fishing: Complete Vertical Slice

**Dependencies:** F02, F03

**Current gate:** A01 is `READY_FOR_SOL_PASS_TEST`, with the owner-directed 2026-09-27
known catch share display completed. F02/F03 are both
`MVP_PASSED`; F01 is transitive through them. F04/F05/F06 are separate `READY` stages, not A01 v1
prerequisites. Earlier rendered checks remain recorded in PROJECT_STATE.md. The owner-authorized
shell/Fishing handoff, attempt-progress refinement, and random-event extension use the checks below; owner visual approval and final MVP
verification remain pending. Owner follow-ups update A01 mechanics while preserving its stage
dependencies.

**Deferred integrations:** F05-dependent Character XP rewards, Knowledge Points, fishing Knowledge
bonuses, regional travel, and a Coast Fishing Pier are not implemented in A01 v1. The owner's
bounded Fishing Store fish-buyer extension is part of the selected A01 slice; F06's broader NPC
economy remains separate.
They require separately scoped work after the respective F05, F06, or F04 stage passes; completing
those stages does not automatically enlarge A01 v1.

### Goal
Deliver the owner-approved A01 v1 automatic fishing slice at **New Harbor → Harbor District →
Fishing Pier**, using the existing world shell and carried inventory. The complete design lock,
configuration tables, approved assets, and explicit exclusions are in
[GAME_DESIGN.md §15](GAME_DESIGN.md#15-fishing). That v1 scope supersedes older Fishing requirements.

### Build
- [x] Reuse the existing Harbor Fishing Pier and approved supplied assets; no Coast Fishing Pier
  or substitute/condition artwork.
- [x] The preparation entry opens local UI only. Provide exactly Rod and Bait slots with compact
  eligible-item pickers over real carried inventory. A separate validated start action commits
  character activity to `FISHING`.
- [x] Define the original two rods, three baits, and three fish using the canonical v1 configuration
  and supplied assets; the owner-directed expansion adds two rods, two baits, and five fish.
- [x] Install the owner's supplied art for all nine expanded entries and map it through the
  existing item catalog, preparation, discovery preview, catch, inventory, and buyer views.
- [x] Keep the 30-second initial attempt interval, rod chances, catch-condition multipliers, fish
  condition matrix, and non-uniform weight distributions in configuration/data. Time and sea state
  are server-authoritative. Existing rod/condition chance modifiers remain probability-only;
  the timing extension below has separate neutral defaults.
- [x] Persist the shared Pier's 30-minute UTC sea blocks and one revealed next state. Advance under
  `BEGIN IMMEDIATE`, including missed blocks and overrides; resolve attempts using effective sea at
  resolution time. Preserve existing balance, species, liveness, and no offline catches.
- [x] Provide a validated, server-derived Preparation preview from carried rod/bait, and reversible
  shared sea overrides in the existing authorized tools.
- [x] Resolve each attempt in the specified server order: validate physical Pier location,
  `FISHING` activity and carried selections; consume exactly one bait; roll catch probability;
  record no catch or roll species and weight, insert/merge the catch, and record the session result.
- [x] Make bait consumption, inventory mutation and session results
  atomic and idempotent. Concurrent requests, scheduled/forced attempts and retries cannot award
  or consume twice. Invalid/stale rod or bait stops safely before consumption.
- [x] Cap fish stacks at ten by species and bait stacks at 120. Preserve individual fish identities,
  weights, and stack membership. Fill a partial species stack before opening another slot; check
  capacity after bait consumption so the final bait may free a slot.
  - [x] Merge matching stackable cards on drop into the chosen target up to its item cap, retaining
    source overflow and fish specimen identities, within or across inventory and locker.
- [x] If a successful new-species catch still needs an unavailable slot, stop safely with
  `Fishing stopped: inventory full.` and record the result without inserting an excess item.
- [x] Support explicit `Stop Fishing`, automatic stopping on authoritative departure from the Pier,
  and safe stopping when selected equipment or bait becomes unavailable. Revalidate on every attempt.
- [x] Run only during active sessions; define simple server-side liveness and refresh/reconnect
  recovery without offline catches or catch-up replay. Persist authoritative inventory and session
  outcomes; refresh/restart must not duplicate attempts or rewards.
- [x] Keep F05-dependent XP rewards, Knowledge Points and fishing Knowledge bonuses deferred;
  do not invent a replacement progression system or add general NPC economy/regional travel to
  A01 v1. The owner-directed Fishing Store fish buyer is the bounded selling exception.
- [x] Add an authorized development/admin-only Fishing Debug Console backed by structured server
  logs and a UI view consistent with the architecture. Include every attempt trace field listed in
  [API_CONTRACTS.md](API_CONTRACTS.md#a01-developmentadmin-tooling),
  including validation, bait before/after, conditions, probability/RNG, species, weight, inventory
  result, XP marked not implemented/no mutation, and stop reason.
- [x] Add authorized force-next-attempt and individual time/sea overrides; optionally force
  the next attempt to succeed or to award a Trophy. Forced Trophy implies success and samples
  from the same species distribution's top 5%; all forced attempts use the same validation and
  mutation pipeline.
- [x] Add an authorized development/admin-only inventory tool: search/select any defined item,
  add/remove a chosen quantity, delete a stack and clear carried inventory; direct quantity setting
  is optional. Validate permissions, character ownership, item definitions, quantities and capacity
  server-side, log every mutation, persist real inventory and immediately reconcile the player UI.
  Preserve capacity unless an explicit, clearly labeled development override is provided and logged.
- [x] Extend the authorized inventory tool with a confirmed Clear Locker action that deletes only
  the operator character's stored stacks, audits the mutation, and refreshes ordinary inventory.
- [x] Let an authorized admin delete one selected item/stack from carried inventory or the city
  locker after confirmation, using the audited idempotent mutation and refreshing ordinary views.
- [x] Expose a clearly labeled Fishing test tools development/admin entry point after server
  authorization. Verify all four rods and five baits can be spawned through the guarded HTTP
  action, read through normal carried inventory, and retained after reopening persistence.
- [x] Reject unauthorized access to all new debug APIs and hide all debug controls/traces from
  ordinary players; a development client build alone is not authorization.
- [x] Keep deferred progression, general NPC economy, regional travel, fish traits, and journal
  systems out of A01. The bounded Fishing Store buyer and owner-requested per-character fish
  discovery reveal state remain within the selected slice.
- [x] Derive a shared 24-hour Frontier day from a four-hour real UTC period, with Dawn 05–08,
  Day 08–17, Dusk 17–20, and Night 20–05. Anchor an overridden clock at the selected phase start,
  keep it advancing through later phases, and make overrides clearable.
- [x] Persist first awarded catches as personal fish discoveries and provide an authorized reset
  that affects only the operator's discoveries, never inventory or attempt history.

### UI refinement
The checked items record earlier implementation work; the handoff acceptance below verifies the
new presentation. They do not constitute owner approval of the revised rendering.

- [x] Physically entering Fishing Pier automatically shows `Fishing` and its preparation entry in the
  right context panel. Previewing the destination does not permit preparation/commit as if present.
- [x] Preparation shows exactly Rod/Bait, their compact carried-item pickers, and a Possible Catches
  area. Undiscovered fish appear as black silhouettes with `???`; awarded catches reveal species.
  Selecting equipment never opens the full inventory drawer merely for that choice.
- [x] Show each discovered fish's percentage of the full eligible species score under its name;
  include undiscovered species in the denominator while hiding their percentages. The preview
  remains server-derived and keeps overall catch-success odds private.
- [x] Transform the same panel into the active Fishing view, showing selected rod, selected bait and
  remaining quantity, authoritative sea state, catches this session, latest catch/weight,
  and `Stop Fishing`. Keep it present, with no collapse/close action or separate activity page.
  Show Frontier time and effective phase in the shared HUD across all locations.
- [x] Provide loading, empty/missing equipment, disabled, pending, active, no-catch, catch, stopped,
  full-inventory and error feedback. Use real server data; retain keyboard access and responsive
  world/HUD/context behavior from [UI_TARGET.md](UI_TARGET.md).
- [x] Show no Manual/Auto choice, mandatory reeling, energy meter, overall catch-success odds,
  raw RNG values, or debug controls in ordinary player UI. The optional Reel Pull prompt is
  authorized by the owner-directed event scope below.
- [x] Show effective current sea and qualitative next-state outlook in Preparation and active Fishing;
  refresh at the boundary and on tab resume. The sea outlook remains separate from attempt progress.
- [x] Select one of twelve supplied Fishing Pier scenes from effective time and sea state, retaining
  the world/HUD/context shell and refreshes at both sea and Frontier phase boundaries.
- [x] Remove all world-scene caption overlays and crossfade scenery only after the incoming image
  loads, honoring reduced motion. Keep the authorized tools in a bounded nonmodal window that
  supports pointer/keyboard move and resize while leaving the world interactive.

### Current handoff acceptance
- [x] Refine earned Trophy catch feedback and stopped results, the selected-specimen collection
  with stable descending rows, and single inventory quantity badges. The
  [Trophy review pack](../artifacts/a01-trophy-review/REVIEW.md) records focused checks and captures;
  owner visual approval and complete final MVP verification remain pending.
- [x] Verify **Prepare tackle** opens preparation only and **Start fishing** commits valid carried
  selections. Both sockets show category, art, name, and bait quantity with a checkmark for selection;
  use one readiness message and no separate Select/Selected strip.
- [ ] Verify bounded desktop pickers and narrow dialog/sheet choices never displace the action footer.
  Selection, Close, and Escape return focus; long lists scroll internally and empty choices offer Inventory
  where useful. Confirm loading, stale items, pending requests, and repeated activation remain safe.
- [x] Review the compact shell, world-header location/Back/pin, large balances, Inventory naming, quiet
  account access, and authorized test-tools entry. Confirm complete scene/overlay alignment under
  one contain transform, identical condition-variant composition, and preserved navigation semantics.
- [x] Verify one dock conditions row agrees with the authoritative HUD phase and scene; show a concise
  qualitative sea outlook without exact transition time. Expired or
  failed refreshes await confirmation. Overrides remain clear in admin tools. The previous
  exclusion of attempt progress is superseded by the 2026-09-26 owner direction below.
- [x] Review idle, missing gear, picker-open, ready, active-before-catch, catch, no-catch, stopping,
  interruption, and error states. Keep bait remaining and latest catch prominent, preserve session
  results, and reconcile connection loss without clearing rewards or silently restarting.
- [ ] Capture **1366×768, 1440×900, 1920×1080**, **320×640**, and a **390px-wide** narrow layout;
  also check footer reachability at **1280×720**. Review keyboard/touch, zoom, long names/quantities,
  focus return, contrast, reduced motion, and resize state preservation. Record actual checks and
  owner visual approval separately; prior screenshots alone verify none of these interactions.

The 2026-09-24 [review pack](../artifacts/a01-handoff/REVIEW.md) records 109 passing tests,
all six measured capture sizes and the interaction checks actually performed. The two unchecked
items retain long-list stress and dedicated touch/screen-reader/zoom review for final verification;
they do not imply those broader checks were performed. Owner visual approval remains separate.

### Authoritative attempt-progress refinement acceptance — 2026-09-26

The owner-authorized progress ring replaces earlier no-attempt-progress instructions. These checks
apply only to A01; preserve F02/F03's `MVP_PASSED` history and leave owner visual approval pending.

- [x] Verify the active response exposes persisted attempt start, deadline, and duration with server
  time; neutral timing defaults now yield 30 seconds for every rod/time/sea combination. Separate
  configurable timing multipliers must not reuse catch-chance modifiers.
- [x] Verify each duration is fixed at scheduling, including persistence/reopen and condition
  changes mid-attempt. Subsequent timing conditions apply to the next attempt; catch probability
  still uses conditions at resolution. Exercise non-neutral configuration in tests only.
- [x] Recreate the supplied composition inside the existing context after confirmed Start fishing:
  fish icon and Fishing…, Good luck copy, cyan clockwise ring with fish silhouette, waiting/checking
  status, bait-consumption copy, compact loadout/conditions, catch results, and full-width Stop Fishing.
  Keep the world/HUD visible, results below progress, and the action footer reachable.
- [x] Verify server-time/monotonic-clock progress survives polling, rerender, refresh, reconnect, and
  tab resume. At full progress, wait for authoritative resolution with bounded reconciliation;
  never consume bait, award fish, trigger an attempt, or start a new cycle locally.
- [x] Verify unsuccessful and admin-forced attempts advance only from confirmed state, preserve
  the latest catch, and reject stale responses that would rewind a cycle or revive a stopped session.
- [x] Verify pending Start/Stop, inline stop cancel/confirm, failed requests, heartbeat expiry,
  exhausted final bait, missing equipment, inventory-full stops, and no offline catch-up. Never
  fabricate continued progress or restart automatically after a confirmed stop.
- [x] Verify progress semantics and meaningful announcements without frame-by-frame live updates,
  reduced motion with accurate progress, keyboard focus, contrast, touch targets, and reachable
  footer at 1366×768, 1440×900, 1920×1080, 320×640, 390px wide, and 1280×720.
- [x] Run required formatting, lint, typecheck, tests, and build; record actual focused and rendered
  evidence in PROJECT_STATE.md without treating automated/browser review as owner visual approval.


Verification: "npm run check" passed on 2026-09-26 (212 tests across 20 files and production build).
[Current review evidence](../artifacts/a01-attempt-progress/REVIEW.md) records measured viewports,
keyboard interaction, source fingerprint, and actual limits. Accessibility checks covered semantics,
phase-only announcements, absence of ring decoration, keyboard focus, nominal color contrast, and
target dimensions; dedicated physical touch/screen-reader and alternate OS motion/zoom sessions were
not performed. Owner visual approval and full A01 MVP verification remain pending.

### Fishing random-event extension acceptance — 2026-09-26

- [x] Persist five randomized opportunities in the specified active-hour windows; verify stopped,
  offline, reconnect, restart, and refresh behavior, 60-minute rollover, deferred opportunities,
  one active Reel Pull prompt, and consumed-on-show semantics.
- [x] Verify every natural opportunity offers Reel Pull. Forced prompts do not consume or reroll
  natural scheduling.
- [x] Verify Reel Pull immediately resolves the current attempt through the normal catch, bait, and
  next-schedule transaction; ignored, late, repeated, and concurrent activations cannot add an
  attempt or duplicate resolution/rewards.
- [x] Verify a Reel Pull offer expires five seconds after server creation or at cast resolution,
  whichever comes first; stale activation is rejected, and ignored casts continue normally.
- [x] Show the five-second response bar and restrained matching pulse without moving focus; hide the
  prompt at expiry, including during connection uncertainty, and retain an accurate static timer with
  reduced motion.
- [x] Use the owner-supplied Reel Pull recording for a newly observed offer, aligned to its remaining
  five-second window; stop on use/clear/expiry, skip restored prompts, and keep gameplay independent
  of blocked or unavailable audio.
- [x] Verify historical Surface Activity offers are hidden and rejected on activation, and neither
  pending nor previously used rows alter catch weights or later attempts.
- [x] Integrate compact optional prompts in the current progress/status area with pending, error,
  connection uncertainty, and completed-action feedback; preserve ring, Stop, sounds, and results.
- [x] Keep the guarded Reel Pull force action, valid-attempt/active-prompt disabling, and
  cycle/next/count/current/schedule information; remove the Surface Activity force action and
  weight comparison.
- [x] Verify persistence, authorization, stale intent, bait/catch/reward atomicity, inventory,
  discoveries, catch history, session stats, and unchanged condition/weight calculations.
- [x] Run formatting, lint, typecheck, tests, and build; record focused evidence separately from
  pending owner visual approval and full A01 MVP verification.

### Fishing content and condition expansion — 2026-09-26

- [x] Add all eight fish, five baits, and four rods to the existing catalog and preparation selectors.
- [x] Store the exact four-axis YES/NO matrix centrally; exclude any fish with a NO before preview
  and catch selection.
- [x] Keep the existing success roll and weighted picker; apply the four positive condition weights
  through one calculation function. Preserve existing item IDs and saved inventories.
- [x] Add a guarded catch-pool test panel for arbitrary time/sea/bait/rod combinations.
- [x] Verify matrix completeness, generalists, requested valid/invalid cases, persistence of a new
  species catch, and the full format/lint/typecheck/test/build gate.
- [ ] Owner visual approval and complete A01 MVP acceptance remain separate pending gates.

### Sea-state refinement acceptance
- [ ] Verify :00/:30 half-open boundaries, one committed promotion under independent-connection
  contention, restart and missed-block recovery, and no reroll on repeat reads.
- [ ] Verify preview/attempt agreement, no preview rewards or bait use, all force/clear states,
  eligible species membership across the expanded matrix, and ordinary/admin response separation.
- [ ] Verify all Frontier phase boundaries and six complete game days per real UTC day, all twelve
  Pier scene combinations, first-catch discovery persistence, and personal reset isolation.
- [ ] Review the rendered panel at 1366×768, 1440×900, 1920×1080, 320×640, and 390px wide with keyboard,
  touch, tab resume, loading/error recovery, and reachable Stop/Back. Owner visual approval remains
  a separate gate.

### MVP acceptance
- [ ] Navigate New Harbor → Harbor District → Fishing Pier. The activity appears only at the
  authoritative Pier location; no second Coast pier exists for A01.
- [ ] Prepare tackle changes only preparation UI. Pick only valid carried rods/bait through compact
  pickers; Start fishing sets `FISHING`. Reject missing, unowned, stored or stale selections.
- [ ] Exercise all configured time/sea states and all four rods through authorized overrides;
  verify the exact multiplicative formula and initial interval against configuration and debug logs.
- [ ] Verify a no-catch consumes exactly one bait; successful attempts use only fish with positive
  time, sea, bait, and rod factors and generate weight within each species' configured range.
  Verify the 20% Basic base chance with unchanged modifiers, the configured distribution favors
  ordinary sizes, and approximately 5% of each species' samples classify as Trophy.
- [ ] Catch all eight species and verify ten-fish stack limits, partial-stack insertion into a full
  pack, new-stack rejection when still full, and the final-bait-frees-slot case.
  Verify the exact inventory-full stop message and no excess or duplicate inventory mutation.
- [ ] Verify a session remains bound to its selected bait stack through final-bait resolution,
  never rolls over to another stack, and stops immediately on exhaustion. Inspect both full and
  partial fish stacks: stable descending numerical weights, Trophy badge, readable min/max gradient
  and arrow, three decimals for one-digit displayed kg weights and two from 10 kg onward,
  keyboard Back/Close, refresh and focus retention without
  stopping Fishing.
- [ ] During active Fishing, verify the latest catch appears above the current-session species
  summary and below the authoritative attempt-progress display. The summary updates counts and Trophy counts after awarded attempts; after
  stopping, keep that order and label the same summary Session complete.
- [ ] Verify the supplied water-exit cue plays once for a newly confirmed catch and stays silent on
  restored or duplicate snapshots and no-catch attempts. At Fishing Pier, independently mute and
  restore Reel event and Fish caught sounds from the Character sidebar or narrow-screen Account
  drawer; verify per-character browser persistence, immediate stop on mute, and visual feedback with
  audio blocked.
- [ ] Switch repeatedly among carried and locker fish stacks while scrolling the inventory drawer;
  verify only the selected stack inspector is visible at desktop and narrow sizes.
- [ ] Drag a carried stack into an empty locker, then drag a locker card into an empty carried slot;
  verify the whole stack transfers, persists after reload, and capacity/authorization errors appear
  without moving it. Verify same-container card swaps and empty-slot sorting still work.
- [ ] Verify a mixed fish stack displays a Trophy cue on its carried/locker card and drag preview,
  while ordinary stacks do not; refresh or move away the last Trophy and verify the cue disappears.
- [ ] Verify fish cards show the sum of their own known specimen weights at bottom right in kg,
  including carried, locker, and dragged cards. Mixed known/unknown stacks show `— kg`; non-fish
  cards have no weight. Transfers and refresh update the total without losing specimen identities.
- [ ] Force a Trophy through the authorized debug control; verify it implies success, uses the
  same 95th-percentile distribution, consumes one selected bait, respects capacity and idempotency,
  and rejects unauthorized or invalid requests.
- [ ] Transfer, split, merge, remove and reload fish across inventory and locker, verifying each
  specimen ID and known weight stays associated with exactly one stack and quantities remain exact.
  Reopen a legacy database with oversized stacks, known trace weights, missing weights and a full
  pack; verify no loss, explicit unknowns, and overflow moved to the city locker.
- [ ] Stop explicitly, depart through every applicable navigation path, exhaust bait, and remove or
  move selected equipment/bait. Confirm the stop prompt stays inside the activity panel at desktop
  and narrow widths; cancel/Escape sends no stop request and a confirmed stop sends
  one and shows the saved species counts, Trophy counts, and zero-catch state after
  refresh. No later invalid attempt consumes bait or awards a catch.
- [ ] After leaving the Pier from an active or already stopped session, return and verify the prior
  stop notice, session count, and latest catch are gone from the Pier panel. Confirm completed
  session records and caught fish remain saved, while a failed departure leaves the panel intact.
- [ ] Refresh/reconnect and restart against persisted state. Preserve committed results and prevent
  offline catch-up, duplicate attempts, duplicate bait consumption and duplicate rewards under
  retries, concurrent clients, navigation races and scheduled/forced-attempt races.
- [ ] Verify the active panel's real session/condition/inventory values and responsive, keyboard,
  loading, empty, disabled, pending, stopped and error states, including the authoritative progress
  ring and full-progress checking state, without a closing action.
- [ ] Inspect complete structured traces for success, no catch, validation failure and termination.
  Force attempts and override each condition; any optional force-success action still validates
  location, activity, equipment, bait and capacity.
- [ ] Use the inventory tool with all expanded fishing item definitions: add/remove, delete a stack
  and clear carried inventory or locker. Verify immediate real UI updates, persisted state, validation, normal
  capacity, audit logs, and any explicitly labeled optional development override.
- [ ] Reject debug/inventory mutation requests from ordinary or unauthenticated users, including
  forged item/character/quantity inputs; no debug UI, raw RNG or privileged traces reach players.
- [ ] Verify A01 awards no Character XP or Knowledge Points, applies no fishing Knowledge bonuses,
  and implements no regional travel or Coast Fishing Pier. Log no XP mutation. Verify Fishing Store
  specimen/stack sales pay once, enforce carried ownership and location, and preserve XP.
- [ ] Confirm all remaining [A01 v1 exclusions](GAME_DESIGN.md#15-fishing) remain unimplemented;
  journal, events beyond Reel Pull, formal records, unrelated fish traits and
  speculative APIs are absent.

**Unlocks:** N01, O01, V01

---

## A02 — Mining: Complete Vertical Slice

**Dependencies:** F02, F03, F04, F05, F06

### Goal
Create a second complete activity with a different resource identity and introduce material quality/purity.

### Build
- [ ] Mining satellite location.
- [ ] Mine sublocation.
- [ ] Tool requirements.
- [ ] Deposit definitions.
- [ ] Ore/resource batches.
- [ ] Purity/quality values.
- [ ] Automatic extraction cycle during active sessions, not unlimited offline mining.
- [ ] Optional rich-vein/equipment prompts.
- [ ] Equipment wear integration.
- [ ] Carry-weight/slot rules as selected.
- [ ] Character XP.
- [ ] Knowledge effects.
- [ ] Basic NPC commodity buyer.

### UI refinement
- [ ] Mining setup in the shared activity/context panel, preserving the world and inventory drawer.
- [ ] Deposit selection.
- [ ] Equipment state.
- [ ] Extraction feed.
- [ ] Quality/purity results.
- [ ] Inventory/capacity handling.

### MVP acceptance
- [ ] Player travels to mine.
- [ ] Starts mining with valid tool.
- [ ] Receives ore batches with differing purity.
- [ ] Knowledge/equipment changes measurable outcomes.
- [ ] Inventory limits apply.
- [ ] Ore can be sold or retained for refining.
- [ ] Tool wear persists if enabled.

**Unlocks:** A03

---

## A03 — Refining: Complete Vertical Slice

**Dependencies:** A02, F05, F06

### Goal
Turn mined resources into a distinct configuration/optimization activity.

### Build
- [ ] Refinery location.
- [ ] Input-batch selection.
- [ ] Process recipes.
- [ ] Temperature/process configuration.
- [ ] Speed vs quality tradeoffs.
- [ ] Waste calculation.
- [ ] Output purity.
- [ ] Batch duration.
- [ ] Optional process-correction prompt.
- [ ] Knowledge effects.
- [ ] Output inventory/storage.
- [ ] Character XP.

### UI refinement
- [ ] Refinery configuration UI.
- [ ] Clear input/output preview.
- [ ] Quality vs speed controls.
- [ ] Active batch state.
- [ ] Completion/results panel within the shared world shell.
- [ ] Avoid stock-market-dashboard appearance.

### MVP acceptance
- [ ] Player selects a real ore batch.
- [ ] Two different configurations produce meaningfully different results.
- [ ] Refining consumes inputs.
- [ ] Waste/output are persisted.
- [ ] Knowledge ability changes the result.
- [ ] Batch can complete while player is away if offline progression rules are active later; until then, normal server time completion must work.

**Unlocks:** A04, O01

---

## A04 — Blacksmithing: Complete Vertical Slice

**Dependencies:** A03, F05, F06

### Goal
Create the first full player-crafted equipment system.

### Build
- [ ] Blacksmith workshop.
- [ ] Recipes.
- [ ] Material selection.
- [ ] Input quality inheritance.
- [ ] Production method.
- [ ] Quality/durability/weight/edge-retention outputs.
- [ ] Crafted item instance with creator/provenance.
- [ ] Equipment compatibility.
- [ ] Character XP.
- [ ] Knowledge effects.
- [ ] Sellability.

### UI refinement
- [ ] Recipe selection.
- [ ] Material slots.
- [ ] Stat preview.
- [ ] Crafting configuration.
- [ ] Crafted-item result card.
- [ ] Creator/provenance display.

### MVP acceptance
- [ ] Player can use refined material to craft one complete item.
- [ ] Different materials/settings change item stats.
- [ ] Item shows creator.
- [ ] Item can be equipped if applicable.
- [ ] Item can be stored/sold.
- [ ] Character XP awarded.

**Unlocks:** M01, C01

---

## A05 — Hunting: Complete Vertical Slice

**Dependencies:** F02, F04, F05

### Goal
Create a gathering/PvE hybrid that resolves through tracking choices instead of the fishing/mining pattern.

### Build
- [ ] Hunting ground.
- [ ] Species tables.
- [ ] Weapon/ammo/bait/tracking preparation.
- [ ] Automatic hunt progression.
- [ ] Track events.
- [ ] Shot/wait/disengage decisions.
- [ ] Failure/injury possibilities.
- [ ] Meat/hide/trophy/specimen items.
- [ ] Character XP.
- [ ] Knowledge effects.

### UI refinement
- [ ] Hunt preparation.
- [ ] Tracking state.
- [ ] Encounter prompt.
- [ ] Result/loot panel within the shared world shell.
- [ ] Risk presentation.

### MVP acceptance
- [ ] Valid preparation is required.
- [ ] Hunt can succeed/fail.
- [ ] Player decisions alter outcome.
- [ ] Rewards enter inventory.
- [ ] Knowledge/gear materially affects results.
- [ ] Activity feels distinct from Fishing.

**Unlocks:** C01, E01

---

# SYSTEM EXPANSION TRACK

After the foundation is complete, these can be selected according to dependencies and priority.

---

## V01 — Personal Vehicles, Cargo, Fuel, Durability, and Upgrades

**Dependencies:** F02, F04, F06

### Goal
Turn transportation into an owned asset and logistics playstyle.

### Build
- [ ] Vehicle definitions/instances.
- [ ] Ownership.
- [ ] Purchase/sale.
- [ ] Fuel.
- [ ] Durability.
- [ ] Travel speed.
- [ ] Vehicle cargo.
- [ ] Vehicle access across a satellite hub.
- [ ] Cargo transfer.
- [ ] Upgrades: storage, tank, durability, speed.
- [ ] Repair.
- [ ] Knowledge effects.
- [ ] Travel integration.

### UI refinement
- [ ] Garage/vehicle panel within the shared world shell.
- [ ] Vehicle cargo.
- [ ] Travel-method comparison including owned vehicles.
- [ ] Upgrade slots.
- [ ] Fuel/durability without making UI feel like a spreadsheet.

### MVP acceptance
- [ ] Player buys a vehicle.
- [ ] Vehicle changes travel time/cargo capacity.
- [ ] Fuel is consumed.
- [ ] Fish/resources can be moved into vehicle cargo.
- [ ] Vehicle upgrades persist and alter behavior.
- [ ] Player can repair it.

**Unlocks:** L01, P02, E01

---

## P01-PLACEMENT — Bounded Furniture Placement Slice

**Selected:** 2026-09-27 by explicit owner direction. **Dependencies:** F02, F03 (`MVP_PASSED`).
F06 is waived only for this slice; full P01 retains its F06 dependency.

### Scope
- [x] Guarded development fixtures provide owned rooms and nonstackable furniture; ordinary new
      characters receive no property.
- [x] Select a carried furniture instance; show snapped grid ghost, footprint and invalid reason.
- [x] Place by click or explicit accessible control; rotate in 90-degree steps and move saved items.
- [x] Server validates ownership, host location, inventory eligibility, bounds and collisions.
- [x] Each successful action persists `{itemId, x, y, rotation}` atomically and survives reload.
- [x] Request-key replay, revision conflict and uncertain-outcome reconciliation prevent duplicates.
- [x] World shell, HUD, context and shared inventory drawer remain usable at acceptance sizes;
      exact-size rendered evidence is linked from `PROJECT_STATE.md`. Owner visual approval and
      final slice verification remain pending.
- [x] The 8×8 plot background follows the effective server Dawn/Day/Dusk/Night phase, waits for
      the requested image before replacing the current one, and preserves the existing grid and
      placement state. Phase selection and late-load handling have focused client coverage.
- [ ] Opening the room loads its initial yard phase without requiring a time-of-day change.
- [x] A temporary framed farm-bed visual fixture is available only in the guarded nonproduction
      room fixture, registers to the 2×2 grid, and draws no redundant tile slab under its sprite.
- [x] The bed has two authored axis views; placement rotation selects the matching view.
- [x] Allowlisted development admins can build the single fixed-orientation 1×1 tomato plant.
      It uses the ordinary red/green placement ghost and highlights one bed square; planters do not
      respond to hover. Occupied/outside-bed placement is rejected, and placed crops can be returned.
- [x] Crop placements persist in their own table and follow their bed when it moves; returning a
      bed with planted crops is rejected until the crops are removed.
- [x] Refreshing the browser while a room plot is open restores that room in the same tab; leaving
      the plot clears the restored view.
- [x] Returning a selected placed instance moves that same item to carried inventory with server-side
      capacity and revision checks.
- [x] A development-admin Build menu lists current furniture definitions and creates carried test
      instances for the existing placement flow; the build endpoint is unavailable in production.
- [x] Existing furniture tests and browser review cover placement, invalid cases, persistence and
      input.
- [ ] Crop-specific tests and browser review cover bed compatibility, red/green ghosting, occupied
      squares, persistence, retry safety, removal and accessible placement controls.

Purchases, economy integration, production property acquisition and property storage remain full-P01
work. Completing this slice does not pass full P01 or F06.

---

## P01 — Property Purchase and Personal Homestead

**Dependencies:** F02, F03, F06

### Goal
Make first property ownership optional, earned, useful, and customizable. Public facilities and
lockers remain viable alternatives; property is not an onboarding gift or progression prerequisite.

### Build
- [ ] Property listings.
- [ ] Purchase flow.
- [ ] Ownership.
- [ ] Instanced personal plot.
- [ ] Isometric grid placement model with individual functional objects, not a flattened image.
- [ ] Choose/document a bounded property renderer integration inside the React shell. Assess
  Phaser as a candidate, not a preselected dependency or whole-game migration.
- [ ] Define object scale, grid footprints, anchors, depth ordering, and supported rotation views.
- [ ] Keep ownership, placement/bounds/overlap, and layout persistence validated server-side.
- [ ] Place/move/rotate functional objects.
- [ ] Starter storage structure.
- [ ] Build/remove validation.
- [ ] Property storage.
- [ ] Persist layout.

### UI refinement
- [ ] Property listings.
- [ ] Property scene inside the world shell, with HUD, shared drawers, and object context panel.
- [ ] Build mode.
- [ ] Place/move/rotate UX with a snapped preview, click-to-place and explicit keyboard/touch
      controls with cancel/recovery.
- [ ] Functional-object interactions.
- [ ] Reference-aligned isometric grid and separate object sprites with correct scale/depth/rotation.

### MVP acceptance
- [ ] Player can earn/buy first property.
- [ ] Open property.
- [ ] Place storage structure.
- [ ] Move/rotate it.
- [ ] Store an item there.
- [ ] Refresh preserves exact layout, object positions/rotations, and stored items.
- [ ] Invalid placement/ownership is rejected; property storage remains location-gated.
- [ ] Objects remain independently selectable and functional; shared drawer use preserves layout.
- [ ] A player without property can continue using public facilities/lockers.

**Unlocks:** P02, O01

---

## P02 — Property Infrastructure: Power, Workshop, Greenhouse, Garage

**Dependencies:** P01, F05
**Optional dependencies for full integration:** V01

### Goal
Prove that Knowledge Atlas choices can change what a homestead can physically do.

### Build
- [ ] Functional building/object requirements.
- [ ] Solar Power object gated by Knowledge.
- [ ] Local infrastructure power concept if retained; never a universal daily character energy cap.
- [ ] Workshop object.
- [ ] Greenhouse object.
- [ ] Garage integration.
- [ ] Upgradeable structures.
- [ ] Production/storage hooks.

### UI refinement
- [ ] Infrastructure placement.
- [ ] Building details.
- [ ] Locked capability messaging.
- [ ] Upgrade interactions.

### MVP acceptance
- [ ] Player without Solar Power cannot place/use solar infrastructure.
- [ ] Unlocking Solar Power immediately enables it.
- [ ] At least two infrastructure types function differently.
- [ ] Property layout remains player-customizable.

**Unlocks:** O01

---

## M01 — Player Marketplace: Buy/Sell Orders and Unique Listings

**Dependencies:** F02, F06
**Recommended:** A04

### Goal
Introduce the player-driven economy without removing the NPC economic floor.

### Build
- [ ] Commodity buy orders.
- [ ] Commodity sell orders.
- [ ] Matching engine.
- [ ] Escrow.
- [ ] Fees if used.
- [ ] Order cancellation.
- [ ] Trade history.
- [ ] Unique-item listing for crafted/provenance items.
- [ ] Search/filter.
- [ ] Server-authoritative atomic transactions.
- [ ] Anti-duplication/concurrency tests.

### UI refinement
- [ ] Commodity market in a shared panel/drawer, retaining world context and storage permissions.
- [ ] Buy/sell order UX.
- [ ] Unique-item browser.
- [ ] Price/history display.
- [ ] Avoid finance-terminal overload.

### MVP acceptance
- [ ] Player A lists commodity.
- [ ] Player B buys it.
- [ ] Items/credits transfer exactly once.
- [ ] Partial fills work if supported.
- [ ] Crafted unique item can be listed and retains provenance.
- [ ] Concurrent purchase cannot duplicate an item.
- [ ] Executing trades grants no Character XP, Knowledge Points, or trading level.

**Use additional review depth for matching/transaction integrity when needed.**

**Unlocks:** S01, L01, N01

---

## C01 — Automatic Combat and PvE Encounter

**Dependencies:** F01, F02, F05
**Recommended:** A04 or seeded equipment

### Goal
Implement the browser-native automatic combat model.

### Build
- [ ] Combat stats.
- [ ] Equipment contributions.
- [ ] Knowledge contributions.
- [ ] Enemy definition.
- [ ] Automatic round resolver.
- [ ] Hit/miss/crit/block/status rules as chosen.
- [ ] HP/damage.
- [ ] Consumables/preparation if allowed.
- [ ] Combat log.
- [ ] Rewards.
- [ ] Defeat handling.
- [ ] Seed Street Bandit and one stronger PvE enemy.

### UI refinement
- [ ] Player card vs enemy card.
- [ ] HP bars.
- [ ] Gear/stats.
- [ ] Automatic round playback.
- [ ] Combat log.
- [ ] Victory/defeat.
- [ ] Explicitly avoid tactical-map/manual-movement presentation.

### MVP acceptance
- [ ] Same setup + deterministic seed produces reproducible fight.
- [ ] Better gear/build changes win probability/outcomes.
- [ ] Fight resolves without manual attack clicking.
- [ ] Victory grants reward/XP.
- [ ] Defeat correctly applies HP/result rules.
- [ ] Combat persists correctly if page refreshes during/after resolution.

**Use additional review depth for formulas/balance when needed.**

**Unlocks:** N01, E01, PVP01

---

## E01 — Expedition: Complete Vertical Slice

**Dependencies:** F02, F04, F05
**Recommended:** C01, V01

### Goal
Create a complete expedition with preparation, route progress, branching encounters, offline-safe defaults, and extraction.

### Build
- [ ] Expedition destination.
- [ ] Estimated duration/risk.
- [ ] Required/recommended supplies.
- [ ] Loadout.
- [ ] Policy: Cautious/Balanced/Aggressive.
- [ ] Priorities.
- [ ] Auto-retreat threshold.
- [ ] Route stages.
- [ ] Encounter generation.
- [ ] Manual response when online.
- [ ] Preset-policy response when offline/unanswered.
- [ ] Loot/cargo.
- [ ] Extraction.
- [ ] Character XP.
- [ ] Combat encounter integration if C01 complete.

### UI refinement
- [ ] Expedition preparation panel within the shared world shell.
- [ ] Route/progress presentation.
- [ ] Event prompt.
- [ ] Policy settings.
- [ ] Cargo/supplies.
- [ ] Extraction/results.

### MVP acceptance
- [ ] Player sees time/risk before departure.
- [ ] Player departs with valid supplies.
- [ ] At least three different events can occur.
- [ ] Manual choice changes outcome.
- [ ] Ignored event resolves via preset policy.
- [ ] Player can extract and retain secured loot.
- [ ] Expedition survives logout/relogin.

**Unlocks:** W01, PVP01, N01

---

## S01 — Chat, Local Presence, Profiles, and Player Interaction

**Dependencies:** F01, F03
**Recommended:** M01

### Goal
Make the shared world visibly multiplayer without controllable avatars.

### Build
- [ ] Global chat.
- [ ] Trade chat.
- [ ] City chat.
- [ ] Local/zone chat.
- [ ] Private messages.
- [ ] Presence count per location.
- [ ] Player profile.
- [ ] Current/last known public status as appropriate.
- [ ] Block/report/mute basics.
- [ ] Rate limiting/moderation hooks.

### UI refinement
- [ ] Persistent chat UX.
- [ ] Channel switching.
- [ ] Local presence.
- [ ] Player profile.
- [ ] Contextual interaction from listings/chat.

### MVP acceptance
- [ ] Two users can chat.
- [ ] Entering Coast changes local channel/presence.
- [ ] Private message works.
- [ ] Block/mute works.
- [ ] Page refresh reconnects safely.

**Unlocks:** N01

---

## N01 — Full New-Player Onboarding

**Dependencies:** F01–F06, A01, C01
**Recommended:** S01

### Goal
Turn the completed systems into the intended first 15–30 minute experience.

### Build
- [ ] New-arrival state.
- [ ] Welcome NPC.
- [ ] Guided city tour.
- [ ] Starter allowance/supplies.
- [ ] Tutorial gather action.
- [ ] Tutorial basic process/craft action using real game systems.
- [ ] Tutorial NPC buy/sell.
- [ ] Scripted bandit encounter using real combat system.
- [ ] Security/guard intervention.
- [ ] Leave player at low HP.
- [ ] Guide player to use consumable.
- [ ] Award enough XP for first Knowledge Point.
- [ ] Guided Knowledge Atlas interaction.
- [ ] Explicit tutorial completion.
- [ ] Remove mandatory objective chain after completion.
- [ ] Contextual tutorial framework for later systems.
- [ ] Skip rules for experienced/restarted players.

### UI refinement
- [ ] Compact arrival/tour panel within the shared world, not a permanent large welcome card.
- [ ] NPC dialogue/tour.
- [ ] Guided highlights.
- [ ] Combat interruption presentation.
- [ ] Knowledge Atlas introduction.
- [ ] Strong ending that returns control to the player rather than presenting four career buttons.

### MVP acceptance
A brand-new tester with no explanation can:
- [ ] finish onboarding;
- [ ] understand navigation;
- [ ] understand inventory;
- [ ] gather;
- [ ] process/craft;
- [ ] buy/sell;
- [ ] understand HP/consumables;
- [ ] understand automatic combat;
- [ ] level up;
- [ ] spend first Knowledge Point;
- [ ] reach the unrestricted city view;
- [ ] choose their own next action.

---

## O01 — Offline Progression and Login Summary

**Dependencies:** at least one timed activity plus F01
**Recommended:** A03, P01, E01

### Goal
Implement the rule: only things deliberately set in motion continue offline.

### Build
- [ ] Durable scheduled-action model.
- [ ] Server-authoritative completion timestamps.
- [ ] Completed-action settlement.
- [ ] Login summary.
- [ ] Integrate at least three real systems, such as refining batch, property crop/build, expedition.
- [ ] No generic “character farms while offline” behavior.
- [ ] Catch-up processing after downtime.
- [ ] Idempotency.

### UI refinement
- [ ] Active-jobs overview.
- [ ] Offline completion summary.
- [ ] Clear finish times.
- [ ] Compact “while you were away” presentation.

### MVP acceptance
- [ ] Start three supported jobs.
- [ ] Log out.
- [ ] Wait until completion.
- [ ] Log back in.
- [ ] All results settle exactly once.
- [ ] Summary explains what happened.
- [ ] Repeated refresh does not duplicate rewards.

**Use additional review depth for idempotency/job logic when needed.**

---

## L01 — Shipping and Logistics

**Dependencies:** F04, F02
**Recommended:** V01, M01

### Goal
Turn geographic inventory and transport into an economy system before adding PvP.

### Build
- [ ] Shipment creation.
- [ ] Origin/destination.
- [ ] Cargo selection.
- [ ] Capacity.
- [ ] Route options.
- [ ] Safe/trade/frontier/smuggler route definitions.
- [ ] Cost/time/risk preview.
- [ ] Dispatch.
- [ ] Arrival.
- [ ] Cargo escrow/in-transit state.
- [ ] Insurance baseline if retained.
- [ ] Delivery history.

### UI refinement
- [ ] Shipment builder.
- [ ] Route comparison.
- [ ] Cargo selection.
- [ ] In-transit tracking.
- [ ] Delivery result.

### MVP acceptance
- [ ] Create shipment.
- [ ] Cargo becomes unavailable while in transit.
- [ ] Different routes change time/cost.
- [ ] Safe shipment arrives correctly.
- [ ] Destination inventory receives cargo.
- [ ] Cancel/failed-state rules behave correctly.

**Unlocks:** PVP01

---

## PVP01 — Opt-In Shipment Interception

**Dependencies:** L01, C01
**Recommended:** V01, S01

### Goal
Create the first opt-in PvP system without open-world ganking.

### Build
- [ ] PvP-enabled routes.
- [ ] Interception eligibility.
- [ ] Raider preparation.
- [ ] Defender escort/security setup.
- [ ] Intelligence visibility rules.
- [ ] Combat integration.
- [ ] Partial cargo loss/capture.
- [ ] Insurance interaction.
- [ ] Anti-new-player/abuse constraints.
- [ ] Risk/reward tuning.
- [ ] PvP history.

### UI refinement
- [ ] Risk warning at shipment creation.
- [ ] Raider target/intel presentation.
- [ ] Defender prep.
- [ ] Interception result.
- [ ] Clear voluntary-risk communication.

### MVP acceptance
- [ ] Safe route cannot be intercepted.
- [ ] Frontier route explicitly opts cargo into PvP.
- [ ] Eligible raider can intercept.
- [ ] Combat resolves.
- [ ] Cargo outcome is correct.
- [ ] No item duplication/loss beyond intended rules.
- [ ] New-player protections work.

**Use additional review depth for interception integrity when needed.**

---

## R01 — Retirement and Legacy

**Dependencies:** F05
**Recommended:** several activity systems

### Goal
Make retirement meaningfully different from respec.

### Build
- [ ] Retirement eligibility.
- [ ] Retirement preview.
- [ ] Legacy reward calculation.
- [ ] Historical life record.
- [ ] Account-wide Legacy storage.
- [ ] New-character creation after retirement.
- [ ] Apply Legacy benefits.
- [ ] Preserve allowed heirlooms/history.
- [ ] Prevent accidental retirement.

### UI refinement
- [ ] Life-summary panel within the shared interface pattern.
- [ ] What-you-keep/what-you-lose preview.
- [ ] Legacy reward presentation.
- [ ] New-life start.
- [ ] Historical retired-life profile.

### MVP acceptance
- [ ] Eligible character can retire.
- [ ] Preview is accurate.
- [ ] Character current-life state resets according to rules.
- [ ] Account-wide Legacy persists.
- [ ] New character receives correct benefit.
- [ ] Retired life remains visible in history.

---

## MON01 — Premium Membership and Tradeable Voucher

**Dependencies:** F01, F06
**Recommended:** M01, O01

### Goal
Implement monetization under the rule: money may buy capital, not capability.

### Build
- [ ] Premium entitlement.
- [ ] Monthly premium benefits.
- [ ] Define benefits that do not directly grant Character XP or Knowledge Points.
- [ ] Premium voucher item.
- [ ] Voucher redemption.
- [ ] Voucher marketplace listing.
- [ ] Payment-provider integration.
- [ ] Purchase verification.
- [ ] Refund/failure handling.
- [ ] Entitlement expiry.
- [ ] Audit log.

### UI refinement
- [ ] Premium comparison.
- [ ] Purchase flow.
- [ ] Voucher inventory/listing.
- [ ] Membership status.
- [ ] Avoid manipulative dark patterns.

### MVP acceptance
- [ ] Test purchase grants voucher/entitlement exactly once.
- [ ] Voucher can be redeemed.
- [ ] Voucher can be sold through player market.
- [ ] Another player can buy/redeem it.
- [ ] No purchase directly grants XP/Knowledge Points.
- [ ] Expiry behaves correctly.

**Use additional review depth for payment/entitlement security when needed.**

---

## W01 — Frontier Discovery, Land Claims, and World Expansion

**Dependencies:** E01, P01
**Recommended:** M01

### Goal
Introduce scarce shared-world land only after exploration/property systems already work.

### Build
- [ ] Unknown/surveyed/mapped/claimable states.
- [ ] Discovery.
- [ ] Survey data.
- [ ] Claim rights.
- [ ] Claim purchase/auction.
- [ ] Ownership.
- [ ] Lease rights.
- [ ] Claim expiration/inactivity rules.
- [ ] Resource-site attachment.
- [ ] World-history record.
- [ ] Map reveal.

### UI refinement
- [ ] Known vs unknown frontier.
- [ ] Survey result.
- [ ] Claim/auction panel within the shared world interface.
- [ ] Ownership/lease detail.
- [ ] Historical discovery attribution.

### MVP acceptance
- [ ] Expedition discovers new site.
- [ ] Site progresses through discovery states.
- [ ] Eligible player claims/buys it.
- [ ] Ownership persists.
- [ ] Another player can interact through permitted lease/right.
- [ ] Inactivity/expiration rule can be simulated in test environment.

---

# HOW TO PICK WHAT TO BUILD NEXT

Do **not** treat this file as a mandatory linear sequence after the Foundation Track.

A stage is selectable when:
1. every listed dependency is `MVP_PASSED`;
2. no unresolved architecture decision blocks it;
3. it is marked `READY` in `PROJECT_STATE.md`.

Once F00–F06 are complete, choose from the ready stages using this priority order:

A01 v1 is an explicit exception to waiting for the full Foundation Track: it may be selected as
soon as F02/F03 pass and A01 is `READY`, using the same priorities below.

### 1. Unlock value
Prefer a stage that unlocks several later stages.

### 2. Core-fantasy value
Prefer work that better proves:
> “I can choose what kind of life I want.”

### 3. Player-test value
Prefer something real players can meaningfully test.

### 4. Risk reduction
If a difficult assumption could break the project, test it sooner.

Examples:
- automatic activity loop fun;
- Knowledge Atlas freedom;
- player marketplace concurrency;
- offline jobs;
- PvP fairness.

### 5. Variety
Avoid building five economy systems in a row if combat/social/exploration remain completely untested.

### 6. Personal motivation
When two stages are otherwise similar, build the one you are more excited to test.

## Suggested first path

A sensible first playable route is:

`F00 → F01 → F02 → F03 → A01 Fishing v1`

F04/F05/F06 remain separately selectable stages for later travel, progression, and economy integration.

After Fishing passes, the roadmap becomes flexible.

Good next candidates:
- **A02 Mining** to test a second gathering style;
- **C01 Combat** to prove the other side of the game;
- **P01 Property** to prove ownership/customization;
- **M01 Market** to prove player economy;
- **V01 Vehicles** to deepen preparation/logistics.

Do not automatically start any of them. Pick from the READY pool.

---

# STAGE STATUS VALUES

Use exactly these values in `PROJECT_STATE.md`:

- `BLOCKED`
- `READY`
- `SOL_BUILD`
- `READY_FOR_ASTRA_UI_DESIGN`
- `ASTRA_UI`
- `READY_FOR_SOL_PASS_TEST`
- `SOL_PASS_TEST`
- `MVP_PASSED`
- `MVP_FAILED`

A stage only satisfies dependencies when it is `MVP_PASSED`.
