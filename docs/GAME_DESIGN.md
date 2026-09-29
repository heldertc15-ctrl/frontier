# FRONTIER — MASTER GAME DESIGN

> Working title: **Frontier**  
> Format: **Persistent browser sandbox**

---

# 1. CORE VISION

Frontier is a persistent browser sandbox where the player arrives as a newcomer to a growing city and builds whatever kind of life they want.

There are no preset classes or fixed career paths.

A player can:
- specialize deeply in one or two areas;
- mix unrelated capabilities into unusual builds;
- learn the basics of many different activities;
- become a broad generalist;
- eventually master nearly everything with enough time;
- keep playing the same character indefinitely;
- or eventually retire and begin a new life with Legacy benefits.

The game should support emergent identities created by the player rather than predefined careers.

Example:

> A player might become someone who fishes occasionally, repairs vehicles, collects antique fishing equipment, and flips rare items for profit.

The game never labels that player with a class. Their identity comes from what they actually choose to do.

## Core gameplay loop

**See opportunity → choose an activity → prepare → commit → resolve → gain rewards / XP / information / access → improve character / assets / position → repeat**

Long-term:

**Continue developing the same life indefinitely OR retire later for permanent Legacy benefits.**

## Core design principles

- Freedom over prescribed careers.
- No hard class selection.
- Breadth is viable.
- Depth is powerful.
- Total mastery is possible but extremely time-consuming.
- Preparation matters.
- Player interaction and the economy matter.
- Different activities should feel mechanically distinct.
- The world should feel persistent and shared.
- The interface should feel like a modern browser game.
- Player identity should emerge from choices, possessions, history, and abilities.

---

# 2. CHARACTER PROGRESSION

## Global Character XP

Activities do not have separate level systems.

Fishing does not have “Fishing Level 73.” Mining does not have “Mining Level 51.”

Instead, eligible activities grant global **Character XP**. Ordinary buying/selling does not award
trading XP; trading is market participation, not a separately leveled skill.

Examples:
- fishing;
- mining;
- crafting;
- fighting;
- discovering locations;
- completing contracts;
- refining;
- hunting;
- transporting goods;
- exploring;
- building;
- researching.

Character XP raises the player’s overall level.

## Character levels

Leveling grants **Knowledge Points**.

The XP curve becomes increasingly steep.

Early levels come quickly. Later levels require progressively more time and effort.

There is no need for a strict mastery cap. The curve itself makes extreme mastery rare.

## Initial character state

Each account begins with one persistent character at level 1, 0 Character XP, 100/100 HP, and 250
credits in New Harbor with an idle active status. Later stages may change these values only through
server-authoritative game rules; account funds never directly purchase XP, levels, or Knowledge Points.

## Breadth versus depth

Players can spend Knowledge Points however they want.

A player can:
- buy many inexpensive basic capabilities;
- specialize heavily in a smaller number of areas;
- mix several unrelated abilities;
- eventually unlock nearly everything with enough playtime.

---

# 3. KNOWLEDGE ATLAS

The Knowledge Atlas is a large searchable collection of passive skills, abilities, unlocks, and capabilities.

It is **not a traditional branching skill tree**.

Players spend Knowledge Points freely across the Atlas.

Abilities are independent and upgradeable, without prerequisite branches or prescribed combination
careers. Buying a higher rank upgrades that same ability; using its effects may still require the
relevant equipment, supplies, or facility.

Examples of Knowledge Atlas abilities:
- Solar Power
- Antique Appraisal
- Spearfishing
- Navigation
- Negotiation
- Mechanical Repair
- Ballistics
- Botany
- Field Medicine
- Deep Water Fishing
- Advanced Baiting
- Material Appraisal
- Gem Appraisal
- Greenhouse Climate Control
- Cartography
- First Aid
- Precision Rifling
- Night Navigation
- Advanced Storage

## Skill ranks

Many abilities can have multiple ranks.

Example:

**Mechanical Repair I → II → III → IV → V**

Higher ranks:
- cost more Knowledge Points;
- improve the effect;
- may unlock deeper or more specialized uses.

## Emergent build synergy

Abilities should interact naturally through the game systems rather than through thousands of predefined combo recipes.

Example:

Mechanical Repair may:
- reduce equipment wear;
- allow field repairs;
- restore damaged machinery.

Wilderness Foraging may:
- reveal wild resources;
- improve food sustainability outdoors.

Together, those abilities naturally make a player better at long, self-sufficient expeditions.

The game does not need to explicitly create a named “Wilderness Mechanic” build.

## Respec and retraining

Players may fully refund Knowledge Points with a retraining cooldown; changing a build takes time.

Rules:
- all invested Knowledge Points can eventually be recovered;
- retraining takes time;
- deeper investments take longer to unwind;
- early-game retraining can be easier to encourage experimentation.

The goal is:

> Players can change direction without permanently ruining a character, but they cannot instantly respec into the perfect build for every activity.

---

# 4. RETIREMENT AND LEGACY

Retirement is optional.

A player can keep the same character indefinitely.

Retirement is a prestige-style system for players who eventually want to begin again while preserving part of what the previous life accomplished.

Possible Legacy benefits:
- account-wide Legacy Points;
- heirloom perks;
- faster early progression;
- unique starting options;
- exclusive cosmetics or status;
- permanent account bonuses;
- historical badges;
- limited inherited heirlooms or assets.

The choice should be meaningful:

> Keep the current powerful character and continue their story  
> OR  
> retire them and strengthen the account permanently.

---

# 5. WORLD FOUNDATION

## Main city hub

New players arrive as newcomers to a large city that is actively accepting people from around the world.

The city provides:
- starter money;
- food;
- clothing;
- basic tools;
- orientation.

New arrivals are expected to contribute to the city and the surrounding frontier.

This provides the basic narrative reason for:
- new players continuing to arrive;
- city-run onboarding;
- world expansion;
- opportunities for newcomers.

## Launch world structure

At launch, the game should focus on:
- one main city hub;
- roughly 20 to 25 nearby satellite locations.

This keeps the early playerbase concentrated rather than splitting players between many cities.

