# Frontier room art production guide

Status: owner-supplied Dawn, Day, Dusk and Night yard backgrounds integrated, 2026-09-28. The
remaining directional sprite and object-lighting guidance is proposed. The supplied backgrounds
are not owner approval of the final plot layout. Next, calibrate one asymmetric 2×1 piece in four
views before producing a larger catalogue.

## Current implementation and proposed delivery

The selected P01-PLACEMENT slice uses React, TypeScript and PixiJS 8.21.0. It loads the effective
server phase's yard background on 8×8 owned plots, draws a thin transparent grid and keeps
procedural furniture blocks, facing markers and ghost footprints. A phase change loads before
replacing the current background; an older in-flight load cannot replace a newer phase. All four
2560×1440 source images share the Day image's composition and registration. There is no directional
sprite manifest or object-lighting pipeline yet. Relevant code:

- [RoomCanvas.tsx](../src/room/RoomCanvas.tsx): Pixi drawing and pointer-to-cell input.
- [roomProjection.ts](../src/room/roomProjection.ts): 2:1 projection, based on 64×32 logical tiles.
- [depthOrder.ts](../src/room/depthOrder.ts): ordering from authoritative rectangular footprints.
- [roomTypes.ts](../shared/roomTypes.ts), [roomGeometry.ts](../shared/roomGeometry.ts): definitions,
  integer placement and footprint rotation. Artwork cannot alter collision or ownership.
- [inventory.ts](../server/inventory.ts): `chair` 1×1, `bench` 2×1 and `table` 2×2 artwork keys.
- [PropertyRoom.tsx](../src/components/PropertyRoom.tsx): placement UI and saved-state handling.
- [yard-day.webp](../src/assets/rooms/yard/yard-day.webp): the supplied 2560×1440 Day artwork.
- [yard-dawn.webp](../src/assets/rooms/yard/yard-dawn.webp),
  [yard-dusk.webp](../src/assets/rooms/yard/yard-dusk.webp) and
  [yard-night.webp](../src/assets/rooms/yard/yard-night.webp): matching phase variants.
- [temporary-farm-bed.png](../src/assets/furniture/temporary-farm-bed.png): a temporary visual
  fixture for experimenting with the supplied framed bed. The renderer registers its measured
  soil footprint and front corner to a 2×2 grid and omits the redundant tile fill below it. It does
  not establish farming or crop-placement rules.

