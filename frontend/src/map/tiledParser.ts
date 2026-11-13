import Phaser from 'phaser';
import type { ColliderRect, MapSpawnData, Point2D, PortalTrigger } from '../sim/types';
import { TILESET_CATALOG, type TilesetMeta } from './tilesetCatalog';

export interface TiledZoneData {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  properties: Record<string, any>;
}

export interface TiledEnvObject {
  id: string;
  type: string;
  variant?: string;
  x: number;
  y: number;
  properties: Record<string, any>;
}

export interface ParsedTiledResult {
  mapName: string;
  spawnData: MapSpawnData;
  zones: TiledZoneData[];
  envObjects: TiledEnvObject[];
  properties: Record<string, any>;
}

export function parseTiledProperties(rawProps: any): Record<string, any> {
  if (!rawProps) return {};
  if (Array.isArray(rawProps)) {
    const out: Record<string, any> = {};
    for (const item of rawProps) {
      if (item && typeof item === 'object' && item.name !== undefined) {
        out[item.name] = item.value;
      }
    }
    return out;
  }
  if (typeof rawProps === 'object') {
    return { ...rawProps };
  }
  return {};
}

export function getPropCaseInsensitive(props: Record<string, any>, ...keys: string[]): any {
  if (!props) return undefined;
  for (const k of keys) {
    if (props[k] !== undefined) return props[k];
    const lowerK = k.toLowerCase();
    for (const [pName, pVal] of Object.entries(props)) {
      if (pName.toLowerCase() === lowerK && pVal !== undefined) {
        return pVal;
      }
    }
  }
  return undefined;
}

export const KNOWN_TILESET_ANIMATIONS: Record<string, Array<{ id: number; animation: Array<{ tileid: number; duration: number }> }>> = {
  light2a: [
    {
      id: 0,
      animation: [
        { tileid: 0, duration: 100 },
        { tileid: 1, duration: 100 },
        { tileid: 2, duration: 100 },
        { tileid: 3, duration: 100 },
        { tileid: 8, duration: 100 },
        { tileid: 9, duration: 100 }
      ]
    },
    {
      id: 4,
      animation: [
        { tileid: 4, duration: 100 },
        { tileid: 5, duration: 100 },
        { tileid: 6, duration: 100 },
        { tileid: 7, duration: 100 },
        { tileid: 12, duration: 100 },
        { tileid: 13, duration: 100 }
      ]
    }
  ],
  trident_torch: [
    {
      id: 0,
      animation: [
        { tileid: 0, duration: 100 },
        { tileid: 1, duration: 100 },
        { tileid: 2, duration: 100 },
        { tileid: 3, duration: 100 },
        { tileid: 8, duration: 100 },
        { tileid: 9, duration: 100 }
      ]
    },
    {
      id: 4,
      animation: [
        { tileid: 4, duration: 100 },
        { tileid: 5, duration: 100 },
        { tileid: 6, duration: 100 },
        { tileid: 7, duration: 100 },
        { tileid: 12, duration: 100 },
        { tileid: 13, duration: 100 }
      ]
    }
  ],
  fire3: [
    {
      id: 0,
      animation: [
        { tileid: 0, duration: 100 },
        { tileid: 1, duration: 100 },
        { tileid: 2, duration: 100 },
        { tileid: 3, duration: 100 },
        { tileid: 4, duration: 100 },
        { tileid: 5, duration: 100 }
      ]
    },
    {
      id: 6,
      animation: [
        { tileid: 6, duration: 100 },
        { tileid: 7, duration: 100 },
        { tileid: 8, duration: 100 },
        { tileid: 9, duration: 100 },
        { tileid: 10, duration: 100 },
        { tileid: 11, duration: 100 }
      ]
    }
  ],
  water_effa: [
    {
      id: 0,
      animation: [
        { tileid: 0, duration: 100 },
        { tileid: 1, duration: 100 },
        { tileid: 2, duration: 100 },
        { tileid: 3, duration: 100 },
        { tileid: 4, duration: 100 },
        { tileid: 5, duration: 100 },
        { tileid: 6, duration: 100 },
        { tileid: 7, duration: 100 },
        { tileid: 8, duration: 100 },
        { tileid: 9, duration: 100 }
      ]
    }
  ],
  water_effb: [
    {
      id: 0,
      animation: [
        { tileid: 0, duration: 100 },
        { tileid: 1, duration: 100 },
        { tileid: 2, duration: 100 },
        { tileid: 3, duration: 100 },
        { tileid: 4, duration: 100 },
        { tileid: 5, duration: 100 },
        { tileid: 6, duration: 100 },
        { tileid: 7, duration: 100 },
        { tileid: 8, duration: 100 },
        { tileid: 9, duration: 100 }
      ]
    }
  ],
  light1a: [
    {
      id: 0,
      animation: [
        { tileid: 4, duration: 100 },
        { tileid: 5, duration: 100 },
        { tileid: 6, duration: 100 },
        { tileid: 7, duration: 100 },
        { tileid: 12, duration: 100 },
        { tileid: 13, duration: 100 }
      ]
    }
  ],
  light1a_particles: [
    {
      id: 0,
      animation: [
        { tileid: 0, duration: 100 },
        { tileid: 1, duration: 100 },
        { tileid: 2, duration: 100 },
        { tileid: 3, duration: 100 },
        { tileid: 8, duration: 100 },
        { tileid: 9, duration: 100 }
      ]
    }
  ]
};

/**
 * Resolves external tileset sources (e.g. "grassland.tsx", "trees.tsx")
 * by matching against TILESET_CATALOG and embedding the metadata directly
 * into the map JSON so Phaser can load and render the tiles cleanly.
 */