Satellite locations can include:
- coastline;
- forests;
- mountains;
- farms;
- quarries;
- hunting grounds;
- wreck sites;
- frontier camps;
- caves;
- industrial sites.

Additional cities can appear later as the world and player population grow.

---

# 6. WORLD MAP AND FRONTIER

The game takes place in one persistent shared world.

The world is very large, but players only know part of it.

Conceptually:
1. Developed core
2. Frontier
3. Deep Frontier / unknown territory

New territory becomes known through exploration and world progression.

The world should expand because players discover and develop it, not simply because the game generates endless identical land.

## Land ownership

World land can be:
- discovered;
- surveyed;
- claimed;
- bought;
- sold;
- leased;
- subdivided;
- developed.

A single property can support multiple economic relationships, such as:
- land ownership;
- mining rights;
- warehouse leases;
- workshop tenants;
- transport contracts;
- security contracts.

Inactive property should eventually be able to return to circulation so abandoned accounts cannot permanently lock the world.

---

# 7. CITY NAVIGATION

Navigation follows:

**City → District → Location → Activity**

Example:

**New Harbor**  
→ Harbor District  
→ Fishing Pier  
→ Fishing  
→ Preparation

Fishing preparation and commitment follow the A01 v1 flow in section 15; entering the place alone
does not start the activity.

New Harbor's main districts are Harbor District, Market District, Industrial District,
Residential District, and City Centre. Its secondary city zones are Transit Hub and Outskirts.
The zones can be entered as city locations, but regional travel and exploration beyond the city
are unavailable until later stages. The former combined Civic & Residential location retains its
stable ID as Residential District; Civic Hall belongs to City Centre and Newcomer Housing belongs
to Residential District.

Example Harbor locations:
- Fishing Pier
- Shipyard
- Freight Terminal
- Boat Market
- Harbor Contracts
- Fishing Store

Example Industrial locations:
- Refinery
- Workshops
- Blacksmith
- Gunsmith
- Warehouses

## Favorites and discovered places

The layered city structure creates a sense of place, but players should not have to click through it repeatedly.

Players can:
- discover locations;
- browse them through a Places list;
- pin favorite locations;
- use pinned locations as quick-access shortcuts.

New Harbor begins discovered. Entering a connected district, zone, or place discovers it permanently for
that character. Entered districts, zones, and places may be pinned; the starting city cannot. In-city
navigation is instant. A character may pin up to five distinct locations; older saves above that limit
retain their pins and may remove them. This structure does not imply regional travel or activity
availability.

---

# 8. SATELLITE LOCATIONS

Satellite locations act as smaller hubs.

Example: Coastal Area

Possible destinations:
- Rocky Shore
- Diving Cove
- Wreck Site
- Local Trader
- Camp

These are broader satellite examples, not A01 destinations. A01 v1 uses the existing Fishing Pier
in New Harbor's Harbor District; do not create a second Coast Fishing Pier. F04's separate Coast
travel stage remains separate and is not an A01 v1 prerequisite.

A satellite location should contain only a handful of meaningful places so navigation stays simple.

Once at a satellite hub, most activities should be reachable in one or two clicks.

---

# 9. TRAVEL

## City travel

Travel within the main city is generally instant.

## Regional travel

Travel to satellite locations takes a short amount of real time.

Possible travel methods:

### Walking
- free;
- slow;
- limited carrying capacity.

### Public transport
- costs credits;
- faster;
- safe;
- does not provide personal cargo storage.

### Personal vehicle
- requires buying the vehicle;
- uses fuel;
- has durability;
- has cargo storage;
- can be upgraded;
- provides more flexibility.

Typical nearby travel times should create a sense of distance without becoming frustrating.

## Traveling state

While traveling, players may still:
- chat;
- browse markets;
- read messages;
- manage some menus.

They cannot begin activities that require them to physically be at another location.

---

# 10. PREPARATION AND GEOGRAPHIC INVENTORY

The player has limited carried inventory.

Stored items remain where they are stored.

Items held in:
- a locker;
- home storage;
- warehouse;
- workshop;
- city storage

remain accessible only at their authorized location. New Harbor's public locker permits access
throughout the city hierarchy; other storage follows its own location/access rules. Carried items
remain accessible wherever the character is, including travel, subject to action validation.
Opening an inventory drawer does not grant remote storage access.

Before traveling, the player decides what to bring.

If something important is forgotten, the player must:
- adapt;
- buy or obtain it locally;
- or travel back.

Preparation is therefore part of the gameplay.

---

# 11. VEHICLES

Vehicles are functional assets and can support entire player niches.

Possible vehicle statistics:
- storage capacity;
- fuel capacity;
- fuel efficiency;
- travel speed;
- durability;
- terrain capability;
- maintenance cost.

Players may:
- buy vehicles;
- sell vehicles;
- repair vehicles;
- upgrade storage;
- modify fuel tanks;
- improve durability;
- tune speed;
- specialize vehicles for cargo or exploration.

Players could build businesses around repairing or modifying other players’ vehicles.

## Vehicle cargo

When parked at a satellite location, the player’s vehicle cargo is accessible throughout that hub.

The player does not need to repeatedly walk back to the exact parking spot through menus.

---

# 12. INVENTORY AND STORAGE

Players have limited carried inventory.

F02 baseline: every character has ten carried item slots and a city locker in New Harbor. Items are
either stackable consumables or individual equipment/tools. The starter kit includes field rations,
bandages, a newcomer jacket, and a basic toolkit. Locker contents can only be viewed or moved while
the character is in New Harbor; future travel makes this geographic constraint meaningful.
Allowlisted development admins have 50 carried slots and 50 locker stack positions. Ordinary
characters retain ten carried slots and an unbounded locker.
Players can arrange carried stacks and city locker stacks by dragging whole item cards. Dropping
onto a different item swaps their positions within a container. Dropping a stackable item onto
another stack of that exact item fills the target to its cap, leaving overflow in the source; this
also works across carried inventory and the locker. Fish retain their individual specimen IDs and
weights. Dropping into an empty space keeps the card in that exact position. Reordering alone does
not change quantities, capacity, equipment, or stack membership. Items entering either container
use its first open space.
Moving a locker item to the last visible space does not create more spaces. Ordinary locker grids
extend only when stored stacks need positions beyond those already shown.

