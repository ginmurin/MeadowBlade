import Phaser from 'phaser';
import type {
  CharacterKind,
  MapSpawnData,
  PlayerInput,
  SimEvent,
  WorldSnapshot
} from '../../sim/types';
import { HERO_PROFILES, WorldSimulation } from '../../sim/WorldSimulation';
import { CharacterAnimator } from '../sprites/CharacterAnimator';
import { SlimeAnimator } from '../sprites/SlimeAnimator';
import { OrcAnimator } from '../sprites/OrcAnimator';
import { BossAnimator } from '../sprites/BossAnimator';
import { KNOWN_TILESET_ANIMATIONS, parseTiledMapData, resolveExternalTilesetSources, resolveTilesetTextureKey, type TiledZoneData } from '../../map/tiledParser';
import { MultiplayerGameSession } from '../../net/collabSync';

const FIXED_DT = 1 / 60;

export interface WorldSceneInitData {
  tiledMapData?: any;
  tiledMapKey?: string;
  mapName?: string;
  hero?: CharacterKind;
  waveMode?: boolean;
  lobbyRoomCode?: string;
  isPvp?: boolean;
  localPlayerName?: string;
  existingNet?: { peer: any; connections: any[] };
}

interface AnimatedTileRef {
  layer: Phaser.Tilemaps.TilemapLayer;
  tileX: number;
  tileY: number;
  firstgid: number;
  frames: Array<{ tileid: number; duration: number }>;
  frameIdx: number;
  elapsedMs: number;
}

export class WorldScene extends Phaser.Scene {
  private sim!: WorldSimulation;
  private accumulator = 0;
  private pausedForSelect = false;

  private tiledMapData?: any;
  private tiledMapKey = 'meadow';
  private mapName = 'Meadow Realm';
  private waveMode = false;
  private zones: TiledZoneData[] = [];
  private mapProperties: Record<string, any> = {};
  private initialHero: CharacterKind = 'crimson';

  private playerAnimator!: CharacterAnimator;
  private enemyAnimators = new Map<string, CharacterAnimator | SlimeAnimator | OrcAnimator | BossAnimator>();
  private animatedTileRefs: AnimatedTileRef[] = [];

  private waveTitleEl!: HTMLElement;
  private waveSubtitleEl!: HTMLElement;
  private bossHudBarEl!: HTMLElement;
  private bossNameEl!: HTMLElement;
  private bossHpFillEl!: HTMLElement;
  private bossHpTextEl!: HTMLElement;
  private projectileSprites = new Map<number, Phaser.GameObjects.Image>();

  private keys!: {
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    j: Phaser.Input.Keyboard.Key;
    k: Phaser.Input.Keyboard.Key;
    e: Phaser.Input.Keyboard.Key;
    q: Phaser.Input.Keyboard.Key;
    f: Phaser.Input.Keyboard.Key;
    c: Phaser.Input.Keyboard.Key;
    o: Phaser.Input.Keyboard.Key;
    esc: Phaser.Input.Keyboard.Key;
    shift: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
    r: Phaser.Input.Keyboard.Key;
  };

  private skillBtnQueued = false;
  private pausedForSettings = false;

  private heroNameEl!: HTMLElement;
  private heroRoleEl!: HTMLElement;
  private hpFillEl!: HTMLElement;
  private hpTextEl!: HTMLElement;
  private stmFillEl!: HTMLElement;
  private stmTextEl!: HTMLElement;
  private mpFillEl?: HTMLElement | null;
  private mpTextEl?: HTMLElement | null;
  private levelBadgeEl?: HTMLElement | null;
  private expFillEl?: HTMLElement | null;
  private expTextEl?: HTMLElement | null;
  private statPointsPanelEl?: HTMLElement | null;
  private statPointsCountEl?: HTMLElement | null;
  private upgradeHpBtn?: HTMLElement | null;
  private upgradeStmBtn?: HTMLElement | null;
  private upgradeMpBtn?: HTMLElement | null;
  private killsTextEl!: HTMLElement;

  private dashSlotEl!: HTMLElement;
  private dashCdFillEl!: HTMLElement;
  private dashStatusEl!: HTMLElement;

  private skillSlotEl!: HTMLElement;
  private skillCdFillEl!: HTMLElement;
  private skillNameEl!: HTMLElement;
  private skillStatusEl!: HTMLElement;

  private guardSlotEl?: HTMLElement | null;
  private guardCdFillEl?: HTMLElement | null;
  private guardStatusEl?: HTMLElement | null;

  private ultSlotEl?: HTMLElement | null;
  private ultCdFillEl?: HTMLElement | null;
  private ultNameEl?: HTMLElement | null;
  private ultStatusEl?: HTMLElement | null;

  private rageRowEl?: HTMLElement | null;
  private rageFillEl?: HTMLElement | null;
  private rageTextEl?: HTMLElement | null;

  private throwSlotEl?: HTMLElement | null;
  private throwCdFillEl?: HTMLElement | null;
  private throwNameEl?: HTMLElement | null;
  private throwStatusEl?: HTMLElement | null;

  private ultBtnQueued = false;
  private throwBtnQueued = false;
  private dashBtnQueued = false;
  private pendingStatUpgrade?: 'hp' | 'stamina' | 'mp';

  private worldObjectViews = new Map<string, Phaser.GameObjects.Container>();

  private charSelectModalEl!: HTMLElement;
  private deathBannerEl!: HTMLElement;
  private deathSummaryEl!: HTMLElement;

  // Multiplayer & PVP Network Session
  private netSession: MultiplayerGameSession | null = null;
  private peerAnimators = new Map<string, CharacterAnimator>();
  private lobbyRoomCode?: string;
  private isPvp = false;
  private localPlayerName = 'Hero';
  private existingNet?: { peer: any; connections: any[] };
  private peerPointers = new Map<string, Phaser.GameObjects.Text>();

  constructor() {
    super('WorldScene');
  }

  public init(data?: WorldSceneInitData): void {
    this.tiledMapData = data?.tiledMapData;
    const rawKey = data?.tiledMapKey;
    const isBuiltinMeadow = !this.tiledMapData && (!rawKey || rawKey === 'meadow' || rawKey === 'builtin_meadow' || rawKey === 'builtin');
    this.tiledMapKey = isBuiltinMeadow ? 'meadow' : (rawKey || (this.tiledMapData ? `custom_tiled_${Date.now()}` : 'meadow'));
    this.mapName = isBuiltinMeadow ? 'Meadow Realm' : (data?.mapName || (this.tiledMapData ? 'Custom Tiled Map' : 'Meadow Realm'));
    this.initialHero = data?.hero || 'crimson';
    this.lobbyRoomCode = data?.lobbyRoomCode;
    this.isPvp = Boolean(data?.isPvp);
    this.localPlayerName = data?.localPlayerName || localStorage.getItem('meadowblade_player_name') || 'Hero';
    this.existingNet = data?.existingNet;

    const isCustomMap = Boolean(this.tiledMapData || (this.tiledMapKey && this.tiledMapKey !== 'meadow'));
    this.waveMode = data?.waveMode !== undefined ? data.waveMode : (!isCustomMap && !this.isPvp);
    this.enemyAnimators.clear();
    this.projectileSprites.clear();
    this.peerAnimators.clear();
    for (const ptr of this.peerPointers.values()) {
      ptr.destroy();
    }
    this.peerPointers.clear();
    this.accumulator = 0;
  }

