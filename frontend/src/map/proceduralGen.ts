import type { CellValue, CustomMapData, MapObject, TileCell } from './mapModel';

export type ProceduralTheme = 'grassland' | 'forest' | 'cave' | 'desert' | 'snow';

export function generateProceduralMap(
  theme: ProceduralTheme = 'grassland',
  name = 'Procedural Realm',
  width = 44,
  height = 30
): CustomMapData {
  const count = width * height;
  const ground: CellValue[] = new Array(count).fill(null);
  const props: CellValue[] = new Array(count).fill(null);
  const collision: boolean[] = new Array(count).fill(false);

  function hash(x: number, y: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  // 1. Base Biome Terrain
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const h = hash(x, y);
      let cell: TileCell;

      if (theme === 'cave') {
        cell = { set: 'cave_grounds', col: Math.floor(h * 6), row: Math.floor(hash(y, x) * 4) };
      } else if (theme === 'desert') {
        cell = { set: 'desert_main', col: 18 + Math.floor(h * 5), row: 18 + Math.floor(hash(y, x) * 5) };
      } else if (theme === 'snow') {
        cell = { set: 'snow_main', col: 8 + Math.floor(h * 5), row: 8 + Math.floor(hash(y, x) * 5) };
      } else if (theme === 'forest') {
        cell = { set: 'forest_main', col: 24 + Math.floor(h * 6), row: 20 + Math.floor(hash(y, x) * 4) };
      } else {
        cell = { set: 'grassland_main', col: 55 + Math.floor(h * 6), row: 23 + Math.floor(hash(y + 11, x + 7) * 6) };
      }
      ground[y * width + x] = cell;
    }
  }

  // 2. Winding Stone / Dirt Trail through the landscape
  const midY = Math.floor(height / 2);
  for (let x = 4; x < width - 4; x++) {
    const curveY = midY + Math.floor(Math.sin((x / width) * Math.PI * 2) * 3);
    for (let dy = 0; dy <= 1; dy++) {
      const ty = curveY + dy;
      if (ty >= 0 && ty < height) {
        if (theme === 'cave') {
          ground[ty * width + x] = { set: 'cave_grounds', col: 8 + (x % 3), row: 8 + (ty % 3) };
        } else if (theme === 'desert') {
          ground[ty * width + x] = { set: 'desert_main', col: 30 + (x % 3), row: 28 + (ty % 3) };
        } else {
          ground[ty * width + x] = { set: 'grassland_main', col: 31 + ((x + ty) % 3), row: 33 + ((x * 2 + ty) % 3) };
        }
      }
    }
  }

  // 3. Natural Water River / Chasm across the eastern quadrant
  const riverX = Math.floor(width * 0.72);
  const bridgeY = midY + 1;

  for (let y = 0; y < height; y++) {
    for (let rx = 0; rx < 3; rx++) {
      const tx = riverX + rx;
      if (tx < width) {
        if (theme === 'cave') {
          ground[y * width + tx] = { set: 'cave_grounds', col: 14 + (y % 2), row: 14 + (tx % 2) };
        } else if (theme === 'snow') {
          // Frozen river ice
          ground[y * width + tx] = { set: 'snow_main', col: 22 + (y % 2), row: 18 + (tx % 2) };
        } else {
          // River water
          ground[y * width + tx] = { set: 'grassland_main', col: 58 + (y % 2), row: 1 + (tx % 2) };
        }

        // River collision (except bridge crossing)
        if (y < bridgeY - 1 || y > bridgeY + 2) {
          collision[y * width + tx] = true;
        }
      }
    }
  }

  // Bridge spanning the river
  for (let bx = 0; bx < 3; bx++) {
    const tx = riverX + bx;
    if (theme === 'cave') {
      props[(bridgeY - 1) * width + tx] = { set: 'cave_hills', col: 10 + bx, row: 8 };
      props[bridgeY * width + tx] = { set: 'cave_hills', col: 10 + bx, row: 9 };
    } else {
      props[(bridgeY - 1) * width + tx] = { set: 'grassland_main', col: 55 + bx, row: 32 };
      props[bridgeY * width + tx] = { set: 'grassland_main', col: 55 + bx, row: 33 };
      props[(bridgeY + 1) * width + tx] = { set: 'grassland_main', col: 55 + bx, row: 34 };
    }
    collision[(bridgeY - 1) * width + tx] = false;
    collision[bridgeY * width + tx] = false;
    collision[(bridgeY + 1) * width + tx] = false;
  }

  // 4. Perimeter Border Collisions
  for (let x = 0; x < width; x++) {
    collision[0 * width + x] = true;
    collision[(height - 1) * width + x] = true;
  }
  for (let y = 0; y < height; y++) {
    collision[y * width + 0] = true;
    collision[y * width + (width - 1)] = true;
  }

  // 5. Procedural Objects: Spawn, Enemies, Trees, Rocks & Portals
  const objects: MapObject[] = [
    {
      id: 'player_spawn',
      type: 'player_spawn',
      name: 'Hero Landing',
      x: Math.floor(width * 0.32) * 32,
      y: midY * 32
    }
  ];

  // Scatter enemy guardians around quadrants
  const enemyCoords = [
    { x: Math.floor(width * 0.18), y: midY - 4, name: 'Western Scout' },
    { x: Math.floor(width * 0.45), y: midY - 6, name: 'Northern Guardian' },
    { x: Math.floor(width * 0.45), y: midY + 6, name: 'Southern Sentry' },
    { x: riverX + 6, y: bridgeY - 3, name: 'East Shore Enforcer' },
    { x: riverX + 7, y: bridgeY + 4, name: 'Ruins Protector' }
  ];

  for (let i = 0; i < enemyCoords.length; i++) {
    const e = enemyCoords[i];
    objects.push({
      id: `enemy_${i + 1}`,
      type: 'enemy_spawn',
      name: e.name,
      x: e.x * 32,
      y: e.y * 32
    });
  }

  // Clustered Trees & Props
  const treeSpots = [
    { x: 4.5, y: 4.5, variant: 'tree1B' as const },
    { x: 14.5, y: 5.5, variant: 'tree2B' as const },
    { x: 24.5, y: 4.5, variant: 'tree1B' as const },
    { x: width - 5.5, y: 5.5, variant: 'tree2B' as const },
    { x: 4.5, y: height - 5.5, variant: 'tree2B' as const },
    { x: 15.5, y: height - 4.5, variant: 'tree1B' as const },
    { x: 24.5, y: height - 5.5, variant: 'tree2B' as const },
    { x: width - 5.5, y: height - 5.5, variant: 'tree1B' as const }
  ];

  for (let i = 0; i < treeSpots.length; i++) {
    const t = treeSpots[i];
    objects.push({
      id: `proc_tree_${i + 1}`,
      type: 'tree',
      variant: t.variant,
      x: t.x * 32,
      y: t.y * 32
    });
  }

  // 6. Dungeon / Cave Portal in the Northwest clearing
  objects.push({
    id: 'proc_dungeon_portal',
    type: 'portal',
    name: 'Ancient Cavern Portal',
    x: 6 * 32,
    y: 8 * 32,
    portalData: {
      targetMapId: 'builtin_cave',
      targetX: 6 * 32,
      targetY: 10 * 32,
      label: 'To Deep Cave'
    }
  });

  return {
    id: `proc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    version: 1,
    width,
    height,
    tileSize: 32,
    ground,
    props,
    collision,
    objects,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}