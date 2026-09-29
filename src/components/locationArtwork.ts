// The canonical city image and seven cutouts share one 2560×1440 coordinate system.
import city from '../assets/locations/new-harbor-city.webp';
import harbor from '../assets/locations/new-harbor-harbor-scene.webp';
import market from '../assets/locations/new-harbor-market-scene.webp';
import industrial from '../assets/locations/new-harbor-industrial-scene.webp';
import residential from '../assets/locations/new-harbor-residential-scene.webp';
import cityCentre from '../assets/locations/new-harbor-city-centre-scene.webp';
import transit from '../assets/locations/new-harbor-transit-scene.webp';
import outskirts from '../assets/locations/new-harbor-outskirts-scene.webp';
import fishingPier from '../assets/locations/fishing-pier.webp';
import storeDawn from '../assets/locations/fishing store/fishing store dawn.webp';
import storeDay from '../assets/locations/fishing store/fishing store day.webp';
import storeDusk from '../assets/locations/fishing store/fishing store dusk.webp';
import storeNight from '../assets/locations/fishing store/fishing store night.webp';
import pierCalmDawn from '../assets/locations/fishing-pier/dawn/fishingpier-calm-dawn.webp';
import pierModerateDawn from '../assets/locations/fishing-pier/dawn/fishingpier-moderate-dawn.webp';
import pierDangerousDawn from '../assets/locations/fishing-pier/dawn/fishingpier-dangerous-dawn.webp';
import pierCalmDay from '../assets/locations/fishing-pier/day/fishingpier-calm-day.webp';
import pierModerateDay from '../assets/locations/fishing-pier/day/fishingpier-moderate-day.webp';
import pierDangerousDay from '../assets/locations/fishing-pier/day/fishingpier-dangerous-day.webp';
import pierCalmDusk from '../assets/locations/fishing-pier/dusk/fishingpier-calm-dusk.webp';
import pierModerateDusk from '../assets/locations/fishing-pier/dusk/fishingpier-moderate-dusk.webp';
import pierDangerousDusk from '../assets/locations/fishing-pier/dusk/fishingpier-dangerous-dusk.webp';
import pierCalmNight from '../assets/locations/fishing-pier/night/fishingpier-calm-night.webp';
import pierModerateNight from '../assets/locations/fishing-pier/night/fishingpier-moderate-night.webp';
import pierDangerousNight from '../assets/locations/fishing-pier/night/fishingpier-dangerous-night.webp';
import type { SeaState, TimeOfDay } from '../../server/fishingConfig';
import harborCutout from '../assets/locations/new-harbor-harbor-cutout.webp';
import marketCutout from '../assets/locations/new-harbor-market-cutout.webp';
import industrialCutout from '../assets/locations/new-harbor-industrial-cutout.webp';
import residentialCutout from '../assets/locations/new-harbor-residential-cutout.webp';
import centreCutout from '../assets/locations/new-harbor-city-centre-cutout.webp';
import transitCutout from '../assets/locations/new-harbor-transit-cutout.webp';
import outskirtsCutout from '../assets/locations/new-harbor-outskirts-cutout.webp';

export interface SceneHotspot {
  locationId: string;
  labelX: number;
  labelY: number;
  /** Area path in the base image's intrinsic coordinate system. */
  path?: string;
  /** Transparent, full-canvas cutout derived from this exact base image. */
  cutoutSrc?: string;
}

export interface LocationArtwork {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  focalX?: number;
  focalY?: number;
  hotspots: SceneHotspot[];
}

const fishingPierScenes: Record<TimeOfDay, Record<SeaState, string>> = {
  Dawn: { Calm: pierCalmDawn, Moderate: pierModerateDawn, Dangerous: pierDangerousDawn },
  Day: { Calm: pierCalmDay, Moderate: pierModerateDay, Dangerous: pierDangerousDay },
  Dusk: { Calm: pierCalmDusk, Moderate: pierModerateDusk, Dangerous: pierDangerousDusk },
  Night: { Calm: pierCalmNight, Moderate: pierModerateNight, Dangerous: pierDangerousNight },
};