export function resolveExternalTilesetSources(tiledJson: any): void {
  if (!tiledJson || !Array.isArray(tiledJson.tilesets)) return;

  const isCave = Boolean(
    (tiledJson.name && /cave|dungeon|underground/i.test(tiledJson.name)) ||
    (tiledJson.properties && /cave|dungeon/i.test(JSON.stringify(tiledJson.properties)))
  );

  const usedNames = new Set<string>();
  for (const ts of tiledJson.tilesets) {
    if (!ts || typeof ts !== 'object') continue;
    const source = typeof ts.source === 'string' ? ts.source : '';
    const rawName = typeof ts.name === 'string' ? ts.name : '';
    const cleanSource = source.replace(/\\/g, '/').split('/').pop() || '';
    const rawImg = typeof ts.image === 'string' ? ts.image.replace(/\\/g, '/').split('/').pop() || '' : '';
    const query = (cleanSource || rawName || rawImg).replace(/\.(tsx|tsj|json|png)$/i, '').toLowerCase().trim();

    // Find best match in catalog, fallback to primary terrain if no exact match
    const matched = findMatchingCatalogMeta(query, isCave) || TILESET_CATALOG[0];
    if (matched) {
      let uniqueName = matched.key;
      if (usedNames.has(uniqueName)) {
        uniqueName = `${matched.key}_${ts.firstgid || usedNames.size}`;
      }
      usedNames.add(uniqueName);
      ts.name = uniqueName;
      ts.image = matched.url;
      ts.imagewidth = matched.width;
      ts.imageheight = matched.height;
      ts.tilewidth = matched.tileWidth;
      ts.tileheight = matched.tileHeight;
      ts.tilecount = matched.cols * matched.rows;
      ts.columns = matched.cols;

      // Attach tile animations if defined for this tileset
      const animKey = query.replace(/[\s-]+/g, '_').toLowerCase();
      const anims = KNOWN_TILESET_ANIMATIONS[animKey] || KNOWN_TILESET_ANIMATIONS[matched.key];
      if (anims && (!ts.tiles || ts.tiles.length === 0)) {
        ts.tiles = anims;
      }

      // CRUCIAL: Remove ts.source so Phaser treats this tileset as embedded instead of an unparsed external file!
      delete ts.source;
    }
  }
}

function findMatchingCatalogMeta(query: string, isCave = false): TilesetMeta | undefined {
  if (!query) return undefined;
  const q = query.toLowerCase();

  // 1. Exact key or name match
  for (const meta of TILESET_CATALOG) {
    if (meta.key.toLowerCase() === q || meta.name.toLowerCase() === q) {
      return meta;
    }
  }

  // 2. Normalized key match (e.g. "deep_cave_decorative" matches "deep cave decorative")
  const normalizedKey = q.replace(/[\s-]+/g, '_');
  for (const meta of TILESET_CATALOG) {
    if (meta.key.toLowerCase() === normalizedKey) {
      return meta;
    }
  }

  // 3. Deep cave specifics
  if (q.includes('deep') && q.includes('cave')) {
    if (q.includes('dec') || q.includes('prop')) {
      return TILESET_CATALOG.find((m) => m.key === 'deep_cave_decorative');
    }
    return TILESET_CATALOG.find((m) => m.key === 'deep_cave_mainlev');
  }

  // 4. Props & animated
  if (q.includes('chest')) return TILESET_CATALOG.find((m) => m.key === 'treasure_chests');
  if (q.includes('plant')) return TILESET_CATALOG.find((m) => m.key === 'cave_plants');
  if (q.includes('torch')) return TILESET_CATALOG.find((m) => m.key === 'light2a');
  if (q.includes('light1')) return TILESET_CATALOG.find((m) => m.key === 'light1a');
  if (q.includes('light2')) return TILESET_CATALOG.find((m) => m.key === 'light2a');
  if (q.includes('fire')) return TILESET_CATALOG.find((m) => m.key === 'fire3');
  if (q.includes('water_effa')) return TILESET_CATALOG.find((m) => m.key === 'water_effa');
  if (q.includes('water_effb')) return TILESET_CATALOG.find((m) => m.key === 'water_effb');

  // 5. Cave context (e.g. mainlev inside cave map)
  if (isCave || q.includes('cave') || q.includes('dungeon')) {
    if (q.includes('mainlev') || q.includes('ground') || q.includes('floor')) {
      return TILESET_CATALOG.find((m) => m.key === 'deep_cave_mainlev') || TILESET_CATALOG.find((m) => m.key === 'cave_grounds');
    }
    if (q.includes('dec') || q.includes('prop')) {
      return TILESET_CATALOG.find((m) => m.key === 'deep_cave_decorative') || TILESET_CATALOG.find((m) => m.key === 'cave_dec');
    }
    if (q.includes('hill') || q.includes('wall') || q.includes('stalagmite')) {
      return TILESET_CATALOG.find((m) => m.key === 'cave_hills');
    }
  }

  // 6. General biome rules
  if (q.includes('grass')) return TILESET_CATALOG.find((m) => m.key.includes('grassland'));
  if (q.includes('forest')) return TILESET_CATALOG.find((m) => m.key.includes('forest'));
  if (q.includes('desert')) return TILESET_CATALOG.find((m) => m.key.includes('desert'));
  if (q.includes('snow')) return TILESET_CATALOG.find((m) => m.key.includes('snow'));
  if (q.includes('cave')) return TILESET_CATALOG.find((m) => m.key.includes('cave'));
  if (q.includes('mainlev')) return TILESET_CATALOG.find((m) => m.key === 'grassland_main');

  return TILESET_CATALOG[0]; // Fallback to grassland_main
}

/**
 * Parses a Tiled native XML map (.tmx) into standard Tiled JSON format.
 */
