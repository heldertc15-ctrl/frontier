# F03 runtime environments

`new-harbor-city.webp` is the approved canonical New Harbor image. The seven
`new-harbor-*-cutout.webp` assets share its 2560×1440 canvas and coordinate system. The cutouts
are visual layers only. SVG hit regions, coded labels, and intrinsic dimensions are centralized in
`src/components/locationArtwork.ts`. `scripts/derive-city-regions.py` records how the initial paths
were simplified from cutout alpha; runtime input does not use alpha testing.

The seven `new-harbor-*-scene.webp` files are the district and zone scenes supplied for Harbor,
Market, Industrial, Residential, City Centre, Transit Hub (train station), and Outskirts. Each is
2560×1440. `fishing-pier.webp` is the approved 2560×1440 daytime scene for the Fishing Pier.
`fishing store/fishing store dawn.webp`, `fishing store/fishing store day.webp`,
`fishing store/fishing store dusk.webp`, and `fishing store/fishing store night.webp` are the
owner-supplied 2560×1440 Fishing Store interiors, replacing the original single image. The shared
effective server phase selects the variant; Day is the fallback until the world snapshot arrives.
They have no hotspots; the header provides the route back to Harbor District and the buyer remains
in the right context. Their full composition uses the shared contain transform.
Other places use their parent scene until place-specific artwork is supplied. Named route controls remain available for scenes without point landmarks and if an
image fails to load. `harbor.webp`, `industrial.webp`, and `new-harbor.webp` are superseded interim
images and are no longer imported at runtime. The labeled PNG files under
`docs/art/frontier_f03_art_package/` are references only.

Canonical city geography is Harbor southwest, Market central, Industrial southeast, Residential
northwest, City Centre north-central, Transit Hub northeast, and Outskirts at the far northeast edge.
Names, labels, states, and controls belong to the HTML/SVG layer. Replace artwork and geometry as a
pair, and verify their shared transform at every acceptance size.
