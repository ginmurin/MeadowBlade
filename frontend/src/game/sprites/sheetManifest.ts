import type { ActionState, CharacterKind } from '../../sim/types';

export interface SheetSpec {
  key: string;
  url: string;
  cols: number;
  frameRate: number;
  repeat: number;
  overlayKey?: string;
}

export const CHARACTER_SHEETS: Record<CharacterKind, Partial<Record<ActionState, SheetSpec>>> = {
  crimson: {
    idle: {
      key: 'crimson_idle',
      url: 'assets/characters/crimson/Idle Default.png',
      cols: 6,
      frameRate: 8,
      repeat: -1
    },
    walk: {
      key: 'crimson_walk',
      url: 'assets/characters/crimson/Walk.png',
      cols: 6,
      frameRate: 11,
      repeat: -1
    },
    dash: {
      key: 'crimson_dash',
      url: 'assets/characters/crimson/Dash.png',
      cols: 4,
      frameRate: 18,
      repeat: 0
    },
    roll: {
      key: 'crimson_roll',
      url: 'assets/characters/crimson/Roll.png',
      cols: 11,
      frameRate: 24,
      repeat: 0
    },
    slash1: {
      key: 'crimson_slash1_body',
      overlayKey: 'crimson_slash1_vfx',
      url: 'assets/characters/crimson/Slash 1 No Weapon.png',
      cols: 6,
      frameRate: 20,
      repeat: 0
    },
    slash2: {
      key: 'crimson_slash2_body',
      overlayKey: 'crimson_slash2_vfx',
      url: 'assets/characters/crimson/Slash 2 No Weapon.png',
      cols: 6,
      frameRate: 18,
      repeat: 0
    },
    bowPull: {
      key: 'crimson_bow_pull',
      url: 'assets/characters/crimson/Bow Pull.png',
      cols: 4,
      frameRate: 10,
      repeat: 0
    },
    bowRelease: {
      key: 'crimson_bow_release',
      url: 'assets/characters/crimson/Bow Release.png',
      cols: 4,
      frameRate: 18,
      repeat: 0
    },
    guard: {
      key: 'crimson_guard',
      url: 'assets/characters/crimson/Block Idle.png',
      cols: 4,
      frameRate: 8,
      repeat: -1
    },
    throw: {
      key: 'crimson_throw',
      url: 'assets/characters/crimson/Throw.png',
      cols: 12,
      frameRate: 22,
      repeat: 0
    },
    skill: {
      key: 'crimson_skill',
      url: 'assets/characters/crimson/Dash Stab.png',
      cols: 11,
      frameRate: 24,
      repeat: 0
    },
    hit: {
      key: 'crimson_hit',
      url: 'assets/characters/crimson/Hit.png',
      cols: 4,
      frameRate: 14,
      repeat: 0
    }
  },
  elvish: {
    idle: {
      key: 'elvish_idle',
      url: 'assets/characters/elvish/Base.png',
      cols: 1,
      frameRate: 1,
      repeat: -1
    },
    walk: {
      key: 'elvish_walk',
      url: 'assets/characters/elvish/Walk.png',
      cols: 6,
      frameRate: 10,
      repeat: -1
    },
    dash: {
      key: 'elvish_dash',
      url: 'assets/characters/elvish/Dash.png',
      cols: 4,
      frameRate: 16,
      repeat: 0
    },
    roll: {
      key: 'elvish_roll',
      url: 'assets/characters/elvish/Roll.png',
      cols: 10,
      frameRate: 22,
      repeat: 0
    },
    slash1: {
      key: 'elvish_slash1',
      url: 'assets/characters/elvish/Slash 1.png',
      cols: 6,
      frameRate: 14,
      repeat: 0
    },
    slash2: {
      key: 'elvish_slash2',
      url: 'assets/characters/elvish/Slash 2.png',
      cols: 6,
      frameRate: 14,
      repeat: 0
    },
    bowPull: {
      key: 'elvish_bow_pull',
      url: 'assets/characters/elvish/Bow Attack.png',
      cols: 9,
      frameRate: 8,
      repeat: 0
    },
    bowRelease: {
      key: 'elvish_bow_release',
      url: 'assets/characters/elvish/Bow Attack.png',
      cols: 9,
      frameRate: 20,
      repeat: 0
    },
    guard: {
      key: 'elvish_dash',
      url: 'assets/characters/elvish/Dash.png',
      cols: 4,
      frameRate: 16,
      repeat: 0
    },
    throw: {
      key: 'elvish_bow_release',
      url: 'assets/characters/elvish/Bow Attack.png',
      cols: 9,
      frameRate: 22,
      repeat: 0
    },
    skill: {
      key: 'elvish_skill',
      url: 'assets/characters/elvish/Bow Attack.png',
      cols: 9,
      frameRate: 20,
      repeat: 0
    },
    hit: {
      key: 'elvish_hit',
      url: 'assets/characters/elvish/Hit.png',
      cols: 4,
      frameRate: 14,
      repeat: 0
    }
  },
  legacy: {
    idle: {
      key: 'legacy_idle',
      url: 'assets/characters/legacy/Idle Default.png',
      cols: 6,
      frameRate: 8,
      repeat: -1
    },
    walk: {
      key: 'legacy_walk',
      url: 'assets/characters/legacy/Walk.png',
      cols: 6,
      frameRate: 10,
      repeat: -1
    },
    dash: {
      key: 'legacy_dash',
      url: 'assets/characters/legacy/Dash.png',
      cols: 4,
      frameRate: 16,
      repeat: 0
    },
    roll: {
      key: 'legacy_roll',
      url: 'assets/characters/legacy/Roll.png',
      cols: 10,
      frameRate: 22,
      repeat: 0
    },
    slash1: {
      key: 'legacy_slash1',
      url: 'assets/characters/legacy/Slash 1 Default.png',
      cols: 6,
      frameRate: 16,
      repeat: 0
    },
    slash2: {
      key: 'legacy_slash2',
      url: 'assets/characters/legacy/Slash 2 Default.png',
      cols: 6,
      frameRate: 15,
      repeat: 0
    },
    bowPull: {
      key: 'legacy_bow_pull',
      url: 'assets/characters/legacy/Bow Pull.png',
      cols: 4,
      frameRate: 10,
      repeat: 0
    },
    bowRelease: {
      key: 'legacy_bow_release',
      url: 'assets/characters/legacy/Bow Release.png',
      cols: 4,
      frameRate: 18,
      repeat: 0
    },
    guard: {
      key: 'legacy_guard',
      url: 'assets/characters/legacy/Block Idle.png',
      cols: 4,
      frameRate: 8,
      repeat: -1
    },
    throw: {
      key: 'legacy_throw',
      url: 'assets/characters/legacy/Throw.png',
      cols: 13,
      frameRate: 22,
      repeat: 0
    },
    skill: {
      key: 'legacy_skill',
      url: 'assets/characters/legacy/Sword Spin Blue.png',
      cols: 8,
      frameRate: 20,
      repeat: 0
    },
    hit: {
      key: 'legacy_hit',
      url: 'assets/characters/legacy/Hit.png',
      cols: 4,
      frameRate: 14,
      repeat: 0
    }
  }
};

