import Phaser from 'phaser';
import { animKey, CHARACTER_SHEETS, EXTRA_OVERLAY_SHEETS, type SheetSpec } from '../sprites/sheetManifest';
import { SLIME_CONFIGS, getSlimeSpecs } from '../sprites/enemyManifest';
import { TILESET_CATALOG } from '../../map/tilesetCatalog';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  public preload(): void {
    // Default Map
    this.load.tilemapTiledJSON('meadow', 'assets/maps/meadow.json');
    this.load.image('MainLev2.0', 'assets/tilesets/MainLev2.0.png');
    this.load.image('decorative', 'assets/tilesets/decorative.png');

    // Preload all Biome & Prop Tileset Packs (excluding animated ones loaded as spritesheets)
    const animatedKeys = new Set(['water_tafle_1A', 'water_effA', 'torch', 'fire1', 'tree1B', 'tree2B']);
    for (const meta of TILESET_CATALOG) {
      if (!animatedKeys.has(meta.key)) {
        this.load.image(meta.key, meta.url);
      }
    }

    // Animated Trees (1A..1D: 160x160; 2A..2D: 128x160; 3A..3D: 128x160)
    const tree1List = ['tree1A', 'tree1B', 'tree1C', 'tree1D'];
    for (const key of tree1List) {
      this.load.spritesheet(key, `assets/tilesets/${key}_ss.png`, {
        frameWidth: 160,
        frameHeight: 160
      });
    }
    const tree2And3List = ['tree2A', 'tree2B', 'tree2C', 'tree2D', 'tree3A', 'tree3B', 'tree3C', 'tree3D'];
    for (const key of tree2And3List) {
      this.load.spritesheet(key, `assets/tilesets/${key}_ss.png`, {
        frameWidth: 128,
        frameHeight: 160
      });
    }

    // Hunter Orc Enemy Spritesheet (14 cols x 6 rows of 96x96)
    this.load.spritesheet('hunter_orc', 'assets/enemies/Hunter Orc/HunterOrc-Sheet.png', {
      frameWidth: 96,
      frameHeight: 96
    });
    this.load.image('orc_javelin', 'assets/enemies/Hunter Orc/Projectile/Proyectile1.png');

    // Two-Phase Boss Spritesheets: Phase 1 (Abyssal Jelly) & Phase 2 (Floating Eldritch Organism)
    const bossKinds = ['abyssal_jelly', 'floating_eldritch'] as const;
    const bossActs = ['idle', 'move', 'attack', 'death'] as const;
    for (const bKind of bossKinds) {
      for (const bAct of bossActs) {
        const key = `${bKind}_${bAct}`;
        this.load.spritesheet(key, `assets/enemies/Bosses/${key}.png`, {
          frameWidth: 128,
          frameHeight: 128
        });
      }
    }

    // Water, Torch & Fire Animations
    this.load.spritesheet('water_tafle_1A', 'assets/tilesets/anims/water_tafle_1A.png', {
      frameWidth: 32,
      frameHeight: 32
    });
    this.load.spritesheet('water_effA', 'assets/tilesets/anims/water_effA.png', {
      frameWidth: 32,
      frameHeight: 32
    });
    this.load.spritesheet('torch', 'assets/tilesets/anims/torch.png', {
      frameWidth: 32,
      frameHeight: 64
    });
    this.load.spritesheet('fire1', 'assets/tilesets/anims/fire1.png', {
      frameWidth: 48,
      frameHeight: 48
    });

    // Character Sheets
    for (const kindMap of Object.values(CHARACTER_SHEETS)) {
      for (const spec of Object.values(kindMap)) {
        if (spec) {
          this.load.spritesheet(spec.key, spec.url, {
            frameWidth: 64,
            frameHeight: 64
          });
        }
      }
    }

    // Preload all 8 Slime Enemy Spritesheets
    for (const cfg of Object.values(SLIME_CONFIGS)) {
      for (const spec of getSlimeSpecs(cfg)) {
        this.load.spritesheet(spec.key, spec.url, {
          frameWidth: 64,
          frameHeight: 64
        });
      }
    }

    for (const extra of EXTRA_OVERLAY_SHEETS) {
      this.load.spritesheet(extra.key, extra.url, {
        frameWidth: 64,
        frameHeight: 64
      });
    }
  }

  public create(): void {
    this.registerCharacterAnims();
    this.registerSlimeAnims();
    this.registerOrcAnims();
    this.registerBossAnims();
    this.registerEnvironmentAnims();
    this.createArrowTexture();
    // Do not immediately start WorldScene; Main entry manages screen switching
  }

  private registerBossAnims(): void {
    const bossSpecs: Array<{
      kind: 'abyssal_jelly' | 'floating_eldritch';
      action: 'idle' | 'move' | 'attack' | 'death';
      cols: number;
      fps: number;
      repeat: number;
    }> = [
      { kind: 'abyssal_jelly', action: 'idle', cols: 12, fps: 10, repeat: -1 },
      { kind: 'abyssal_jelly', action: 'move', cols: 12, fps: 12, repeat: -1 },
      { kind: 'abyssal_jelly', action: 'attack', cols: 12, fps: 15, repeat: 0 },
      { kind: 'abyssal_jelly', action: 'death', cols: 16, fps: 12, repeat: 0 },
      { kind: 'floating_eldritch', action: 'idle', cols: 12, fps: 11, repeat: -1 },
      { kind: 'floating_eldritch', action: 'move', cols: 12, fps: 13, repeat: -1 },
      { kind: 'floating_eldritch', action: 'attack', cols: 12, fps: 16, repeat: 0 },
      { kind: 'floating_eldritch', action: 'death', cols: 16, fps: 12, repeat: 0 }
    ];

    for (const spec of bossSpecs) {
      const sheetKey = `${spec.kind}_${spec.action}`;
      for (let row = 0; row < 8; row++) {
        const animName = `${spec.kind}_${spec.action}_r${row}`;
        if (!this.anims.exists(animName)) {
          const start = row * spec.cols;
          const end = start + spec.cols - 1;
          this.anims.create({
            key: animName,
            frames: this.anims.generateFrameNumbers(sheetKey, { start, end }),
            frameRate: spec.fps,
            repeat: spec.repeat
          });
        }
      }
    }
  }

  private registerOrcAnims(): void {
    if (!this.anims.exists('hunter_orc_idle')) {
      this.anims.create({
        key: 'hunter_orc_idle',
        frames: this.anims.generateFrameNumbers('hunter_orc', { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1
      });
      this.anims.create({
        key: 'hunter_orc_walk',
        frames: this.anims.generateFrameNumbers('hunter_orc', { start: 14, end: 21 }),
        frameRate: 10,
        repeat: -1
      });
      this.anims.create({
        key: 'hunter_orc_attack1',
        frames: this.anims.generateFrameNumbers('hunter_orc', { start: 28, end: 36 }),
        frameRate: 14,
        repeat: 0
      });
      this.anims.create({
        key: 'hunter_orc_attack2',
        frames: this.anims.generateFrameNumbers('hunter_orc', { start: 42, end: 55 }),
        frameRate: 18,
        repeat: 0
      });
      this.anims.create({
        key: 'hunter_orc_hit',
        frames: this.anims.generateFrameNumbers('hunter_orc', { start: 56, end: 59 }),
        frameRate: 12,
        repeat: 0
      });
      this.anims.create({
        key: 'hunter_orc_death',
        frames: this.anims.generateFrameNumbers('hunter_orc', { start: 70, end: 75 }),
        frameRate: 10,
        repeat: 0
      });
    }
  }

  private registerSlimeAnims(): void {
    for (const cfg of Object.values(SLIME_CONFIGS)) {
      for (const spec of getSlimeSpecs(cfg)) {
        if (!this.anims.exists(spec.key)) {
          this.anims.create({
            key: spec.key,
            frames: this.anims.generateFrameNumbers(spec.key, { start: 0, end: spec.frames - 1 }),
            frameRate: spec.frameRate,
            repeat: spec.repeat
          });
        }
      }
    }
  }

  private registerCharacterAnims(): void {
    const registerSpec = (spec: Pick<SheetSpec, 'key' | 'cols' | 'frameRate' | 'repeat'>) => {
      for (let row = 0; row < 5; row++) {
        const start = row * spec.cols;
        let end = start + spec.cols - 1;
        let frameStart = start;

        if (spec.key === 'elvish_bow_pull') {
          end = start + 4;
        } else if (spec.key === 'elvish_bow_release') {
          frameStart = start + 5;
        }

        this.anims.create({
          key: animKey(spec.key, row),
          frames: this.anims.generateFrameNumbers(spec.key, { start: frameStart, end }),
          frameRate: spec.frameRate,
          repeat: spec.repeat
        });
      }
    };

    for (const kindMap of Object.values(CHARACTER_SHEETS)) {
      for (const spec of Object.values(kindMap)) {
        if (spec) {
          registerSpec(spec);
        }
      }
    }

    // Preload all 8 Slime Enemy Spritesheets
    for (const cfg of Object.values(SLIME_CONFIGS)) {
      for (const spec of getSlimeSpecs(cfg)) {
        this.load.spritesheet(spec.key, spec.url, {
          frameWidth: 64,
          frameHeight: 64
        });
      }
    }

    for (const extra of EXTRA_OVERLAY_SHEETS) {
      registerSpec(extra);
    }
  }

  private registerEnvironmentAnims(): void {
    const tree1List = ['tree1A', 'tree1B', 'tree1C', 'tree1D'];
    for (const key of tree1List) {
      if (!this.anims.exists(`${key}_sway`)) {
        this.anims.create({
          key: `${key}_sway`,
          frames: this.anims.generateFrameNumbers(key, { start: 0, end: 9 }),
          frameRate: 6,
          repeat: -1
        });
      }
    }

    const tree2And3List = ['tree2A', 'tree2B', 'tree2C', 'tree2D', 'tree3A', 'tree3B', 'tree3C', 'tree3D'];
    for (const key of tree2And3List) {
      if (!this.anims.exists(`${key}_sway`)) {
        this.anims.create({
          key: `${key}_sway`,
          frames: this.anims.generateFrameNumbers(key, { start: 0, end: 9 }),
          frameRate: 6,
          repeat: -1
        });
      }
    }

    this.anims.create({
      key: 'water_tafle_1A_anim',
      frames: this.anims.generateFrameNumbers('water_tafle_1A', { start: 0, end: 7 }),
      frameRate: 6,
      repeat: -1
    });

    this.anims.create({
      key: 'water_effA_anim',
      frames: this.anims.generateFrameNumbers('water_effA', { start: 0, end: 9 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'torch_flicker',
      frames: this.anims.generateFrameNumbers('torch', { start: 0, end: 3 }),
      frameRate: 7,
      repeat: -1
    });

    this.anims.create({
      key: 'fire1_flame',
      frames: this.anims.generateFrameNumbers('fire1', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1
    });
  }

  private createArrowTexture(): void {
    const gfx = this.make.graphics({ x: 0, y: 0 });
    // Wooden arrow shaft
    gfx.fillStyle(0xd97706, 1);
    gfx.fillRect(3, 2, 14, 2);
    // Shaft underside shadow
    gfx.fillStyle(0x78350f, 1);
    gfx.fillRect(3, 4, 14, 1);

    // Steel arrowhead socket
    gfx.fillStyle(0x64748b, 1);
    gfx.fillRect(17, 2, 2, 2);

    // Steel broadhead blade
    gfx.fillStyle(0xf1f5f9, 1);
    gfx.fillRect(19, 1, 3, 2);
    gfx.fillStyle(0x94a3b8, 1);
    gfx.fillRect(19, 3, 3, 2);
    // Sharp arrow tip point
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(22, 2, 2, 2);

    // Fletchings (feathers)
    // Upper vane
    gfx.fillStyle(0xef4444, 1);
    gfx.fillRect(0, 0, 4, 2);
    gfx.fillStyle(0xfca5a5, 1);
    gfx.fillRect(1, 1, 2, 1);
    // Lower vane
    gfx.fillStyle(0xb91c1c, 1);
    gfx.fillRect(0, 4, 4, 2);
    // Nock
    gfx.fillStyle(0x451a03, 1);
    gfx.fillRect(0, 2, 2, 2);

    // Register under both keys so both 'arrow' and 'arrow_tex' work seamlessly
    gfx.generateTexture('arrow', 24, 7);
    gfx.generateTexture('arrow_tex', 24, 7);
    gfx.destroy();

    // Hunter Orc Javelin / Spear Projectile Texture
    const javGfx = this.make.graphics({ x: 0, y: 0 });
    javGfx.fillStyle(0x78350f, 1);
    javGfx.fillRect(0, 2, 18, 2);
    javGfx.fillStyle(0x334155, 1);
    javGfx.fillRect(16, 1, 3, 4);
    javGfx.fillStyle(0x94a3b8, 1);
    javGfx.fillRect(18, 0, 4, 6);
    javGfx.fillStyle(0xf1f5f9, 1);
    javGfx.fillRect(22, 1, 3, 4);
    javGfx.fillRect(25, 2, 2, 2);
    javGfx.generateTexture('orc_javelin_tex', 28, 6);
    javGfx.destroy();

    // Abyssal Jelly & Floating Eldritch Void Projectile Texture
    const voidGfx = this.make.graphics({ x: 0, y: 0 });
    voidGfx.fillStyle(0x9333ea, 0.55);
    voidGfx.fillCircle(9, 9, 8);
    voidGfx.fillStyle(0xc084fc, 0.9);
    voidGfx.fillCircle(9, 9, 5);
    voidGfx.fillStyle(0xf5d0fe, 1);
    voidGfx.fillCircle(9, 9, 2.5);
    voidGfx.generateTexture('void_orb_tex', 18, 18);
    voidGfx.destroy();
  }
}