export function parseTmxXml(xmlString: string, defaultName = 'Tiled Realm'): any {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, 'text/xml');
  const parserError = xml.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid TMX XML format: ' + parserError.textContent);
  }

  const mapEl = xml.querySelector('map');
  if (!mapEl) {
    throw new Error('Invalid TMX format: Missing <map> root element.');
  }

  const width = parseInt(mapEl.getAttribute('width') || '30', 10);
  const height = parseInt(mapEl.getAttribute('height') || '20', 10);
  const tilewidth = parseInt(mapEl.getAttribute('tilewidth') || '32', 10);
  const tileheight = parseInt(mapEl.getAttribute('tileheight') || '32', 10);
  const orientation = mapEl.getAttribute('orientation') || 'orthogonal';
  const renderorder = mapEl.getAttribute('renderorder') || 'right-down';
  const infinite = mapEl.getAttribute('infinite') === '1';
  const version = mapEl.getAttribute('version') || '1.10';
  const tiledversion = mapEl.getAttribute('tiledversion') || '1.10';

  // Map custom properties
  const properties: Array<{ name: string; type?: string; value: any }> = [];
  const mapPropsEl = mapEl.querySelector(':scope > properties');
  if (mapPropsEl) {
    for (const prop of Array.from(mapPropsEl.querySelectorAll(':scope > property'))) {
      const name = prop.getAttribute('name') || '';
      const val = prop.getAttribute('value') ?? prop.textContent;
      const type = prop.getAttribute('type') || 'string';
      properties.push({ name, type, value: val });
    }
  }

  // Tilesets
  const tilesets: any[] = [];
  for (const tsEl of Array.from(mapEl.querySelectorAll(':scope > tileset'))) {
    const firstgid = parseInt(tsEl.getAttribute('firstgid') || '1', 10);
    const source = tsEl.getAttribute('source');
    const sourceFilename = source ? source.replace(/\\/g, '/').split('/').pop()?.replace(/\.[^/.]+$/, '') || '' : '';
    const name = tsEl.getAttribute('name') || sourceFilename || `tileset_${firstgid}`;
    const imgEl = tsEl.querySelector('image');
    const image = imgEl ? imgEl.getAttribute('source') : undefined;
    const imagewidth = imgEl ? parseInt(imgEl.getAttribute('width') || '1024', 10) : undefined;
    const imageheight = imgEl ? parseInt(imgEl.getAttribute('height') || '1024', 10) : undefined;

    const tiles: any[] = [];
    for (const tEl of Array.from(tsEl.querySelectorAll(':scope > tile'))) {
      const tileId = parseInt(tEl.getAttribute('id') || '0', 10);
      const animEl = tEl.querySelector('animation');
      if (animEl) {
        const frames: any[] = [];
        for (const fEl of Array.from(animEl.querySelectorAll(':scope > frame'))) {
          frames.push({
            tileid: parseInt(fEl.getAttribute('tileid') || '0', 10),
            duration: parseInt(fEl.getAttribute('duration') || '100', 10)
          });
        }
        if (frames.length > 0) {
          tiles.push({ id: tileId, animation: frames });
        }
      }
    }

    tilesets.push({
      firstgid,
      source: source || undefined,
      name,
      image,
      imagewidth,
      imageheight,
      tilewidth: parseInt(tsEl.getAttribute('tilewidth') || String(tilewidth), 10),
      tileheight: parseInt(tsEl.getAttribute('tileheight') || String(tileheight), 10),
      tiles: tiles.length > 0 ? tiles : undefined
    });
  }

  // Layers & Object Groups
  const layers: any[] = [];
  for (const child of Array.from(mapEl.children)) {
    if (child.tagName === 'layer') {
      const lname = child.getAttribute('name') || 'Tile Layer';
      const lw = parseInt(child.getAttribute('width') || String(width), 10);
      const lh = parseInt(child.getAttribute('height') || String(height), 10);
      const dataEl = child.querySelector('data');
      let data: number[] = [];
      if (dataEl) {
        const tileEls = dataEl.querySelectorAll('tile');
        if (tileEls.length > 0) {
          data = Array.from(tileEls).map((t) => parseInt(t.getAttribute('gid') || '0', 10));
        } else {
          const text = dataEl.textContent || '';
          data = text
            .trim()
            .split(/[\s,]+/)
            .filter(Boolean)
            .map((v) => parseInt(v, 10));
        }
      }
      layers.push({
        id: layers.length + 1,
        name: lname,
        type: 'tilelayer',
        width: lw,
        height: lh,
        visible: child.getAttribute('visible') !== '0',
        opacity: parseFloat(child.getAttribute('opacity') || '1'),
        data
      });
    } else if (child.tagName === 'objectgroup') {
      const gname = child.getAttribute('name') || 'objects';
      const gclass = child.getAttribute('class') || child.getAttribute('type') || '';
      const groupProps: Array<{ name: string; type?: string; value: any }> = [];
      const groupPropsEl = child.querySelector(':scope > properties');
      if (groupPropsEl) {
        for (const p of Array.from(groupPropsEl.querySelectorAll(':scope > property'))) {
          groupProps.push({
            name: p.getAttribute('name') || '',
            type: p.getAttribute('type') || 'string',
            value: p.getAttribute('value') ?? p.textContent
          });
        }
      }

      const objects: any[] = [];
      for (const objEl of Array.from(child.querySelectorAll(':scope > object'))) {
        const objId = parseInt(objEl.getAttribute('id') || String(objects.length + 1), 10);
        const objName = objEl.getAttribute('name') || '';
        const objType = objEl.getAttribute('type') || objEl.getAttribute('class') || '';
        const ox = parseFloat(objEl.getAttribute('x') || '0');
        const oy = parseFloat(objEl.getAttribute('y') || '0');
        const ow = parseFloat(objEl.getAttribute('width') || '0');
        const oh = parseFloat(objEl.getAttribute('height') || '0');
        const gid = objEl.getAttribute('gid') ? parseInt(objEl.getAttribute('gid')!, 10) : undefined;
        const isPoint = Boolean(objEl.querySelector('point'));

        const objProps: Array<{ name: string; type?: string; value: any }> = [];
        const propsEl = objEl.querySelector('properties');
        if (propsEl) {
          for (const p of Array.from(propsEl.querySelectorAll(':scope > property'))) {
            objProps.push({
              name: p.getAttribute('name') || '',
              type: p.getAttribute('type') || 'string',
              value: p.getAttribute('value') ?? p.textContent
            });
          }
        }

        objects.push({
          id: objId,
          name: objName,
          type: objType,
          class: objType,
          x: ox,
          y: oy,
          width: ow,
          height: oh,
          gid,
          point: isPoint,
          properties: objProps
        });
      }

      layers.push({
        id: layers.length + 1,
        name: gname,
        type: 'objectgroup',
        class: gclass,
        visible: child.getAttribute('visible') !== '0',
        opacity: parseFloat(child.getAttribute('opacity') || '1'),
        properties: groupProps,
        objects
      });
    }
  }

  const result: any = {
    name: defaultName,
    type: 'map',
    version,
    tiledversion,
    orientation,
    renderorder,
    infinite,
    compressionlevel: -1,
    width,
    height,
    tilewidth,
    tileheight,
    properties,
    tilesets,
    layers
  };

  resolveExternalTilesetSources(result);
  return result;
}

