import type { EnemyKind } from '../../sim/types';

export interface SlimeActionSpec {
  action: 'idle' | 'walk' | 'attack' | 'hit' | 'death';
  dir: 'down' | 'up';
  key: string;
  url: string;
  frames: number;
  frameRate: number;
  repeat: number;
}

export interface SlimeConfig {
  kind: EnemyKind;
  name: string;
  isBoss: boolean;
  folder: string;
  prefix: string;
  scale: number;
  shadowScale: number;
}

export const SLIME_CONFIGS: Record<string, SlimeConfig> = {
  green_slime: {
    kind: 'green_slime',
    name: 'Green Slime',
    isBoss: false,
    folder: 'Green Slime',
    prefix: 'green slime-',
    scale: 0.95,
    shadowScale: 0.9
  },
  blue_slime: {
    kind: 'blue_slime',
    name: 'Blue Slime',
    isBoss: false,
    folder: 'Blue Slime',
    prefix: 'blue slime-',
    scale: 0.95,
    shadowScale: 0.9
  },
  purple_slime: {
    kind: 'purple_slime',
    name: 'Purple Toxic Slime',
    isBoss: false,
    folder: 'Purple Slime',
    prefix: 'purple slime-',
    scale: 1.05,
    shadowScale: 1.0
  },
  yellow_slime: {
    kind: 'yellow_slime',
    name: 'Yellow Spark Slime',
    isBoss: false,
    folder: 'Yellow Slime',
    prefix: 'yellow slime-',
    scale: 0.95,
    shadowScale: 0.9
  },
  green_king_slime: {
    kind: 'green_king_slime',
    name: 'King Green Slime',
    isBoss: true,
    folder: 'Green King Slime',
    prefix: 'king green slime-',
    scale: 1.6,
    shadowScale: 1.7
  },
  blue_king_slime: {
    kind: 'blue_king_slime',
    name: 'King Blue Slime',
    isBoss: true,
    folder: 'Blue King Slime',
    prefix: 'king blue slime-',
    scale: 1.6,
    shadowScale: 1.7
  },
  purple_king_slime: {
    kind: 'purple_king_slime',
    name: 'King Purple Slime',
    isBoss: true,
    folder: 'Purple King Slime',
    prefix: 'king purple slime-',
    scale: 1.7,
    shadowScale: 1.8
  },
  yellow_king_slime: {
    kind: 'yellow_king_slime',
    name: 'King Yellow Slime',
    isBoss: true,
    folder: 'Yellow King Slime',
    prefix: 'king yellow slime-',
    scale: 1.65,
    shadowScale: 1.7
  }
};

export function getSlimeSpecs(cfg: SlimeConfig): SlimeActionSpec[] {
  const actions: Array<{
    action: SlimeActionSpec['action'];
    downFile: string;
    upFile: string;
    frames: number;
    fps: number;
    repeat: number;
  }> = [
    { action: 'idle', downFile: 'Idle Down.png', upFile: 'Idle Up.png', frames: 4, fps: 6, repeat: -1 },
    { action: 'walk', downFile: 'Walk Down.png', upFile: 'Walk Up.png', frames: 7, fps: 10, repeat: -1 },
    { action: 'attack', downFile: 'Attack Down.png', upFile: 'Attack Up.png', frames: 7, fps: 12, repeat: 0 },
    { action: 'hit', downFile: 'Get Hit Down.png', upFile: 'Get Hit Up.png', frames: 2, fps: 9, repeat: 0 },
    { action: 'death', downFile: 'Death Down.png', upFile: 'Death Up.png', frames: 5, fps: 8, repeat: 0 }
  ];

  const specs: SlimeActionSpec[] = [];
  for (const a of actions) {
    const keyDown = `${cfg.kind}_${a.action}_down`;
    const keyUp = `${cfg.kind}_${a.action}_up`;
    const urlDown = `assets/enemies/${encodeURIComponent(cfg.folder)}/${encodeURIComponent(cfg.prefix + a.downFile)}`;
    const urlUp = `assets/enemies/${encodeURIComponent(cfg.folder)}/${encodeURIComponent(cfg.prefix + a.upFile)}`;

    specs.push({
      action: a.action,
      dir: 'down',
      key: keyDown,
      url: urlDown,
      frames: a.frames,
      frameRate: a.fps,
      repeat: a.repeat
    });

    specs.push({
      action: a.action,
      dir: 'up',
      key: keyUp,
      url: urlUp,
      frames: a.frames,
      frameRate: a.fps,
      repeat: a.repeat
    });
  }
  return specs;
}
