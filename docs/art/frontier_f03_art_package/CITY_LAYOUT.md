# Frontier Main City Layout

## Purpose

This file is the canonical geography reference for Frontier's first main city. It exists to keep overview artwork, district closeups, navigation, and future visual variants consistent.

The city overview does **not** need to match every closeup building-for-building. It must, however, preserve the same geography, landmark relationships, district placement, and movement logic.

## Canonical orientation

Assume the city overview is read with north toward the top of the artwork unless a later approved map explicitly changes that convention.

- **Harbor:** southwest waterfront.
- **Market District:** central, directly inland from Harbor.
- **Industrial District:** southeast waterfront / river side.
- **Residential District:** northwest neighborhoods above the waterfront.
- **City Centre:** north-central civic square and public buildings.
- **Transit Hub:** northeast rail station.
- **Outskirts:** far northeast city edge beyond the station.

## Major geography

- Open water defines the southern and southwestern edge.
- Harbor occupies the most accessible working waterfront.
- Industrial waterfront continues eastward from the Harbor side but is visually heavier and more utilitarian.
- The main inland city rises away from the waterfront.
- Primary roads should make the city feel physically connected rather than like isolated menu islands.

## Permanent movement logic

The main road network should visually support:

1. Harbor → Market
2. Market → Residential / City Centre
3. Market → Industrial
4. Industrial → Transit Hub / Outskirts
5. Residential / City Centre → Market

The exact road curves may vary between artwork scales, but these relationships must remain recognizable.

## Permanent landmark anchors

### Harbor

- Lighthouse or harbor-navigation landmark near the water entrance.
- Cluster of wooden piers.
- Freight / cargo facility.
- Fishing-oriented area.
- Inland road leading toward Market.

### Market

- Central public square or recognizable commercial focal point.
- Dense mixed-use buildings.
- Stalls, awnings, storefronts, and pedestrian-oriented streets.
- Direct visual connection toward Harbor and City Centre.

### Industrial

- Refinery / processing complex.
- Chimney, vent, or stack cluster visible from the city overview.
- Warehouses and utility buildings.
- Loading / service yard.
- Waterfront, canal, river, or heavy-service edge.

### Residential District

- Neighborhood housing and greener streets.
- Slightly elevated or calmer visual character.

### City Centre

- Civic hall, church-like civic landmark, or other recognizable public building.
- Public square and cleaner streets than Harbor/Industrial.

### Transit Hub and Outskirts

- Train station and rail lines in the northeast.
- Rural edge beyond the station, without implying regional travel is available now.

## District boundaries

District boundaries should be readable from the overview through:

- road changes,
- building density,
- material palette,
- waterfront use,
- elevation,
- vegetation,
- architectural character.

Do not rely on painted boundary lines in the artwork. F03 defines seven SVG area hit regions and
aligned transparent cutouts against the canonical production image. Names, hover/focus, selection,
and explicit enter behavior follow [UI_TARGET.md](../../UI_TARGET.md).

## What must remain fixed across future artwork

- relative district placement;
- waterfront direction;
- Harbor-to-Market relationship;
- Industrial position east/southeast of the central city;
- Residential northwest and City Centre north-central;
- Transit Hub northeast and Outskirts beyond it;
- permanent landmark identity;
- major road relationships;
- general coastline / water orientation.

## What may vary

- number of minor buildings;
- exact window/door placement;
- decorative props;
- pedestrians;
- parked vehicles;
- small boats;
- stalls;
- crates;
- foliage;
- lighting details;
- exact placement of non-landmark structures.

## Overview vs district closeups

District artwork is a **closer interpretation of the same place**, not a literal camera zoom.

A district closeup may:

- reveal additional side streets;
- show more buildings than are distinguishable in the overview;
- simplify or rearrange non-landmark structures for gameplay clarity;
- enlarge important sublocations so they are usable as click targets.

A district closeup may **not**:

- move the district to a different side of the city;
- reverse the coastline;
- relocate permanent landmarks arbitrarily;
- contradict the road connections;
- introduce a radically different architectural language.

## Future day/night variants

Day, sunset, night, and seasonal variants must use the same approved base geography.

Preferred workflow:

1. approve one canonical daytime image;
2. create later variants as edits/reference-based transformations of that image;
3. preserve geometry exactly enough that SVG hotspots still align.

Do not regenerate day/night versions independently from scratch.

## Implementation note

The game should treat artwork and interactivity separately:

`approved static artwork + SVG/HTML hotspot overlay + optional animated effects`

The image itself is not the interaction layer. Version and approve artwork and geometry together;
independent generations and even reference-based edits are not assumed pixel-aligned. Keep overlay
coordinates relative to intrinsic image dimensions and share all fit offsets, scale, crop, and
optional pan/zoom transforms. Check every region after resize or an asset/variant change. An
illustrated landmark never creates a navigable location absent from the server catalog.