/**
 * Parses a standalone Tiled XML Tileset (.tsx).
 */
export function parseTsxXml(xmlString: string): any {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlString, 'text/xml');
  const tsEl = xml.querySelector('tileset');
  if (!tsEl) {
    throw new Error('Invalid TSX format: Missing <tileset> root element.');
  }

  const name = tsEl.getAttribute('name') || 'Custom Tileset';
  const tilewidth = parseInt(tsEl.getAttribute('tilewidth') || '32', 10);
  const tileheight = parseInt(tsEl.getAttribute('tileheight') || '32', 10);
  const tilecount = parseInt(tsEl.getAttribute('tilecount') || '256', 10);
  const columns = parseInt(tsEl.getAttribute('columns') || '16', 10);
  const imgEl = tsEl.querySelector('image');
  const image = imgEl ? imgEl.getAttribute('source') : undefined;

  const tiles: any[] = [];
  for (const tEl of Array.from(tsEl.querySelectorAll(':scope > tile'))) {
    const tileId = parseInt(tEl.getAttribute('id') || '0', 10);
    const animEl = tEl.querySelector('animation');
    if (animEl) {
      const frames: any[] = [];
      for (const fEl of Array.from(animEl.querySelectorAll(':scope > frame'))) {
        frames.push({
          tileid: parseInt(fEl.getAttribute('tileid') || '0', 10),
          duration: parseInt(fEl.getAttribute('duration') || '100', 10)
        });
      }
      if (frames.length > 0) {
        tiles.push({ id: tileId, animation: frames });
      }
    }
  }

  return {
    name,
    tilewidth,
    tileheight,
    tilecount,
    columns,
    image,
    tiles: tiles.length > 0 ? tiles : undefined
  };
}

/**
 * Normalizes any tree variant identifier into one of the 12 preloaded animated tree keys.
 */
export function normalizeTreeVariant(raw?: string): string {
  if (!raw) return 'tree2B';
  const v = raw.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (v.includes('1a')) return 'tree1A';
  if (v.includes('1b')) return 'tree1B';
  if (v.includes('1c')) return 'tree1C';
  if (v.includes('1d')) return 'tree1D';

  if (v.includes('2a')) return 'tree2A';
  if (v.includes('2b')) return 'tree2B';
  if (v.includes('2c')) return 'tree2C';
  if (v.includes('2d')) return 'tree2D';

  if (v.includes('3a')) return 'tree3A';
  if (v.includes('3b')) return 'tree3B';
  if (v.includes('3c')) return 'tree3C';
  if (v.includes('3d')) return 'tree3D';

  if (v.includes('oak') || v.includes('grand') || v.includes('big')) return 'tree1B';
  if (v.includes('pine') || v.includes('conifer')) return 'tree3B';
  if (v.includes('meadow') || v.includes('small')) return 'tree2B';

  return 'tree2B';
}

