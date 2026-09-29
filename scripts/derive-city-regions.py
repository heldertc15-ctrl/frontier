"""Print simplified SVG hit regions from the canonical city cutout alpha channels.

This is an offline authoring aid. Runtime interaction uses the paths checked into
locationArtwork.ts, so an alpha mask is never the only click or focus target.
"""

from collections import defaultdict
from pathlib import Path
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1] / "src/assets/locations"
STEP = 12
ASSETS = {
    "harbor": "new-harbor-harbor-cutout.webp",
    "market-district": "new-harbor-market-cutout.webp",
    "industrial-district": "new-harbor-industrial-cutout.webp",
    "civic-residential": "new-harbor-residential-cutout.webp",
    "city-centre": "new-harbor-city-centre-cutout.webp",
    "transit-hub": "new-harbor-transit-cutout.webp",
    "outskirts": "new-harbor-outskirts-cutout.webp",
}


def simplify(points, tolerance=1.3):
    def distance(point, start, end):
        dx, dy = end[0] - start[0], end[1] - start[1]
        if dx == dy == 0:
            return ((point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2) ** 0.5
        return abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / (dx * dx + dy * dy) ** 0.5

    def segment(values):
        if len(values) <= 2:
            return values
        index, maximum = max(enumerate(values[1:-1], 1), key=lambda item: distance(item[1], values[0], values[-1]))
        if distance(values[index], values[0], values[-1]) <= tolerance:
            return [values[0], values[-1]]
        return segment(values[: index + 1])[:-1] + segment(values[index:])

    return segment(points)


def contours(mask):
    width, height = mask.size
    pixels = mask.load()
    edges = defaultdict(list)
    for y in range(height):
        for x in range(width):
            if not pixels[x, y]:
                continue
            if y == 0 or not pixels[x, y - 1]:
                edges[(x, y)].append((x + 1, y))
            if x == width - 1 or not pixels[x + 1, y]:
                edges[(x + 1, y)].append((x + 1, y + 1))
            if y == height - 1 or not pixels[x, y + 1]:
                edges[(x + 1, y + 1)].append((x, y + 1))
            if x == 0 or not pixels[x - 1, y]:
                edges[(x, y + 1)].append((x, y))
    loops = []
    while edges:
        start = next(iter(edges))
        current = start
        loop = [start]
        while True:
            next_point = edges[current].pop()
            if not edges[current]:
                del edges[current]
            if next_point == start:
                break
            loop.append(next_point)
            current = next_point
        area = sum(loop[i][0] * loop[(i + 1) % len(loop)][1] - loop[(i + 1) % len(loop)][0] * loop[i][1] for i in range(len(loop))) / 2
        if area > 24:
            loops.append((area, loop))
    return sorted(loops, reverse=True)


for location_id, filename in ASSETS.items():
    alpha = Image.open(ROOT / filename).getchannel("A")
    small = alpha.resize((alpha.width // STEP, alpha.height // STEP), Image.Resampling.BOX)
    mask = small.point(lambda value: 255 if value > 25 else 0).filter(ImageFilter.MaxFilter(3)).point(lambda value: 1 if value else 0)
    paths = []
    for area, loop in contours(mask):
        if area < 60:
            continue
        points = simplify(loop + [loop[0]])[:-1]
        paths.append("M " + " L ".join(f"{x * STEP} {y * STEP}" for x, y in points) + " Z")
    print(location_id, len(paths), sum(len(path) for path in paths))
    print(" ".join(paths))