  public create(): void {
    let tilemap: Phaser.Tilemaps.Tilemap;
    if (this.tiledMapData) {
      resolveExternalTilesetSources(this.tiledMapData);
      if (this.cache.tilemap.has(this.tiledMapKey)) {
        this.cache.tilemap.remove(this.tiledMapKey);
      }
      this.cache.tilemap.add(this.tiledMapKey, {
        format: Phaser.Tilemaps.Formats.TILED_JSON,
        data: this.tiledMapData
      });
      tilemap = this.make.tilemap({ key: this.tiledMapKey });
    } else {
      const targetKey = (!this.tiledMapKey || this.tiledMapKey === 'builtin_meadow' || this.tiledMapKey === 'builtin') ? 'meadow' : this.tiledMapKey;
      tilemap = this.make.tilemap({ key: targetKey });
    }

    const targetKey = (!this.tiledMapKey || this.tiledMapKey === 'builtin_meadow' || this.tiledMapKey === 'builtin') ? 'meadow' : this.tiledMapKey;
    const rawJson = this.tiledMapData || this.cache.tilemap.get(targetKey)?.data;
    const mapData = this.buildTiledMap(tilemap, rawJson);
    this.initAnimatedTiles(tilemap, rawJson);

    this.sim = new WorldSimulation(mapData, this.initialHero, this.waveMode);
    const initial = this.sim.getSnapshot();

    this.playerAnimator = new CharacterAnimator(this, initial.player);
    for (const enemy of initial.enemies) {
      const isEldritchBoss = enemy.kind === 'abyssal_jelly' || enemy.kind === 'floating_eldritch';
      const isOrc = typeof enemy.kind === 'string' && enemy.kind.includes('orc');
      const isSlime = typeof enemy.kind === 'string' && enemy.kind.includes('slime');
      const anim = isEldritchBoss
        ? new BossAnimator(this, enemy)
        : isOrc
          ? new OrcAnimator(this, enemy)
          : isSlime
            ? new SlimeAnimator(this, enemy)
            : new CharacterAnimator(this, enemy);
      this.enemyAnimators.set(enemy.id, anim);
    }

    this.cameras.main.setBounds(0, 0, mapData.widthPx, mapData.heightPx);
    this.cameras.main.setZoom(2.0);
    this.cameras.main.startFollow(this.playerAnimator.body, true, 0.1, 0.1);
    this.cameras.main.roundPixels = true;

    // Set background color: dark slate for caves/dungeons, lush grass green for outdoor meadows
    const isCaveOrDungeon = this.mapName.toLowerCase().includes('cave') || this.mapName.toLowerCase().includes('dungeon');
    if (this.mapProperties.ambient_light !== undefined) {
      const light = Math.max(0.1, Math.min(1.0, Number(this.mapProperties.ambient_light)));
      if (light < 1.0) {
        const val = Math.round(light * 255);
        this.cameras.main.setBackgroundColor(Phaser.Display.Color.GetColor(val, val, val));
      } else {
        this.cameras.main.setBackgroundColor(isCaveOrDungeon ? 0x18181b : 0x2e5c1e);
      }
    } else {
      this.cameras.main.setBackgroundColor(isCaveOrDungeon ? 0x18181b : 0x2e5c1e);
    }

    this.setupInputs();
    this.bindHud();

    const realmNameEl = document.getElementById('in-game-realm-name');
    if (realmNameEl) {
      realmNameEl.textContent = this.isPvp ? `${this.mapName} (PVP Arena)` : this.mapName;
    }
    this.initMultiplayerSession();
    this.syncWorld(initial);
  }