export function parseTiledMapData(tiledJson: any, defaultName = 'Tiled Realm'): ParsedTiledResult {
  if (!tiledJson || typeof tiledJson !== 'object') {
    throw new Error('Invalid Tiled map format: root is not an object.');
  }

  // Automatically resolve external .tsx / .tsj tileset sources
  resolveExternalTilesetSources(tiledJson);

  const width = Number(tiledJson.width) || 30;
  const height = Number(tiledJson.height) || 20;
  const tileWidth = Number(tiledJson.tilewidth) || 32;
  const tileHeight = Number(tiledJson.tileheight) || 32;

  const widthPx = width * tileWidth;
  const heightPx = height * tileHeight;

  const mapProperties = parseTiledProperties(tiledJson.properties);
  const mapName = (mapProperties.name as string) || (tiledJson.name as string) || defaultName;

  let playerSpawn: Point2D = {
    x: Math.round(widthPx / 2),
    y: Math.round(heightPx / 2)
  };
  let hasExplicitPlayerSpawn = false;

  const enemySpawns: Array<{ name: string; x: number; y: number; kind?: string; respawnDelay?: number }> = [];
  const colliders: ColliderRect[] = [];
  const portals: PortalTrigger[] = [];
  const zones: TiledZoneData[] = [];
  const envObjects: TiledEnvObject[] = [];
  const namedAnchors = new Map<string, { x: number; y: number; width: number; height: number; name: string }>();

  const layers: any[] = Array.isArray(tiledJson.layers) ? tiledJson.layers : [];

  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    const layerName = String(layer.name || '').toLowerCase();
    const layerClass = String(layer.class || layer.type || '').toLowerCase();
    const layerType = String(layer.type || '');
    const layerProps = parseTiledProperties(layer.properties);

    if (layerType === 'tilelayer') {
      const isSolidLayer =
        layerName.includes('collision') ||
        layerName.includes('collider') ||
        layerName.includes('barrier') ||
        layerName.includes('wall') ||
        Boolean(layerProps.solid);

      if (isSolidLayer && Array.isArray(layer.data)) {
        const lw = Number(layer.width) || width;
        const lh = Number(layer.height) || height;
        for (let y = 0; y < lh; y++) {
          for (let x = 0; x < lw; x++) {
            const rawGid = layer.data[y * lw + x];
            const cleanGid = Number(rawGid) & 0x1fffffff;
            if (cleanGid > 0) {
              colliders.push({
                x: x * tileWidth,
                y: y * tileHeight,
                width: tileWidth,
                height: tileHeight
              });
            }
          }
        }
      }
    } else if (layerType === 'objectgroup') {
      const objects: any[] = Array.isArray(layer.objects) ? layer.objects : [];
      for (const obj of objects) {
        if (!obj || typeof obj !== 'object') continue;
        const objName = String(obj.name || '');
        const objClass = String(obj.class || '').toLowerCase();
        const objType = (String(obj.type || '') || objClass).toLowerCase();
        const objProps = parseTiledProperties(obj.properties);
        const ox = Number(obj.x) || 0;
        const oy = Number(obj.y) || 0;
        const ow = Number(obj.width) || tileWidth;
        const oh = Number(obj.height) || tileHeight;

        // 1. Player Spawn Detection
        const isPlayerSpawn =
          objType === 'player_spawn' ||
          objName === 'player_spawn' ||
          objName.toLowerCase().includes('player') ||
          layerName.includes('player') ||
          layerClass === 'player_spawn' ||
          layerClass.includes('player') ||
          objProps.spawn === 'player';

        if (isPlayerSpawn) {
          playerSpawn = { x: ox, y: oy };
          hasExplicitPlayerSpawn = true;
          continue;
        }

        // 2. Enemy Spawns Detection (Class = 'enemy_spawn', Custom Property: <enemy_name> = 1 to spawn, 0 to disable)
        const mergedEnemyProps: Record<string, any> = { ...layerProps, ...objProps };
        const isEnemyKey = (k: string) => {
          const kl = k.toLowerCase().trim();
          return (
            kl.includes('slime') ||
            kl.includes('jelly') ||
            kl.includes('abyssal') ||
            kl.includes('eldritch') ||
            kl.includes('boss') ||
            kl.includes('orc') ||
            kl === 'enemy' ||
            kl === 'spawn' ||
            kl === 'kind'
          );
        };
        const isPropDisabled = (v: any) => v === 0 || v === '0' || v === false || String(v).toLowerCase().trim() === 'false';
        const isPropEnabled = (v: any) =>
          v === 1 ||
          v === '1' ||
          v === true ||
          String(v).toLowerCase().trim() === 'true' ||
          (typeof v === 'string' && v.trim() !== '' && !isPropDisabled(v));

        const enemyPropEntries = Object.entries(mergedEnemyProps).filter(([k, v]) => isEnemyKey(k) || (typeof v === 'string' && isEnemyKey(v)));
        const enabledEnemyEntries = enemyPropEntries.filter(([, v]) => isPropEnabled(v));
        const hasDisabledEnemyEntries = enemyPropEntries.some(([, v]) => isPropDisabled(v));

        const isEnemyLayer =
          (layerClass === 'enemy_spawn' ||
            layerClass === 'boss_spawn' ||
            layerClass.includes('enemy') ||
            layerClass.includes('slime') ||
            layerClass.includes('orc') ||
            layerClass.includes('boss') ||
            layerName.includes('enemy') ||
            layerName.includes('slime') ||
            layerName.includes('orc') ||
            layerName.includes('boss') ||
            layerName.includes('spawner')) &&
          !layerName.includes('player') &&
          !layerClass.includes('player');

        const isEnemySpawn =
          objType === 'enemy_spawn' ||
          objClass === 'enemy_spawn' ||
          objType === 'boss_spawn' ||
          objClass === 'boss_spawn' ||
          objType === 'boss' ||
          objClass === 'boss' ||
          objType === 'jelly_boss' ||
          objClass === 'jelly_boss' ||
          objName.toLowerCase().includes('jelly_boss') ||
          objName.toLowerCase().includes('jelly boss') ||
          objName.toLowerCase().includes('enemy') ||
          objName.toLowerCase().includes('slime') ||
          objName.toLowerCase().includes('orc') ||
          objName.toLowerCase().includes('boss') ||
          isEnemyLayer ||
          enemyPropEntries.length > 0;

        if (isEnemySpawn) {
          // If custom properties exist and are set to 0 (false) with no enabled (1) properties, do not spawn anything!
          if (hasDisabledEnemyEntries && enabledEnemyEntries.length === 0) {
            continue;
          }

          const spawnX = ox + (Number(obj.width) > 0 && !obj.point ? Number(obj.width) / 2 : 0);
          const spawnY = oy + (Number(obj.height) > 0 && !obj.point ? Number(obj.height) / 2 : 0);

          // Determine enemy kind from enabled (1 / true) custom properties first, then fallback to object/layer names
          const activeTokens =
            enabledEnemyEntries.length > 0
              ? enabledEnemyEntries.map(([k, v]) => `${k} ${v}`).join(' ').toLowerCase()
              : `${objName} ${objType} ${objClass} ${layerName}`.toLowerCase();

          let kind: string | undefined;
          if (
            activeTokens.includes('jelly_boss') ||
            activeTokens.includes('jelly boss') ||
            activeTokens.includes('abyssal') ||
            activeTokens.includes('jelly') ||
            activeTokens.includes('eldritch') ||
            activeTokens.includes('organism') ||
            activeTokens.includes('boss')
          ) {
            kind = 'abyssal_jelly';
          } else if (activeTokens.includes('orc')) {
            kind = activeTokens.includes('warlord') ? 'orc_warlord' : 'hunter_orc';
          } else if (activeTokens.includes('slime')) {
            kind = 'green_slime';
          } else {
            // If enemy_spawn has custom properties and none matched a known enemy or all were 0, skip
            if (enemyPropEntries.length > 0 && enabledEnemyEntries.length === 0) {
              continue;
            }
            kind = 'green_slime';
          }

          const rawRespawn = getPropCaseInsensitive(
            mergedEnemyProps,
            'respawn_timer',
            'respawn timer',
            'respawn_time',
            'respawn time',
            'respawntimer',
            'respawn'
          );
          const respawnDelay =
            rawRespawn !== undefined && rawRespawn !== '' && !Number.isNaN(Number(rawRespawn))
              ? Number(rawRespawn)
              : undefined;

          enemySpawns.push({
            name:
              objName && !['jelly_boss', 'jelly boss', 'boss', 'enemy_spawn', 'slime'].includes(objName.toLowerCase().trim())
                ? objName
                : kind === 'abyssal_jelly'
                  ? 'Abyssal Jelly'
                  : kind === 'hunter_orc'
                    ? 'Hunter Orc'
                    : 'Cave Slime',
            x: spawnX,
            y: spawnY,
            kind,
            respawnDelay
          });
          continue;
        }

        const propIn = getPropCaseInsensitive(objProps, 'in', 'from', 'entry', 'source');
        const propOut = getPropCaseInsensitive(objProps, 'out', 'to', 'target', 'dest', 'destination', 'targetMapId', 'targetMapName');
        const px = ox + (ow > 0 && !obj.point ? ow / 2 : 0);
        const py = oy + (oh > 0 && !obj.point ? oh / 2 : 0);

        if (propIn !== undefined && String(propIn).trim()) {
          const inTag = String(propIn).trim();
          namedAnchors.set(inTag.toLowerCase(), { x: px, y: py, width: ow, height: oh, name: inTag });
        }
        if (objName && objName.trim()) {
          namedAnchors.set(objName.toLowerCase().trim(), { x: px, y: py, width: ow, height: oh, name: objName.trim() });
        }

        // 3. Portals / Doorways / Room Connectors (Supports simple 'in' and 'out' variables)
        const isPortalObj =
          propOut !== undefined ||
          propIn !== undefined ||
          objType === 'portal' ||
          objType === 'door' ||
          objType === 'teleport' ||
          objType === 'warp' ||
          objClass === 'portal' ||
          objClass === 'door' ||
          objClass === 'teleport' ||
          objName.toLowerCase().includes('portal') ||
          objName.toLowerCase().includes('teleport') ||
          objName.toLowerCase().includes('door') ||
          objName.toLowerCase().includes('warp') ||
          objName.toLowerCase().includes('exit') ||
          objName.toLowerCase().includes('entrance') ||
          objProps.targetMapId ||
          objProps.targetMapName ||
          objProps.connectorTag;

        if (isPortalObj) {
          const inName = String(propIn ?? objName ?? '').trim();
          const outName = String(propOut ?? objProps.targetMapId ?? objProps.targetMapName ?? '').trim();
          portals.push({
            id: String(obj.id || `portal_${portals.length + 1}`),
            x: px,
            y: py,
            width: ow > 0 ? ow : 32,
            height: oh > 0 ? oh : 32,
            inName: inName || undefined,
            outName: outName || undefined,
            targetMapId: objProps.targetMapId || objProps.targetMapName || (outName ? outName : undefined),
            targetMapName: objProps.targetMapName || objProps.targetMapId,
            targetX: Number(objProps.targetX) || px,
            targetY: Number(objProps.targetY) || py,
            label: objProps.label || outName || inName || objName || 'Doorway',
            connectorTag: objProps.connectorTag
          });
          continue;
        }

        // 4. Hazard / Healing Zones (Damage, Poison, Heal regions)
        if (
          objType === 'zone' ||
          objType === 'hazard' ||
          objProps.hazard !== undefined ||
          objProps.damage !== undefined ||
          objProps.heal !== undefined ||
          objName.toLowerCase().includes('hazard') ||
          objName.toLowerCase().includes('poison')
        ) {
          zones.push({
            id: String(obj.id || `zone_${zones.length + 1}`),
            name: objName || 'Custom Zone',
            x: ox,
            y: oy,
            width: ow,
            height: oh,
            color: objProps.color || '#22c55e',
            properties: objProps
          });
          continue;
        }

        // 5. Explicit Colliders in Object Layer (handles barrier, collision, collider, wall, rock, tree_trunk, etc.)
        const isExplicitCollider =
          objType === 'collider' ||
          objType === 'collision' ||
          objType === 'barrier' ||
          objType === 'wall' ||
          objType === 'solid' ||
          objClass === 'collider' ||
          objClass === 'collision' ||
          objClass === 'wall' ||
          layerName.includes('collision') ||
          layerName.includes('collider') ||
          layerName.includes('wall') ||
          layerName.includes('barrier') ||
          layerName.includes('solid') ||
          objName.toLowerCase().includes('trunk') ||
          objName.toLowerCase().includes('collider') ||
          objName.toLowerCase().includes('wall') ||
          objName.toLowerCase().includes('rock') ||
          objName.toLowerCase().includes('solid') ||
          (!obj.point && ow > 0 && oh > 0 && !objType && objProps.type !== 'tree');

        if (
          isExplicitCollider &&
          objType !== 'tree' &&
          !objProps.is_tree &&
          objType !== 'water_anim' &&
          !isPortalObj &&
          objType !== 'zone' &&
          objType !== 'hazard'
        ) {
          colliders.push({
            x: ox,
            y: oy,
            width: ow > 0 ? ow : 32,
            height: oh > 0 ? oh : 32
          });
          continue;
        }

        // 6. Environmental Props (Animated Trees, Water)
        const isTree =
          objType === 'tree' ||
          objClass === 'tree' ||
          objProps.type === 'tree' ||
          Boolean(objProps.is_tree) ||
          (objType.includes('tree') && !objType.includes('trunk') && !objType.includes('collider')) ||
          (objName.toLowerCase().startsWith('tree') && !objName.toLowerCase().includes('trunk') && !objName.toLowerCase().includes('collider'));

        const isWaterAnim =
          objType === 'water_anim' ||
          objType.includes('water') ||
          objName.toLowerCase().includes('water_anim') ||
          objProps.type === 'water_anim';

        if (isTree || isWaterAnim) {
          const type = isTree ? 'tree' : 'water_anim';
          const variant = isTree
            ? normalizeTreeVariant(objProps.variant as string || objProps.tree_type as string)
            : (objProps.variant as string) || 'water_tafle_1A';

          const isPoint = Boolean(obj.point);
          const baseX = ox + (isPoint ? 0 : ow > 0 ? ow / 2 : 0);
          const baseY = isPoint ? oy : (obj.gid ? oy : oy + oh);

          envObjects.push({
            id: String(obj.id || `env_${envObjects.length + 1}`),
            type,
            variant,
            x: baseX,
            y: baseY,
            properties: objProps
          });

          // Add solid trunk collider for every tree if no explicit collider already covers it
          if (isTree) {
            const hasExistingCollider = colliders.some(
              (c) =>
                Math.abs(c.x + c.width / 2 - baseX) < 24 &&
                Math.abs(c.y + c.height / 2 - (baseY - 8)) < 24
            );
            if (!hasExistingCollider) {
              colliders.push({
                x: baseX - 16,
                y: baseY - 18,
                width: 32,
                height: 20
              });
            }
          }
          continue;
        }
      }
    }
  }

  // If no explicit player spawn was found, search for populated tile regions so player never spawns in empty void
  if (!hasExplicitPlayerSpawn) {
    let minTileX = Infinity;
    let minTileY = Infinity;
    let maxTileX = -Infinity;
    let maxTileY = -Infinity;
    for (const layer of layers) {
      if (layer && layer.type === 'tilelayer' && Array.isArray(layer.data)) {
        const lw = Number(layer.width) || width;
        const lh = Number(layer.height) || height;
        for (let y = 0; y < lh; y++) {
          for (let x = 0; x < lw; x++) {
            const rawGid = layer.data[y * lw + x];
            const cleanGid = Number(rawGid) & 0x1fffffff;
            if (cleanGid > 0) {
              if (x < minTileX) minTileX = x;
              if (x > maxTileX) maxTileX = x;
              if (y < minTileY) minTileY = y;
              if (y > maxTileY) maxTileY = y;
            }
          }
        }
      }
    }
    if (minTileX !== Infinity) {
      const midX = Math.floor((minTileX + maxTileX) / 2) * tileWidth + tileWidth / 2;
      const midY = Math.floor((minTileY + maxTileY) / 2) * tileHeight + tileHeight / 2;
      playerSpawn = { x: midX, y: midY };
    }
  }

  // Safe landing probe to ensure player does not arrive trapped inside a wall collider
  const isPointBlocked = (cx: number, cy: number) => {
    for (const c of colliders) {
      if (cx >= c.x && cx <= c.x + c.width && cy >= c.y && cy <= c.y + c.height) {
        return true;
      }
    }
    return false;
  };

  const getSafeLandingPos = (tx: number, ty: number) => {
    if (!isPointBlocked(tx, ty)) return { x: tx, y: ty };
    const probeOffsets = [
      { x: 0, y: 32 },
      { x: 0, y: -32 },
      { x: 32, y: 0 },
      { x: -32, y: 0 },
      { x: 0, y: 48 },
      { x: 0, y: -48 },
      { x: 36, y: 36 },
      { x: -36, y: 36 }
    ];
    for (const off of probeOffsets) {
      if (!isPointBlocked(tx + off.x, ty + off.y)) {
        return { x: tx + off.x, y: ty + off.y };
      }
    }
    return { x: tx, y: ty };
  };

  // Connect and resolve 'in' and 'out' portal destinations
  for (const portal of portals) {
    const destTag = (portal.outName || portal.targetMapId || '').trim();
    if (!destTag) continue;

    const destLower = destTag.toLowerCase();

    // 1. Meadow Realm / Overworld transition
    if (destLower === 'meadow' || destLower === 'green meadow' || destLower === 'surface' || destLower === 'overworld') {
      portal.targetMapId = 'meadow';
      portal.targetX = 480;
      portal.targetY = 432;
      portal.label = 'Meadow Realm';
      continue;
    }

    // 2. Local in-map destination matched by 'in' variable or object name
    const anchor = namedAnchors.get(destLower);
    if (anchor) {
      const safe = getSafeLandingPos(anchor.x, anchor.y);
      portal.targetMapId = 'local';
      portal.targetX = safe.x;
      portal.targetY = safe.y;
      portal.label = anchor.name;
      continue;
    }

    // 3. External map transition
    portal.targetMapId = destTag;
    portal.label = destTag;
  }

  // 4. Auto-pair unlinked local portals (e.g. if the user placed two doorways without typing 'out')
  const unlinkedPortals = portals.filter((p) => !p.targetMapId || p.targetMapId === '');
  if (unlinkedPortals.length === 2) {
    const p1 = unlinkedPortals[0];
    const p2 = unlinkedPortals[1];
    const safe1 = getSafeLandingPos(p1.x, p1.y);
    const safe2 = getSafeLandingPos(p2.x, p2.y);

    p1.targetMapId = 'local';
    p1.targetX = safe2.x;
    p1.targetY = safe2.y;
    p1.label = p2.label || p2.inName || 'Teleport';

    p2.targetMapId = 'local';
    p2.targetX = safe1.x;
    p2.targetY = safe1.y;
    p2.label = p1.label || p1.inName || 'Return Portal';
  } else if (unlinkedPortals.length > 2) {
    // Attempt to pair portals by name similarity (e.g. "Secret Room" and "Secret Room Area")
    for (let i = 0; i < unlinkedPortals.length; i++) {
      const pi = unlinkedPortals[i];
      if (pi.targetMapId) continue;
      const nameI = (pi.inName || pi.label || '').toLowerCase();
      for (let j = i + 1; j < unlinkedPortals.length; j++) {
        const pj = unlinkedPortals[j];
        if (pj.targetMapId) continue;
        const nameJ = (pj.inName || pj.label || '').toLowerCase();
        if (nameI && nameJ && (nameI.includes(nameJ) || nameJ.includes(nameI))) {
          const safeI = getSafeLandingPos(pi.x, pi.y);
          const safeJ = getSafeLandingPos(pj.x, pj.y);
          pi.targetMapId = 'local';
          pi.targetX = safeJ.x;
          pi.targetY = safeJ.y;
          pi.label = pj.label || pj.inName || 'Teleport';

          pj.targetMapId = 'local';
          pj.targetX = safeI.x;
          pj.targetY = safeI.y;
          pj.label = pi.label || pi.inName || 'Return Portal';
          break;
        }
      }
    }
  }

  // Only spawn enemies if explicitly placed in Tiled object layers
  const isPeaceful = Boolean(mapProperties.is_peaceful);

  return {
    mapName,
    spawnData: {
      widthPx,
      heightPx,
      playerSpawn,
      enemySpawns,
      colliders,
      portals,
      isPeaceful
    },
    zones,
    envObjects,
    properties: mapProperties
  };
}