Inventory opens as a HUD drawer over the preserved world, not a separate page. The intended carried
access rule is not yet met outside New Harbor: the current GET endpoint rejects the whole inventory
response there. F04 must separate carried access from protected storage before regional travel ships.
See [API_CONTRACTS.md](API_CONTRACTS.md) for current versus planned behavior.

Food and fish do not spoil. There is no freshness decay or anti-spoilage perk requirement. Cooking
and processing may transform goods; no new balancing formula is implied.

Starter example:
- 10 inventory slots.

Storage can expand through:
- backpacks;
- vehicle cargo;
- public lockers;
- rented storage;
- warehouses;
- property storage;
- specialized containers.

Inventory pressure matters because it affects:
- gathering runs;
- loot decisions;
- consumables;
- travel planning;
- vehicle value;
- logistics.

---

# 13. NEW PLAYER EXPERIENCE

## Arrival

The player arrives in the main city as a new immigrant / newcomer.

An NPC welcomes them and gives a guided city tour.

The player receives:
- starter money;
- food;
- clothing;
- basic tools;
- basic supplies.

## Mandatory onboarding

The tutorial teaches universal mechanics:

1. Navigating the city
2. Basic gathering
3. Inventory management
4. Basic refining or crafting
5. Buying and selling with an NPC
6. Character XP
7. Leveling
8. First Knowledge Point
9. Knowledge Atlas

The activity shown during onboarding is only an example.

At the end, the NPC makes it clear that the player is now free to decide what to do.

## Combat introduction

During the city tour, a bandit attacks the player.

Combat begins automatically.

The player begins losing.

A city guard or security officer intervenes and ends the fight.

This introduces:
- HP;
- combat;
- the importance of gear and preparation;
- safe and dangerous areas.

The encounter leaves the player injured.

The NPC then guides them to open inventory and use food or a bandage, teaching:
- consumables;
- healing;
- equipment versus consumable items.

## Contextual tutorials

Advanced systems are taught when the player actually interacts with them.

Examples:
- first property purchase;
- first expedition;
- first vehicle;
- first advanced trade;
- first PvP activity;
- first workshop;
- first shipment.

Tutorials should be short and skippable.

---

# 14. CORE ACTIVITY STRUCTURE

Most game systems follow:

**Prepare → Commit → Resolution → Optional intervention → Outcome**

The resolution should differ by activity so everything does not feel identical. There is no
universal daily energy cap. Preparation, supplies, capacity, equipment, and time provide constraints.
Gathering runs automatically during active sessions with optional attention prompts; manual
activities do not silently become unlimited offline production. Only deliberately established
processes continue offline under section 30.

A01 Fishing v1 runs automatic attempts with an optional Reel Pull prompt. Section 15 defines its
full scope.

---

# 15. FISHING

## A01 v1 design lock

