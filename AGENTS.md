# AGENTS.md — FRONTIER

## Purpose

This repository contains **Frontier**, a persistent browser sandbox game.

This file is a map to the project's source-of-truth documents. Do not treat this file as the full game design.

## Read before making changes

Always read the relevant sections of:

1. `docs/GAME_DESIGN.md`
2. `docs/DEVELOPMENT_CHECKLIST.md`
3. `docs/PROJECT_STATE.md`
4. `docs/ARCHITECTURE.md` if present
5. `docs/API_CONTRACTS.md` if present
6. `docs/DESIGN_SYSTEM.md` if present
7. [UI target](docs/UI_TARGET.md) for presentation or interaction changes

Current explicit owner directions take precedence over older documentation. During an authorized
alignment task, replace the identified conflicting instructions rather than stopping over those
known conflicts. Report only essential unresolved product decisions; do not invent new mechanics.

## Documentation-only maintenance

An explicitly documentation-only task is exempt from the implementation/UI/test cycle below.
Read relevant documents and supplied evidence, revise only authorized Markdown, and check links,
consistency, stage dependencies, and the allowed-file diff. Do not launch the app, run builds/tests,
install dependencies, generate artwork, change code/assets/data, or start a stage. Preserve recorded
verification history and distinguish planned changes from current implementation. No fresh runtime
or owner approval may be inferred. Stop with the requested documentation deliverable.

## Core product rules

- Frontier is a browser-first persistent sandbox.
- There are no fixed player classes or careers.
- Eligible activities grant global Character XP; ordinary buying/selling grants no trading XP.
- Character levels grant Knowledge Points.
- Knowledge Points are spent freely on independent, upgradeable abilities in a searchable Knowledge Atlas, without prerequisite branches or fixed combination careers.
- The activity a player performs must not dictate what they are forced to become.
- Preparation, geographic inventory, travel, player economy, and persistent world state matter.
- Combat is primarily automatic/stat-based and browser-game-native.
- Avoid turning the UI into a cinematic RPG or a spreadsheet/finance dashboard.
- The viewport world, HUD, contextual panels, and inventory drawer follow `docs/UI_TARGET.md`.
- Static city/district artwork can fill the world surface; labels and controls are coded overlays.
- Property is optional and earned; P01 owns a separate object/grid renderer decision.
- Food/fish do not spoil; no universal daily energy cap or automatic offline manual gathering.
- Gather automatically in active sessions with optional prompts; only deliberately established processes continue offline.
- Money may buy capital, but must not directly buy Character XP, Knowledge Points, or progression requirements.

## Stage discipline

Work on **one selected stage at a time**.

Do not begin another development stage automatically after finishing the current one.

Before coding:

- confirm the selected stage ID;
- read its dependencies and MVP acceptance tests;
- confirm all dependencies are `MVP_PASSED` in `docs/PROJECT_STATE.md`.

If dependencies are not passed, stop and report the blocker.

## Implementation phase

Roles are model-neutral. Existing status identifiers and exact handoff phrases below are retained
for compatibility; their model names do not mandate a particular model or reasoning level.

During an implementation pass:

- implement the complete functional feature slice;
- handle persistence and validation;
- keep game logic server-authoritative where relevant;
- add/update tests;
- provide a functional UI sufficient for testing;
- update architecture/API docs when behavior changes;
- do not spend the pass redesigning polished UI.

When the implementation is functionally ready for visual refinement:

1. set stage status to `READY_FOR_ASTRA_UI_DESIGN`;
2. summarize what is implemented and any UI constraints;
3. end the response with exactly:

`READY FOR ASTRA UI DESIGN — <STAGE_ID>`

## UI refinement phase

During a UI refinement pass:

- preserve game rules, schemas, APIs, and contracts;
- do not invent or modify backend mechanics unless explicitly asked;
- refine the selected stage's UX and visual design;
- implement loading, empty, disabled, error, active, success, and completion states as relevant;
- keep the interface modern-clean and browser-game-first;
- follow `docs/UI_TARGET.md` and reuse the corrected design system;
- do not break accessibility or responsive behavior.

When the scoped UI pass is complete:

1. record owner visual approval separately as pending unless the owner approved this exact result;
2. set stage status to `READY_FOR_SOL_PASS_TEST`;
3. summarize visual/interaction changes and the owner-review evidence;
4. end the response with exactly:

`READY FOR SOL PASS TEST — <STAGE_ID>`

## Owner visual approval

For F03's presentation repair, show the rendered acceptance sizes from `docs/UI_TARGET.md` and
record the owner's explicit approval, date, and reviewed revision in `docs/PROJECT_STATE.md`.
Passing automated tests or another agent's browser review does not approve appearance. If approval
is pending or changes are requested, retain the non-passed stage status and report that gate.
Do not reset F00-F02 or mark functional work failed solely because visual approval is pending.

## Final verification phase

During final verification:

- review the UI changes;
- wire/fix integration issues;
- run formatting/lint/typecheck/tests;
- execute the stage's MVP acceptance test from beginning to end;
- fix regressions;
- update docs and `PROJECT_STATE.md`.

If every acceptance criterion passes and any required owner visual approval covers this result:

- set status to `MVP_PASSED`;
- end exactly:

`MVP PASSED — <STAGE_ID>`

If functional acceptance remains broken:

- set status to `MVP_FAILED`;
- do not proceed to another stage;
- end exactly:

`MVP FAILED — <STAGE_ID>: <short reason>`

## Coding standards

- Prefer simple, explicit code over clever abstractions.
- Avoid premature abstraction across activities until at least two real activities prove the abstraction.
- Do not add dependencies without a clear need.
- Avoid duplicating core game rules between client and server.
- Never trust the client for money, inventory, XP, Knowledge Points, market trades, combat results, or rewards.
- Make timed/offline operations idempotent.
- Transactions that move scarce items or currency must be atomic.
- Every persistent gameplay feature needs a test or reproducible verification path.

## Documentation rules

When introducing a durable game rule:

- update `docs/GAME_DESIGN.md`.

When changing a technical contract:

- update `docs/API_CONTRACTS.md`.

When making a durable architecture decision:

- update `docs/ARCHITECTURE.md`.

When completing or blocking a stage:

- update `docs/PROJECT_STATE.md`.

Keep docs concise and current. Do not preserve obsolete brainstorm history in source-of-truth files.

## Development priority

After the Foundation Track, do not blindly follow numeric order.

Choose only from stages whose dependencies have passed and whose status is `READY`.

When several are ready, prefer:

1. stages that unlock more dependencies;
2. stages that test the core sandbox fantasy;
3. stages that yield meaningful player testing;
4. stages that reduce major technical/design risk;
5. variety across economy, exploration, ownership, combat, and social systems.