export function resolveTilesetTextureKey(
  scene: Phaser.Scene,
  tiledTileset: { name: string; image?: any; source?: string }
): string | null {
  // 1. Direct name match (or stripped unique suffix _firstgid)
  if (scene.textures.exists(tiledTileset.name)) {
    return tiledTileset.name;
  }
  const strippedSuffix = tiledTileset.name.replace(/_\d+$/, '');
  if (scene.textures.exists(strippedSuffix)) {
    return strippedSuffix;
  }

  // 2. Basename of image path (e.g. '../tilesets/MainLev2.0.png' -> 'MainLev2.0')
  if (tiledTileset.image && typeof tiledTileset.image === 'string') {
    const rawFilename = tiledTileset.image.split(/[/\\]/).pop() || '';
    const withoutExt = rawFilename.replace(/\.[^/.]+$/, '');
    if (scene.textures.exists(withoutExt)) {
      return withoutExt;
    }
    const matched = findMatchingCatalogMeta(withoutExt);
    if (matched && scene.textures.exists(matched.key)) {
      return matched.key;
    }
  }

  // 3. Basename of external source path (e.g. 'grassland.tsx' -> 'grassland')
  if (tiledTileset.source && typeof tiledTileset.source === 'string') {
    const sourceBase = tiledTileset.source.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, '') || '';
    const matched = findMatchingCatalogMeta(sourceBase);
    if (matched && scene.textures.exists(matched.key)) {
      return matched.key;
    }
  }

  // 4. Normalized key check (e.g. "deep cave decorative" -> "deep_cave_decorative")
  const normalizedName = (tiledTileset.name || '').toLowerCase().trim();
  const normalizedKey = normalizedName.replace(/[\s-]+/g, '_');
  if (scene.textures.exists(normalizedKey)) {
    return normalizedKey;
  }

  // 5. Match catalog directly
  const metaMatch = findMatchingCatalogMeta(normalizedName, true);
  if (metaMatch && scene.textures.exists(metaMatch.key)) {
    return metaMatch.key;
  }

  // 6. Search TILESET_CATALOG by name or key
  for (const meta of TILESET_CATALOG) {
    if (
      meta.name.toLowerCase().trim() === normalizedName ||
      meta.key.toLowerCase().trim() === normalizedName ||
      normalizedName.includes(meta.key.toLowerCase())
    ) {
      if (scene.textures.exists(meta.key)) {
        return meta.key;
      }
    }
  }

  // 7. Cave / Dungeon specific fallbacks
  if (normalizedName.includes('cave') || normalizedName.includes('dungeon') || normalizedName.includes('underground')) {
    if (scene.textures.exists('deep_cave_mainlev')) return 'deep_cave_mainlev';
    if (scene.textures.exists('cave_grounds')) return 'cave_grounds';
  }

  // 8. Default fallbacks
  if (scene.textures.exists('MainLev2.0')) {
    return 'MainLev2.0';
  }
  if (scene.textures.exists('grassland_main')) {
    return 'grassland_main';
  }

  return null;
}
