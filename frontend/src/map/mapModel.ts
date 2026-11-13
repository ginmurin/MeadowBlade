import { TILESET_CATALOG, TILESET_MAP } from './tilesetCatalog';
import type { ColliderRect, MapSpawnData } from '../sim/types';

export interface TileCell {
  set: string;
  col: number;
  row: number;
}

export type CellValue = TileCell | null;

export interface PortalData {
  targetMapId?: string;
  targetMapName?: string;
  targetX?: number;
  targetY?: number;
  connectorTag?: string;
  label?: string;
}

export type PropertyType = 'string' | 'int' | 'float' | 'bool' | 'color';

export interface CustomProperty {
  name: string;
  type: PropertyType;
  value: any;
}

export interface MapObject {
  id: string;
  type: 'player_spawn' | 'enemy_spawn' | 'tree' | 'portal' | 'water_anim' | 'torch' | 'fire';
  x: number;
  y: number;
  name?: string;
  variant?: string;
  portalData?: PortalData;
  properties?: CustomProperty[];
}

export interface MapZone {
  id: string;
  name: string;
  x: number; // in tile coords
  y: number;
  width: number; // in tiles
  height: number;
  color?: string; // hex color e.g. '#22c55e'
  properties?: CustomProperty[];
}

export interface CustomMapData {
  id: string;
  name: string;
  version: number;
  width: number;
  height: number;
  tileSize: number;
  ground: CellValue[];
  props: CellValue[];
  collision: boolean[];
  objects: MapObject[];
  zones?: MapZone[];
  properties?: CustomProperty[];
  createdAt: number;
  updatedAt: number;
}