export const EXTRA_OVERLAY_SHEETS = [
  {
    key: 'crimson_slash1_vfx',
    url: 'assets/characters/crimson/Slash 1 Default.png',
    cols: 6,
    frameRate: 20,
    repeat: 0
  },
  {
    key: 'crimson_slash2_vfx',
    url: 'assets/characters/crimson/Slash 2 Default.png',
    cols: 6,
    frameRate: 18,
    repeat: 0
  },
  {
    key: 'crimson_slash1_flame_vfx',
    url: 'assets/characters/crimson/Slash 1 Default Flame.png',
    cols: 6,
    frameRate: 20,
    repeat: 0
  },
  {
    key: 'crimson_slash2_flame_vfx',
    url: 'assets/characters/crimson/Slash 2 Default Flame.png',
    cols: 6,
    frameRate: 18,
    repeat: 0
  },
  {
    key: 'crimson_slash1_bloody_vfx',
    url: 'assets/characters/crimson/Slash 1 Bloody Flame.png',
    cols: 6,
    frameRate: 20,
    repeat: 0
  },
  {
    key: 'crimson_slash2_bloody_vfx',
    url: 'assets/characters/crimson/Slash 2 Bloody Flame.png',
    cols: 6,
    frameRate: 18,
    repeat: 0
  }
];

export function animKey(sheetKey: string, row: number): string {
  return `${sheetKey}_r${row}`;
}