  private initMultiplayerSession(): void {
    if (!this.lobbyRoomCode) return;
    const localId = `net_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.netSession = new MultiplayerGameSession(this.lobbyRoomCode, localId, this.existingNet);

    if (this.isPvp) {
      this.spawnSkillBanner(this.cameras.main.midPoint.x, this.cameras.main.midPoint.y - 70, '⚔️ PVP DUEL ARENA ACTIVE!');
    }

    this.netSession.onPeerAttack((msg) => {
      // If PVP is enabled and the attacking peer's strike lands near local player:
      if (this.isPvp) {
        const p = this.sim.getSnapshot().player;
        if (p.action !== 'dead' && p.invulnTimer <= 0) {
          const dist = Math.hypot(p.x - msg.x, p.y - msg.y);
          const hitRadius = msg.attackType.includes('arrow') ? 80 : (msg.attackType.includes('ultimate') ? 120 : 65);
          if (dist <= hitRadius) {
            this.sim.damagePlayer(msg.damage);
            this.spawnDamageText(p.x, p.y - 12, msg.damage, true);
            this.spawnSkillBanner(p.x, p.y - 28, `HIT BY ${msg.hero.toUpperCase()}!`);
            this.triggerCameraShake(180, 0.007);
          }
        }
      }
    });

    this.netSession.onPeerHit((targetId, damage) => {
      if (targetId === 'player') {
        this.sim.damagePlayer(damage);
      }
    });

    this.netSession.onPeerLeave((peerId) => {
      const anim = this.peerAnimators.get(peerId);
      if (anim) {
        anim.destroy();
        this.peerAnimators.delete(peerId);
      }
      const ptr = this.peerPointers.get(peerId);
      if (ptr) {
        ptr.destroy();
        this.peerPointers.delete(peerId);
      }
    });
  }

  private buildTiledMap(tilemap: Phaser.Tilemaps.Tilemap, rawJson: any): MapSpawnData {
    const parsed = parseTiledMapData(rawJson || tilemap, this.mapName);
    this.zones = parsed.zones;
    this.mapProperties = parsed.properties;
    if (parsed.mapName) {
      this.mapName = parsed.mapName;
    }

    // 1. Resolve and bind tilesets from Tiled
    const validTilesets: Phaser.Tilemaps.Tileset[] = [];
    for (const ts of tilemap.tilesets) {
      const matchedKey = resolveTilesetTextureKey(this, ts);
      if (matchedKey) {
        const phaserTs = tilemap.addTilesetImage(ts.name, matchedKey);
        if (phaserTs) {
          validTilesets.push(phaserTs);
        }
      }
    }

    // Fallback if no tileset name matched: bind available tileset textures
    if (validTilesets.length === 0) {
      const fallbackKey = this.textures.exists('MainLev2.0')
        ? 'MainLev2.0'
        : this.textures.exists('grassland_main')
          ? 'grassland_main'
          : this.textures.exists('cave_grounds')
            ? 'cave_grounds'
            : '';
      if (fallbackKey) {
        if (tilemap.tilesets.length > 0) {
          for (const ts of tilemap.tilesets) {
            const phaserTs = tilemap.addTilesetImage(ts.name, fallbackKey);
            if (phaserTs) validTilesets.push(phaserTs);
          }
        } else {
          const phaserTs = tilemap.addTilesetImage('default', fallbackKey, 32, 32, 0, 0, 1);
          if (phaserTs) validTilesets.push(phaserTs);
        }
      }
    }

    // 2. Render all tile layers dynamically with layer depth ordering
    tilemap.layers.forEach((layerData, idx) => {
      const layer = tilemap.createLayer(layerData.name, validTilesets, 0, 0);
      if (!layer) return;

      const lname = layerData.name.toLowerCase();
      if (lname.includes('ground') || lname.includes('base') || idx === 0) {
        layer.setDepth(-100);
      } else if (lname.includes('water')) {
        layer.setDepth(-95);
      } else if (lname.includes('bridge') || lname.includes('road') || lname.includes('path')) {
        layer.setDepth(-90);
      } else if (lname.includes('prop') || lname.includes('decor') || lname.includes('detail')) {
        layer.setDepth(-80);
      } else if (lname.includes('overhead') || lname.includes('roof') || lname.includes('top')) {
        layer.setDepth(100);
      } else {
        layer.setDepth(-100 + idx * 5);
      }
    });

    // 3. Spawn Environmental Props (Animated Trees, Water)
    for (const env of parsed.envObjects) {
      if (env.type === 'tree') {
        const variant = env.variant || 'tree2B';
        const tree = this.add.sprite(env.x, env.y, variant, 0);
        tree.setOrigin(0.5, 0.98);
        tree.setDepth(env.y);
        if (this.anims.exists(`${variant}_sway`)) {
          tree.play({
            key: `${variant}_sway`,
            startFrame: Math.floor(Math.random() * 10)
          });
        }
      } else if (env.type === 'water_anim') {
        const variant = env.variant || 'water_tafle_1A';
        const water = this.add.sprite(env.x, env.y, variant, 0);
        water.setOrigin(0.5, 0.5);
        water.setDepth(-95);
        if (this.anims.exists(`${variant}_anim`)) {
          water.play(`${variant}_anim`);
        }
      }
    }

    // 4. Spawn Portals from Tiled Object Layer
    for (const portal of parsed.spawnData.portals || []) {
      const ring = this.add.circle(portal.x, portal.y, 14, 0xa855f7, 0.45).setDepth(portal.y - 10);
      this.tweens.add({ targets: ring, scale: 1.3, alpha: 0.15, duration: 900, yoyo: true, repeat: -1 });
      const labelText = portal.label || 'Doorway';
      this.add
        .text(portal.x, portal.y - 18, labelText, {
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#f3e8ff',
          stroke: '#1e1035',
          strokeThickness: 3
        })
        .setOrigin(0.5)
        .setDepth(portal.y + 10);
    }

    // Custom Zones (hazard/healing) run purely in logic via checkPlayerZones(); no debug rectangles or text in gameplay.

    return parsed.spawnData;
  }

  private initAnimatedTiles(tilemap: Phaser.Tilemaps.Tilemap, rawJson: any): void {
    this.animatedTileRefs = [];
    if (!rawJson || !Array.isArray(rawJson.tilesets)) return;

    interface AnimRule {
      firstgid: number;
      frames: Array<{ tileid: number; duration: number }>;
    }
    const gidToRule = new Map<number, AnimRule>();

    for (const ts of rawJson.tilesets) {
      if (!ts) continue;
      const firstgid = Number(ts.firstgid) || 1;
      const cleanSource = typeof ts.source === 'string' ? ts.source.replace(/\\/g, '/').split('/').pop() || '' : '';
      const rawName = typeof ts.name === 'string' ? ts.name : '';
      const animKey = (cleanSource || rawName).replace(/[\s-]+/g, '_').toLowerCase().replace(/\.(tsx|tsj|json)$/i, '');
      const animTiles = (Array.isArray(ts.tiles) && ts.tiles.length > 0)
        ? ts.tiles
        : (KNOWN_TILESET_ANIMATIONS[animKey] || KNOWN_TILESET_ANIMATIONS[rawName.toLowerCase()] || []);

      if (!animTiles || animTiles.length === 0) continue;

      for (const tDef of animTiles) {
        if (!tDef.animation || !Array.isArray(tDef.animation) || tDef.animation.length === 0) continue;

        const rule: AnimRule = {
          firstgid,
          frames: tDef.animation
        };

        const baseGid = firstgid + Number(tDef.id);
        gidToRule.set(baseGid, rule);
        for (const frame of tDef.animation) {
          gidToRule.set(firstgid + Number(frame.tileid), rule);
        }
      }
    }

    if (gidToRule.size === 0) return;

    for (const layerData of tilemap.layers) {
      const layer = layerData.tilemapLayer;
      if (!layer) continue;

      layer.filterTiles((tile: Phaser.Tilemaps.Tile) => {
        const rule = gidToRule.get(tile.index);
        if (rule) {
          this.animatedTileRefs.push({
            layer,
            tileX: tile.x,
            tileY: tile.y,
            firstgid: rule.firstgid,
            frames: rule.frames,
            frameIdx: 0,
            elapsedMs: 0
          });
        }
        return false;
      });
    }
  }

  private updateAnimatedTiles(deltaMs: number): void {
    if (!this.animatedTileRefs || this.animatedTileRefs.length === 0) return;

    for (const ref of this.animatedTileRefs) {
      ref.elapsedMs += deltaMs;
      const curFrame = ref.frames[ref.frameIdx];
      const duration = curFrame ? curFrame.duration : 100;
      if (ref.elapsedMs >= duration) {
        ref.elapsedMs -= duration;
        ref.frameIdx = (ref.frameIdx + 1) % ref.frames.length;
        const nextFrame = ref.frames[ref.frameIdx];
        const nextIndex = ref.firstgid + nextFrame.tileid;
        const tile = ref.layer.getTileAt(ref.tileX, ref.tileY);
        if (tile) {
          tile.index = nextIndex;
        }
      }
    }
  }

  private setupInputs(): void {
    const kb = this.input.keyboard!;
    this.keys = {
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      j: kb.addKey(Phaser.Input.Keyboard.KeyCodes.J),
      k: kb.addKey(Phaser.Input.Keyboard.KeyCodes.K),
      e: kb.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      q: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      f: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      c: kb.addKey(Phaser.Input.Keyboard.KeyCodes.C),
      o: kb.addKey(Phaser.Input.Keyboard.KeyCodes.O),
      esc: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
      shift: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      r: kb.addKey(Phaser.Input.Keyboard.KeyCodes.R)
    };

    // Prevent context menu on right click
    this.input.mouse?.disableContextMenu();

    window.addEventListener('meadowblade_pause_game', (e: Event) => {
      const custom = e as CustomEvent<boolean>;
      this.pausedForSettings = Boolean(custom.detail);
    });
  }

  private bindHud(): void {
    this.heroNameEl = document.getElementById('hero-name')!;
    this.heroRoleEl = document.getElementById('hero-role')!;
    this.hpFillEl = document.getElementById('hp-fill')!;
    this.hpTextEl = document.getElementById('hp-text')!;
    this.stmFillEl = document.getElementById('stm-fill')!;
    this.stmTextEl = document.getElementById('stm-text')!;
    this.mpFillEl = document.getElementById('mp-fill');
    this.mpTextEl = document.getElementById('mp-text');
    this.levelBadgeEl = document.getElementById('level-badge');
    this.expFillEl = document.getElementById('exp-fill');
    this.expTextEl = document.getElementById('exp-text');
    this.statPointsPanelEl = document.getElementById('stat-points-panel');
    this.statPointsCountEl = document.getElementById('stat-points-count');
    this.upgradeHpBtn = document.getElementById('upgrade-hp-btn');
    this.upgradeStmBtn = document.getElementById('upgrade-stm-btn');
    this.upgradeMpBtn = document.getElementById('upgrade-mp-btn');
    this.killsTextEl = document.getElementById('kills-text')!;

    this.upgradeHpBtn?.addEventListener('click', () => {
      this.pendingStatUpgrade = 'hp';
    });
    this.upgradeStmBtn?.addEventListener('click', () => {
      this.pendingStatUpgrade = 'stamina';
    });
    this.upgradeMpBtn?.addEventListener('click', () => {
      this.pendingStatUpgrade = 'mp';
    });

    this.waveTitleEl = document.getElementById('wave-title')!;
    this.waveSubtitleEl = document.getElementById('wave-subtitle')!;
    this.bossHudBarEl = document.getElementById('boss-hud-bar')!;
    this.bossNameEl = document.getElementById('boss-name')!;
    this.bossHpFillEl = document.getElementById('boss-hp-fill')!;
    this.bossHpTextEl = document.getElementById('boss-hp-text')!;

    this.dashSlotEl = document.getElementById('dash-slot')!;
    this.dashCdFillEl = document.getElementById('dash-cd-fill')!;
    this.dashStatusEl = document.getElementById('dash-status')!;

    this.skillSlotEl = document.getElementById('skill-slot')!;
    this.skillCdFillEl = document.getElementById('skill-cd-fill')!;
    this.skillNameEl = document.getElementById('skill-name')!;
    this.skillStatusEl = document.getElementById('skill-status')!;

    this.guardSlotEl = document.getElementById('guard-slot');
    this.guardCdFillEl = document.getElementById('guard-cd-fill');
    this.guardStatusEl = document.getElementById('guard-status');

    this.ultSlotEl = document.getElementById('ult-slot');
    this.ultCdFillEl = document.getElementById('ult-cd-fill');
    this.ultNameEl = document.getElementById('ult-name');
    this.ultStatusEl = document.getElementById('ult-status');

    this.throwSlotEl = document.getElementById('throw-slot');
    this.throwCdFillEl = document.getElementById('throw-cd-fill');
    this.throwNameEl = document.getElementById('throw-name');
    this.throwStatusEl = document.getElementById('throw-status');

    this.rageRowEl = document.getElementById('rage-row');
    this.rageFillEl = document.getElementById('rage-fill');
    this.rageTextEl = document.getElementById('rage-text');

    this.charSelectModalEl = document.getElementById('char-select-modal')!;
    this.deathBannerEl = document.getElementById('death-banner')!;
    this.deathSummaryEl = document.getElementById('death-summary')!;

    document.getElementById('respawn-btn')?.addEventListener('click', () => this.handleRespawn());
    document.getElementById('switch-hero-btn')?.addEventListener('click', () => this.toggleCharacterSelect());

    window.addEventListener('meadowblade_hero_change', (e: Event) => {
      const hero = (e as CustomEvent).detail as CharacterKind;
      if (hero) {
        this.selectHero(hero);
      }
    });

    window.addEventListener('meadowblade_close_hero_select', () => {
      this.pausedForSelect = false;
      this.charSelectModalEl?.classList.remove('visible');
    });

    this.skillSlotEl?.addEventListener('click', () => {
      if (!this.charSelectModalEl.classList.contains('visible')) {
        this.skillBtnQueued = true;
      }
    });

    this.ultSlotEl?.addEventListener('click', () => {
      if (!this.charSelectModalEl.classList.contains('visible')) {
        this.ultBtnQueued = true;
      }
    });

    this.throwSlotEl?.addEventListener('click', () => {
      if (!this.charSelectModalEl.classList.contains('visible')) {
        this.throwBtnQueued = true;
      }
    });

    this.dashSlotEl?.addEventListener('click', () => {
      if (!this.charSelectModalEl.classList.contains('visible')) {
        this.dashBtnQueued = true;
      }
    });

    const cards = document.querySelectorAll<HTMLElement>('.hero-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const hero = card.dataset.hero as CharacterKind | undefined;
        if (!hero) return;
        cards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        this.selectHero(hero);
      });
    });
  }

  private toggleCharacterSelect(): void {
    const isVis = this.charSelectModalEl.classList.toggle('visible');
    this.pausedForSelect = isVis;
  }

  private selectHero(kind: CharacterKind): void {
    this.sim.setPlayerCharacter(kind);
    const snap = this.sim.getSnapshot();

    this.playerAnimator.destroy();
    this.playerAnimator = new CharacterAnimator(this, snap.player);
    this.cameras.main.startFollow(this.playerAnimator.body, true, 0.1, 0.1);

    this.pausedForSelect = false;
    this.charSelectModalEl.classList.remove('visible');
    this.deathBannerEl.classList.remove('visible');
    (document.activeElement as HTMLElement)?.blur();
    this.syncWorld(snap);
  }

  private handleRespawn(): void {
    this.sim.respawnPlayer();
    this.deathBannerEl.classList.remove('visible');
    this.syncWorld(this.sim.getSnapshot());
  }

  public update(_time: number, deltaMs: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.c)) {
      this.toggleCharacterSelect();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.o)) {
      window.dispatchEvent(new CustomEvent('meadowblade_open_settings'));
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.esc)) {
      window.dispatchEvent(new CustomEvent('meadowblade_open_menu'));
    }

    this.pausedForSelect = this.charSelectModalEl?.classList.contains('visible') ?? false;
    if (this.pausedForSelect || this.pausedForSettings) {
      return;
    }

    const dt = Math.min(deltaMs / 1000, 0.05);
    this.accumulator += dt;

    // Check player zone interactions (e.g. Poisonous Water damage or Healing)
    this.zoneTickTimer = (this.zoneTickTimer || 0) + dt;
    if (this.zoneTickTimer >= 1.2) {
      this.zoneTickTimer = 0;
      this.checkPlayerZones();
    }

    let latestSnapshot: WorldSnapshot | null = null;
    while (this.accumulator >= FIXED_DT) {
      const input = this.collectInput();
      latestSnapshot = this.sim.step(FIXED_DT, input);
      this.handleSimEvents(latestSnapshot.events);
      this.accumulator -= FIXED_DT;
    }

    if (latestSnapshot) {
      this.syncWorld(latestSnapshot);
    } else {
      this.syncWorld(this.sim.getSnapshot());
    }

    // Broadcast local player state to multiplayer peers
    if (this.netSession) {
      const p = (latestSnapshot || this.sim.getSnapshot()).player;
      const heroKind = (p.kind === 'elvish' || p.kind === 'legacy' ? p.kind : 'crimson') as CharacterKind;
      this.netSession.broadcastState({
        id: this.netSession.localId,
        name: this.localPlayerName,
        hero: heroKind,
        x: p.x,
        y: p.y,
        facing: p.facing,
        action: p.action,
        hp: p.hp,
        maxHp: p.maxHp,
        isAttacking: p.action === 'slash1' || p.action === 'slash2' || p.action === 'skill',
        pvpEnabled: this.isPvp
      });
    }

    this.updateAnimatedTiles(deltaMs);
  }

  private zoneTickTimer = 0;

  private checkPlayerZones(): void {
    if (
      !this.zones ||
      this.zones.length === 0 ||
      this.sim.getSnapshot().player.action === 'dead' ||
      this.sim.getSnapshot().player.invulnTimer > 0
    ) {
      return;
    }

    const px = this.playerAnimator.body.x;
    const py = this.playerAnimator.body.y;

    for (const zone of this.zones) {
      if (px >= zone.x && px <= zone.x + zone.width && py >= zone.y && py <= zone.y + zone.height) {
        // Player is inside the zone!
        const dmg = Number(zone.properties.damage) || (zone.properties.hazard === 'poison' ? 4 : 0);
        if (dmg > 0) {
          this.sim.damagePlayer(dmg);
          this.spawnDamageText(px, py, dmg, false);
          this.triggerCameraShake(80, 0.003);
          this.triggerCameraFlash(90, 34, 197, 94); // Poison green tint
        }

        const heal = Number(zone.properties.heal) || 0;
        if (heal > 0) {
          this.sim.healPlayer(heal);
          this.spawnSkillBanner(px, py - 12, `+${heal} HEAL`);
        }
      }
    }
  }

  private collectInput(): PlayerInput {
    let moveX = 0;
    let moveY = 0;
    if (this.keys.a.isDown || this.keys.left.isDown) moveX -= 1;
    if (this.keys.d.isDown || this.keys.right.isDown) moveX += 1;
    if (this.keys.w.isDown || this.keys.up.isDown) moveY -= 1;
    if (this.keys.s.isDown || this.keys.down.isDown) moveY += 1;

    const rDown = Phaser.Input.Keyboard.JustDown(this.keys.r);
    if (rDown && this.sim.getSnapshot().player.action === 'dead') {
      this.handleRespawn();
    }

    const attackPressed = Phaser.Input.Keyboard.JustDown(this.keys.j);
    const bowHeld = this.keys.k.isDown;
    const skillPressed = Phaser.Input.Keyboard.JustDown(this.keys.e) || this.skillBtnQueued;
    const ultimatePressed = rDown || this.ultBtnQueued;
    const throwPressed = Phaser.Input.Keyboard.JustDown(this.keys.f) || this.throwBtnQueued;
    const dashPressed = Phaser.Input.Keyboard.JustDown(this.keys.shift) || this.dashBtnQueued;
    const rollPressed = Phaser.Input.Keyboard.JustDown(this.keys.space);
    const guardHeld = this.keys.q.isDown;
    const statUpgrade = this.pendingStatUpgrade;

    this.skillBtnQueued = false;
    this.ultBtnQueued = false;
    this.throwBtnQueued = false;
    this.dashBtnQueued = false;
    this.pendingStatUpgrade = undefined;

    return {
      moveX,
      moveY,
      aimDir: undefined,
      attackPressed,
      bowHeld,
      dashPressed,
      rollPressed,
      skillPressed,
      guardHeld,
      ultimatePressed,
      throwPressed,
      statUpgrade
    };
  }

  private handleSimEvents(events: SimEvent[]): void {
    for (const ev of events) {
      if (this.netSession) {
        const p = this.sim.getSnapshot().player;
        const heroKind = (p.kind === 'elvish' || p.kind === 'legacy' ? p.kind : 'crimson') as CharacterKind;
        if (ev.type === 'slash' && ev.actorId === 'player') {
          this.netSession.broadcastAttack(heroKind, ev.x, ev.y, `slash_${ev.combo}`, 26, ev.facing);
        } else if (ev.type === 'bowRelease' && ev.actorId === 'player') {
          this.netSession.broadcastAttack(heroKind, ev.x, ev.y, 'arrow_shot', 28, ev.facing);
        } else if (ev.type === 'skill' && ev.actorId === 'player') {
          this.netSession.broadcastAttack(heroKind, ev.x, ev.y, `skill_${ev.skill}`, 38, p.facing);
        } else if (ev.type === 'ultimateVfx') {
          this.netSession.broadcastAttack(heroKind, ev.x, ev.y, 'ultimate', 65, ev.dir);
        } else if (ev.type === 'redFlameRecast') {
          this.netSession.broadcastAttack(heroKind, ev.x, ev.y, 'flame_burst', 45, p.facing);
        }
      }

      if (ev.type === 'hit') {
        this.spawnDamageText(ev.x, ev.y, ev.damage, Boolean(ev.critical));
      } else if (ev.type === 'portalTransport') {
        const destKey = (ev.targetMapId || '').toLowerCase().trim();
        const isLocalExplicit =
          !destKey ||
          destKey === 'local' ||
          destKey === 'current' ||
          destKey === this.mapName.toLowerCase().trim() ||
          destKey === this.tiledMapKey.toLowerCase().trim();

        if (isLocalExplicit && ev.targetX !== undefined && ev.targetY !== undefined) {
          this.sim.teleportPlayer(ev.targetX, ev.targetY);
          this.triggerCameraFlash(220, 168, 85, 247);
          this.spawnSkillBanner(ev.targetX, ev.targetY - 24, `ENTERED: ${ev.label || 'Room'}`);
          return;
        }

        if (destKey === 'meadow' || destKey === 'meadow realm' || destKey === 'surface' || destKey === 'overworld') {
          this.spawnSkillBanner(ev.x, ev.y, `RETURNING: ${ev.label || 'Meadow Realm'}`);
          this.triggerCameraFlash(260, 168, 85, 247);
          this.scene.restart({
            tiledMapData: undefined,
            tiledMapKey: 'meadow',
            mapName: 'Meadow Realm',
            hero: this.sim.getSnapshot().player.kind,
            waveMode: true
          });
          return;
        }

        // Inter-realm transition:
        this.spawnSkillBanner(ev.x, ev.y, `ENTERING: ${ev.label || destKey}`);
        this.triggerCameraFlash(260, 168, 85, 247);
        this.scene.restart({
          tiledMapData: this.tiledMapData,
          tiledMapKey: this.tiledMapKey,
          mapName: this.mapName,
          hero: this.sim.getSnapshot().player.kind
        });
        return;
      } else if (ev.type === 'actorDefeated' && ev.actorId === 'player') {
        const snap = this.sim.getSnapshot();
        this.deathSummaryEl.textContent = `You survived until Wave ${snap.wave || 1}! Defeated ${snap.kills} slime${snap.kills === 1 ? '' : 's'}.`;
        this.deathBannerEl.classList.add('visible');
      } else if (ev.type === 'waveStart') {
        if (ev.isBossWave) {
          this.spawnSkillBanner(this.cameras.main.midPoint.x, this.cameras.main.midPoint.y - 70, `WARNING: BOSS WAVE ${ev.wave}!`);
          this.triggerCameraFlash(450, 239, 68, 68);
          this.triggerCameraShake(300, 0.007);
        } else {
          this.spawnSkillBanner(this.playerAnimator.body.x, this.playerAnimator.body.y - 40, `WAVE ${ev.wave} STARTING!`);
        }
      } else if (ev.type === 'waveCleared') {
        this.spawnSkillBanner(this.playerAnimator.body.x, this.playerAnimator.body.y - 40, `WAVE ${ev.wave} CLEARED! +35 HP`);
        this.triggerCameraFlash(280, 34, 197, 94);
      } else if (ev.type === 'bossPhaseTransition') {
        this.triggerCameraShake(420, 0.014);
        this.triggerCameraFlash(360, 168, 85, 247);
        this.spawnSkillBanner(ev.x, ev.y - 44, `PHASE II: ${ev.newName} AWAKENS!`);
        const ring1 = this.add.circle(ev.x, ev.y - 12, 22, 0xa855f7, 0.85);
        ring1.setDepth(ev.y + 20);
        this.tweens.add({
          targets: ring1,
          scale: 4.5,
          alpha: 0,
          duration: 680,
          ease: 'Cubic.easeOut',
          onComplete: () => ring1.destroy()
        });
        const ring2 = this.add.circle(ev.x, ev.y - 12, 14, 0x38bdf8, 0.9);
        ring2.setDepth(ev.y + 22);
        this.tweens.add({
          targets: ring2,
          scale: 3.4,
          alpha: 0,
          duration: 520,
          delay: 120,
          ease: 'Cubic.easeOut',
          onComplete: () => ring2.destroy()
        });
      } else if (ev.type === 'bossSkill') {
        if (ev.skill === 'slam') {
          const wave = this.add.circle(ev.x, ev.y, 18, 0xa855f7, 0.72);
          wave.setDepth(ev.y + 12);
          this.tweens.add({ targets: wave, scale: 4.8, alpha: 0, duration: 450, onComplete: () => wave.destroy() });
          this.triggerCameraShake(200, 0.007);
          this.spawnSkillBanner(ev.x, ev.y - 26, 'GRAVITY SLAM!');
        } else if (ev.skill === 'void_beam') {
          this.triggerCameraShake(240, 0.009);
          this.spawnSkillBanner(ev.x, ev.y - 30, 'ELDRITCH VOID BEAM!');
          const pulse = this.add.circle(ev.x, ev.y - 14, 24, 0xd946ef, 0.8);
          pulse.setDepth(ev.y + 18);
          this.tweens.add({
            targets: pulse,
            scale: 2.8,
            alpha: 0,
            duration: 380,
            ease: 'Cubic.easeOut',
            onComplete: () => pulse.destroy()
          });
        } else if (ev.skill === 'spit') {
          this.spawnSkillBanner(ev.x, ev.y - 22, 'ABYSSAL BARRAGE!');
        } else if (ev.skill === 'minions') {
          this.spawnSkillBanner(ev.x, ev.y - 24, 'ABYSSAL BROOD SUMMONED!');
        }
      } else if (ev.type === 'parry') {
        if (ev.perfect) {
          this.spawnSkillBanner(ev.x, ev.y - 20, 'PERFECT PARRY!');
          this.triggerCameraFlash(180, 250, 204, 21);
          this.triggerCameraShake(150, 0.005);
          const spark = this.add.circle(ev.x, ev.y - 14, 18, 0xfde047, 0.9);
          spark.setDepth(ev.y + 10);
          this.tweens.add({ targets: spark, scale: 2.4, alpha: 0, duration: 250, onComplete: () => spark.destroy() });
        } else {
          this.spawnSkillBanner(ev.x, ev.y - 20, 'BLOCKED (-75%)');
          const spark = this.add.circle(ev.x, ev.y - 14, 12, 0x60a5fa, 0.8);
          spark.setDepth(ev.y + 10);
          this.tweens.add({ targets: spark, scale: 1.8, alpha: 0, duration: 200, onComplete: () => spark.destroy() });
        }
      } else if (ev.type === 'barrelExploded') {
        const boom = this.add.circle(ev.x, ev.y, 36, 0xf97316, 0.85);
        boom.setDepth(ev.y + 15);
        this.tweens.add({
          targets: boom,
          scale: 2.6,
          alpha: 0,
          duration: 380,
          ease: 'Cubic.easeOut',
          onComplete: () => boom.destroy()
        });
        this.triggerCameraShake(180, 0.008);
        this.spawnSkillBanner(ev.x, ev.y - 28, 'BOOM! 60 AoE');
      } else if (ev.type === 'shrineActivated') {
        this.spawnSkillBanner(ev.x, ev.y - 32, ev.label);
        this.triggerCameraFlash(260, 56, 189, 248);
      } else if (ev.type === 'brambleCut') {
        for (let i = 0; i < 4; i++) {
          const leaf = this.add.rectangle(ev.x, ev.y, 4, 4, 0x15803d);
          leaf.setDepth(ev.y + 1);
          this.tweens.add({
            targets: leaf,
            x: ev.x + (Math.random() - 0.5) * 36,
            y: ev.y + (Math.random() - 0.5) * 36,
            alpha: 0,
            duration: 300,
            onComplete: () => leaf.destroy()
          });
        }
      } else if (ev.type === 'bowRelease') {
        const puff = this.add.circle(ev.x, ev.y - 10, 3, 0xf8fafc, 0.7);
        this.tweens.add({
          targets: puff,
          scale: 2.2,
          alpha: 0,
          duration: 180,
          onComplete: () => puff.destroy()
        });
      } else if (ev.type === 'levelUp') {
        const px = this.playerAnimator.body.x;
        const py = this.playerAnimator.body.y;
        this.triggerCameraShake(280, 0.007);
        this.triggerCameraFlash(350, 250, 204, 21);
        this.spawnSkillBanner(px, py - 38, `LEVEL UP! (LV ${ev.level}) +1 STAT POINT`);
        const aura = this.add.circle(px, py, 20, 0xfde047, 0.85);
        aura.setDepth(py + 10);
        this.tweens.add({
          targets: aura,
          scale: 4.2,
          alpha: 0,
          duration: 600,
          ease: 'Cubic.easeOut',
          onComplete: () => aura.destroy()
        });
      } else if (ev.type === 'statUpgraded') {
        const px = this.playerAnimator.body.x;
        const py = this.playerAnimator.body.y;
        const statName = ev.stat.toUpperCase();
        this.spawnSkillBanner(px, py - 32, `+ ${statName} UPGRADED! (Max: ${ev.newMax})`);
        const col = ev.stat === 'hp' ? 0x22c55e : ev.stat === 'mp' ? 0x06b6d4 : 0xf59e0b;
        const spark = this.add.circle(px, py, 16, col, 0.85);
        spark.setDepth(py + 10);
        this.tweens.add({
          targets: spark,
          scale: 2.8,
          alpha: 0,
          duration: 450,
          ease: 'Cubic.easeOut',
          onComplete: () => spark.destroy()
        });
      } else if (ev.type === 'flameStanceActivated') {
        const px = this.playerAnimator.body.x;
        const py = this.playerAnimator.body.y;
        this.spawnSkillBanner(px, py - 32, 'CRIMSON IGNITION: FLAMING SWORD!');
        const flameBurst = this.add.circle(px, py, 40, 0xf97316, 0.7);
        flameBurst.setDepth(py + 15);
        this.tweens.add({
          targets: flameBurst,
          scale: 2.2,
          alpha: 0,
          duration: 450,
          ease: 'Cubic.easeOut',
          onComplete: () => flameBurst.destroy()
        });
      } else if (ev.type === 'recastReady') {
        const px = this.playerAnimator.body.x;
        const py = this.playerAnimator.body.y;
        this.triggerCameraShake(200, 0.008);
        this.spawnSkillBanner(px, py - 36, 'RAGE MAX! [R] RECAST READY!');
        const pulse = this.add.circle(px, py, 50, 0xdc2626, 0.8);
        pulse.setDepth(py + 16);
        this.tweens.add({
          targets: pulse,
          scale: 2.5,
          alpha: 0,
          duration: 500,
          ease: 'Cubic.easeOut',
          onComplete: () => pulse.destroy()
        });
      } else if (ev.type === 'redFlameRecast') {
        this.triggerCameraShake(400, 0.016);
        this.triggerCameraFlash(350, 220, 38, 38);
        this.spawnSkillBanner(ev.x, ev.y - 42, 'RED FLAME: BLAZING DRAGON BURST!');
        const nova = this.add.circle(ev.x, ev.y, 110, 0xff2222, 0.85);
        nova.setDepth(ev.y + 25);
        this.tweens.add({
          targets: nova,
          scale: 1.4,
          alpha: 0,
          duration: 500,
          ease: 'Cubic.easeOut',
          onComplete: () => nova.destroy()
        });
      } else if (ev.type === 'rageNotReady') {
        this.spawnSkillBanner(ev.x, ev.y - 28, `RAGE NOT FULL (${Math.floor(ev.rage)}/100)`);
      } else if (ev.type === 'bowPerfect') {
        this.triggerCameraShake(180, 0.007);
        this.spawnSkillBanner(ev.x, ev.y - 32, 'PERFECT DRAW! BULLSEYE!');
        const spark = this.add.circle(ev.x, ev.y, 28, 0xfacc15, 0.9);
        spark.setDepth(ev.y + 15);
        this.tweens.add({
          targets: spark,
          scale: 2.2,
          alpha: 0,
          duration: 400,
          ease: 'Cubic.easeOut',
          onComplete: () => spark.destroy()
        });
      } else if (ev.type === 'bowFatigued') {
        this.spawnSkillBanner(ev.x, ev.y - 28, 'FATIGUED SHOT (MISFIRE)');
      } else if (ev.type === 'noStamina') {
        this.spawnSkillBanner(ev.x, ev.y - 28, `OUT OF STAMINA (${ev.needed} NEEDED)`);
      } else if (ev.type === 'burnTick') {
        this.spawnDamageText(ev.x, ev.y, ev.damage, false);
        const spark = this.add.circle(ev.x + (Math.random() - 0.5) * 10, ev.y - 12, 4, 0xf97316, 0.9);
        spark.setDepth(ev.y + 10);
        this.tweens.add({
          targets: spark,
          y: ev.y - 24,
          alpha: 0,
          duration: 350,
          ease: 'Cubic.easeOut',
          onComplete: () => spark.destroy()
        });
      } else if (ev.type === 'enemyDash') {
        this.spawnSkillBanner(ev.x, ev.y - 22, ev.skill);
        const isAcid = ev.skill.includes('ACID');
        const puff = this.add.circle(ev.x, ev.y - 8, 12, isAcid ? 0x4ade80 : 0x38bdf8, 0.75);
        puff.setDepth(ev.y + 8);
        this.tweens.add({
          targets: puff,
          scale: 2.3,
          alpha: 0,
          duration: 280,
          ease: 'Cubic.easeOut',
          onComplete: () => puff.destroy()
        });
      } else if (ev.type === 'debuffApplied') {
        this.spawnSkillBanner(ev.x, ev.y - 30, ev.label);
        const col = ev.debuff === 'slow' ? 0x22c55e : ev.debuff === 'bleed' ? 0xef4444 : 0xa855f7;
        const ring = this.add.circle(ev.x, ev.y - 12, 16, col, 0.75);
        ring.setDepth(ev.y + 12);
        this.tweens.add({
          targets: ring,
          scale: 2.2,
          alpha: 0,
          duration: 360,
          ease: 'Cubic.easeOut',
          onComplete: () => ring.destroy()
        });
      } else if (ev.type === 'noMp') {
        const px = this.playerAnimator.body.x;
        const py = this.playerAnimator.body.y;
        this.spawnSkillBanner(px, py - 24, `NOT ENOUGH MP (${ev.needed} MP NEEDED)`);
      } else if (ev.type === 'ultimateVfx') {
        this.triggerCameraShake(320, 0.01);
        if (ev.hero === 'crimson') {
          this.triggerCameraFlash(300, 239, 68, 68);
          this.spawnSkillBanner(ev.x, ev.y - 36, 'BLAZING DRAGON CLEAVE!');
          const blast = this.add.circle(ev.x, ev.y, 48, 0xef4444, 0.8);
          blast.setDepth(ev.y + 20);
          this.tweens.add({
            targets: blast,
            scale: 2.2,
            alpha: 0,
            duration: 400,
            ease: 'Cubic.easeOut',
            onComplete: () => blast.destroy()
          });
        } else if (ev.hero === 'elvish') {
          this.triggerCameraFlash(300, 52, 211, 153);
          this.spawnSkillBanner(ev.x, ev.y - 36, 'CELESTIAL VOLLEY OF ARROWS!');
        } else {
          this.triggerCameraFlash(300, 168, 85, 247);
          this.spawnSkillBanner(ev.x, ev.y - 36, 'SHADOW METEOR IMPACT!');
        }
      }
    }
  }

  private triggerCameraFlash(duration: number, r: number, g: number, b: number): void {
    const setting = localStorage.getItem('meadowblade_flash_setting') || 'off';
    if (setting === 'off') {
      return; // Epilepsy Safe: Zero full-screen flashes
    }
    if (setting === 'soft') {
      this.cameras.main.flash(
        Math.min(duration * 0.35, 100),
        Math.round(r * 0.35),
        Math.round(g * 0.35),
        Math.round(b * 0.35)
      );
      return;
    }
    this.cameras.main.flash(duration, r, g, b);
  }

  private triggerCameraShake(duration: number, intensity: number): void {
    const setting = localStorage.getItem('meadowblade_shake_setting') || 'reduced';
    if (setting === 'off') {
      return;
    }
    if (setting === 'reduced') {
      this.cameras.main.shake(Math.min(duration * 0.45, 140), intensity * 0.45);
      return;
    }
    this.cameras.main.shake(duration, intensity);
  }

  private spawnSkillBanner(x: number, y: number, name: string): void {
    const label = this.add
      .text(x, y, name.toUpperCase(), {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#34d399',
        stroke: '#090d10',
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(5200);

    this.tweens.add({
      targets: label,
      y: y - 26,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy()
    });
  }

  private spawnDamageText(x: number, y: number, damage: number, critical: boolean): void {
    const text = this.add
      .text(x + (Math.random() - 0.5) * 12, y - 10, `${damage}`, {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: critical ? '13px' : '10px',
        fontStyle: 'bold',
        color: critical ? '#fbbf24' : '#ef4444',
        stroke: '#0b0f13',
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(5000);

    this.tweens.add({
      targets: text,
      y: text.y - 22,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy()
    });
  }

  private syncWorld(snapshot: WorldSnapshot): void {
    this.playerAnimator.sync(snapshot.player);

    // Sync Multiplayer Peers
    if (this.netSession) {
      const activePeers = new Set<string>();
      const cam = this.cameras.main;
      const worldView = cam.worldView;

      for (const [peerId, peer] of this.netSession.peers.entries()) {
        activePeers.add(peerId);
        let anim = this.peerAnimators.get(peerId);
        if (!anim) {
          const fakeActor: any = {
            id: peer.id,
            kind: peer.hero,
            isPlayer: false,
            x: peer.x,
            y: peer.y,
            facing: peer.facing,
            action: peer.action,
            hp: peer.hp,
            maxHp: peer.maxHp,
            stamina: 100,
            maxStamina: 100
          };
          anim = new CharacterAnimator(this, fakeActor);
          this.peerAnimators.set(peerId, anim);
        }

        const heroLabel = peer.hero === 'crimson' ? 'Blade' : peer.hero === 'elvish' ? 'Ranger' : 'Knight';
        anim.sync({
          id: peer.id,
          kind: peer.hero,
          isPlayer: false,
          peerName: `${peer.name} [${heroLabel}]`,
          isPvp: this.isPvp,
          x: peer.x,
          y: peer.y,
          facing: peer.facing as any,
          action: peer.action as any,
          actionElapsed: 0.1,
          hp: peer.hp,
          maxHp: peer.maxHp,
          stamina: 100,
          maxStamina: 100,
          invulnTimer: 0,
          dashCooldown: 0,
          dashMaxCooldown: 1.4,
          skillCooldown: 0,
          skillMaxCooldown: 5,
          skillName: 'Skill',
          guardCooldown: 0,
          guardMaxCooldown: 2,
          ultimateCooldown: 0,
          ultimateMaxCooldown: 16,
          throwCooldown: 0,
          throwMaxCooldown: 5
        });

        // Off-screen peer locator compass / arrow
        const inView = worldView.contains(peer.x, peer.y);
        let ptr = this.peerPointers.get(peerId);
        if (!inView) {
          const dist = Math.round(Math.hypot(peer.x - cam.midPoint.x, peer.y - cam.midPoint.y));
          const angle = Math.atan2(peer.y - cam.midPoint.y, peer.x - cam.midPoint.x);
          const margin = 36;
          const halfW = (cam.width / (2 * cam.zoom)) - margin;
          const halfH = (cam.height / (2 * cam.zoom)) - margin;
          const clampX = cam.midPoint.x + Math.max(-halfW, Math.min(halfW, Math.cos(angle) * halfW));
          const clampY = cam.midPoint.y + Math.max(-halfH, Math.min(halfH, Math.sin(angle) * halfH));

          if (!ptr) {
            ptr = this.add.text(clampX, clampY, '', {
              fontFamily: 'sans-serif',
              fontSize: '11px',
              fontStyle: 'bold',
              color: this.isPvp ? '#f87171' : '#38bdf8',
              backgroundColor: '#0f172a',
              padding: { x: 6, y: 3 },
              stroke: '#000000',
              strokeThickness: 2
            });
            ptr.setOrigin(0.5, 0.5);
            this.peerPointers.set(peerId, ptr);
          }
          const arrow = Math.abs(angle) < 0.78 ? '▶' : (Math.abs(angle) > 2.35 ? '◀' : (angle > 0 ? '▼' : '▲'));
          ptr.setText(`${arrow} ${peer.name} (${dist}m)`).setPosition(clampX, clampY).setDepth(1500).setVisible(true);
        } else if (ptr) {
          ptr.setVisible(false);
        }
      }

      for (const [peerId, anim] of this.peerAnimators.entries()) {
        if (!activePeers.has(peerId)) {
          anim.destroy();
          this.peerAnimators.delete(peerId);
          const ptr = this.peerPointers.get(peerId);
          if (ptr) {
            ptr.destroy();
            this.peerPointers.delete(peerId);
          }
        }
      }
    }

    for (const enemySnap of snapshot.enemies) {
      let anim = this.enemyAnimators.get(enemySnap.id);
      if (!anim) {
        const isEldritchBoss = enemySnap.kind === 'abyssal_jelly' || enemySnap.kind === 'floating_eldritch';
        const isOrc = typeof enemySnap.kind === 'string' && enemySnap.kind.includes('orc');
        const isSlime = typeof enemySnap.kind === 'string' && enemySnap.kind.includes('slime');
        anim = isEldritchBoss
          ? new BossAnimator(this, enemySnap)
          : isOrc
            ? new OrcAnimator(this, enemySnap)
            : isSlime
              ? new SlimeAnimator(this, enemySnap)
              : new CharacterAnimator(this, enemySnap);
        this.enemyAnimators.set(enemySnap.id, anim);
      }
      anim.sync(enemySnap);
    }

    const aliveIds = new Set(snapshot.enemies.map((e) => e.id));
    for (const [id, anim] of this.enemyAnimators.entries()) {
      if (!aliveIds.has(id)) {
        anim.destroy();
        this.enemyAnimators.delete(id);
      }
    }

    const activeIds = new Set<number>();
    for (const proj of snapshot.projectiles) {
      activeIds.add(proj.id);
      let sprite = this.projectileSprites.get(proj.id);
      if (!sprite) {
        const ownerStr = String(proj.ownerId);
        const isOrcProj = ownerStr.includes('orc');
        const isBossProj = ownerStr.includes('boss') || ownerStr.includes('abyssal') || ownerStr.includes('eldritch');
        const texKey = isBossProj ? 'void_orb_tex' : isOrcProj ? 'orc_javelin_tex' : 'arrow_tex';
        sprite = this.add.image(proj.x, proj.y, texKey);
        sprite.setOrigin(0.5, 0.5);
        if (isBossProj) {
          if (proj.isPerfect) {
            sprite.setTint(0xf0abfc); // Phase 2 Void Beam orb
            sprite.setScale(1.35, 1.35);
          } else {
            sprite.clearTint();
            sprite.setScale(1.1, 1.1);
          }
        } else if (proj.isSkill) {
          if (proj.ownerId === snapshot.player.id) {
            sprite.setTint(0xfde047); // Golden radiant arrows for Elvish skill volley
          } else {
            sprite.setTint(0x22c55e); // Emerald poison spit for slimes
          }
        } else if (proj.isPerfect) {
          sprite.setTint(0xfacc15); // Brilliant radiant gold for Perfect Draw Bullseye
          sprite.setScale(1.3, 1.3);
        } else if (proj.isPierce) {
          sprite.setTint(0x60a5fa); // Cyan piercing wind arrow
          sprite.setScale(1.15, 1.15);
        } else if (isOrcProj) {
          sprite.clearTint();
        } else if (proj.ownerId !== snapshot.player.id) {
          sprite.setTint(0x22c55e); // Poison spit for normal slimes
        } else {
          sprite.clearTint();
          sprite.setScale(1, 1);
        }
        sprite.setDepth(proj.y);
        this.projectileSprites.set(proj.id, sprite);
      }
      sprite.setPosition(proj.x, proj.y);
      sprite.setRotation(proj.angle);
      sprite.setDepth(proj.y);
    }

    for (const [id, sprite] of this.projectileSprites.entries()) {
      if (!activeIds.has(id)) {
        sprite.destroy();
        this.projectileSprites.delete(id);
      }
    }

    // Interactive World Objects (Barrels, Shrines, Campfire, Brambles)
    const activeObjIds = new Set<string>();
    if (snapshot.worldObjects) {
      for (const obj of snapshot.worldObjects) {
        activeObjIds.add(obj.id);
        let view = this.worldObjectViews.get(obj.id);
        if (!view) {
          view = this.createWorldObjectView(obj);
          this.worldObjectViews.set(obj.id, view);
        }
        view.setVisible(Boolean(obj.active));
        view.setDepth(obj.y);
      }
    }

    for (const [id, view] of this.worldObjectViews.entries()) {
      if (!activeObjIds.has(id)) {
        view.destroy();
        this.worldObjectViews.delete(id);
      }
    }

    // Sync HUD
    const p = snapshot.player;
    const profile = HERO_PROFILES[(p.kind in HERO_PROFILES ? p.kind : 'crimson') as CharacterKind] || HERO_PROFILES.crimson;
    this.heroNameEl.textContent = profile.title;
    this.heroRoleEl.textContent = profile.role;

    this.hpFillEl.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
    this.hpTextEl.textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    this.stmFillEl.style.width = `${Math.max(0, (p.stamina / p.maxStamina) * 100)}%`;
    this.stmTextEl.textContent = `${Math.floor(p.stamina)}/${p.maxStamina}`;

    if (this.mpFillEl && this.mpTextEl) {
      const mp = p.mp ?? 0;
      const maxMp = p.maxMp ?? 100;
      this.mpFillEl.style.width = `${Math.max(0, (mp / maxMp) * 100)}%`;
      this.mpTextEl.textContent = `${Math.floor(mp)}/${maxMp}`;
    }

    if (this.levelBadgeEl) {
      this.levelBadgeEl.textContent = `LV ${p.level ?? 1}`;
    }

    if (this.expFillEl && this.expTextEl) {
      const exp = p.exp ?? 0;
      const maxExp = p.maxExp ?? 40;
      this.expFillEl.style.width = `${Math.max(0, Math.min(100, (exp / maxExp) * 100))}%`;
      this.expTextEl.textContent = `${exp}/${maxExp} XP`;
    }

    if (this.rageRowEl && this.rageFillEl && this.rageTextEl) {
      if (p.kind === 'crimson') {
        this.rageRowEl.style.display = 'flex';
        const rage = p.rage ?? 0;
        const maxRage = p.maxRage ?? 100;
        const pct = Math.max(0, Math.min(100, (rage / maxRage) * 100));
        this.rageFillEl.style.width = `${pct}%`;
        this.rageTextEl.textContent = `${Math.floor(rage)}/${maxRage}`;
        this.rageFillEl.classList.toggle('ready', Boolean(p.isRecastReady));
      } else {
        this.rageRowEl.style.display = 'none';
      }
    }

    if (this.statPointsPanelEl && this.statPointsCountEl) {
      const points = p.statPoints ?? 0;
      if (points > 0) {
        this.statPointsPanelEl.style.display = 'flex';
        this.statPointsCountEl.textContent = `+${points} Point${points === 1 ? '' : 's'} Available`;
      } else {
        this.statPointsPanelEl.style.display = 'none';
      }
    }

    this.killsTextEl.textContent = String(snapshot.kills);

    // Wave & Boss HUD Sync
    const waveCardEl = document.getElementById('wave-card');
    if (waveCardEl) {
      waveCardEl.style.display = this.waveMode ? 'block' : 'none';
    }

    if (this.waveMode && this.waveTitleEl && this.waveSubtitleEl) {
      const isBossWave = Boolean(snapshot.boss);
      this.waveTitleEl.textContent = isBossWave ? `WAVE ${snapshot.wave || 1} [BOSS]` : `WAVE ${snapshot.wave || 1}`;
      this.waveTitleEl.style.color = isBossWave ? '#ef4444' : '#fbbf24';

      if (snapshot.waveState === 'cleared') {
        this.waveSubtitleEl.textContent = 'Wave Cleared!';
        this.waveSubtitleEl.style.color = '#34d399';
      } else {
        const left = snapshot.waveEnemiesLeft ?? 0;
        const total = snapshot.waveTotalEnemies ?? 0;
        this.waveSubtitleEl.textContent = `Slimes Left: ${left}/${total}`;
        this.waveSubtitleEl.style.color = '#94a3b8';
      }
    }

    if (this.bossHudBarEl) {
      if (snapshot.boss) {
        this.bossHudBarEl.style.display = 'block';
        this.bossHudBarEl.classList.add('visible');
        const phase = snapshot.boss.phase ?? 1;
        const maxPhases = snapshot.boss.maxPhases ?? 2;
        this.bossNameEl.textContent = `${snapshot.boss.name}  [PHASE ${phase} / ${maxPhases}]`;
        this.bossNameEl.style.color = phase >= 2 ? '#e879f9' : '#38bdf8';
        const bHpPct = Math.max(0, Math.min(100, (snapshot.boss.hp / snapshot.boss.maxHp) * 100));
        this.bossHpFillEl.style.width = `${bHpPct}%`;
        this.bossHpFillEl.style.background =
          phase >= 2
            ? 'linear-gradient(90deg, #6b21a8, #a855f7, #f472b6)'
            : 'linear-gradient(90deg, #991b1b, #ef4444, #f97316)';
        this.bossHpTextEl.textContent = `${Math.ceil(snapshot.boss.hp)} / ${snapshot.boss.maxHp}`;
      } else {
        this.bossHudBarEl.classList.remove('visible');
        this.bossHudBarEl.style.display = 'none';
      }
    }

    // Cooldown Bars
    const dashPct = Math.max(0, Math.min(1, p.dashCooldown / p.dashMaxCooldown));
    this.dashCdFillEl.style.height = `${dashPct * 100}%`;
    this.dashSlotEl.classList.toggle('on-cooldown', dashPct > 0);
    this.dashStatusEl.textContent = dashPct > 0 ? `${p.dashCooldown.toFixed(1)}s` : 'Ready';
    this.dashStatusEl.className = `ability-status ${dashPct > 0 ? 'cooling' : 'ready'}`;

    const skillPct = Math.max(0, Math.min(1, p.skillCooldown / p.skillMaxCooldown));
    this.skillCdFillEl.style.height = `${skillPct * 100}%`;
    this.skillSlotEl.classList.toggle('on-cooldown', skillPct > 0);
    this.skillNameEl.textContent = p.skillName;
    this.skillStatusEl.textContent = skillPct > 0 ? `${p.skillCooldown.toFixed(1)}s` : 'Ready';
    this.skillStatusEl.className = `ability-status ${skillPct > 0 ? 'cooling' : 'ready'}`;

    if (this.guardSlotEl) {
      const qCd = p.guardCooldown ?? 0;
      const qMax = p.guardMaxCooldown ?? 2.0;
      const qPct = qCd > 0 ? (qCd / qMax) * 100 : 0;
      if (this.guardCdFillEl) this.guardCdFillEl.style.height = `${qPct}%`;
      if (this.guardStatusEl) {
        this.guardStatusEl.textContent = qCd > 0 ? `${qCd.toFixed(1)}s` : 'Ready';
        this.guardStatusEl.className = `ability-status ${qCd > 0 ? 'cooling' : 'ready'}`;
      }
      this.guardSlotEl.classList.toggle('on-cooldown', qCd > 0);
    }

    if (this.ultSlotEl) {
      const rCd = p.ultimateCooldown ?? 0;
      const rMax = p.ultimateMaxCooldown ?? 16.0;
      const rPct = rCd > 0 ? (rCd / rMax) * 100 : 0;
      if (p.kind === 'crimson') {
        if (p.isRecastReady) {
          if (this.ultCdFillEl) this.ultCdFillEl.style.height = '0%';
          if (this.ultNameEl) this.ultNameEl.textContent = 'Red Flame';
          if (this.ultStatusEl) {
            this.ultStatusEl.textContent = 'RECAST [R]';
            this.ultStatusEl.className = 'ability-status ready';
          }
          this.ultSlotEl.classList.remove('on-cooldown');
          this.ultSlotEl.classList.add('ready');
        } else if (p.isFlameStance) {
          const stancePct = Math.max(0, Math.min(1, 1 - (p.flameStanceTimer ?? 0) / 12.0));
          if (this.ultCdFillEl) this.ultCdFillEl.style.height = `${stancePct * 100}%`;
          if (this.ultNameEl) this.ultNameEl.textContent = 'Flame Sword';
          if (this.ultStatusEl) {
            this.ultStatusEl.textContent = `${Math.ceil(p.flameStanceTimer ?? 0)}s`;
            this.ultStatusEl.className = 'ability-status ready';
          }
          this.ultSlotEl.classList.remove('on-cooldown');
          this.ultSlotEl.classList.add('ready');
        } else {
          if (this.ultCdFillEl) this.ultCdFillEl.style.height = `${rPct}%`;
          if (this.ultNameEl) this.ultNameEl.textContent = p.ultimateName || 'Crimson Ignition';
          if (this.ultStatusEl) {
            this.ultStatusEl.textContent = rCd > 0 ? `${rCd.toFixed(1)}s` : 'Ready';
            this.ultStatusEl.className = `ability-status ${rCd > 0 ? 'cooling' : 'ready'}`;
          }
          this.ultSlotEl.classList.toggle('on-cooldown', rCd > 0);
        }
      } else {
        if (this.ultCdFillEl) this.ultCdFillEl.style.height = `${rPct}%`;
        if (this.ultNameEl) this.ultNameEl.textContent = p.ultimateName || 'Ultimate';
        if (this.ultStatusEl) {
          this.ultStatusEl.textContent = rCd > 0 ? `${rCd.toFixed(1)}s` : 'Ready';
          this.ultStatusEl.className = `ability-status ${rCd > 0 ? 'cooling' : 'ready'}`;
        }
        this.ultSlotEl.classList.toggle('on-cooldown', rCd > 0);
      }
    }

    if (this.throwSlotEl) {
      const fCd = p.throwCooldown ?? 0;
      const fMax = p.throwMaxCooldown ?? 5.0;
      const fPct = fCd > 0 ? (fCd / fMax) * 100 : 0;
      if (this.throwCdFillEl) this.throwCdFillEl.style.height = `${fPct}%`;
      if (this.throwNameEl) this.throwNameEl.textContent = p.throwName || 'Throw';
      if (this.throwStatusEl) {
        this.throwStatusEl.textContent = fCd > 0 ? `${fCd.toFixed(1)}s` : 'Ready';
        this.throwStatusEl.className = `ability-status ${fCd > 0 ? 'cooling' : 'ready'}`;
      }
      this.throwSlotEl.classList.toggle('on-cooldown', fCd > 0);
    }
  }

  private createWorldObjectView(obj: { id: string; type: string; x: number; y: number; name?: string }): Phaser.GameObjects.Container {
    const container = this.add.container(obj.x, obj.y);

    if (obj.type === 'campfire') {
      const shadow = this.add.ellipse(0, 0, 36, 14, 0x000000, 0.4);
      const stones = this.add.ellipse(0, -2, 30, 12).setStrokeStyle(2, 0x64748b);
      const wood1 = this.add.rectangle(0, -4, 22, 6, 0x78350f).setRotation(0.35);
      const wood2 = this.add.rectangle(0, -4, 22, 6, 0x92400e).setRotation(-0.35);
      const fire = this.add.circle(0, -9, 8, 0xf97316, 0.9);
      const innerFire = this.add.circle(0, -9, 4, 0xfde047, 1);
      this.tweens.add({
        targets: [fire, innerFire],
        scaleX: 1.25,
        scaleY: 1.35,
        y: -11,
        duration: 350,
        yoyo: true,
        repeat: -1
      });
      const lbl = this.add.text(0, -28, 'Campfire (Rest)', {
        fontSize: '8px',
        fontStyle: 'bold',
        color: '#fde047',
        stroke: '#000',
        strokeThickness: 2
      }).setOrigin(0.5);
      container.add([shadow, stones, wood1, wood2, fire, innerFire, lbl]);
    } else if (obj.type === 'shrine') {
      const isZephyr = obj.id.includes('zephyr');
      const mainCol = isZephyr ? 0x0284c7 : 0xd97706;
      const glowCol = isZephyr ? 0x38bdf8 : 0xfbbf24;

      const shadow = this.add.ellipse(0, 0, 32, 12, 0x000000, 0.4);
      const aura = this.add.ellipse(0, 0, 44, 16).setStrokeStyle(1.5, glowCol, 0.6);
      this.tweens.add({
        targets: aura,
        scaleX: 1.15,
        scaleY: 1.2,
        alpha: 0.25,
        duration: 800,
        yoyo: true,
        repeat: -1
      });
      const pillar = this.add.rectangle(0, -18, 14, 30, mainCol);
      const gem = this.add.circle(0, -28, 5, glowCol, 0.95);
      const lbl = this.add.text(0, -40, isZephyr ? 'Zephyr (+Speed)' : 'Might (+DMG)', {
        fontSize: '8px',
        fontStyle: 'bold',
        color: isZephyr ? '#38bdf8' : '#fbbf24',
        stroke: '#000',
        strokeThickness: 2
      }).setOrigin(0.5);
      container.add([shadow, aura, pillar, gem, lbl]);
    } else if (obj.type === 'barrel') {
      const shadow = this.add.ellipse(0, 0, 24, 10, 0x000000, 0.4);
      const barrelBody = this.add.rectangle(0, -12, 18, 22, 0x78350f);
      const hoop1 = this.add.rectangle(0, -18, 20, 2, 0x475569);
      const hoop2 = this.add.rectangle(0, -6, 20, 2, 0x475569);
      const skullBand = this.add.rectangle(0, -12, 18, 4, 0xef4444);
      const lbl = this.add.text(0, -26, 'TNT Barrel', {
        fontSize: '7px',
        fontStyle: 'bold',
        color: '#f87171',
        stroke: '#000',
        strokeThickness: 2
      }).setOrigin(0.5);
      container.add([shadow, barrelBody, hoop1, hoop2, skullBand, lbl]);
    } else if (obj.type === 'bramble') {
      const shadow = this.add.ellipse(0, 0, 24, 8, 0x000000, 0.3);
      const bush1 = this.add.circle(-4, -6, 10, 0x14532d, 0.85);
      const bush2 = this.add.circle(5, -6, 9, 0x166534, 0.85);
      const thorn1 = this.add.line(0, 0, -8, -12, -4, -6, 0x15803d).setLineWidth(2);
      const thorn2 = this.add.line(0, 0, 6, -12, 2, -6, 0x15803d).setLineWidth(2);
      container.add([shadow, bush1, bush2, thorn1, thorn2]);
    }

    return container;
  }
}