export function createEmptyMap(
  name = 'New Realm',
  width = 38,
  height = 26,
  biome: 'grassland' | 'cave' | 'desert' | 'snow' | 'forest' = 'grassland'
): CustomMapData {
  const count = width * height;
  const ground: CellValue[] = new Array(count).fill(null);
  const props: CellValue[] = new Array(count).fill(null);
  const collision: boolean[] = new Array(count).fill(false);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let cell: TileCell;
      if (biome === 'cave') {
        cell = { set: 'cave_grounds', col: (x * 3 + y * 7) % 6, row: (x + y * 2) % 4 };
      } else if (biome === 'desert') {
        cell = { set: 'desert_main', col: 20 + ((x + y) % 4), row: 20 + ((x * 2 + y) % 4) };
      } else if (biome === 'snow') {
        cell = { set: 'snow_main', col: 10 + ((x + y) % 4), row: 10 + ((x * 2 + y) % 4) };
      } else if (biome === 'forest') {
        cell = { set: 'forest_main', col: 24 + ((x * 5 + y * 9) % 6), row: 20 + ((x + y * 3) % 4) };
      } else {
        const col = 55 + ((x * 7 + y * 13) % 6);
        const row = 23 + ((x * 11 + y * 5) % 6);
        cell = { set: 'grassland_main', col, row };
      }
      ground[y * width + x] = cell;
    }
  }

  // Set perimeter collision by default
  for (let x = 0; x < width; x++) {
    collision[0 * width + x] = true;
    collision[(height - 1) * width + x] = true;
  }
  for (let y = 0; y < height; y++) {
    collision[y * width + 0] = true;
    collision[y * width + (width - 1)] = true;
  }

  const objects: MapObject[] = [
    {
      id: 'spawn_player',
      type: 'player_spawn',
      name: 'Hero Spawn',
      x: Math.floor(width / 2) * 32,
      y: Math.floor(height / 2) * 32,
      properties: [{ name: 'respawn_time', type: 'float', value: 0 }]
    },
    {
      id: 'spawn_enemy_1',
      type: 'enemy_spawn',
      name: 'Forest Guardian',
      x: (Math.floor(width / 2) - 12) * 32,
      y: (Math.floor(height / 2) - 5) * 32,
      properties: [{ name: 'patrol_radius', type: 'int', value: 96 }]
    },
    {
      id: 'spawn_enemy_2',
      type: 'enemy_spawn',
      name: 'Glade Sentinel',
      x: (Math.floor(width / 2) + 12) * 32,
      y: (Math.floor(height / 2) - 5) * 32,
      properties: [{ name: 'patrol_radius', type: 'int', value: 96 }]
    },
  ];

  if (name === 'Green Meadow Starter') {
    objects.push({
      id: 'portal_shadow_crypt',
      type: 'portal',
      name: 'Crypt Entrance',
      x: (Math.floor(width / 2) + 3) * 32,
      y: Math.floor(height / 2) * 32,
      portalData: {
        targetMapId: 'Shadow Crypt',
        targetMapName: 'Shadow Crypt',
        label: 'Doorway to Shadow Crypt'
      },
      properties: [{ name: 'min_level', type: 'int', value: 1 }]
    });
    objects.push({
      id: 'portal_cave',
      type: 'portal',
      name: 'Deep Cave Entrance',
      x: (width - 4) * 32,
      y: 4 * 32,
      portalData: {
        targetMapId: 'builtin_cave',
        targetX: 6 * 32,
        targetY: 10 * 32,
        label: 'To Deep Cave'
      },
      properties: [{ name: 'min_level', type: 'int', value: 1 }]
    });
  }

  if (biome === 'grassland' || biome === 'forest') {
    objects.push({ id: 'tree_1', type: 'tree', variant: 'tree2B', x: 5 * 32, y: 5 * 32 });
    objects.push({ id: 'tree_2', type: 'tree', variant: 'tree1B', x: (width - 6) * 32, y: 5 * 32 });
  }

  const properties: CustomProperty[] = [
    { name: 'theme', type: 'string', value: biome },
    { name: 'ambient_light', type: 'float', value: 1.0 },
    { name: 'is_peaceful', type: 'bool', value: false },
    { name: 'bgm', type: 'string', value: 'meadow_breeze' },
    { name: 'weather', type: 'string', value: 'clear' }
  ];

  const zones: MapZone[] = [
    {
      id: 'zone_water_1',
      name: 'Poisonous Water',
      x: Math.max(2, width - 10),
      y: Math.max(2, height - 10),
      width: 5,
      height: 5,
      color: '#22c55e',
      properties: [
        { name: 'hazard', type: 'string', value: 'poison' },
        { name: 'damage', type: 'int', value: 4 },
        { name: 'slow_pct', type: 'float', value: 0.3 }
      ]
    }
  ];

  return {
    id: `map_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    version: 1,
    width,
    height,
    tileSize: 32,
    ground,
    props,
    collision,
    objects,
    zones,
    properties,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

/**
 * Expands map boundaries in any of the 4 directions.
 */
export function expandMap(
  map: CustomMapData,
  addLeft: number,
  addRight: number,
  addTop: number,
  addBottom: number
): CustomMapData {
  const newWidth = Math.max(10, map.width + addLeft + addRight);
  const newHeight = Math.max(10, map.height + addTop + addBottom);
  const newCount = newWidth * newHeight;

  const newGround: CellValue[] = new Array(newCount).fill(null);
  const newProps: CellValue[] = new Array(newCount).fill(null);
  const newCollision: boolean[] = new Array(newCount).fill(false);

  // Fill default background for new cells
  for (let ny = 0; ny < newHeight; ny++) {
    for (let nx = 0; nx < newWidth; nx++) {
      const col = 55 + ((nx * 7 + ny * 13) % 6);
      const row = 23 + ((nx * 11 + ny * 5) % 6);
      newGround[ny * newWidth + nx] = { set: 'grassland_main', col, row };
    }
  }

  // Copy existing cells
  for (let oy = 0; oy < map.height; oy++) {
    for (let ox = 0; ox < map.width; ox++) {
      const nx = ox + addLeft;
      const ny = oy + addTop;
      if (nx >= 0 && nx < newWidth && ny >= 0 && ny < newHeight) {
        const oldIdx = oy * map.width + ox;
        const newIdx = ny * newWidth + nx;
        newGround[newIdx] = map.ground[oldIdx];
        newProps[newIdx] = map.props[oldIdx];
        newCollision[newIdx] = map.collision[oldIdx];
      }
    }
  }

  // Set borders to collision
  for (let x = 0; x < newWidth; x++) {
    newCollision[0 * newWidth + x] = true;
    newCollision[(newHeight - 1) * newWidth + x] = true;
  }
  for (let y = 0; y < newHeight; y++) {
    newCollision[y * newWidth + 0] = true;
    newCollision[y * newWidth + (newWidth - 1)] = true;
  }

  // Shift objects
  const shiftX = addLeft * map.tileSize;
  const shiftY = addTop * map.tileSize;
  const newObjects = map.objects.map((obj) => ({
    ...obj,
    x: Math.max(32, Math.min(newWidth * map.tileSize - 32, (Number(obj.x) || 0) + shiftX)),
    y: Math.max(32, Math.min(newHeight * map.tileSize - 32, (Number(obj.y) || 0) + shiftY))
  }));

  // Shift zones
  const newZones = (map.zones || []).map((z) => ({
    ...z,
    x: Math.max(0, Math.min(newWidth - z.width, z.x + addLeft)),
    y: Math.max(0, Math.min(newHeight - z.height, z.y + addTop))
  }));

  return {
    ...map,
    width: newWidth,
    height: newHeight,
    ground: newGround,
    props: newProps,
    collision: newCollision,
    objects: newObjects,
    zones: newZones,
    properties: map.properties ? [...map.properties] : [],
    updatedAt: Date.now()
  };
}

export function customMapToSimData(map: CustomMapData): MapSpawnData {
  const colliders: ColliderRect[] = [];
  const widthPx = map.width * map.tileSize;
  const heightPx = map.height * map.tileSize;

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.collision[y * map.width + x]) {
        colliders.push({
          x: x * map.tileSize,
          y: y * map.tileSize,
          width: map.tileSize,
          height: map.tileSize
        });
      }
    }
  }

  let playerSpawn = { x: widthPx / 2, y: heightPx / 2 };
  const enemySpawns: Array<{ name: string; x: number; y: number }> = [];
  const portals: any[] = [];

  for (const obj of map.objects) {
    const ox = Number.isFinite(obj.x) ? obj.x : widthPx / 2;
    const oy = Number.isFinite(obj.y) ? obj.y : heightPx / 2;

    if (obj.type === 'player_spawn') {
      playerSpawn = { x: ox, y: oy };
    } else if (obj.type === 'enemy_spawn') {
      enemySpawns.push({ name: obj.name || 'guardian', x: ox, y: oy });
    } else if (obj.type === 'portal') {
      portals.push({
        id: obj.id,
        x: ox,
        y: oy,
        targetMapId: obj.portalData?.targetMapId || obj.portalData?.targetMapName,
        targetMapName: obj.portalData?.targetMapName || obj.portalData?.targetMapId,
        targetX: obj.portalData?.targetX ?? 480,
        targetY: obj.portalData?.targetY ?? 400,
        label: obj.portalData?.label || obj.name,
        connectorTag: obj.portalData?.connectorTag
      });
    } else if (obj.type === 'tree') {
      colliders.push({
        x: ox - 18,
        y: oy - 18,
        width: 36,
        height: 22
      });
    }
  }

  const isPeaceful = Boolean(map.properties?.find((p) => p.name === 'is_peaceful')?.value);
  return {
    widthPx,
    heightPx,
    playerSpawn,
    enemySpawns,
    colliders,
    portals,
    isPeaceful
  };
}

/**
 * Built-in Interior Realms for instant door teleportation.
 */
export function getBuiltinInterior(realmId: string): CustomMapData | null {
  if (realmId === 'builtin_cave') {
    const map = createEmptyMap('Deep Crystal Cavern', 28, 20, 'cave');
    for (let y = 6; y <= 13; y++) {
      for (let x = 8; x <= 18; x++) {
        map.props[y * map.width + x] = { set: 'cave_dec', col: 2 + (x % 3), row: 2 + (y % 3) };
      }
    }
    map.objects = [
      { id: 'player_spawn', type: 'player_spawn', name: 'Cave Entrance Spawn', x: 5 * 32, y: 10 * 32 },
      { id: 'cave_sentinel', type: 'enemy_spawn', name: 'Cave Sentinel', x: 18 * 32, y: 10 * 32 },
      {
        id: 'return_portal',
        type: 'portal',
        name: 'Exit Cave to Surface',
        x: 4 * 32,
        y: 10 * 32,
        portalData: { targetMapId: 'builtin_meadow', targetX: 480, targetY: 432, label: 'To Surface' }
      }
    ];
    return map;
  }

  if (realmId === 'builtin_house') {
    const map = createEmptyMap('Village Tavern', 22, 16);
    for (let y = 1; y < 15; y++) {
      for (let x = 1; x < 21; x++) {
        map.ground[y * map.width + x] = { set: 'house_interiors', col: 4 + (x % 4), row: 12 + (y % 4) };
      }
    }
    map.objects = [
      { id: 'player_spawn', type: 'player_spawn', name: 'Tavern Floor', x: 11 * 32, y: 11 * 32 },
      {
        id: 'tavern_exit',
        type: 'portal',
        name: 'Door to Meadow',
        x: 11 * 32,
        y: 14 * 32,
        portalData: { targetMapId: 'builtin_meadow', targetX: 480, targetY: 432, label: 'Door to Meadow' }
      }
    ];
    return map;
  }

  return null;
}

export function exportToTiledJson(map: CustomMapData): object {
  const setsUsed = new Set<string>();
  for (const cell of [...map.ground, ...map.props]) {
    if (cell?.set) setsUsed.add(cell.set);
  }
  setsUsed.add('grassland_main');
  setsUsed.add('grassland_dec');

  const orderedSets = Array.from(setsUsed)
    .map((k) => TILESET_MAP.get(k))
    .filter((t): t is (typeof TILESET_CATALOG)[number] => Boolean(t));

  let currentGid = 1;
  const tilesetBlocks: any[] = [];
  const gidOffsetMap = new Map<string, number>();

  for (const meta of orderedSets) {
    gidOffsetMap.set(meta.key, currentGid);
    const tilecount = meta.cols * meta.rows;
    tilesetBlocks.push({
      columns: meta.cols,
      firstgid: currentGid,
      image: meta.url,
      imageheight: meta.height,
      imagewidth: meta.width,
      margin: 0,
      name: meta.key,
      spacing: 0,
      tilecount,
      tileheight: meta.tileHeight,
      tilewidth: meta.tileWidth
    });
    currentGid += tilecount;
  }

  function layerToGids(cells: CellValue[]): number[] {
    return cells.map((cell) => {
      if (!cell) return 0;
      const baseGid = gidOffsetMap.get(cell.set) ?? 1;
      const meta = TILESET_MAP.get(cell.set);
      const cols = meta ? meta.cols : 64;
      return baseGid + cell.row * cols + cell.col;
    });
  }

  const objects: any[] = [];
  let nextObjId = 1;

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.collision[y * map.width + x]) {
        objects.push({
          id: nextObjId++,
          name: `col_${x}_${y}`,
          type: 'collider',
          x: x * map.tileSize,
          y: y * map.tileSize,
          width: map.tileSize,
          height: map.tileSize
        });
      }
    }
  }

  for (const obj of map.objects) {
    const objProperties: any[] = [
      ...(obj.variant ? [{ name: 'variant', type: 'string', value: obj.variant }] : []),
      ...(obj.portalData ? [{ name: 'portalData', type: 'string', value: JSON.stringify(obj.portalData) }] : []),
      ...(obj.properties || [])
    ];

    objects.push({
      id: nextObjId++,
      name: obj.name || obj.type,
      type: obj.type,
      point: true,
      x: obj.x,
      y: obj.y,
      properties: objProperties
    });
  }

  // Export custom zones (e.g. Poisonous Water, Lava Lake)
  for (const zone of map.zones || []) {
    objects.push({
      id: nextObjId++,
      name: zone.name,
      type: 'zone',
      x: zone.x * map.tileSize,
      y: zone.y * map.tileSize,
      width: zone.width * map.tileSize,
      height: zone.height * map.tileSize,
      properties: [
        ...(zone.color ? [{ name: 'color', type: 'color', value: zone.color }] : []),
        ...(zone.properties || [])
      ]
    });
  }

  return {
    compressionlevel: -1,
    height: map.height,
    width: map.width,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tileheight: map.tileSize,
    tilewidth: map.tileSize,
    tilesets: tilesetBlocks,
    properties: map.properties || [],
    layers: [
      {
        data: layerToGids(map.ground),
        height: map.height,
        width: map.width,
        id: 1,
        name: 'ground',
        opacity: 1,
        type: 'tilelayer',
        visible: true,
        x: 0,
        y: 0
      },
      {
        data: layerToGids(map.props),
        height: map.height,
        width: map.width,
        id: 2,
        name: 'props',
        opacity: 1,
        type: 'tilelayer',
        visible: true,
        x: 0,
        y: 0
      },
      {
        draworder: 'topdown',
        id: 3,
        name: 'objects',
        objects,
        opacity: 1,
        type: 'objectgroup',
        visible: true,
        x: 0,
        y: 0
      }
    ],
    nextlayerid: 4,
    nextobjectid: nextObjId,
    type: 'map',
    version: '1.10'
  };
}