The guarded development room is 8×8 cells. Production homes, buildings, purchase, storage and
additional room sizes remain future full-P01 work. See [the current slice](DEVELOPMENT_CHECKLIST.md#p01-placement--bounded-furniture-placement-slice)
and [property rules](GAME_DESIGN.md#property-interaction).

Recommended next art package:

| Asset                    | Proposed delivery                                         | Notes                                                          |
| ------------------------ | --------------------------------------------------------- | -------------------------------------------------------------- |
| Outdoor or windowed room | Four registered backgrounds: Dawn, Day, Dusk, Night       | Same room, floor, camera and geometry in every image           |
| Enclosed interior        | One neutral base may suffice                              | Use ambient/artificial lighting; four backgrounds are optional |
| Chair, bench, table      | Four neutral directional views per piece                  | 12 sprites total; true views of one design                     |
| Contact shadow           | Runtime graphic initially                                 | Do not bake a long directional shadow into each object         |
| Luminous objects         | Optional four matching emissive masks per luminous design | Not needed for the initial three unlit pieces                  |
| Inventory preview        | Derive from an approved directional sprite                | No separate AI redesign needed                                 |

Use four neutral views plus runtime lighting for each object. Sixteen fully painted images per
object—four facings times four phases—multiply generation, alignment and maintenance work.
Reserve special painted phase variants for an exceptional object whose appearance cannot be
represented by a tint and optional emission, after the basic pipeline is proven.

## Shared visual and camera specification

- Original Frontier artwork: clean, readable stylized isometric forms, restrained texture and
  clear material separation. Use the same approved reference sheet for every asset. A room-builder
  interaction does not require copying another game's artwork or switching to pixel art.
- Fixed orthographic 2:1 ground projection: grid axes run diagonally at approximately ±26.565°
  to the screen horizontal. Vertical object edges stay vertical. No perspective convergence,
  camera tilt changes, lens effects or depth of field. Avoid asking merely for “isometric”: many
  generators produce a different 30° projection.
- Author at a ground-tile basis of **256×128 pixels**, four times the current 64×32 logical basis.
  This is a proposed production target, not a validated final art scale or a change to room
  coordinates or collision cells. Confirm it in the first calibration integration.
- Treat one shared human-scale reference and the first approved 2×1 piece as scale standards. Furniture must
  look consistent beside that reference; do not stretch each sprite until it fills its footprint.
- No baked labels, selection outlines, grid highlights, UI, people, watermark, bounding boxes or
  floor diamonds in object exports. Grid lines and placement feedback remain coded overlays.
- Keep the silhouette within the declared footprint in plan view. Large decorative overhangs,
  bridges, multi-level objects and tall interlocking structures need a later occlusion design;
  the current renderer orders whole objects from rectangular floor footprints.

## Room backgrounds

Four phase backgrounds are recommended for outdoor or windowed environments whose scenery visibly
changes with daylight. An enclosed interior can use one neutral background plus ambient/artificial
lighting. Do not require four almost-identical images for every interior.

The owner's **2560×1440 WebP** is the current 8×8 Day master. Its floor corners are approximate;
the drawing is not a mathematically exact 2:1 diamond. The renderer draws it into a calibrated
1672×941 frame and registers the back landmark and horizontal floor span to its exact 2:1
placement grid. The visual floor perimeter can differ slightly from the coded outline, especially
at the side corners. The existing measurements below are coordinates in that calibrated frame:

| Ground point                | Source pixel position |
| --------------------------- | --------------------- |
| `(0,0)` back/top corner     | about `(836,69)`      |
| `(8,0)` right corner        | about `(1656,445)`    |
| `(8,8)` front/bottom corner | about `(836,900)`     |
| `(0,8)` left corner         | about `(16,445)`      |

The coded floor is still an 8×8 diamond, and placement uses 64×32 logical tile units. The current
yard registration uses source back `(836,69)` and horizontal floor span `1640` pixels, with
`s = 8 * projection.tileWidth / 1640`. Render the bitmap at `(projection.originX - 836*s,
projection.originY - 69*s)` with size `(1672*s,941*s)`. Future phase variants of this same yard
must retain these image dimensions and landmarks. A separate calibration overlay may show the
corners and grid during production; remove it from final artwork. Image editing from this exact
Day master is more reliable than regenerating each phase independently.

Keep this floor completely empty and unobstructed. Rear walls, windows and distant surroundings
may be baked into the background. Avoid foreground walls, foliage or props that should cover
moveable objects: these would require separate foreground layers, not an opaque flattened image.
Do not include the chair, bench, table, moveable lights or their shadows in a room background.

The Dawn, Day, Dusk and Night backgrounds are integrated. The phase images retain the shared
canvas dimensions and registration.
Change illumination and sky/window atmosphere only. Do not regenerate each scene independently.
Wall edges, floor seams, windows, doorways and environmental objects must remain pixel-registered.
Use soft ambient lighting over the placement area initially; strong baked sunbeams and floor
shadows are difficult to reconcile with arbitrary future furniture positions.

Proposed filenames:

```text
src/assets/rooms/yard/yard-dawn.webp
src/assets/rooms/yard/yard-day.webp
src/assets/rooms/yard/yard-dusk.webp
src/assets/rooms/yard/yard-night.webp
```

This template is specifically 8×8. Do not stretch it to disguise another room size. Future room
types require a matching registered template or a modular floor/wall renderer. The runtime must
map the sharp background and floor with the same projection; CSS `cover` for the main image would
misalign artwork and placement. The renderer keeps the procedural floor as a fallback and draws the
registered yard image behind transparent grid lines, placement cells and individual objects for
8×8 plots. A blurred copy may fill only the unused margins outside the registered scene.

## Object views, rotation and anchors

Use one original design and render its front, sides and back. Rotate the object around its vertical
axis while keeping the camera fixed. Rotating a flat PNG on the screen does not reveal another
side; mirroring cannot reproduce asymmetric doors, handles, chair backs or lettering. Symmetric
objects may use one or two unique textures after all orientations are checked: for example, four-way
symmetry can reuse one view, while a design with two identical opposing pairs can reuse two.
All four rotation entries and their anchors are still required in the manifest; texture reuse
does not remove orientation metadata or rotate a flat image into a new physical view.

Proposed physical-facing convention for imported art:

| Saved rotation / filename | Object's front faces | Screen direction |
| ------------------------- | -------------------- | ---------------- |
| `0` / `r000`              | `+x`                 | Lower right      |
| `90` / `r090`             | `+y`                 | Lower left       |
| `180` / `r180`            | `−x`                 | Upper left       |
| `270` / `r270`            | `−y`                 | Upper right      |

“Front” is the seat opening, drawer face, entrance or another marked feature on the reference
sheet. For symmetric designs choose and retain a reference front. This is a proposed art convention;
the current procedural facing markers are abstract cues and are not calibrated to this physical
front. Align those cues when sprites are integrated. Never change saved rotation values to make
an image fit. At 90/270 a 2×1 bench occupies 1×2 cells, while square footprints retain dimensions.

Deliver each view as a separate transparent **RGBA PNG**, with neutral diffuse illumination,
gentle material shading and subtle self-occlusion. No opaque floor, checkerboard pixels, baked
ground shadow or colored background. Keep the same canvas size for all four views of a design.
Recommended starting canvases at the 256×128 tile basis:

| Piece | Footprint at 0° | Canvas  | Ground anchor in the canvas |
| ----- | --------------- | ------- | --------------------------- |
| Chair | 1×1             | 512×512 | `(256,448)`                 |
| Bench | 2×1             | 512×512 | `(256,448)`                 |
| Table | 2×2             | 768×768 | `(384,704)`                 |

These canvases are production targets, not AI output-size guarantees. Align and pad generated
images in an editor after generation. Preserve the object scale; enlarge the canvas if an approved
silhouette clips. Do not shrink only the tall view. Large future buildings need a footprint-specific
canvas and height budget; the current furniture sizes are not a building contract.

The anchor is the **frontmost ground corner of the rotated footprint**, including empty transparent
space if no physical leg touches that corner. It is not the center of the visible pixels and is not
necessarily the bottommost opaque pixel. For rotated width `wR` and depth `dR`, display the anchor
at `project(x + wR, y + dR)`. Scale the sprite uniformly by `projection.tileWidth / 256`.

In source pixels, relative to anchor `(ax,ay)`, the footprint corners are:

```text
back  = (ax - 128*(wR-dR), ay - 64*(wR+dR))
right = (ax + 128*dR,      ay - 64*dR)
front = (ax,              ay)
left  = (ax - 128*wR,      ay - 64*wR)
```

Use a temporary diamond guide at these positions to align every view, then remove the guide.
For the 1×1 chair, the front anchor `(256,448)` gives a back point `(256,320)`, right `(384,384)`
and left `(128,384)`. The seat/back rises above that ground diamond. Rotating the object must not
cause the ground registration to jump.

Proposed filenames for each artwork key:

```text
src/assets/furniture/chair/chair-r000.png
src/assets/furniture/chair/chair-r090.png
src/assets/furniture/chair/chair-r180.png
src/assets/furniture/chair/chair-r270.png
```

Repeat for `bench`, `table` and later approved keys. Keep PNG masters; lossless WebP derivatives
or an atlas can be considered after alignment is verified. If frames are trimmed or packed later,
retain original canvas dimensions and offsets so trimming cannot shift anchors.

A future client art manifest should map each existing `artworkKey` to four texture URLs,
`sourceTileWidth: 256`, source dimensions and per-view anchor pixels. Record background origin,
tile size and room dimensions similarly. Art metadata belongs to presentation; server-owned
footprints and persisted `{itemId,x,y,rotation}` remain authoritative. An example specification:

```json
{
  "artworkKey": "chair",
  "sourceTileWidth": 256,
  "views": {
    "0": { "file": "chair-r000.png", "width": 512, "height": 512, "anchorX": 256, "anchorY": 448 },
    "90": { "file": "chair-r090.png", "width": 512, "height": 512, "anchorX": 256, "anchorY": 448 },
    "180": {
      "file": "chair-r180.png",
      "width": 512,
      "height": 512,
      "anchorX": 256,
      "anchorY": 448
    },
    "270": { "file": "chair-r270.png", "width": 512, "height": 512, "anchorX": 256, "anchorY": 448 }
  }
}
```

## Time-of-day lighting

The existing shared server clock already has Dawn 05:00–08:00, Day 08:00–17:00, Dusk 17:00–20:00
and Night 20:00–05:00, in a four-real-hour Frontier day. [App.tsx](../src/App.tsx) reads
`/api/world/state`, subscribes to `/api/world/events`, and passes `worldState` to
[LocationsPanel.tsx](../src/components/LocationsPanel.tsx). Use its effective
`conditions.timeOfDay`, including server overrides, rather than browser local time or a new clock.
[gameTime.ts](../server/gameTime.ts) owns boundaries. `LocationsPanel` passes the phase through
`PropertyRoom` to `RoomCanvas`. The renderer loads the selected background before replacing the
current one and ignores stale loads. This changes presentation only; no phase value is saved with a
room or placement.

Future object-lighting treatment, to tune against the approved assets:

| Phase | Background                                        | Object lighting                             | Contact shadow / emission                                     |
| ----- | ------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| Dawn  | Cool environment with restrained warm early light | Mild warm tint, preserve readable materials | Soft contact shadow; low window/lamp emission where present   |
| Day   | Neutral bright master                             | White tint / neutral source                 | Soft contact shadow; emission usually unnecessary             |
| Dusk  | Warm fading environment                           | Warm, slightly dimmer than Day              | Soft contact shadow; warm emission can increase               |
| Night | Cool blue environment, readable floor             | Cool dim tint, never near-black silhouettes | Subtle contact shadow; approved lamps/windows supply emission |

Pixi sprite tint is a multiply-like color adjustment, not physically based relighting. Start with
light, neutral source sprites so darkening them retains detail; tint cannot reconstruct hidden
surfaces, move a painted highlight or repair a baked directional shadow. Pixi provides sprite
anchors, texture replacement and tint; use separate containers/layers for neutral furniture,
emission and untouched UI. See the official [sprite guide](https://pixijs.com/8.x/guides/components/scene-objects/sprite)
and [tint guide](https://pixijs.com/8.x/guides/components/scene-objects#tinting).

For a future luminous object, supply `key-r000-emissive.png` through `key-r270-emissive.png`:
same canvas and anchor as the corresponding sprite, transparent everywhere except its lighted
windows/bulbs/screens. Runtime controls color/strength and, optionally, a restrained separate glow.
Do not tint the emission with the ambient furniture tint. Non-luminous furniture needs no mask.

Use procedural ground contact shadows first, sized from the footprint. Vary opacity softly by
phase. Long cast shadows, nearby lamps relighting other objects, normal maps and shadow occlusion
are separate rendering features; four painted views plus tint do not provide those effects.
Avoid promising them as part of this art package. No lighting changes affect gameplay or storage.

If object lighting is added, preserve the background behavior above, update background and object
lighting together, and keep the last working scene on a load failure. Any optional short crossfade
must honor reduced motion and preserve the draft, selection and saved positions. Keep validation
outlines and text legible in all phases. Background loading can use Pixi's existing
[Assets background loader](https://pixijs.com/8.x/guides/components/assets/background-loader).

## Reusable generation prompts

Attach the approved style sheet and exact grid/template whenever possible. Replace bracketed
fields; do not ask the generator to invent footprint dimensions or a new design on every request.

**New room master (for a separate future room; the yard already has its Day master)**

> Create original Frontier room artwork using the attached exact 8×8 floor calibration template.
> Fixed orthographic 2:1 isometric camera, diagonal ground axes at ±26.565 degrees, vertical wall
> edges vertical. 2560×1440 canvas. Match all template floor corners and its 256×128-pixel cell
> scale exactly. [Approved room description and materials.] Keep the entire diamond floor empty
> and visible. Only rear walls, windows and distant environment may be fixed scenery. Neutral
> daytime ambient lighting, soft illumination, readable stylized forms and restrained texture.
> No moveable furniture, people, foreground obstructions, UI, text, grid lines or watermark.

**Yard phases: edit the supplied Day image**

> Edit only the lighting and atmosphere of the exact supplied 1672×941 yard-day.webp to
> [Dawn / Dusk / Night].
> [Phase direction from the lighting table.] Preserve every pixel-aligned architectural edge,
> camera, floor corner, seam, scale, window, doorway and fixed object. Do not add, remove, rotate,
> recrop or redesign anything. Keep the empty placement floor readable. No UI, labels or furniture.

**Neutral object view**

> Produce one transparent sprite of the exact [object] in the attached approved design reference.
> [Material, silhouette, dimensions and distinctive front feature.] Fixed orthographic 2:1 camera
> matching the attached ground diamond, tile basis 256×128 pixels. Footprint [w]×[d] cells before
> rotation. Rotate the object about its vertical axis to [r000 front lower-right / r090 front
> lower-left / r180 front upper-left / r270 front upper-right]; keep the camera unchanged. Show
> the physically correct visible sides, including the real rear construction when facing away.
> Match the reference proportions, materials and details exactly. Neutral diffuse lighting and
> subtle self-shading, no baked ground shadow or colored environmental light. Entire object
> visible with transparent padding. Transparent RGBA background; no floor, grid, text or watermark.

**Emissive mask, only when needed**

> From this exact approved directional sprite, isolate only the [window/bulb/screen] emission on
> transparency. Preserve its canvas size, pixel placement and anchor. All non-emitting areas must
> be transparent. Do not move or redraw the object; no ground light pool or external glow.

AI-generated views can disagree on leg counts, hidden surfaces, scale and camera. A four-view
contact sheet helps inspect consistency but is not the runtime deliverable. Correct drift before
splitting/exporting; do not hide it with per-view stretching. If exact consistency is difficult,
use a simple reusable 3D model or manually corrected turnaround as the generation reference.

## Delivery checks and later integration

1. The Day yard is integrated. Produce one asymmetric 2×1 object in four directions and verify
   camera, scale, anchors, 2×1-to-1×2 rotation and depth before commissioning the object batch.
   Keep originals and approved reference sheets.
2. After calibration, deliver the room backgrounds appropriate to the environment, the approved
   object views, and a manifest/table of source sizes, footprint references, anchors and all four
   orientations. Optional masks must match their base files. Symmetric textures may be reused.
3. Check alpha on light and dark backdrops: no checkerboard, opaque halo, stray pixels or clipped
   silhouette. Overlay phase backgrounds to detect moved geometry; overlay directional ground
   guides to detect anchor or scale drift. Keep adjacent floor cells clear of unintended overhang.
4. The future renderer integration loads sprites by `artworkKey` and rotation, keeps existing depth
   order/collision logic, draws separate shadows, and preserves coded ghost/selection feedback.
   Missing art falls back to a recognizable procedural piece; it must not disappear or lose input.
5. Fit the complete approved art bounds, including tall objects and background margins, with one
   projection. The current fitter allocates floor bounds with limited headroom; tall sprites can
   clip if that fitter is retained unchanged. Do not independently scale sprites or background to
   conceal this. Keep background calibration and cell hit testing under the same transform.
6. Verify the four phases and four facings, non-square bench rotation, overlap/edge feedback, adjacent
   depth ordering, resize and drawer reopen, at the [UI target sizes](UI_TARGET.md).
   Phase changes must preserve the current draft and confirmed layout, including during a save.
7. Record the owner's approval of the exact integrated result separately. This proposed guide and
   existing placement tests do not approve future artwork or pass full P01.