Owner-approved on 2026-09-23, with an owner-directed authoritative attempt-progress refinement on
2026-09-26 and the bounded Reel Pull extension, revised on 2026-09-27. These directions
supersede older prohibitions on fishing attempt progress indicators and optional events.
This section supersedes older Fishing
instructions and bounds A01 even where broader game examples describe later systems. A01 v1 requires
only **F02 and F03**, both `MVP_PASSED`; F01 is transitive through them. A01 is selected;
F04/F05/F06 remain separate `READY` stages, not prerequisites. This owner dependency correction
supersedes older A01 blocked-gate and conditional F05-integration guidance.
See [PROJECT_STATE.md](PROJECT_STATE.md) and
[DEVELOPMENT_CHECKLIST.md](DEVELOPMENT_CHECKLIST.md#a01--fishing-complete-vertical-slice).
This design approval is not approval of a rendered A01 implementation.

### Location and preparation

Use **New Harbor → Harbor District → Fishing Pier**, the existing place. Do not add a Coast pier.
When the character is physically at Fishing Pier, the right contextual panel automatically shows
**Fishing** and **Prepare tackle**. Previewing the Pier from elsewhere does not enable fishing.

**Prepare tackle** opens **Preparation** in that panel; it does not set the character's
activity to `FISHING`, consume bait, or schedule attempts. Preparation has exactly two slots:

| Slot | Eligible carried items |
| --- | --- |
| Rod | Basic Fishing Rod; Reinforced Fishing Rod; Surfcasting Rod; Heavy Game Rod |
| Bait | Worm Bait; Squid Bait; Crab Bait; Shrimp Bait; Fish Chunks Bait |

Each slot opens a compact eligible-item picker populated from real carried inventory. Locker or
other stored items are not eligible. Do not open the full inventory drawer just to choose equipment.
Validate possession and eligibility again on commitment and on every attempt. No additional hook,
lure, tackle, consumable, or saved-loadout slot is part of preparation.

Below the slots, retain **Possible Catches** after both carried items are selected. Its bounded
server-derived preview shows undiscovered species as black silhouettes labeled **???**. A species
is permanently discovered for that character when a successful catch enters inventory; subsequent
previews show its name, art, and percentage share of the current eligible species pool. Compute
each share as that species' normal condition-weighted score divided by the sum of all eligible
scores, including undiscovered species. Do not show an undiscovered fish's percentage or reveal its
name. These percentages are conditional on a successful catch, not the chance of catching any fish
on an attempt; later condition changes can change the actual attempt pool.
Discovery changes no catch chances or rewards. The authorized admin tool can clear only the
operator character's fish discoveries, returning the preview to silhouettes
without deleting fish, attempts, or session results. Do not add a journal or first-catch rewards.

With both valid selections, the player presses **Start fishing**. This action commits
the server-validated activity, sets character activity to **`FISHING`**, and starts automatic
attempts. There is no Manual/Auto choice, mandatory reeling minigame, energy meter,
stamina system, Fishing Level, or fishing class.

### World conditions and provisional balance configuration

Time of day and sea state are authoritative world state, not player-selected modifiers.
All players at the Pier see the same effective conditions. Admin overrides persist in the shared
world row until cleared; connected clients receive committed changes and scheduled transitions
from the server. Catch probability always uses authoritative conditions at resolution, including
when a client's display is reconnecting. An attempt's duration uses conditions when scheduled and
stays fixed until that attempt resolves unless Reel Pull ends it early; timing-condition changes apply
to the next attempt.
Authorized development/admin tooling can override time and sea independently for testing.
The fish condition matrix below determines species eligibility and relative weights at each attempt.

The shared Frontier clock has a 24-hour day every four real hours, anchored to 00:00 UTC at the
Unix epoch. One game hour takes ten real minutes, yielding six complete game days per real UTC day.
The half-open phases are Night 20:00–05:00, Dawn 05:00–08:00, Day 08:00–17:00, and Dusk
17:00–20:00. Server time chooses the scheduled phase and actual attempt condition. An authorized
time override persists until cleared and anchors the running clock at the phase start
(Dawn 05:00, Day 08:00, Dusk 17:00, Night 20:00). From there, time and phase advance
normally and the Pier artwork follows the effective phase. Clearing returns to the UTC-anchored
clock. Existing time multipliers stay unchanged.

At the shared Fishing Pier, scheduled sea state changes in half-hour UTC blocks at :00 and :30.
The current block and exactly one already-rolled next state persist. On the next authoritative
access after a boundary, the server promotes that next state and rolls a replacement for each
elapsed block in order. The transition chances are:

| From / To | Calm | Moderate | Dangerous |
| --- | ---: | ---: | ---: |
| Calm | 0.60 | 0.40 | 0 |
| Moderate | 0.25 | 0.55 | 0.20 |
| Dangerous | 0 | 0.65 | 0.35 |

Fresh schedules begin at the prior Moderate seed. A one-time upgrade treats a valid legacy sea
value as scheduled current; its earlier admin origin cannot be inferred. A testing sea override
persists until explicitly cleared, affects the shared Pier, and does not alter the schedule.
The player sees effective current sea and a short qualitative outlook for the committed next
state, without an exact transition time. The scheduled transition does
not clear an override. This outlook is separate from the current fishing attempt's progress ring.
Catch probability uses effective conditions at the
actual attempt time, including when a due attempt resolves just after a boundary. The Pier's
Preparation preview is derived from carried rod/bait and the same server calculation; it lists
only fish eligible under the current time, sea, bait, and rod, with conditional species shares
shown only for discovered fish.

| Rod | Base catch probability |
| --- | --- |
| Basic Fishing Rod | 20% |
| Reinforced Fishing Rod | 40% |
| Surfcasting Rod | 40% (provisional) |
| Heavy Game Rod | 40% (provisional) |

| Condition | State | Multiplier |
| --- | --- | --- |
| Time of day | Dawn | ×1.05 |
| Time of day | Day | ×1.00 |
| Time of day | Dusk | ×1.05 |
| Time of day | Night | ×0.95 |
| Sea state | Calm | ×1.05 |
| Sea state | Moderate | ×1.00 |
| Sea state | Dangerous | ×0.85 |

**Final catch probability = rod base chance × time modifier × sea modifier.**

The baseline catch-attempt duration is **30 seconds**, configured server-side. Rod and condition
timing configuration is separate from the catch-probability values above; all timing adjustments
remain neutral until specific speed values are approved. Do not reuse catch-chance multipliers as
speed modifiers. Schedule and persist each attempt's start, deadline, and resulting duration once;
refreshes, condition changes, or polling cannot reschedule it. Baseline duration, timing adjustments,
rod chances, catch-condition multipliers, species conditions, and weight generation parameters belong
in data/configuration, not scattered magic constants. These are provisional balance values, not
permanent design constants.
Bait does not modify catch success. The owner-directed content expansion uses all four conditions
to select species after a successful roll. Ordinary player UI shows only discovered species' share
of the normal eligible pool; it does not show the overall catch-success chance or raw RNG values.

### Authoritative attempt and stop rules

For each scheduled server attempt, in this order:

1. Confirm the character is still at Fishing Pier.
2. Confirm character activity is `FISHING`.
3. Confirm the selected rod and bait remain eligible and carried, with bait available.
4. Consume exactly **1** selected bait.
5. Roll the final catch probability using the current authoritative condition snapshot.
6. On failure, record a no-catch attempt in the active session; that bait remains consumed.
7. On success, exclude fish with any NO condition and roll a species from the remaining weighted pool.
8. Generate that catch's weight.
9. Add the catch to carried inventory, subject to the species-stack capacity rule below.
10. Record the result in the active fishing session.

Validation failure stops safely before consumption or RNG resolution. A session stays bound to the
specific selected bait stack. The attempt consuming its last bait resolves normally, then Fishing
stops even if another stack of that bait remains. A rod/bait that is no longer valid or carried
cannot produce a further catch. Explain the stop reason and never select replacement equipment.
Attempt results, bait consumption, and any catch
must commit atomically and idempotently; retries or competing requests cannot duplicate
attempts or rewards. A completed no-catch or capacity-stop attempt is still a recorded result.

The active panel shows the actual current attempt's progress from its authoritative timing snapshot.
The ring fills clockwise from empty to full and waits at full with **Checking for a bite…** until a
server response confirms the outcome and, if still active, the next scheduled attempt. A completed
ring never resolves an attempt, consumes bait, awards a fish, or guarantees a catch. The same rule
applies to unsuccessful and admin-forced attempts. Reconcile promptly without excessive polling;
refresh, reconnect, rerender, and tab resume must preserve the correct attempt and progress. A
connection error shows uncertainty, preserves earned results, and never fabricates continued cycles
or restarts a stopped session.

The owner's 2026-09-26 extension adds the optional fishing events below. Ignoring a prompt never
interrupts Fishing; there is no missed-prompt counter or mandatory response.

The player can explicitly press **Stop Fishing**. Confirm the choice within the activity panel
before submitting the stop; canceling keeps the session active. While Fishing is active, show the
latest catch above an authoritative current-session summary of awarded fish by species, including
counts and Trophy counts. Keep that order after a confirmed or automatic stop
while the player remains at the Pier; an empty session says no fish were caught. Leaving Fishing
Pier through any successful navigation path automatically stops the activity.
Merely previewing a destination or opening the inventory drawer does not leave the Pier or stop
fishing. Fishing operates only during active sessions: do not accrue offline attempts or replay
missed time on reconnect/server restart. Preserve completed results and inventory; keep
liveness/reconnect handling minimal, with no offline subsystem. After any successful departure
from the Pier, clear the prior session's stop notice, count, summary, and latest catch from the
live Pier panel, including on a later return. Keep the completed session recorded for history; a
new session starts with a fresh panel.

### Optional fishing events

Use controlled randomness over active fishing time, independent of cast count. Each 60-minute
cycle has one randomized opportunity in each window: 2–10, 14–22, 26–34, 38–46, and 50–58 minutes.
Inactive/offline time does not advance the clock. At 60 active minutes, generate the next cycle
without interrupting Fishing. Persist the clock and schedule;
refreshing or remounting must not reroll them. A due opportunity waits for a valid active attempt,
with only one prompt active at a time and one offer per attempt, including after use. Showing it
consumes that opportunity whether used or ignored; additional due opportunities wait for later casts.

Every opportunity offers Reel Pull. Keep the schedule windows and timing effect in central
configuration.

- **Reel Pull:** “Your rod jerks hard!” with **REEL!**. Activation immediately resolves the current
  attempt through the ordinary server catch roll, bait use, inventory, and next-attempt scheduling
  transaction. The response window lasts five seconds from the server's offer time, ending sooner if
  the cast resolves. It never adds an extra attempt, bait use, catch chance, XP, or other reward.
Prompts clear when used, expired, resolved, stopped, or cancelled. Ignored events use the normal countdown
and eligible species pool. Reel Pull does not change species weights.
Duplicate or stale event actions cannot affect a later attempt or duplicate catch resolution.
Place the compact message, five-second timer bar, and optional action in the existing central progress
area. Use a noticeable, restrained cyan-to-gold pulse on the message, bar, and action, with a static
reduced-motion presentation. Keep the fish silhouette/ring, world, and Stop action. Do not add modals
or large overlays.
Play the owner's supplied Reel Pull cue only when a new offer is observed during active Fishing.
Align it with the remaining five-second window and stop it when the offer is used, expired, or
cleared. Sound is supplemental and never changes the event or cast result.
Play the owner's supplied water-exit cue for a newly server-confirmed fish catch. At the Fishing Pier,
players can independently disable the Reel Pull and fish-caught cues from the Character area. These
browser-local choices do not change fishing outcomes.
The fish-caught cue uses the same playback gain as the Reel Pull cue.

Authorized testing controls force Reel Pull only during a valid active attempt and disable while
another prompt is active. It uses the same prompt and activation behavior as a natural event,
without consuming natural opportunities. Show cycle time, next due opportunity, natural events
shown this cycle, current prompt, and generated schedule in the restricted tools.

### Species, weights, and inventory

The owner's fishing expansion replaces the old three-species bait tables. For each fish, these
ordered condition weights are authoritative: time = Dawn/Day/Dusk/Night; sea =
Calm/Moderate/Dangerous; bait = Worm/Squid/Crab/Shrimp/Fish Chunks; rod =
Basic/Reinforced/Surfcasting/Heavy Game. **0 means NO and excludes the fish absolutely.**

| Fish | Time | Sea | Bait | Rod |
| --- | --- | --- | --- | --- |
| Sardine | 8/10/7/3 | 10/6/2 | 7/3/2/10/3 | 10/7/4/2 |
| Mackerel | 9/10/9/4 | 8/10/4 | 5/8/3/8/10 | 10/9/7/3 |
| Red Mullet | 7/10/7/3 | 10/7/2 | 10/5/7/10/4 | 10/8/7/2 |
| Seabass | 10/5/10/8 | 6/10/0 | 8/7/10/9/8 | 5/10/10/0 |
| Bluefin Tuna | 8/10/7/0 | 8/10/0 | 0/8/0/0/10 | 0/0/0/10 |
| Conger Eel | 4/0/8/10 | 8/10/6 | 0/10/6/0/10 | 0/5/10/8 |
| Barracuda | 10/6/10/0 | 10/8/0 | 0/7/0/0/10 | 0/7/10/7 |
| Swordfish | 0/0/6/10 | 0/8/10 | 0/10/0/0/8 | 0/0/0/10 |

After excluding any fish with a zero factor, the existing weighted picker uses a centralized
score: provisional species base weight × (time × sea × bait × rod) / 10,000. Existing Sardine,
Mackerel, and Tuna base rarity retains 70/25/5; added species use provisional 15/10/5/4/2
for Red Mullet/Seabass/Conger Eel/Barracuda/Swordfish. The four condition weights do not alter
the separate catch-success roll.

| Species | Provisional weight range |
| --- | --- |
| Sardine | 0.05–0.15 kg |
| Mackerel | 0.20–0.80 kg |
| Red Mullet | 0.20–1.50 kg (provisional) |
| Seabass | 0.50–12 kg (provisional) |
| Bluefin Tuna | 30–250 kg |
| Conger Eel | 1–50 kg (provisional) |
| Barracuda | 1–25 kg (provisional) |
| Swordfish | 50–300 kg (provisional) |

Each species uses a configurable non-uniform weight distribution that favors ordinary sizes and
makes progressively larger fish rarer. Sampling and the Trophy threshold use that same distribution;
Trophy begins at its 95th percentile, approximately the heaviest 5% of catches. Trophy is a
weight-based distinction only, with no reward or formal Record tier. Each awarded fish is a
persisted specimen with its own ID, weight, and stack membership. Ordinary fish carry no tier badge.
The species' full numerical min/max range remains distinct from the Trophy percentile. Player-facing
weights whose three-decimal rounding remains below 10 kg display three decimal places; larger
displayed weights use two (including values that round up to 10 kg);
retain the sampled precision in persistence,
sorting, and Trophy classification.

Fish stack by species up to **10 per stack**, irrespective of weight or Trophy status. Fill an
eligible partial stack before opening another slot. Bait stacks hold up to **120**. Each stack
occupies one carried slot. A partial fish stack can accept a catch even when all slots are occupied;
another stack requires an available slot after bait consumption. If a successful catch cannot fit,
stop and report exactly **Fishing stopped: inventory full.** Record consumed bait and the capacity
outcome without inserting a fish. The final bait may free a slot for its resolved catch. Food/fish
never spoil.

Inventory inspection lists the specimens in the selected stack, heaviest first, with stable ties,
numerical weights, and Trophy badges where applicable. A compact green-to-yellow-to-orange-to-red
bar marks each known weight's clamped position within its species min/max range, with endpoints and
readable text. Inspection and dismissal do not stop Fishing. Historical fish lacking recoverable
weights remain present with an explicit unknown-weight label; no weight is fabricated.
An inventory or locker fish stack shows a Trophy cue when at least one of its current specimens is
Trophy. The cue disappears when no Trophy fish remain; it does not change stacking or rewards.

### Active right-panel state

After the server confirms Start fishing, transform the existing right context panel into
**Fishing…** with a small fish icon and **Your line is in the water. Good luck!**; do not navigate to
another page. There is no collapse/close action for this active Fishing panel. Preserve location
orientation and a route out of the Pier; leaving stops fishing. Show real server-confirmed values:

- a prominent cyan circular attempt-progress ring with rounded ends and a fish silhouette inside,
  above the catch results; **Waiting for a bite…** while underway and **Checking for a bite…** when
  the deadline is reached but the result is not yet confirmed;
- **Each attempt consumes 1 bait.**;
- selected rod;
- selected bait and remaining quantity;
- one compact row of effective phase and sea state; the shared Frontier time and effective
  phase remain visible in the HUD;
- catches this session;
- latest catch and its weight;
- a full-width **Stop Fishing** footer button with a small stop icon and the existing inline confirmation.

Provide loading, empty, invalid/disabled setup, pending, active, no-catch, error, and stopped/result
states. Use accessible progress semantics without live announcements on every frame. Reduced motion
removes decorative movement while preserving accurate progress. Use the existing scene and shell,
compact pickers, and accessible controls described in
[UI_TARGET.md](UI_TARGET.md) and [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

### Development/admin testing tools

A01 includes a **Fishing Debug Console** and an **inventory testing tool** for authorized
developers/admins only. Both require server-side authorization; hiding controls or merely being
signed in is insufficient. Neither debug data nor controls may reach normal players. Prefer
structured server logging with a restricted development/admin UI in the existing architecture.
See [API_CONTRACTS.md](API_CONTRACTS.md#a01-developmentadmin-tooling) for
the current attempt log and mutation validation contracts.

Fishing controls: **Force next fishing attempt**, optional **Force next attempt to succeed**,
optional **Force next catch to be Trophy**, and independent time-of-day and sea-state overrides.
Forcing Trophy also forces a catch and samples its weight from the chosen species' top 5% of the
same distribution. Forced attempts still use authoritative validation, bait consumption, capacity
rules, and the same recorded attempt path.

The inventory tool must search/select any currently defined item; add a chosen quantity to the
current character's carried inventory; remove a chosen quantity from a carried stack; delete a
selected carried or locker item/stack; and clear carried inventory or the city locker. Admins can
also delete the selected item/stack from its ordinary inventory detail view after confirmation.
Directly setting a stack quantity is optional. It must support the full expanded
Fishing catalog through the real persisted inventory and immediately update the normal
inventory UI. Validate each action and log every admin inventory mutation. Normal capacity rules
apply unless the tool explicitly offers a clearly labeled development override; any such override
must be authorized and logged. Do not create a client-only testing inventory or require database edits.

### Progression, assets, and explicit exclusions

Global Character XP remains the only activity progression, but A01 v1 does not implement rewards
that depend on F05. Character XP rewards, Knowledge Points, and fishing Knowledge bonuses are deferred
to a separately scoped integration after F05 passes; log XP as not implemented/no mutation in v1.
An owner-directed A01 extension places one fish-buying NPC at the existing New Harbor Fishing Store.
Only carried fish can be sold there; locker fish must first be taken into the pack. Ordinary fish
earn a fixed per-fish credit price by species. A Trophy specimen earns a species-specific rate per
kg that increases with its weight above that species' Trophy threshold. The provisional prices are
Sardine 3 credits ordinary, Trophy 35–60 credits/kg; Mackerel 9 credits ordinary, Trophy 20–34
credits/kg; Bluefin Tuna 60 credits ordinary, Trophy 0.5–1 credits/kg.
New species use provisional prices: Red Mullet 9 ordinary / 20–34 Trophy credits/kg, Seabass
20 / 8–16, Conger Eel 30 / 4–8, Barracuda 30 / 6–12, and Swordfish 80 / 0.5–1.
The server quotes and pays
each specimen, including historical fish with unknown weight at the ordinary flat price. Selling
one specimen or a whole stack is atomic and repeat-safe. This bounded buyer does not start F06's
general NPC stock, purchasing, or merchant economy. Regional travel/any Coast Fishing Pier remains
deferred until after F04. Preserve existing character fields and completed functionality; do not
invent replacement progression. Buying/selling never grants XP or Knowledge Points.

Approved initial assets/items exist for **Basic Fishing Rod, Reinforced Fishing Rod, Worm Bait,
Squid Bait, Crab Bait, Sardine, Mackerel, and Bluefin Tuna**. Supplied approved assets are installed
in `public/assets/items/`. The owner supplied matching art for the other two rods, two baits, and
five fish on 2026-09-27; all expanded catalog entries now use those files in the same directory.
The supplied Pier artwork has one
2560×1440 scene for every time-of-day and sea-state combination. The effective conditions select
the scene.

**Do not implement in A01 v1**, even if broader game examples or earlier instructions mention them:

- F05-dependent Character XP rewards, Knowledge Points, general NPC merchant trade, regional travel,
  or a Coast Fishing Pier;
- fishing events beyond Reel Pull, or response rewards;
- Fisher's Journal or first-catch rewards beyond the per-character discovery reveal;
- Knowledge Atlas fishing bonuses, fishing-specific levels, or fishing classes;
- length, fish quality, formal records, specimen condition, grading, or provenance beyond the
  required specimen identity, weight, stack membership, and Trophy distinction;
- open-sea fishing, boats, nets, traps, hooks/lures/tackle, or saved loadouts;
- catch/release choices, fish economy balancing, or spoilage;
- energy/stamina, Manual/Auto selection, or reeling minigames;
- complex offline Fishing behavior or offline rod-fishing catch-up.

Keep only practical extension points in configuration, the Possible Catches layout, and the bounded
attempt service. Do not prebuild deferred systems, database models, controls, or speculative APIs.

---

# 16. MINING AND GATHERING

Mining and similar gathering activities depend on:
- location;
- resource deposit;
- equipment;
- preparation;
- Knowledge Atlas abilities;
- random discoveries.

Resources can have quality or purity.

Higher-quality materials can:
- sell for more;
- process more efficiently;
- produce better crafted goods.

Gathering supports both:
- automatic accumulation during active sessions;
- active attention for better results.

---

# 17. PROCESSING AND REFINING

Processing is more configuration-driven than gathering.

Players can choose:
- input material quality;
- machinery;
- temperature;
- throughput;
- additives;
- process method;
- speed versus quality.

Outputs may vary by:
- purity;
- waste;
- quality;
- durability;
- advanced properties.

Specialists can become known for producing extremely high-quality or efficient materials.

---

# 18. BLACKSMITHING

Blacksmithing can involve:
- recipe;
- material quality;
- carbon source;
- handle material;
- fuel;
- production method.

Possible tradeoffs:
- higher temperature = faster production but more defects;
- slower cooling = better durability;
- more material = heavier but stronger.

Crafted items can have individual statistics such as:
- Quality
- Durability
- Weight
- Edge Retention

---

# 19. GUNSMITHING

Gunsmithing uses modular components such as:
- barrel;
- receiver;
- stock;
- sights;
- magazine;
- ammunition type.

Players balance:
- accuracy;
- recoil;
- weight;
- reliability;
- damage;
- durability.

Different players can create very different versions of the same weapon family.

---

# 20. HUNTING

Players choose hunting grounds based on:
- species;
- risk;
- value;
- travel distance.

Preparation may include:
- weapon;
- ammunition;
- bait;
- tracking equipment;
- backpack.

The hunt progresses automatically, with occasional decisions.

Examples:
- Fresh tracks found: follow / bait / ignore
- Large animal spotted: shoot / wait / disengage

Possible rewards:
- meat;
- hides;
- trophies;
- specimens;
- Character XP.

---

# 21. EXPLORATION AND EXPEDITIONS

Expeditions involve:
- choosing a destination;
- preparing supplies;
- selecting transport;
- selecting equipment;
- possibly selecting crew;
- traveling;
- resolving events;
- deciding when to extract.

Before departure, show:
- estimated duration;
- expected encounters;
- risk;
- required supplies;
- recommended cargo capacity.

Players can define expedition behavior in advance:
- Cautious
- Balanced
- Aggressive
- prioritize loot
- prioritize discovery
- prioritize survival
- auto-retreat below chosen health threshold

If the player is offline, the expedition continues using these presets.

If the player is online, they can respond manually to encounters.

Example events:
- collapsed bridge;
- unknown structure;
- dangerous wildlife;
- hostile group;
- rare resource;
- injured traveler;
- damaged vehicle.

Expeditions should feel like:

> preparation + discovery + pushing your luck.

---

# 22. COMBAT

Combat is automatic and stat-based.

The player’s strategy happens primarily before the fight through:
- equipment;
- Knowledge Atlas build;
- consumables;
- preparation;
- stance;
- crew or companions where relevant.

Combat presentation includes:
- player card;
- enemy card;
- HP bars;
- equipment;
- important stats;
- automatic rounds;
- hits;
- critical hits;
- blocks;
- status effects;
- combat log.

Limited between-phase decisions may exist, but combat is not a manual tactical RPG.

---

# 23. PVE

PvE includes more than expeditions.

Possible PvE content:
- encounters;
- contracts;
- hunts;
- dangerous locations;
- world events;
- defense jobs;
- abandoned sites;
- bosses;
- salvage sites.

---

# 24. PVP

PvP should be largely structured and opt-in.

Possible PvP:
- duels;
- ranked fights;
- bounties;
- contested expeditions;
- contested resource sites;
- shipment interception;
- market competition;
- auction competition.

Normal progression should not require entering gank-heavy areas.

## Shipment interception

When sending cargo, the player chooses a route.

### Safe route
- slow;
- expensive;
- no PvP risk.

### Trade route
- moderate cost;
- moderate time;
- low risk.

### Frontier route
- cheap;
- fast;
- PvP-enabled.

### Smuggler route
- very fast or inexpensive;
- high risk;
- may allow restricted goods.

Shipment preparation may include:
- escorts;
- insurance;
- armored vehicles;
- decoy cargo;
- route secrecy;
- scouts;
- splitting cargo into multiple shipments.

This makes PvP risk something the player deliberately chooses for economic advantage.

---

# 25. PLAYER ECONOMY

The economy should be heavily player-driven.

Players can create value by:
- gathering;
- refining;
- crafting;
- transporting;
- repairing;
- modifying;
- trading;
- speculating;
- collecting;
- selling services.

High-end items should often come from other players rather than NPC stores.

## Marketplace

The market can support:
- buy orders;
- sell orders;
- market history;
- searchable goods;
- player auctions;
- land listings;
- rare-item listings.

NPCs can provide basic economic support for common items so the game remains playable with a small launch population.

---

# 26. ITEM QUALITY AND PROVENANCE

Resources and crafted items can have quality and purity.

Examples:
- ore purity;
- material quality;
- crafted durability;
- food quality;
- component quality.

Important items can retain history:
- creator;
- date created;
- materials used;
- previous owners;
- repairs;
- upgrades;
- combat history;
- rarity.

This supports:
- collectors;
- antique traders;
- respected craftspeople;
- player-created history.

---

# 27. PROPERTY AND HOMESTEADS

Players are not automatically given property.

Ownership should feel earned and remain optional. A viable character can use public facilities and
lockers without buying property; onboarding does not grant or require a home.

Possible assets include:
- lockers;
- workshop leases;
- boats;
- vehicles;
- land;
- houses;
- warehouses;
- commercial property.

## Property interaction

Personal property uses an isometric grid with individual functional objects and saved layouts,
not one flattened illustration. P01 owns a focused renderer integration within the existing browser
shell; the bounded placement slice uses PixiJS without a whole-game engine migration. Static
city/district views do not need to be assembled from tiles.

The selected P01-PLACEMENT slice proves placement with guarded development rooms and furniture.
It uses carried, nonstackable floor objects with rectangular footprints and four 90-degree views.
Choosing an item previews its footprint; only confirmed placement moves that exact item instance
from inventory into the owned room. Moving or rotating it preserves identity. Purchases, production
property acquisition and property storage remain in full P01; new ordinary characters receive no
property from this slice.

Players can:
- place structures;
- move them;
- rotate them;
- organize layouts;
- customize appearance;
- interact with functional objects.

Examples:
- storage;
- workshop;
- greenhouse;
- solar panels;
- garage;
- laboratory;
- refining equipment.

The system should feel flexible like a room / lot builder, but all functional objects matter to gameplay.
Object assets require consistent scale, grid footprints, anchors, depth ordering, and supported
rotation views. Placement, ownership, storage access, and persisted layout validation remain
server-authoritative. See [UI_TARGET.md](UI_TARGET.md) for the renderer boundary.

---

# 28. SOCIAL SYSTEMS

The game does not require controllable walking avatars.

Players are visible through:
- chat;
- markets;
- contracts;
- listings;
- property ownership;
- shipments;
- crafted items;
- player profiles;
- groups or guilds;
- local activity.

Possible chat channels:
- Global
- Trade
- City
- Local / Zone
- Guild
- Private Messages

Entering a location can automatically join its local chat.

---

# 29. CONTRACTS

Contracts can be created by the world or by players.

Examples:
- deliver goods;
- manufacture a specific quality item;
- transport cargo;
- escort a shipment;
- survey land;
- locate a resource;
- recover an artifact;
- repair equipment;
- defeat a target;
- investigate a site.

Contracts create player-generated objectives without relying entirely on scripted quests.

---

# 30. OFFLINE PROGRESSION

Core rule:

> The character does not magically keep playing while offline. Things deliberately set in motion continue.

Possible offline activities:
- refining batches;
- crops growing;
- fishing nets and traps;
- market orders;
- shipment travel;
- vehicle repairs;
- vehicle upgrades;
- construction;
- manufacturing;
- healing;
- expeditions using preset policies.

When the player returns, they see a concise summary of completed events.

Example:

> Steel batch finished  
> 3 market orders filled  
> Fishing nets caught 14 fish  
> Vehicle repair complete  
> Shipment arrived safely  
> Greenhouse crops ready

---

# 31. MONETIZATION

## Premium membership

The game is free to play with an optional premium membership.

Premium should provide meaningful convenience and scale without directly granting character capability.

Potential Premium benefits:
- additional production queues;
- more market listings;
- longer offline windows;
- additional management capacity;
- additional property slots;
- more saved Knowledge Atlas plans;
- advanced market analytics;
- more notification rules;
- advanced inventory tools;
- UI customization.

## Premium vouchers

Players can buy premium vouchers with real money.

A voucher can:
- be redeemed for Premium;
- or be sold to another player for in-game credits.

This creates a sanctioned real-money-to-capital path.

Core monetization rule:

> **Money may buy capital, but not capability.**

Real money should not directly grant:
- Character XP;
- Knowledge Points;
- level requirements;
- skill unlocks.

A player may buy credits indirectly, but still needs to earn the character progression required to use advanced equipment or systems.

---

# 32. UI AND VISUAL DIRECTION

The game uses a world-first browser interface. [UI_TARGET.md](UI_TARGET.md) is the presentation
specification: a browser-viewport world, compact navigation, persistent left HUD, right contextual
preview with explicit enter actions, and reusable inventory/Character/Knowledge panels that preserve
world state. Hover/selection never moves the character or records discovery. Desktop world use has
no document scroll; bounded panels and the narrow-screen fallback keep controls reachable.

Core UI elements:
- panels;
- tabs;
- inventory grids;
- item cards;
- lists;
- progress bars;
- chat;
- market interfaces;
- city and location views;
- compact information panels.

AI-generated imagery may supply text-free game assets, including large static city/district scenes and:
- items;
- fish;
- weapons;
- vehicles;
- buildings;
- locations;
- icons;
- artifacts;
- background illustrations.

The actual interface should be coded and consistent.

## Left sidebar

The compact character HUD shows existing values:
- character name / portrait;
- Character Level;
- XP;
- HP;
- money;
- inventory capacity;
- active activity;
- shared Frontier time and effective phase.

The world-stage header provides current location, Back to parent, and pin controls. Pinned shortcuts
remain in Quick Travel. Do not duplicate the location or add unsupported statistics to fill the HUD.

The sidebar answers:

> Who am I?  
> What do I have?  
> What am I doing?

The main screen answers:

> Where can I go?  
> What can I interact with?

---

# 33. CURRENT GAME DESCRIPTION

**Frontier is a persistent browser sandbox where you arrive as a newcomer to a growing city and build whatever kind of life you want. There are no classes or preset careers. Eligible activities give Character XP, which earns Knowledge Points that can be spent freely across a large Knowledge Atlas of passive abilities, unlocks, and capabilities. You can specialize deeply, learn a little of everything, or eventually master nearly everything. The world revolves around preparation, travel, gathering, crafting, trade, exploration, combat, property, logistics, and player interaction. You can keep the same character indefinitely or eventually retire and begin again with permanent Legacy benefits.**

---

# 34. DESIGN NORTH STAR

Every new feature should support these principles:

1. Give the player meaningful freedom.
2. Reward preparation and decision-making.
3. Interact with multiple other game systems.
4. Support both specialists and generalists.
5. Create opportunities for player-to-player interaction.
6. Remain understandable through a browser-game interface.
7. Avoid forcing classes or preset careers.
8. Preserve long-term character identity.
9. Allow new players to understand the game without being railroaded.
10. Feel like part of one coherent sandbox.
