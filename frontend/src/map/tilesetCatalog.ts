export interface TilesetMeta {
  key: string;
  name: string;
  category: 'Grassland' | 'Forest' | 'Caves' | 'Desert' | 'Snow' | 'Buildings & Castle' | 'Harbor' | 'Props & Camps' | 'Animated';
  url: string;
  tileWidth: number;
  tileHeight: number;
  width: number;
  height: number;
  cols: number;
  rows: number;
}

export const TILESET_CATALOG: TilesetMeta[] = [
  {
    key: 'grassland_main',
    name: 'Grassland Terrain & Cliffs',
    category: 'Grassland',
    url: 'assets/tilesets/packs/grassland_main.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 2048,
    height: 1408,
    cols: 64,
    rows: 44
  },
  {
    key: 'grassland_dec',
    name: 'Grassland Rocks & Bushes',
    category: 'Grassland',
    url: 'assets/tilesets/packs/grassland_dec.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1024,
    height: 1024,
    cols: 32,
    rows: 32
  },
  {
    key: 'forest_main',
    name: 'Ancient Forest Terrain',
    category: 'Forest',
    url: 'assets/tilesets/packs/forest_main.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1728,
    height: 1568,
    cols: 54,
    rows: 49
  },
  {
    key: 'forest_dec',
    name: 'Ancient Forest Foliage & Logs',
    category: 'Forest',
    url: 'assets/tilesets/packs/forest_dec.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1664,
    height: 736,
    cols: 52,
    rows: 23
  },
  {
    key: 'houses_outside',
    name: 'Village Houses & Roofs',
    category: 'Buildings & Castle',
    url: 'assets/tilesets/packs/houses_outside.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1024,
    height: 1024,
    cols: 32,
    rows: 32
  },
  {
    key: 'house_interiors',
    name: 'House & Tavern Interiors',
    category: 'Buildings & Castle',
    url: 'assets/tilesets/packs/house_interiors.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 704,
    height: 1280,
    cols: 22,
    rows: 40
  },
  {
    key: 'castle_outside',
    name: 'Castle Walls & Battlements',
    category: 'Buildings & Castle',
    url: 'assets/tilesets/packs/castle_outside.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1600,
    height: 1056,
    cols: 50,
    rows: 33
  },
  {
    key: 'castle_interiors',
    name: 'Castle Keep Interiors',
    category: 'Buildings & Castle',
    url: 'assets/tilesets/packs/castle_interiors.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1056,
    height: 1280,
    cols: 33,
    rows: 40
  },
  {
    key: 'castle_dec',
    name: 'Castle Shields & Windows',
    category: 'Buildings & Castle',
    url: 'assets/tilesets/packs/castle_dec.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 512,
    height: 512,
    cols: 16,
    rows: 16
  },
  {
    key: 'cave_grounds',
    name: 'Cave Underground Floors',
    category: 'Caves',
    url: 'assets/tilesets/packs/cave_grounds.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1280,
    height: 1344,
    cols: 40,
    rows: 42
  },
  {
    key: 'cave_hills',
    name: 'Cave Stalagmites & Walls',
    category: 'Caves',
    url: 'assets/tilesets/packs/cave_hills.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1216,
    height: 1056,
    cols: 38,
    rows: 33
  },
  {
    key: 'cave_dec',
    name: 'Cave Crystals & Mushrooms',
    category: 'Caves',
    url: 'assets/tilesets/packs/cave_dec.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1024,
    height: 832,
    cols: 32,
    rows: 26
  },
  {
    key: 'deep_cave_mainlev',
    name: 'Deep Cave MainLev Terrain',
    category: 'Caves',
    url: 'assets/tilesets/packs/deep_cave_mainlev.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1216,
    height: 1344,
    cols: 38,
    rows: 42
  },
  {
    key: 'deep_cave_decorative',
    name: 'Deep Cave Decorative Props',
    category: 'Caves',
    url: 'assets/tilesets/packs/deep_cave_decorative.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 640,
    height: 1024,
    cols: 20,
    rows: 32
  },
  {
    key: 'cave_plants',
    name: 'Cave Vegetation & Plants',
    category: 'Caves',
    url: 'assets/tilesets/packs/cave_plants.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 672,
    height: 608,
    cols: 21,
    rows: 19
  },
  {
    key: 'light1a',
    name: 'Cave Lights & Crystals',
    category: 'Props & Camps',
    url: 'assets/tilesets/packs/light1a.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 128,
    height: 128,
    cols: 4,
    rows: 4
  },
  {
    key: 'light2a',
    name: 'Trident Torch & Lanterns',
    category: 'Props & Camps',
    url: 'assets/tilesets/packs/light2a.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 128,
    height: 128,
    cols: 4,
    rows: 4
  },
  {
    key: 'fire3',
    name: 'Animated Campfire & Flames',
    category: 'Animated',
    url: 'assets/tilesets/packs/fire3.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 192,
    height: 64,
    cols: 6,
    rows: 2
  },
  {
    key: 'treasure_chests',
    name: 'Treasure Chests',
    category: 'Props & Camps',
    url: 'assets/tilesets/packs/treasure_chests.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 160,
    height: 192,
    cols: 5,
    rows: 6
  },
  {
    key: 'water_effa',
    name: 'Water Ripple Effect A',
    category: 'Animated',
    url: 'assets/tilesets/packs/water_effa.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 320,
    height: 32,
    cols: 10,
    rows: 1
  },
  {
    key: 'water_effb',
    name: 'Water Ripple Effect B',
    category: 'Animated',
    url: 'assets/tilesets/packs/water_effb.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 320,
    height: 32,
    cols: 10,
    rows: 1
  },
  {
    key: 'desert_main',
    name: 'Desert Dunes & Temples',
    category: 'Desert',
    url: 'assets/tilesets/packs/desert_main.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1408,
    height: 1312,
    cols: 44,
    rows: 41
  },
  {
    key: 'desert_dec',
    name: 'Desert Urns & Cacti',
    category: 'Desert',
    url: 'assets/tilesets/packs/desert_dec.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1280,
    height: 768,
    cols: 40,
    rows: 24
  },
  {
    key: 'snow_main',
    name: 'Snow Tundra & Frozen Hills',
    category: 'Snow',
    url: 'assets/tilesets/packs/snow_main.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1248,
    height: 1856,
    cols: 39,
    rows: 58
  },
  {
    key: 'snow_dec',
    name: 'Snowy Evergreens & Ice Rocks',
    category: 'Snow',
    url: 'assets/tilesets/packs/snow_dec.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1024,
    height: 800,
    cols: 32,
    rows: 25
  },
  {
    key: 'harbor',
    name: 'Harbor Piers & Bridges',
    category: 'Harbor',
    url: 'assets/tilesets/packs/harbor.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 768,
    height: 448,
    cols: 24,
    rows: 14
  },
  {
    key: 'ships',
    name: 'Ships, Boats & Ropes',
    category: 'Harbor',
    url: 'assets/tilesets/packs/ships.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1248,
    height: 992,
    cols: 39,
    rows: 31
  },
  {
    key: 'props_fence',
    name: 'Wooden Fences & Gates',
    category: 'Props & Camps',
    url: 'assets/tilesets/packs/props_fence.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 768,
    height: 448,
    cols: 24,
    rows: 14
  },
  {
    key: 'props_a',
    name: 'Barrels, Crates & Jars',
    category: 'Props & Camps',
    url: 'assets/tilesets/packs/props_a.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 320,
    height: 768,
    cols: 10,
    rows: 24
  },
  {
    key: 'props_b',
    name: 'Carts, Signs & Wells',
    category: 'Props & Camps',
    url: 'assets/tilesets/packs/props_b.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1024,
    height: 1024,
    cols: 32,
    rows: 32
  },
  {
    key: 'camp_graves',
    name: 'Campfires, Tents & Graves',
    category: 'Props & Camps',
    url: 'assets/tilesets/packs/camp_graves.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 1024,
    height: 480,
    cols: 32,
    rows: 15
  },
  {
    key: 'water_tafle_1A',
    name: 'Animated Water Ripples (Loop)',
    category: 'Animated',
    url: 'assets/tilesets/anims/water_tafle_1A.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 256,
    height: 32,
    cols: 8,
    rows: 1
  },
  {
    key: 'water_effA',
    name: 'Animated Water Flow & Splash',
    category: 'Animated',
    url: 'assets/tilesets/anims/water_effA.png',
    tileWidth: 32,
    tileHeight: 32,
    width: 320,
    height: 32,
    cols: 10,
    rows: 1
  },
  {
    key: 'torch',
    name: 'Animated Wall Torch',
    category: 'Animated',
    url: 'assets/tilesets/anims/torch.png',
    tileWidth: 32,
    tileHeight: 64,
    width: 128,
    height: 64,
    cols: 4,
    rows: 1
  },
  {
    key: 'fire1',
    name: 'Animated Campfire Flame',
    category: 'Animated',
    url: 'assets/tilesets/anims/fire1.png',
    tileWidth: 48,
    tileHeight: 48,
    width: 192,
    height: 96,
    cols: 4,
    rows: 2
  },
  {
    key: 'tree1B_thumb',
    name: 'Animated Grand Oak Tree',
    category: 'Animated',
    url: 'assets/tilesets/tree1B_ss.png',
    tileWidth: 160,
    tileHeight: 160,
    width: 640,
    height: 480,
    cols: 4,
    rows: 3
  },
  {
    key: 'tree2B_thumb',
    name: 'Animated Meadow Oak Tree',
    category: 'Animated',
    url: 'assets/tilesets/tree2B_ss.png',
    tileWidth: 128,
    tileHeight: 160,
    width: 512,
    height: 480,
    cols: 4,
    rows: 3
  }
];

export const TILESET_MAP = new Map(TILESET_CATALOG.map((t) => [t.key, t]));