export function fishingPierArtwork(time: TimeOfDay, sea: SeaState): LocationArtwork {
  return {
    src: fishingPierScenes[time][sea],
    alt: `${time} at the Fishing Pier with ${sea.toLowerCase()} seas, boats, docks, and the lighthouse.`,
    caption: `Fishing Pier · ${time} · ${sea} seas.`,
    width: 2560,
    height: 1440,
    hotspots: [],
  };
}

const fishingStoreScenes: Record<TimeOfDay, string> = {
  Dawn: storeDawn,
  Day: storeDay,
  Dusk: storeDusk,
  Night: storeNight,
};

export function fishingStoreArtwork(time: TimeOfDay): LocationArtwork {
  return {
    src: fishingStoreScenes[time],
    alt: `${time} inside the Fishing Store: a teal counter with a brass scale and fresh fish, fishing rods, tackle shelves, and a harbor-facing window.`,
    caption: `Fishing Store · ${time} · Harbor District.`,
    width: 2560,
    height: 1440,
    hotspots: [],
  };
}

export const locationArtwork: Record<string, LocationArtwork> = {
  'fishing-store': fishingStoreArtwork('Day'),
  'fishing-pier': {
    src: fishingPier,
    alt: 'Daytime view from the fishing pier across New Harbor water toward boats, docks, and the lighthouse.',
    caption: 'Fishing Pier · Harbor District.',
    width: 2560,
    height: 1440,
    hotspots: [],
  },
  'new-harbor': {
    src: city,
    alt: 'New Harbor viewed from above: harbor, market, factories, homes, civic square, train station, and outskirts.',
    caption: 'New Harbor · Select a district or city zone.',
    width: 2560,
    height: 1440,
    hotspots: [
      {
        locationId: 'harbor',
        labelX: 29,
        labelY: 56,
        cutoutSrc: harborCutout,
        path: 'M 528 444 L 732 456 L 792 504 L 912 504 L 948 540 L 1212 612 L 1260 708 L 1344 756 L 1392 756 L 1404 804 L 1500 816 L 1500 864 L 1524 876 L 1500 1008 L 1092 1140 L 1008 1140 L 1008 1080 L 936 1068 L 900 1020 L 900 936 L 936 912 L 912 852 L 828 768 L 756 768 L 732 780 L 732 816 L 768 912 L 732 948 L 636 936 L 540 864 L 480 888 L 552 984 L 552 1020 L 492 1056 L 492 1080 L 552 1104 L 576 1104 L 576 1080 L 624 1092 L 624 1116 L 708 1188 L 708 1308 L 624 1332 L 468 1320 L 324 1248 L 72 1212 L 48 1188 L 48 1068 L 120 1008 L 204 1008 L 204 912 L 240 900 L 228 804 L 252 756 L 180 744 L 132 696 L 72 696 L 60 612 L 108 564 L 180 552 L 276 480 L 384 516 L 468 492 Z',
      },
      {
        locationId: 'market-district',
        labelX: 48,
        labelY: 39,
        cutoutSrc: marketCutout,
        path: 'M 1152 336 L 1356 372 L 1404 420 L 1488 432 L 1500 516 L 1464 564 L 1368 552 L 1356 588 L 1284 624 L 1188 636 L 1116 636 L 948 576 L 948 492 L 1008 420 L 1044 384 L 1128 372 Z',
      },
      {
        locationId: 'industrial-district',
        labelX: 78,
        labelY: 56,
        cutoutSrc: industrialCutout,
        path: 'M 2016 528 L 2088 540 L 2076 624 L 2148 624 L 2172 576 L 2256 552 L 2280 576 L 2280 648 L 2256 672 L 2532 780 L 2532 828 L 2472 840 L 2436 888 L 2364 912 L 2352 972 L 2304 1008 L 2124 1068 L 1884 1044 L 1692 984 L 1656 960 L 1656 912 L 1452 816 L 1452 768 L 1572 720 L 1584 684 L 1800 624 L 1860 564 L 2004 600 Z',
      },
      {
        locationId: 'civic-residential',
        labelX: 26,
        labelY: 16,
        cutoutSrc: residentialCutout,
        path: 'M 504 0 L 540 0 L 552 36 L 804 24 L 864 60 L 996 60 L 1092 96 L 1140 132 L 1140 168 L 828 288 L 768 336 L 516 396 L 264 288 L 228 240 L 240 132 L 264 108 L 348 84 L 384 36 L 480 60 Z',
      },
      {
        locationId: 'city-centre',
        labelX: 56,
        labelY: 19,
        cutoutSrc: centreCutout,
        path: 'M 1404 84 L 1464 84 L 1476 180 L 1584 180 L 1584 228 L 1620 228 L 1632 180 L 1680 180 L 1692 240 L 1788 348 L 1800 480 L 1764 516 L 1608 528 L 1068 288 L 1080 216 L 1200 168 L 1308 180 L 1380 156 Z',
      },
      {
        locationId: 'transit-hub',
        labelX: 81,
        labelY: 24,
        cutoutSrc: transitCutout,
        path: 'M 1836 108 L 1944 108 L 2136 264 L 2292 336 L 2352 420 L 2328 504 L 2268 552 L 2136 552 L 2016 504 L 1800 300 L 1776 252 L 1788 144 Z',
      },
      {
        locationId: 'outskirts',
        labelX: 91,
        labelY: 8,
        cutoutSrc: outskirtsCutout,
        path: 'M 2088 0 L 2556 0 L 2556 192 L 2052 144 L 2040 60 Z',
      },
    ],
  },
  harbor: {
    src: harbor,
    alt: 'Harbor waterfront with a lighthouse, fishing boats, piers, cranes, and warehouses.',
    caption: 'Harbor District · Working waterfront.',
    width: 2560,
    height: 1440,
    hotspots: [
      { locationId: 'fishing-pier', labelX: 27, labelY: 56 },
      { locationId: 'boat-market', labelX: 43, labelY: 31 },
      { locationId: 'freight-terminal', labelX: 72, labelY: 50 },
      { locationId: 'fishing-store', labelX: 52, labelY: 42 },
      { locationId: 'harbor-contracts-office', labelX: 69, labelY: 30 },
    ],
  },
  'market-district': {
    src: market,
    alt: 'Market square with produce stalls, merchants, surrounding shops, and a view toward the harbor.',
    caption: 'Market District · Open market square.',
    width: 2560,
    height: 1440,
    hotspots: [],
  },
  'industrial-district': {
    src: industrial,
    alt: 'Industrial waterfront with factory chimneys, workshops, warehouses, loading cranes, and rail sidings.',
    caption: 'Industrial District · Working edge of New Harbor.',
    width: 2560,
    height: 1440,
    hotspots: [
      { locationId: 'refinery', labelX: 50, labelY: 30 },
      { locationId: 'workshops', labelX: 66, labelY: 56 },
      { locationId: 'warehouse-yard', labelX: 36, labelY: 68 },
    ],
  },
  'civic-residential': {
    src: residential,
    alt: 'Coastal residential district with homes, gardens, tree-lined lanes, and a church.',
    caption: 'Residential District · Coastal neighborhoods.',
    width: 2560,
    height: 1440,
    hotspots: [],
  },
  'city-centre': {
    src: cityCentre,
    alt: 'City centre with a civic hall, fountain square, church, and nearby shops.',
    caption: 'City Centre · Civic square.',
    width: 2560,
    height: 1440,
    hotspots: [],
  },
  'transit-hub': {
    src: transit,
    alt: 'Train station with passenger platforms, steam locomotive, rail yards, and goods wagons.',
    caption: 'Transit Hub · Train station.',
    width: 2560,
    height: 1440,
    hotspots: [],
  },
  outskirts: {
    src: outskirts,
    alt: 'Outskirts with fields, woodland, small homes, a windmill, and rail tracks.',
    caption: 'Outskirts · Fields beyond the city.',
    width: 2560,
    height: 1440,
    hotspots: [],
  },
};

export const districtOrientation: Record<string, string> = {
  harbor: 'Southwest waterfront',
  'market-district': 'Central market square',
  'industrial-district': 'Southeast working waterfront',
  'civic-residential': 'Northwest neighborhoods',
  'city-centre': 'Northern civic square',
  'transit-hub': 'Northeast rail station · future travel',
  outskirts: 'Far northeast city edge · future exploration',
};
