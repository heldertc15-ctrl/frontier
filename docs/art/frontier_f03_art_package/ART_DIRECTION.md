# Frontier Art Direction — F03 City & District Visual Reference

## Purpose

This document defines the visual direction for the first illustrated location screens in Frontier, beginning with the main city and early districts. These images are reference artwork for UI integration, not final marketing illustrations.

## Core visual identity

- **Mood:** grounded, calm, exploratory, slightly aspirational
- **Style:** illustrated environment art for a browser game
- **Presentation:** clean, readable, interactive map artwork
- **Tone:** believable and lived-in, not epic, not cinematic, not overdramatic

## What the art should feel like

The world should look like a persistent frontier city where ordinary people can build a life, work, trade, travel, and prepare for the wider world. The art should feel inviting and clear enough to support clickable areas and game overlays.

## Rendering style

- Semi-realistic illustrated environment art
- Painterly but controlled, with clean silhouettes
- Moderate detail, not hyper-detailed
- Soft natural shading
- Clear material separation between water, wood, stone, metal, foliage, and rooftops
- Avoid heavy line art or comic-book outlines
- Avoid photorealism

## Perspective

- **Main city:** elevated/isometric-ish overview, readable as an interactive city scene
- **District screens:** closer but still elevated perspective
- Perspective should support clickable zones and hotspots
- Geography and landmarks should be stable and easy to recognize

## Composition rules

- Main city image should have clearly readable districts
- District images should contain a handful of obvious sublocations
- Leave room for UI overlays, labels, and hover states
- Avoid clutter that makes hit areas ambiguous
- Shapes and pathways should help players understand where they can click

## Color palette

- Restrained, natural, slightly muted palette
- Harmonize natural water/foliage, warm stone, weathered wood, and slate/iron tones with the
  dark slate/charcoal framing and lighter panels in [UI_TARGET.md](../../UI_TARGET.md).
- The old forest-green/sage website palette is not an immutable UI requirement. Existing usable
  artwork need not be regenerated merely because the framing palette changes.
- Accent colors may appear in signs, awnings, lights, or boats, but should remain tasteful and limited

## Lighting

- Daylight / soft afternoon light as the main baseline
- Natural, readable shadows
- No dramatic golden-hour glow overload
- No neon or cyberpunk lighting
- Night variants later should preserve the exact geography

## Environment storytelling

The city should imply:

- a working harbor economy
- a functioning market / civic life
- practical industry and workshops
- a frontier city that is growing but organized

The districts should feel inhabited and useful, not like empty concept art.

## Interactivity expectations

These images will be used with:

- SVG or hotspot click regions
- district hover highlights
- labels
- subtle animated overlays later

Therefore the artwork must support:

- clean district boundaries
- readable landmarks
- obvious sublocation grouping
- room for overlays without the image becoming noisy

## Animation compatibility

The art should work well with later overlays such as:

- water shimmer
- smoke or chimney wisps
- flags or banners
- blinking lights at night
- hover glow / subtle brighten overlays

The base illustration itself should remain static. The F03 repair uses aligned district-region
outlines/tints and optional label lift first. Physically lifting buildings requires separate aligned
cutout/mask assets, anchors, depth/occlusion rules, and a clean background beneath them. A flattened
image does not provide those objects. Such asset work and decorative animations are deferred.

## District-specific notes

### Main City

Should show a coherent city with clearly distinct major districts:

- Harbor
- Market / commercial area
- Industrial / workshop area
- Residential / civic area
- Roads / pathways connecting them

### Harbor District

Should visually support sublocations such as:

- Fishing Pier
- Boat market or dock sales
- Freight terminal / cargo dock
- Fishing store or supply building
- Harbor contracts office / administrative building

Should feature:

- water
- piers
- moored boats
- crates / nets / cargo
- practical, working-city energy

### Industrial District

Should visually support sublocations such as:

- Refinery
- Blacksmith / workshops
- Gunsmith or machinery shop
- Warehouses
- loading or utility areas

Should feature:

- brick / stone / metal structures
- chimneys or vents
- carts / crates / machinery
- practical infrastructure
- slightly heavier materials and denser construction than the harbor

## What to avoid

- Overly cinematic concept-art look
- Overly fantasy architecture
- Massive castles / huge monuments
- Sci-fi UI aesthetic
- Hyper-saturated colors
- Excessive fog / bloom / dramatic weather
- Tiny unreadable details everywhere
- Cartoon exaggeration
- Fully photorealistic renders
- AI-looking visual artifacts, warped structures, mushy windows, broken perspective, inconsistent object scale

## Asset consistency rules

When generating later location art:

- use this same perspective family
- keep architecture materials and palette aligned
- keep the city’s geography and design language consistent
- reuse landmark ideas when appropriate
- favor readability and gameplay clarity over pure spectacle

## Runtime and geometry rules

Production artwork contains no baked text, branding, labels, controls, or stats. The existing runtime
environments are `src/assets/locations/new-harbor.webp`, `harbor.webp`, and `industrial.webp`.
This documentation review did not visually certify those files; do not mandate regenerating them.
City/district views remain large static scenes with overlays, not thousands of manually placed tiles.

Approve and version each production image and its hit/highlight geometry together. Independent AI
images are not guaranteed pixel-aligned, even with matching prompts. Derive geometry from the actual
asset and check the same image/overlay transform after resizing, cropping, pan/zoom, or variants.

P01's separate property object assets must have consistent scale, grid footprints, anchors, depth
ordering, and supported rotation views. A flattened city-style image is unsuitable for placeable,
movable, rotatable property objects. No asset generation is authorized by this alignment pass.

## File usage recommendation

Suggested starter files:

- `CITY_MASTER_REFERENCE.png`
- `HARBOR_REFERENCE.png`
- `INDUSTRIAL_REFERENCE.png`

These should become canonical visual references for F03.
