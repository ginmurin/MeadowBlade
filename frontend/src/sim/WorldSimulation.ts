import { DIRECTION_VECTORS, normalizeVector, vectorToDirection8 } from './directions';
import type {
  ActionState,
  ActorSnapshot,
  CharacterKind,
  Direction8,
  EnemyKind,
  MapSpawnData,
  PlayerInput,
  SimEvent,
  WorldSnapshot
} from './types';

export interface HeroProfile {
  kind: CharacterKind;
  title: string;
  role: string;
  maxHp: number;
  maxStamina: number;
  moveSpeed: number;
  maxMp?: number;
  skillName: string;
  skillDesc: string;
  skillCooldown: number;
  ultimateName?: string;
  ultimateMaxCooldown?: number;
  throwName?: string;
  throwMaxCooldown?: number;
}

export const HERO_PROFILES: Record<CharacterKind, HeroProfile> = {
  crimson: {
    kind: 'crimson',
    title: 'Crimson Red',
    role: 'Blademaiden',
    maxHp: 110,
    maxStamina: 100,
    maxMp: 100,
    moveSpeed: 152,
    skillName: 'Crimson Thrust',
    skillDesc: 'Blazing lunge thrust that pierces foes for 48 DMG.',
    skillCooldown: 5.5,
    ultimateName: 'Crimson Ignition',
    ultimateMaxCooldown: 16.0,
    throwName: 'Kunai Fan',
    throwMaxCooldown: 5.0
  },
  elvish: {
    kind: 'elvish',
    title: 'Elvish Ranger',
    role: 'Sylph Archer',
    maxHp: 90,
    maxStamina: 120,
    maxMp: 120,
    moveSpeed: 168,
    skillName: 'Arrow Volley',
    skillDesc: 'Fires 3 rapid radiant arrows in a fan spread (30 DMG each).',
    skillCooldown: 4.5,
    ultimateName: 'Sunlight Barrage',
    ultimateMaxCooldown: 15.0,
    throwName: 'Hail of Arrows',
    throwMaxCooldown: 5.0
  },
  legacy: {
    kind: 'legacy',
    title: 'Legacy Knight',
    role: 'Iron Vanguard',
    maxHp: 140,
    maxStamina: 90,
    maxMp: 90,
    moveSpeed: 138,
    skillName: 'Whirlwind',
    skillDesc: '360° greatsword cleave dealing 55 DMG around you.',
    skillCooldown: 6.5,
    ultimateName: 'Iron Fortress',
    ultimateMaxCooldown: 18.0,
    throwName: 'Fuse Bomb',
    throwMaxCooldown: 6.0
  }
};

interface SimActor {
  id: string;
  kind: CharacterKind | EnemyKind;
  isPlayer: boolean;
  isBoss?: boolean;
  bossName?: string;
  bossPhase?: 1 | 2;
  bossMaxPhases?: number;
  bossSkillTimer?: number;
  bossMinionsSpawned?: number;
  attackDamage?: number;
  aiFlankSign?: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  moveSpeed: number;
  facing: Direction8;
  action: ActionState;
  actionElapsed: number;
  actionDuration: number;
  actionHitTriggered: boolean;
  skillTargetsHit: Set<string>;
  comboQueued: boolean;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  staminaRegenDelay: number;
  mp: number;
  maxMp: number;
  level: number;
  exp: number;
  maxExp: number;
  statPoints: number;
  allocatedHp: number;
  allocatedStamina: number;
  allocatedMp: number;
  invulnTimer: number;
  attackCooldown: number;
  dashCooldown: number;
  dashMaxCooldown: number;
  skillCooldown: number;
  skillMaxCooldown: number;
  skillName: string;
  guardCooldown: number;
  guardMaxCooldown: number;
  ultimateCooldown: number;
  ultimateMaxCooldown: number;
  ultimateName: string;
  throwCooldown: number;
  throwMaxCooldown: number;
  throwName: string;
  buffActive?: string;
  buffTimer: number;
  barrierShield: number;
  rage: number;
  maxRage: number;
  flameStanceTimer: number;
  burnTimer: number;
  burnDamage: number;
  burnTickElapsed: number;
  slowTimer?: number;
  debuffActive?: 'slow' | 'bleed' | 'void_sap';
  debuffTimer?: number;
  respawnTimer: number;
  respawnDelay?: number;
  aiPatrolAngle: number;
  aiPatrolTimer: number;
  aiKiteTimer?: number;
  aggroed: boolean;
}

export interface SimWorldObject {
  id: string;
  type: 'barrel' | 'shrine' | 'campfire' | 'bramble';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  active: boolean;
  name: string;
  cooldown?: number;
}

interface SimProjectile {
  id: number;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  damage: number;
  life: number;
  isSkill: boolean;
  pierce?: number;
  hitTargets?: Set<string>;
  isPerfect?: boolean;
}

const FOOT_HALF_W = 10;
const FOOT_HALF_H = 7;

const PLAYER_DASH_SPEED = 360;
const PLAYER_ROLL_SPEED = 275;
const DASH_COOLDOWN_SEC = 1.4;
const ENEMY_MOVE_SPEED = 88;
const ENEMY_AGGRO_RADIUS = 220;

export class WorldSimulation {
  private readonly map: MapSpawnData;
  private readonly player: SimActor;
  private readonly enemies: SimActor[] = [];
  private projectiles: SimProjectile[] = [];
  private worldObjects: SimWorldObject[] = [];
  private events: SimEvent[] = [];
  private tick = 0;
  private kills = 0;
  private nextProjectileId = 1;
  private prevBowHeld = false;
  private portalDebounceTimer = 0;

  // Wave Survival System
  public waveMode = false;
  private currentWave = 0;
  private waveState: 'spawning' | 'active' | 'cleared' | 'boss_wave' = 'cleared';
  private waveCountdown = 0;
  private waveTotalEnemies = 0;
  private activeBoss: SimActor | null = null;

  constructor(map: MapSpawnData, playerKind: CharacterKind = 'crimson', waveMode = false) {
    this.map = map;
    this.waveMode = waveMode;
    const profile = HERO_PROFILES[playerKind];
    this.player = this.createActor('player', playerKind, true, map.playerSpawn.x, map.playerSpawn.y, profile);
    this.initWorldObjects();

    if (this.waveMode) {
      this.startWave(1);
    } else {
      this.currentWave = 0;
      this.waveState = 'cleared';
      this.waveTotalEnemies = 0;
      map.enemySpawns.forEach((spawn, index) => {
        const lowerName = (spawn.name || '').toLowerCase();
        const isTwoPhaseBoss =
          spawn.kind === 'abyssal_jelly' ||
          spawn.kind === 'floating_eldritch' ||
          lowerName.includes('boss') ||
          lowerName.includes('abyssal') ||
          lowerName.includes('jelly') ||
          lowerName.includes('eldritch');

        if (isTwoPhaseBoss) {
          const boss = this.createTwoPhaseBoss(`map_boss_${index}`, spawn.x, spawn.y, 450, 88, 22);
          boss.respawnDelay = spawn.respawnDelay;
          this.enemies.push(boss);
          this.activeBoss = boss;
          return;
        }

        const isOrc = lowerName.includes('orc') || spawn.kind === 'hunter_orc' || spawn.kind === 'orc_warlord';
        const kind: EnemyKind = isOrc ? 'hunter_orc' : 'green_slime';
        const enemy = this.createActor(
          spawn.name || `guardian_${index}`,
          kind,
          false,
          spawn.x,
          spawn.y,
          {
            ...HERO_PROFILES.elvish,
            maxHp: isOrc ? 95 : 75,
            moveSpeed: isOrc ? 86 : ENEMY_MOVE_SPEED
          }
        );
        enemy.aiFlankSign = index % 2 === 0 ? 1 : -1;
        enemy.respawnDelay = spawn.respawnDelay;
        this.enemies.push(enemy);
      });
    }
  }

  public createTwoPhaseBoss(
    id: string,
    x: number,
    y: number,
    phase1Hp = 450,
    speed = 88,
    dmg = 22
  ): SimActor {
    const boss = this.createActor(id, 'abyssal_jelly', false, x, y, {
      kind: 'elvish',
      title: 'Abyssal Jelly',
      role: 'Boss - Phase I',
      maxHp: phase1Hp,
      maxStamina: 200,
      moveSpeed: speed,
      skillName: 'Abyssal Pulse',
      skillDesc: 'Unleashes bio-electric shockwaves and venomous spores',
      skillCooldown: 3.5
    });
    boss.isBoss = true;
    boss.bossPhase = 1;
    boss.bossMaxPhases = 2;
    boss.bossName = 'Abyssal Jelly';
    boss.bossSkillTimer = 3.0;
    boss.bossMinionsSpawned = 0;
    boss.attackDamage = dmg;
    boss.aiFlankSign = 1;
    return boss;
  }

  private initWorldObjects(): void {
    // Barrels and drops removed per user directive
    this.worldObjects = [];
  }

  public startWave(waveNum: number): void {
    this.currentWave = waveNum;
    this.activeBoss = null;
    this.enemies.length = 0;
    const isBossRound = waveNum % 5 === 0;

    if (!isBossRound) {
      this.waveState = 'active';
      const count = Math.min(16, 3 + waveNum * 2);
      this.waveTotalEnemies = count;

      // Scaling: Each wave enemies get stronger (+18% HP, +2 DMG) and faster (+7 speed)
      const hpMultiplier = Math.pow(1.18, waveNum - 1);
      const enemyHp = Math.round(40 * hpMultiplier);
      const enemySpeed = Math.min(160, Math.round(68 + (waveNum - 1) * 7));
      const enemyDmg = Math.round(8 + (waveNum - 1) * 2);

      for (let i = 0; i < count; i++) {
        let kind: EnemyKind = 'green_slime';
        let title = 'Slime';
        let role = 'Minion';
        let hp = enemyHp;
        let spd = enemySpeed;
        let dmg = enemyDmg;

        // Introduce Hunter Orc skirmishers starting from wave 2!
        const spawnOrc = waveNum >= 2 && i % 3 === 0;

        if (spawnOrc) {
          kind = 'hunter_orc';
          title = 'Hunter Orc';
          role = 'Skirmisher';
          hp = Math.round(enemyHp * 1.35);
          spd = Math.min(145, Math.round(enemySpeed * 0.95));
          dmg = Math.round(enemyDmg * 1.25);
        } else if (waveNum <= 2) {
          kind = 'green_slime';
        } else if (waveNum <= 4) {
          kind = i % 2 === 0 ? 'green_slime' : 'blue_slime';
        } else if (waveNum <= 7) {
          kind = i % 3 === 0 ? 'green_slime' : i % 3 === 1 ? 'blue_slime' : 'yellow_slime';
        } else {
          kind = i % 3 === 0 ? 'purple_slime' : i % 3 === 1 ? 'yellow_slime' : 'blue_slime';
        }

        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const dist = 280 + Math.random() * 160;
        const spawnX = Math.max(48, Math.min(this.map.widthPx - 48, this.player.x + Math.cos(angle) * dist));
        const spawnY = Math.max(48, Math.min(this.map.heightPx - 48, this.player.y + Math.sin(angle) * dist));

        const enemy = this.createActor(`${kind}_${waveNum}_${i}`, kind, false, spawnX, spawnY, {
          kind: 'elvish',
          title,
          role,
          maxHp: hp,
          maxStamina: 100,
          moveSpeed: spd,
          skillName: spawnOrc ? 'Javelin Throw' : 'Slime Tackle',
          skillDesc: '',
          skillCooldown: 5
        });
        enemy.attackDamage = dmg;
        this.enemies.push(enemy);
      }

      this.events.push({ type: 'waveStart', wave: waveNum, isBossWave: false });
    } else {
      // BOSS WAVE (Every 5 rounds): Two-Phase Boss (Phase 1: Abyssal Jelly -> Phase 2: Floating Eldritch Organism)
      this.waveState = 'boss_wave';
      const bossTier = Math.max(1, Math.floor(waveNum / 5));
      const bossHp = Math.round(440 * Math.pow(1.24, bossTier - 1));
      const bossSpeed = Math.min(135, Math.round(84 + bossTier * 7));
      const bossDmg = 22 + Math.round(bossTier * 4);

      const spawnX = Math.max(64, Math.min(this.map.widthPx - 64, this.player.x + 220));
      const spawnY = Math.max(64, Math.min(this.map.heightPx - 64, this.player.y - 120));

      const boss = this.createTwoPhaseBoss(`boss_${waveNum}`, spawnX, spawnY, bossHp, bossSpeed, bossDmg);
      this.enemies.push(boss);
      this.activeBoss = boss;
      const bossName = boss.bossName || 'Abyssal Jelly';

      // Spawn 2 minion bodyguards
      for (let m = 0; m < 2; m++) {
        const minion = this.createActor(`boss_minion_${waveNum}_${m}`, 'green_slime', false, spawnX + (m === 0 ? -40 : 40), spawnY + 40, {
          kind: 'elvish',
          title: 'Slime Minion',
          role: 'Guard',
          maxHp: 45,
          maxStamina: 80,
          moveSpeed: 70,
          skillName: 'Tackle',
          skillDesc: '',
          skillCooldown: 5
        });
        minion.attackDamage = 10;
        this.enemies.push(minion);
      }

      this.waveTotalEnemies = this.enemies.length;
      this.events.push({ type: 'waveStart', wave: waveNum, isBossWave: true });
      this.events.push({ type: 'bossSpawned', bossName });
    }
  }

  private createActor(
    id: string,
    kind: CharacterKind | EnemyKind,
    isPlayer: boolean,
    x: number,
    y: number,
    profile: HeroProfile
  ): SimActor {
    return {
      id,
      kind,
      isPlayer,
      x,
      y,
      homeX: x,
      homeY: y,
      vx: 0,
      vy: 0,
      moveSpeed: profile.moveSpeed,
      facing: 'S',
      action: 'idle',
      actionElapsed: 0,
      actionDuration: 0,
      actionHitTriggered: false,
      skillTargetsHit: new Set(),
      comboQueued: false,
      hp: profile.maxHp,
      maxHp: profile.maxHp,
      stamina: profile.maxStamina,
      maxStamina: profile.maxStamina,
      staminaRegenDelay: 0,
      mp: profile.maxMp ?? 100,
      maxMp: profile.maxMp ?? 100,
      level: 1,
      exp: 0,
      maxExp: 40,
      statPoints: 0,
      allocatedHp: 0,
      allocatedStamina: 0,
      allocatedMp: 0,
      invulnTimer: 0,
      attackCooldown: 0,
      dashCooldown: 0,
      dashMaxCooldown: DASH_COOLDOWN_SEC,
      skillCooldown: 0,
      skillMaxCooldown: profile.skillCooldown,
      skillName: profile.skillName,
      guardCooldown: 0,
      guardMaxCooldown: 2.0,
      ultimateCooldown: 0,
      ultimateMaxCooldown: profile.ultimateMaxCooldown ?? 15.0,
      ultimateName: profile.ultimateName ?? 'Ultimate',
      throwCooldown: 0,
      throwMaxCooldown: profile.throwMaxCooldown ?? 5.0,
      throwName: profile.throwName ?? 'Throw',
      buffActive: undefined,
      buffTimer: 0,
      barrierShield: 0,
      rage: 0,
      maxRage: 100,
      flameStanceTimer: 0,
      burnTimer: 0,
      burnDamage: 0,
      burnTickElapsed: 0,
      respawnTimer: 0,
      aiPatrolAngle: Math.random() * Math.PI * 2,
      aiPatrolTimer: 1.5,
      aggroed: false
    };
  }

  public setPlayerCharacter(kind: CharacterKind): void {
    const profile = HERO_PROFILES[kind];
    const p = this.player;
    p.kind = kind;
    p.moveSpeed = profile.moveSpeed;
    p.maxHp = profile.maxHp + p.allocatedHp * 25;
    p.hp = p.maxHp;
    p.maxStamina = profile.maxStamina + p.allocatedStamina * 20;
    p.stamina = p.maxStamina;
    p.maxMp = (profile.maxMp ?? 100) + p.allocatedMp * 25;
    p.mp = p.maxMp;
    p.skillName = profile.skillName;
    p.skillMaxCooldown = profile.skillCooldown;
    p.skillCooldown = 0;
    p.ultimateName = profile.ultimateName || 'Ultimate';
    p.ultimateMaxCooldown = profile.ultimateMaxCooldown || 15.0;
    p.ultimateCooldown = 0;
    p.throwName = profile.throwName || 'Throw';
    p.throwMaxCooldown = profile.throwMaxCooldown || 5.0;
    p.throwCooldown = 0;
    p.guardCooldown = 0;
    p.barrierShield = 0;
    p.buffActive = undefined;
    p.buffTimer = 0;
    p.rage = 0;
    p.maxRage = 100;
    p.flameStanceTimer = 0;
    p.burnTimer = 0;
    p.dashCooldown = 0;
    p.action = 'idle';
    p.actionElapsed = 0;
    p.vx = 0;
    p.vy = 0;
    p.invulnTimer = 0.6;
  }

  public respawnPlayer(): void {
    const p = this.player;
    p.x = this.map.playerSpawn.x;
    p.y = this.map.playerSpawn.y;
    p.vx = 0;
    p.vy = 0;
    p.hp = p.maxHp;
    p.stamina = p.maxStamina;
    p.dashCooldown = 0;
    p.skillCooldown = 0;
    p.action = 'idle';
    p.actionElapsed = 0;
    p.invulnTimer = 2.5;
    p.comboQueued = false;
    this.events.push({ type: 'playerRespawned', x: p.x, y: p.y });
  }

  public addExp(amount: number): void {
    const p = this.player;
    if (p.action === 'dead') return;
    p.exp += amount;
    while (p.exp >= p.maxExp) {
      p.exp -= p.maxExp;
      p.level += 1;
      p.statPoints += 1;
      p.maxExp = Math.round(p.maxExp * 1.45);
      p.hp = p.maxHp;
      p.stamina = p.maxStamina;
      p.mp = p.maxMp;
      this.events.push({
        type: 'levelUp',
        level: p.level,
        statPoints: p.statPoints,
        x: p.x,
        y: p.y
      });
    }
  }

  public upgradeStat(stat: 'hp' | 'stamina' | 'mp'): boolean {
    const p = this.player;
    if (p.statPoints <= 0) return false;
    p.statPoints -= 1;
    if (stat === 'hp') {
      p.allocatedHp += 1;
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 25);
    } else if (stat === 'stamina') {
      p.allocatedStamina += 1;
      p.maxStamina += 20;
      p.stamina = Math.min(p.maxStamina, p.stamina + 20);
    } else if (stat === 'mp') {
      p.allocatedMp += 1;
      p.maxMp += 25;
      p.mp = Math.min(p.maxMp, p.mp + 25);
    }
    this.events.push({
      type: 'statUpgraded',
      stat,
      newMax: stat === 'hp' ? p.maxHp : stat === 'stamina' ? p.maxStamina : p.maxMp
    });
    return true;
  }

  public step(dt: number, input: PlayerInput): WorldSnapshot {
    this.tick += 1;
    this.events = [];

    if (input.statUpgrade) {
      this.upgradeStat(input.statUpgrade);
    }

    this.updatePlayer(dt, input);
    for (const enemy of this.enemies) {
      this.updateEnemy(dt, enemy);
    }
    this.updateProjectiles(dt);
    this.updateWorldObjects(dt);

    // Wave Progression Check
    if (this.waveMode && this.player.action !== 'dead') {
      const aliveEnemies = this.enemies.filter((e) => e.action !== 'dead').length;
      if (aliveEnemies === 0) {
        if (this.waveState === 'active' || this.waveState === 'boss_wave') {
          this.waveState = 'cleared';
          this.waveCountdown = 3.5;
          this.events.push({ type: 'waveCleared', wave: this.currentWave });
          this.healPlayer(35);
          this.addExp(this.currentWave * 25);
        } else if (this.waveState === 'cleared') {
          this.waveCountdown -= dt;
          if (this.waveCountdown <= 0) {
            this.startWave(this.currentWave + 1);
          }
        }
      }
    }

    if (this.portalDebounceTimer > 0) this.portalDebounceTimer -= dt;
    this.prevBowHeld = input.bowHeld;
    return this.getSnapshot();
  }

  private updatePlayer(dt: number, input: PlayerInput): void {
    const p = this.player;
    this.tickTimers(p, dt);

    if (p.action === 'dead') {
      this.applyVelocityWithCollision(p, dt);
      return;
    }

    // Mana & Stamina regeneration
    const mpRegen = 8 + p.allocatedMp * 1.5;
    p.mp = Math.min(p.maxMp, p.mp + mpRegen * dt);

    const regenRate = (p.buffActive === 'zephyr' ? 55 : 28) + p.allocatedStamina * 2;
    if (p.staminaRegenDelay > 0) {
      p.staminaRegenDelay = Math.max(0, p.staminaRegenDelay - dt);
    } else if (p.action !== 'dash' && p.action !== 'roll' && p.action !== 'guard') {
      p.stamina = Math.min(p.maxStamina, p.stamina + regenRate * dt);
    }

    // Movement speed (boosted by Zephyr shrine buff)
    const profile = HERO_PROFILES[p.kind as CharacterKind] || HERO_PROFILES.crimson;
    p.moveSpeed = profile.moveSpeed * (p.buffActive === 'zephyr' ? 1.35 : 1.0);

    const move = normalizeVector(input.moveX, input.moveY);
    const isMoving = Math.abs(move.x) > 0.01 || Math.abs(move.y) > 0.01;

    // Ultimate Skill [R] can CANCEL basic attacks or guard immediately!
    if (input.ultimatePressed && p.ultimateCooldown <= 0) {
      const dir = input.aimDir ?? (isMoving ? vectorToDirection8(move.x, move.y, p.facing) : p.facing);
      this.startUltimate(p, dir);
      return;
    }

    if (p.action === 'guard') {
      p.actionElapsed += dt;
      if (!input.guardHeld || p.stamina <= 0) {
        p.action = 'idle';
        p.actionElapsed = 0;
        p.vx = 0;
        p.vy = 0;
      } else {
        p.stamina = Math.max(0, p.stamina - 12 * dt);
        p.staminaRegenDelay = 0.8;
        if (input.aimDir) {
          p.facing = input.aimDir;
        } else if (isMoving) {
          p.facing = vectorToDirection8(move.x, move.y, p.facing);
        }
        p.vx = move.x * (p.moveSpeed * 0.35);
        p.vy = move.y * (p.moveSpeed * 0.35);
        this.applyVelocityWithCollision(p, dt);
      }
      return;
    }

    if (p.action === 'throw') {
      p.actionElapsed += dt;
      p.vx *= Math.pow(0.06, dt);
      p.vy *= Math.pow(0.06, dt);
      this.applyVelocityWithCollision(p, dt);

      if (!p.actionHitTriggered && p.actionElapsed >= 0.12) {
        p.actionHitTriggered = true;
        this.executeThrow(p);
      }

      if (p.actionElapsed >= p.actionDuration) {
        p.action = 'idle';
        p.actionElapsed = 0;
        p.vx = 0;
        p.vy = 0;
      }
      return;
    }

    if (p.action === 'hit' || p.action === 'dash' || p.action === 'roll' || p.action === 'bowRelease') {
      p.actionElapsed += dt;
      if (p.action === 'hit') {
        p.vx *= Math.pow(0.08, dt);
        p.vy *= Math.pow(0.08, dt);
      } else if (p.action === 'bowRelease') {
        p.vx = 0;
        p.vy = 0;
      }
      this.applyVelocityWithCollision(p, dt);
      if (p.actionElapsed >= p.actionDuration) {
        p.action = 'idle';
        p.actionElapsed = 0;
        p.vx = 0;
        p.vy = 0;
      }
      return;
    }

    if (p.action === 'skill') {
      this.updatePlayerSkill(p, dt);
      return;
    }

    if (p.action === 'slash1' || p.action === 'slash2') {
      p.actionElapsed += dt;
      p.vx *= Math.pow(0.05, dt);
      p.vy *= Math.pow(0.05, dt);
      this.applyVelocityWithCollision(p, dt);

      if (p.action === 'slash1' && input.attackPressed && p.actionElapsed > 0.08) {
        p.comboQueued = true;
      }

      if (!p.actionHitTriggered && p.actionElapsed >= 0.09) {
        p.actionHitTriggered = true;
        const baseDmg = p.kind === 'legacy' ? 30 : p.kind === 'elvish' ? 22 : 25;
        const mightBonus = p.buffActive === 'might' ? 14 : 0;
        const damage = (p.action === 'slash1' ? baseDmg : baseDmg + 10) + mightBonus;
        const knockback = p.action === 'slash1' ? 170 : 240;
        this.performMeleeStrike(p, p.kind === 'legacy' ? 56 : 52, damage, knockback);
      }

      if (p.actionElapsed >= p.actionDuration) {
        if (p.action === 'slash1' && p.comboQueued) {
          this.startSlash(p, 'slash2', input.aimDir ?? (isMoving ? vectorToDirection8(move.x, move.y, p.facing) : p.facing));
        } else {
          p.action = 'idle';
          p.actionElapsed = 0;
          p.comboQueued = false;
        }
      }
      return;
    }

    if (p.action === 'bowPull') {
      p.actionElapsed += dt;
      // Movement is completely locked during firing/charging!
      p.vx = 0;
      p.vy = 0;
      if (input.aimDir) {
        p.facing = input.aimDir;
      } else if (isMoving) {
        p.facing = vectorToDirection8(move.x, move.y, p.facing);
      }

      const isElvish = p.kind === 'elvish';
      const fullChargeTime = isElvish ? 0.60 : 0.85;
      const perfectEnd = isElvish ? 0.85 : 1.10;
      const hold = p.actionElapsed;

      // Overdraw stamina drain past 1.6s
      if (hold > 1.6) {
        p.stamina = Math.max(0, p.stamina - 24 * dt);
      }

      const exhausted = (hold > 1.6 && p.stamina <= 0) || hold >= 2.5;

      if (!input.bowHeld || exhausted) {
        p.action = 'bowRelease';
        p.actionElapsed = 0;
        p.actionDuration = 0.22;
        p.vx = 0;
        p.vy = 0;

        const mightBonus = p.buffActive === 'might' ? 14 : 0;
        const dirVec = DIRECTION_VECTORS[p.facing];
        const angle = Math.atan2(dirVec.y, dirVec.x);

        if (exhausted) {
          this.events.push({ type: 'bowFatigued', x: p.x, y: p.y });
          this.fireArrowCustom(p, 14 + mightBonus, angle, 320, 0.6, 0, false, false);
        } else if (hold < 0.35) {
          this.fireArrowCustom(p, 12 + mightBonus, angle, 360, 0.65, 0, false, false);
        } else if (hold < fullChargeTime) {
          this.fireArrowCustom(p, 26 + (isElvish ? 6 : 0) + mightBonus, angle, 440, 1.2, 0, false, false);
        } else if (hold <= perfectEnd) {
          this.events.push({ type: 'bowPerfect', x: p.x, y: p.y });
          if (isElvish) {
            p.buffActive = 'sylph';
            p.buffTimer = 1.2;
          }
          this.fireArrowCustom(p, 65 + (isElvish ? 10 : 0) + mightBonus, angle, 560, 1.5, 999, false, true);
        } else {
          this.fireArrowCustom(p, 46 + (isElvish ? 8 : 0) + mightBonus, angle, 480, 1.4, 3, false, false);
        }
      }
      return;
    }

    // Free state actions

    // 1. Guard / Parry [Q]
    if (input.guardHeld && p.guardCooldown <= 0 && p.stamina >= 8) {
      if (p.kind === 'elvish') {
        // Elvish Ranger: Wind Step (Evasive back-step with wind pulse)
        p.guardCooldown = 3.0;
        const bVec = DIRECTION_VECTORS[p.facing];
        this.startEvade(p, 'dash', { x: -bVec.x, y: -bVec.y });
        this.events.push({ type: 'skill', actorId: p.id, x: p.x, y: p.y, skill: 'Wind Step' });
        for (const e of this.enemies) {
          if (e.action !== 'dead' && Math.hypot(e.x - p.x, e.y - p.y) <= 75) {
            this.applyDamage(e, 18, e.x - p.x, e.y - p.y, 220, false);
          }
        }
        return;
      } else {
        // Crimson Red & Legacy Knight: Sturdy Weapon/Shield Guard
        p.action = 'guard';
        p.actionElapsed = 0;
        p.actionDuration = 999;
        if (input.aimDir) p.facing = input.aimDir;
        p.vx = 0;
        p.vy = 0;
        return;
      }
    }

    // 2. Ultimate Skill [R]
    if (input.ultimatePressed && p.ultimateCooldown <= 0) {
      const dir = input.aimDir ?? (isMoving ? vectorToDirection8(move.x, move.y, p.facing) : p.facing);
      this.startUltimate(p, dir);
      return;
    }

    // 3. Tactical Throw [F]
    if (input.throwPressed && p.throwCooldown <= 0) {
      const dir = input.aimDir ?? (isMoving ? vectorToDirection8(move.x, move.y, p.facing) : p.facing);
      this.startThrow(p, dir);
      return;
    }

    // 4. Core Skill [E]
    if (input.skillPressed && p.skillCooldown <= 0) {
      const dir = input.aimDir ?? (isMoving ? vectorToDirection8(move.x, move.y, p.facing) : p.facing);
      this.startPlayerSkill(p, dir);
      return;
    }

    // 5. Roll [Space]
    if (input.rollPressed && p.stamina >= 28) {
      this.startEvade(p, 'roll', isMoving ? move : DIRECTION_VECTORS[p.facing]);
      return;
    }

    // 6. Dash [Shift]
    if (input.dashPressed && p.dashCooldown <= 0 && p.stamina >= 22) {
      this.startEvade(p, 'dash', isMoving ? move : DIRECTION_VECTORS[p.facing]);
      return;
    }

    // 7. Melee Slash [J / LMB]
    if (input.attackPressed) {
      const dir = input.aimDir ?? (isMoving ? vectorToDirection8(move.x, move.y, p.facing) : p.facing);
      this.startSlash(p, 'slash1', dir);
      return;
    }

    // 8. Bow Pull [K / RMB]
    if (input.bowHeld && !this.prevBowHeld) {
      if (p.stamina < 12) {
        this.events.push({ type: 'noStamina', x: p.x, y: p.y, needed: 12 });
        return;
      }
      p.stamina -= 12;
      p.action = 'bowPull';
      p.actionElapsed = 0;
      p.actionDuration = 2.5;
      p.vx = 0;
      p.vy = 0;
      if (input.aimDir) {
        p.facing = input.aimDir;
      } else if (isMoving) {
        p.facing = vectorToDirection8(move.x, move.y, p.facing);
      }
      return;
    }

    // Locomotion (with Venom / Void Slow debuff multiplier)
    const slowMult = (p.slowTimer ?? 0) > 0 ? 0.65 : 1.0;
    if (isMoving) {
      p.facing = vectorToDirection8(move.x, move.y, p.facing);
      p.action = 'walk';
      p.vx = move.x * p.moveSpeed * slowMult;
      p.vy = move.y * p.moveSpeed * slowMult;
    } else {
      p.action = 'idle';
      p.vx = 0;
      p.vy = 0;
    }
    p.actionElapsed += dt;
    // Check portal / doorway transport
    if (this.portalDebounceTimer <= 0 && this.map.portals) {
      for (const portal of this.map.portals) {
        // Skip arrival spots with no outbound destination
        const hasDest = Boolean(
          portal.outName ||
          portal.targetMapId ||
          (portal.targetX !== undefined && (portal.targetX !== portal.x || portal.targetY !== portal.y))
        );
        if (!hasDest) continue;

        const halfW = portal.width && portal.width > 0 ? portal.width / 2 : 18;
        const halfH = portal.height && portal.height > 0 ? portal.height / 2 : 18;
        const triggerMargin = 8;
        const insideBox =
          Math.abs(p.x - portal.x) <= halfW + triggerMargin &&
          Math.abs(p.y - portal.y) <= halfH + triggerMargin;
        const insideRadius =
          Math.hypot(p.x - portal.x, p.y - portal.y) <= Math.max(34, Math.max(halfW, halfH) + 6);

        if (insideBox || insideRadius) {
          this.portalDebounceTimer = 2.2;
          this.events.push({
            type: 'portalTransport',
            portalId: portal.id,
            x: p.x,
            y: p.y,
            targetMapId: portal.targetMapId || portal.targetMapName,
            targetX: portal.targetX,
            targetY: portal.targetY,
            label: portal.label || portal.outName || portal.targetMapName || 'Doorway',
            connectorTag: portal.connectorTag
          });
          break;
        }
      }
    }
    this.applyVelocityWithCollision(p, dt);
  }

  public teleportPlayer(x: number, y: number): void {
    this.player.x = x;
    this.player.y = y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.portalDebounceTimer = 2.0;
  }

  public damagePlayer(amount: number): void {
    if (this.player.action === 'dead') return;
    this.player.hp = Math.max(0, this.player.hp - amount);
    if (this.player.hp <= 0) {
      this.player.action = 'dead';
      this.events.push({ type: 'actorDefeated', actorId: 'player', x: this.player.x, y: this.player.y });
    }
  }

  public healPlayer(amount: number): void {
    if (this.player.action === 'dead') return;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + amount);
  }

  private startPlayerSkill(p: SimActor, dir: Direction8): void {
    if (p.mp < 20) {
      this.events.push({ type: 'noMp', x: p.x, y: p.y, needed: 20 });
      return;
    }
    p.mp -= 20;
    p.facing = dir;
    p.action = 'skill';
    p.actionElapsed = 0;
    p.actionHitTriggered = false;
    p.skillTargetsHit.clear();
    p.skillCooldown = p.skillMaxCooldown;

    const fVec = DIRECTION_VECTORS[dir];

    if (p.kind === 'crimson') {
      // Crimson Thrust: blazing forward dash stab
      p.actionDuration = 0.42;
      p.invulnTimer = 0.40;
      p.vx = fVec.x * 410;
      p.vy = fVec.y * 410;
    } else if (p.kind === 'elvish') {
      // Radiant Arrow Volley
      p.actionDuration = 0.44;
      p.vx = -fVec.x * 50;
      p.vy = -fVec.y * 50;
    } else {
      // Legacy Knight: Whirlwind Cleave
      p.actionDuration = 0.44;
      p.invulnTimer = 0.30;
      p.vx = fVec.x * 75;
      p.vy = fVec.y * 75;
    }

    this.events.push({ type: 'skill', actorId: p.id, x: p.x, y: p.y, skill: p.skillName });
  }

  private updatePlayerSkill(p: SimActor, dt: number): void {
    p.actionElapsed += dt;

    if (p.kind === 'crimson') {
      // Pierce enemies continuously during the active thrust window (0.10s .. 0.32s)
      if (p.actionElapsed >= 0.30) {
        p.vx *= Math.pow(0.05, dt);
        p.vy *= Math.pow(0.05, dt);
      }
      this.applyVelocityWithCollision(p, dt);

      if (p.actionElapsed >= 0.08 && p.actionElapsed <= 0.32) {
        for (const target of this.enemies) {
          if (target.action === 'dead' || p.skillTargetsHit.has(target.id)) continue;
          const dist = Math.hypot(target.x - p.x, target.y - p.y);
          if (dist <= 46) {
            p.skillTargetsHit.add(target.id);
            const fVec = DIRECTION_VECTORS[p.facing];
            let effectiveDmg = 48;
            if (p.flameStanceTimer > 0) {
              effectiveDmg += 16;
              target.burnTimer = 3.5;
              target.burnDamage = 7;
              target.burnTickElapsed = 0;
              const prevRage = p.rage;
              p.rage = Math.min(p.maxRage, p.rage + 25);
              if (prevRage < p.maxRage && p.rage >= p.maxRage) {
                this.events.push({ type: 'recastReady', actorId: p.id });
              }
            }
            this.applyDamage(target, effectiveDmg, fVec.x, fVec.y, 260, true);
          }
        }
      }
    } else if (p.kind === 'elvish') {
      p.vx *= Math.pow(0.05, dt);
      p.vy *= Math.pow(0.05, dt);
      this.applyVelocityWithCollision(p, dt);

      if (!p.actionHitTriggered && p.actionElapsed >= 0.22) {
        p.actionHitTriggered = true;
        const baseVec = DIRECTION_VECTORS[p.facing];
        const baseAngle = Math.atan2(baseVec.y, baseVec.x);
        const spreads = [-0.26, 0, 0.26];
        for (const offset of spreads) {
          this.fireArrowAngle(p, 30, baseAngle + offset, true);
        }
      }
    } else {
      // Legacy Whirlwind: 360 degree cleave
      p.vx *= Math.pow(0.08, dt);
      p.vy *= Math.pow(0.08, dt);
      this.applyVelocityWithCollision(p, dt);

      if (!p.actionHitTriggered && p.actionElapsed >= 0.16) {
        p.actionHitTriggered = true;
        for (const target of this.enemies) {
          if (target.action === 'dead') continue;
          const dx = target.x - p.x;
          const dy = target.y - p.y;
          if (Math.hypot(dx, dy) <= 72) {
            this.applyDamage(target, 55, dx, dy, 300, true);
          }
        }
      }
    }

    if (p.actionElapsed >= p.actionDuration) {
      p.action = 'idle';
      p.actionElapsed = 0;
      p.vx = 0;
      p.vy = 0;
    }
  }

  private startUltimate(p: SimActor, dir: Direction8): void {
    // 1. Crimson Flame Recast (Red Flame Dragon Burst): requires no MP, consumes 100 Rage
    if (p.kind === 'crimson' && p.flameStanceTimer > 0) {
      if (p.rage >= 100) {
        p.flameStanceTimer = 0;
        p.rage = 0;
        p.ultimateCooldown = p.ultimateMaxCooldown;
        p.facing = dir;
        p.action = 'skill';
        p.actionElapsed = 0;
        p.actionDuration = 0.65;
        p.actionHitTriggered = false;
        p.skillTargetsHit.clear();
        p.vx = 0;
        p.vy = 0;

        this.events.push({
          type: 'redFlameRecast',
          actorId: p.id,
          x: p.x,
          y: p.y
        });
        this.events.push({
          type: 'skill',
          actorId: p.id,
          x: p.x,
          y: p.y,
          skill: 'Red Flame: Dragon Burst'
        });

        // 360-degree colossal whirlwind flame blast
        for (const e of this.enemies) {
          if (e.action === 'dead') continue;
          const dist = Math.hypot(e.x - p.x, e.y - p.y);
          if (dist <= 110) {
            this.applyDamage(e, 100, e.x - p.x, e.y - p.y, 320, true);
            e.burnTimer = 4.0;
            e.burnDamage = 8;
            e.burnTickElapsed = 0;
          }
        }
        return;
      } else {
        this.events.push({ type: 'rageNotReady', x: p.x, y: p.y, rage: p.rage });
        return;
      }
    }

    // Initial cast requires 35 MP
    if (p.mp < 35) {
      this.events.push({ type: 'noMp', x: p.x, y: p.y, needed: 35 });
      return;
    }
    p.mp -= 35;
    p.facing = dir;
    p.action = 'skill';
    p.actionElapsed = 0;
    p.actionDuration = 0.65;
    p.actionHitTriggered = false;
    p.skillTargetsHit.clear();
    p.vx = 0;
    p.vy = 0;

    const dirVec = DIRECTION_VECTORS[dir];
    const baseAngle = Math.atan2(dirVec.y, dirVec.x);

    this.events.push({
      type: 'ultimateVfx',
      hero: p.kind as CharacterKind,
      x: p.x,
      y: p.y,
      dir: p.facing
    });

    if (p.kind === 'crimson') {
      // Crimson Ignition: Enters Flame Stance for 12.0s, enabling fire-infused sword attacks & rage building
      p.flameStanceTimer = 12.0;
      p.rage = 0;
      p.maxRage = 100;
      p.ultimateCooldown = 0; // Remains active to recast when 100 Rage is reached!
      this.events.push({ type: 'flameStanceActivated', actorId: p.id, duration: 12.0 });
      this.events.push({ type: 'skill', actorId: p.id, x: p.x, y: p.y, skill: 'Crimson Ignition (Flame Stance)' });

      for (const e of this.enemies) {
        if (e.action === 'dead') continue;
        const dist = Math.hypot(e.x - p.x, e.y - p.y);
        const dot = (e.x - p.x) * dirVec.x + (e.y - p.y) * dirVec.y;
        if (dist <= 95 && dot > 0) {
          this.applyDamage(e, 55, e.x - p.x, e.y - p.y, 300, true);
          e.burnTimer = 3.5;
          e.burnDamage = 6;
          e.burnTickElapsed = 0;
        }
      }
      const spreads = [-0.3, 0, 0.3];
      for (const off of spreads) {
        this.fireArrowAngle(p, 45, baseAngle + off, true);
      }
    } else if (p.kind === 'legacy') {
      p.ultimateCooldown = p.ultimateMaxCooldown;
      this.events.push({ type: 'skill', actorId: p.id, x: p.x, y: p.y, skill: 'Iron Fortress' });
      p.barrierShield = 75;
      for (const e of this.enemies) {
        if (e.action === 'dead') continue;
        const dist = Math.hypot(e.x - p.x, e.y - p.y);
        if (dist <= 120) {
          this.applyDamage(e, 75, e.x - p.x, e.y - p.y, 350, true);
        }
      }
    } else {
      p.ultimateCooldown = p.ultimateMaxCooldown;
      this.events.push({ type: 'skill', actorId: p.id, x: p.x, y: p.y, skill: 'Sunlight Barrage' });
      const spreads = [-0.52, -0.35, -0.17, 0, 0.17, 0.35, 0.52];
      for (const off of spreads) {
        this.fireArrowAngle(p, 36, baseAngle + off, true);
      }
    }
  }

  private startThrow(p: SimActor, dir: Direction8): void {
    if (p.mp < 15) {
      this.events.push({ type: 'noMp', x: p.x, y: p.y, needed: 15 });
      return;
    }
    p.mp -= 15;
    p.facing = dir;
    p.throwCooldown = p.throwMaxCooldown;
    p.action = 'throw';
    p.actionElapsed = 0;
    p.actionDuration = 0.38;
    p.actionHitTriggered = false;
    p.vx = 0;
    p.vy = 0;
  }

  private executeThrow(p: SimActor): void {
    const dirVec = DIRECTION_VECTORS[p.facing];
    const baseAngle = Math.atan2(dirVec.y, dirVec.x);

    if (p.kind === 'crimson') {
      // Kunai Fan: 3 throwing knives with spread
      this.events.push({ type: 'skill', actorId: p.id, x: p.x, y: p.y, skill: 'Kunai Fan' });
      const spreads = [-0.22, 0, 0.22];
      for (const off of spreads) {
        this.fireArrowAngle(p, 24, baseAngle + off, false);
      }
    } else if (p.kind === 'legacy') {
      // Fuse Bomb: Thrown explosive grenade dealing 50 AoE damage
      this.events.push({ type: 'skill', actorId: p.id, x: p.x, y: p.y, skill: 'Fuse Bomb' });
      const targetX = p.x + dirVec.x * 90;
      const targetY = p.y + dirVec.y * 90;
      setTimeout(() => {
        this.events.push({ type: 'barrelExploded', x: targetX, y: targetY });
        for (const e of this.enemies) {
          if (e.action === 'dead') continue;
          if (Math.hypot(e.x - targetX, e.y - targetY) <= 70) {
            this.applyDamage(e, 50, e.x - targetX, e.y - targetY, 260, true);
          }
        }
        for (const obj of this.worldObjects) {
          if (obj.active && Math.hypot(obj.x - targetX, obj.y - targetY) <= 70) {
            if (obj.type === 'barrel') this.detonateBarrel(obj);
          }
        }
      }, 350);
    } else {
      // Elvish Hail of Arrows: 5-arrow fan spread
      this.events.push({ type: 'skill', actorId: p.id, x: p.x, y: p.y, skill: 'Hail of Arrows' });
      const spreads = [-0.36, -0.18, 0, 0.18, 0.36];
      for (const off of spreads) {
        this.fireArrowAngle(p, 24, baseAngle + off, false);
      }
    }
  }

  public detonateBarrel(barrel: SimWorldObject): void {
    if (!barrel.active) return;
    barrel.active = false;
    barrel.hp = 0;
    this.events.push({ type: 'barrelExploded', x: barrel.x, y: barrel.y });

    const blastRadius = 85;
    const blastDamage = 60;

    // Damage player if in range
    if (this.player.action !== 'dead') {
      const pDist = Math.hypot(this.player.x - barrel.x, this.player.y - barrel.y);
      if (pDist <= blastRadius) {
        this.applyDamage(this.player, blastDamage, this.player.x - barrel.x, this.player.y - barrel.y, 280, true);
      }
    }

    // Damage enemies in range
    for (const e of this.enemies) {
      if (e.action === 'dead') continue;
      const eDist = Math.hypot(e.x - barrel.x, e.y - barrel.y);
      if (eDist <= blastRadius) {
        this.applyDamage(e, blastDamage, e.x - barrel.x, e.y - barrel.y, 260, true);
      }
    }

    // Chain reaction with nearby barrels
    for (const other of this.worldObjects) {
      if (other.id !== barrel.id && other.type === 'barrel' && other.active) {
        const oDist = Math.hypot(other.x - barrel.x, other.y - barrel.y);
        if (oDist <= blastRadius) {
          setTimeout(() => this.detonateBarrel(other), 120);
        }
      }
    }
  }

  private updateWorldObjects(dt: number): void {
    const p = this.player;
    if (p.action === 'dead') return;

    for (const obj of this.worldObjects) {
      if (obj.type === 'shrine' && !obj.active) {
        obj.cooldown = (obj.cooldown ?? 45) - dt;
        if (obj.cooldown <= 0) {
          obj.active = true;
          obj.cooldown = undefined;
        }
      }

      if (obj.type === 'campfire' && obj.active) {
        const dist = Math.hypot(p.x - obj.x, p.y - obj.y);
        if (dist <= 48) {
          if (p.hp < p.maxHp) {
            p.hp = Math.min(p.maxHp, p.hp + 15 * dt);
          }
          if (p.stamina < p.maxStamina) {
            p.stamina = Math.min(p.maxStamina, p.stamina + 35 * dt);
          }
        }
      }

      if (obj.type === 'shrine' && obj.active) {
        const dist = Math.hypot(p.x - obj.x, p.y - obj.y);
        if (dist <= 30) {
          obj.active = false;
          obj.cooldown = 45;
          if (obj.id.includes('zephyr')) {
            p.buffActive = 'zephyr';
            p.buffTimer = 20;
            this.events.push({
              type: 'shrineActivated',
              shrineType: 'zephyr',
              x: obj.x,
              y: obj.y,
              label: 'Blessing of Zephyr: +35% Speed!'
            });
          } else {
            p.buffActive = 'might';
            p.buffTimer = 20;
            this.events.push({
              type: 'shrineActivated',
              shrineType: 'might',
              x: obj.x,
              y: obj.y,
              label: 'Blessing of Might: +14 DMG!'
            });
          }
        }
      }
    }

    // Bramble slow effect
    let inBramble = false;
    for (const obj of this.worldObjects) {
      if (obj.type === 'bramble' && obj.active) {
        if (Math.hypot(p.x - obj.x, p.y - obj.y) <= 24) {
          inBramble = true;
          break;
        }
      }
    }
    if (inBramble) {
      p.vx *= 0.6;
      p.vy *= 0.6;
    }
  }

  private startEvade(actor: SimActor, kind: 'dash' | 'roll', vec: { x: number; y: number }): void {
    const cost = kind === 'dash' ? 22 : 28;
    actor.stamina = Math.max(0, actor.stamina - cost);
    actor.staminaRegenDelay = 0.45;
    if (kind === 'dash') {
      actor.dashCooldown = actor.dashMaxCooldown;
    }
    actor.action = kind;
    actor.actionElapsed = 0;
    actor.actionDuration = kind === 'dash' ? 0.20 : 0.42;
    actor.invulnTimer = kind === 'dash' ? 0.22 : 0.40;
    actor.facing = vectorToDirection8(vec.x, vec.y, actor.facing);
    const speed = kind === 'dash' ? PLAYER_DASH_SPEED : PLAYER_ROLL_SPEED;
    actor.vx = vec.x * speed;
    actor.vy = vec.y * speed;
    this.events.push({ type: 'dash', actorId: actor.id, x: actor.x, y: actor.y, kind });
  }

  private startSlash(actor: SimActor, kind: 'slash1' | 'slash2', dir: Direction8): void {
    actor.facing = dir;
    actor.action = kind;
    actor.actionElapsed = 0;
    actor.actionDuration = kind === 'slash1' ? 0.28 : 0.34;
    actor.actionHitTriggered = false;
    actor.comboQueued = false;
    const fvec = DIRECTION_VECTORS[dir];
    const lunge = kind === 'slash1' ? 110 : 145;
    actor.vx = fvec.x * lunge;
    actor.vy = fvec.y * lunge;
    this.events.push({
      type: 'slash',
      actorId: actor.id,
      x: actor.x,
      y: actor.y,
      facing: dir,
      combo: kind === 'slash1' ? 1 : 2
    });
  }

  private fireArrowAngle(actor: SimActor, damage: number, angle: number, isSkill: boolean): void {
    const speed = isSkill ? 490 : 430;
    this.fireArrowCustom(actor, damage, angle, speed, 1.4, 0, isSkill, false);
  }

  private fireArrowCustom(
    actor: SimActor,
    damage: number,
    angle: number,
    speed: number,
    life: number,
    pierce: number,
    isSkill: boolean,
    isPerfect: boolean
  ): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    this.projectiles.push({
      id: this.nextProjectileId++,
      ownerId: actor.id,
      x: actor.x + cos * 16,
      y: actor.y - 10 + sin * 16,
      vx: cos * speed,
      vy: sin * speed,
      angle,
      damage,
      life,
      isSkill,
      pierce,
      hitTargets: new Set<string>(),
      isPerfect
    });
    this.events.push({ type: 'bowRelease', actorId: actor.id, x: actor.x, y: actor.y, facing: actor.facing });
  }

  private steerWithAvoidance(actor: SimActor, dirX: number, dirY: number): { x: number; y: number } {
    const probeDist = 26;
    const testX = actor.x + dirX * probeDist;
    const testY = actor.y + dirY * probeDist;
    if (!this.rectCollides(testX - FOOT_HALF_W, testY - FOOT_HALF_H, FOOT_HALF_W * 2, FOOT_HALF_H * 2)) {
      return { x: dirX, y: dirY };
    }

    const baseAngle = Math.atan2(dirY, dirX);
    const whiskerOffsets = [0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.85, -1.85];
    for (const off of whiskerOffsets) {
      const angle = baseAngle + off;
      const wx = Math.cos(angle);
      const wy = Math.sin(angle);
      const px = actor.x + wx * probeDist;
      const py = actor.y + wy * probeDist;
      if (!this.rectCollides(px - FOOT_HALF_W, py - FOOT_HALF_H, FOOT_HALF_W * 2, FOOT_HALF_H * 2)) {
        return { x: wx, y: wy };
      }
    }
    return { x: dirX, y: dirY };
  }

  private computeTacticalMoveDir(e: SimActor, dx: number, dy: number, distToPlayer: number): { x: number; y: number } {
    const baseDir = normalizeVector(dx, dy);
    let tx = baseDir.x;
    let ty = baseDir.y;

    // 1. Pack separation (avoid stacking on allies)
    let sepX = 0;
    let sepY = 0;
    for (const other of this.enemies) {
      if (other.id === e.id || other.action === 'dead') continue;
      const odx = e.x - other.x;
      const ody = e.y - other.y;
      const odist = Math.hypot(odx, ody);
      if (odist > 0.1 && odist < 34) {
        const push = (34 - odist) / 34;
        sepX += (odx / odist) * push * 0.65;
        sepY += (ody / odist) * push * 0.65;
      }
    }
    tx += sepX;
    ty += sepY;

    // 2. Pincer flanking at medium range so enemies surround the player
    const flankSign = e.aiFlankSign || 1;
    if (distToPlayer > 52 && distToPlayer < 175) {
      const perpX = -baseDir.y * flankSign;
      const perpY = baseDir.x * flankSign;
      const flankWeight = e.isBoss ? 0.22 : 0.34;
      tx += perpX * flankWeight;
      ty += perpY * flankWeight;
    }

    // 3. Reactive evasion weaving when player is charging a bow or casting a skill
    const p = this.player;
    if (p.action === 'bowPull' || p.action === 'skill') {
      const weaveSign = Math.sin(this.tick * 0.14 + flankSign) >= 0 ? 1 : -1;
      const perpX = -baseDir.y * weaveSign;
      const perpY = baseDir.x * weaveSign;
      tx += perpX * 0.52;
      ty += perpY * 0.52;
    }

    const norm = normalizeVector(tx, ty);
    return this.steerWithAvoidance(e, norm.x, norm.y);
  }

  private computePredictiveAimAngle(shooter: SimActor, target: SimActor, projSpeed: number): number {
    const dx = target.x - shooter.x;
    const dy = target.y - shooter.y;
    const dist = Math.hypot(dx, dy);
    const leadTime = Math.min(0.45, dist / Math.max(180, projSpeed));
    const predX = target.x + target.vx * leadTime * 0.65;
    const predY = target.y + target.vy * leadTime * 0.65;
    return Math.atan2(predY - shooter.y, predX - shooter.x);
  }

  private alertNearbyAllies(source: SimActor, radius = 150): void {
    for (const ally of this.enemies) {
      if (ally.id === source.id || ally.action === 'dead' || ally.aggroed) continue;
      if (Math.hypot(ally.x - source.x, ally.y - source.y) <= radius) {
        ally.aggroed = true;
      }
    }
  }

  private triggerBossPhaseTransition(boss: SimActor): void {
    boss.bossPhase = 2;
    boss.bossMaxPhases = 2;
    boss.kind = 'floating_eldritch';
    boss.bossName = 'Floating Eldritch Organism';
    boss.maxHp = Math.round(boss.maxHp * 1.35);
    boss.hp = boss.maxHp;
    boss.moveSpeed = Math.round(boss.moveSpeed * 1.18);
    boss.attackDamage = Math.round((boss.attackDamage || 22) * 1.25);
    boss.bossMinionsSpawned = 0;
    boss.burnTimer = 0;
    boss.action = 'transition';
    boss.actionElapsed = 0;
    boss.actionDuration = 1.35;
    boss.invulnTimer = 1.5;
    boss.vx = 0;
    boss.vy = 0;
    boss.bossSkillTimer = 2.2;
    this.activeBoss = boss;

    this.events.push({
      type: 'bossPhaseTransition',
      bossId: boss.id,
      newName: boss.bossName,
      x: boss.x,
      y: boss.y
    });
  }

  private updateEnemy(dt: number, e: SimActor): void {
    this.tickTimers(e, dt);

    if (e.action === 'dead') {
      if (!this.waveMode) {
        if (e.respawnDelay !== undefined && e.respawnDelay <= 0) {
          return; // Respawn disabled (respawn_timer = 0)
        }
        e.respawnTimer -= dt;
        if (e.respawnTimer <= 0) {
          e.x = e.homeX;
          e.y = e.homeY;
          if (e.isBoss && (e.bossMaxPhases ?? 1) >= 2) {
            e.bossPhase = 1;
            e.kind = 'abyssal_jelly';
            e.bossName = 'Abyssal Jelly';
            e.maxHp = 450;
            e.moveSpeed = 88;
            e.attackDamage = 22;
            e.bossMinionsSpawned = 0;
            this.activeBoss = e;
          }
          e.hp = e.maxHp;
          e.action = 'idle';
          e.actionElapsed = 0;
          e.aggroed = false;
          e.vx = 0;
          e.vy = 0;
        }
      }
      return;
    }

    if (e.action === 'dash') {
      e.actionElapsed += dt;
      this.applyVelocityWithCollision(e, dt);

      // Acidic Surge Dash contact strike on player
      const p = this.player;
      if (!e.actionHitTriggered && p.action !== 'dead' && p.invulnTimer <= 0) {
        const dist = Math.hypot(p.x - e.x, p.y - e.y);
        if (dist <= 32) {
          e.actionHitTriggered = true;
          this.applyDamage(p, Math.round((e.attackDamage || 16) * 0.9), p.x - e.x, p.y - e.y, 195, false);
          this.inflictEnemyDebuff(e, p, true);
        }
      }

      if (e.actionElapsed >= e.actionDuration) {
        e.action = 'idle';
        e.actionElapsed = 0;
        e.vx = 0;
        e.vy = 0;
        e.aiKiteTimer = 1.25 + Math.random() * 0.35;
        e.attackCooldown = Math.max(e.attackCooldown, 1.05);
        e.aiFlankSign = Math.random() < 0.5 ? 1 : -1;
      }
      return;
    }

    if (e.action === 'transition') {
      e.actionElapsed += dt;
      e.vx = 0;
      e.vy = 0;
      if (e.actionElapsed >= e.actionDuration) {
        e.action = 'idle';
        e.actionElapsed = 0;
        // Awakening shockwave knocks back nearby player
        const p = this.player;
        const dist = Math.hypot(p.x - e.x, p.y - e.y);
        if (p.action !== 'dead' && dist <= 95) {
          this.applyDamage(p, 14, p.x - e.x, p.y - e.y, 260, false);
        }
      }
      return;
    }

    if (e.action === 'hit') {
      e.actionElapsed += dt;
      e.vx *= Math.pow(0.06, dt);
      e.vy *= Math.pow(0.06, dt);
      this.applyVelocityWithCollision(e, dt);
      if (e.actionElapsed >= e.actionDuration) {
        e.action = 'idle';
        e.actionElapsed = 0;
        e.vx = 0;
        e.vy = 0;
      }
      return;
    }

    if (e.aiKiteTimer && e.aiKiteTimer > 0) {
      e.aiKiteTimer = Math.max(0, e.aiKiteTimer - dt);
    }

    if (e.action === 'skill') {
      e.actionElapsed += dt;
      e.vx *= Math.pow(0.08, dt);
      e.vy *= Math.pow(0.08, dt);
      this.applyVelocityWithCollision(e, dt);
      if (e.actionElapsed >= e.actionDuration) {
        e.action = 'idle';
        e.actionElapsed = 0;
        e.vx = 0;
        e.vy = 0;
        e.aiKiteTimer = 1.45 + Math.random() * 0.35;
        e.attackCooldown = Math.max(e.attackCooldown, 1.35);
        e.aiFlankSign = Math.random() < 0.5 ? 1 : -1;
      }
      return;
    }

    if (e.action === 'slash1' || e.action === 'slash2') {
      e.actionElapsed += dt;
      e.vx *= Math.pow(0.04, dt);
      e.vy *= Math.pow(0.04, dt);
      this.applyVelocityWithCollision(e, dt);

      const hitReach = e.isBoss ? 58 : 46;
      if (e.action === 'slash1' && !e.actionHitTriggered && e.actionElapsed >= 0.22) {
        e.actionHitTriggered = true;
        this.performMeleeStrike(e, hitReach, e.attackDamage || 18, e.isBoss ? 220 : 175);
      }

      if (e.actionElapsed >= e.actionDuration) {
        const wasRanged = e.action === 'slash2';
        e.action = 'idle';
        e.actionElapsed = 0;
        e.attackCooldown = wasRanged ? (1.55 + Math.random() * 0.45) : (e.isBoss ? 1.55 : 1.50 + Math.random() * 0.35);
        e.aiKiteTimer = wasRanged ? 1.15 : (e.isBoss ? 1.50 : 1.35 + Math.random() * 0.35);
        e.aiFlankSign = Math.random() < 0.5 ? 1 : -1;
      }
      return;
    }

    const p = this.player;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const distToPlayer = Math.hypot(dx, dy);
    const effectiveAggroRadius = e.isBoss ? ENEMY_AGGRO_RADIUS * 1.45 : ENEMY_AGGRO_RADIUS;

    if (this.map.isPeaceful || p.action === 'dead') {
      e.aggroed = false;
    } else if (distToPlayer <= effectiveAggroRadius) {
      if (!e.aggroed) {
        e.aggroed = true;
        this.alertNearbyAllies(e, 155);
      }
    } else if (distToPlayer > effectiveAggroRadius * 1.85 && !this.waveMode) {
      e.aggroed = false;
    }

    if (e.aggroed && p.action !== 'dead') {
      const dir = normalizeVector(dx, dy);
      e.facing = vectorToDirection8(dir.x, dir.y, e.facing);
      const flankSign = e.aiFlankSign || 1;

      // Reactive Dodge-Kite: if player swings melee or uses skill nearby, enemies kite away instead of walking into the blade
      if ((p.action === 'slash1' || p.action === 'slash2' || p.action === 'skill') && distToPlayer <= 74 && e.attackCooldown > 0.15) {
        e.aiKiteTimer = Math.max(e.aiKiteTimer || 0, 0.75);
      }

      // Two-Phase Boss & Boss special skills
      if (e.isBoss) {
        const isPhase2 = (e.bossPhase ?? 1) === 2 || e.kind === 'floating_eldritch';
        e.bossSkillTimer = (e.bossSkillTimer ?? 3.2) - dt;
        if (e.bossSkillTimer <= 0 && (e.aiKiteTimer ?? 0) <= 0.35) {
          e.bossSkillTimer = isPhase2 ? 3.2 : 4.0;
          const leadAngle = this.computePredictiveAimAngle(e, p, 520);

          if (isPhase2 && Math.random() < 0.58) {
            // Phase 2 Signature: Void Beam (piercing high-velocity void barrage + beam telegraph)
            e.action = 'slash2';
            e.actionElapsed = 0;
            e.actionDuration = 0.70;
            e.vx = 0;
            e.vy = 0;
            this.events.push({ type: 'bossSkill', bossId: e.id, skill: 'void_beam', x: e.x, y: e.y });
            const beamAngles = [-0.14, -0.05, 0, 0.05, 0.14];
            for (const off of beamAngles) {
              this.fireArrowCustom(e, Math.round((e.attackDamage || 24) * 0.85), leadAngle + off, 540, 1.5, 2, true, true);
            }
            return;
          }

          const skillChoice = Math.random() < 0.48 ? 'slam' : 'spit';
          if (skillChoice === 'slam') {
            e.action = 'skill';
            e.actionElapsed = 0;
            e.actionDuration = 0.55;
            const lungeSpeed = isPhase2 ? 275 : 235;
            e.vx = dir.x * lungeSpeed;
            e.vy = dir.y * lungeSpeed;
            this.events.push({ type: 'bossSkill', bossId: e.id, skill: 'slam', x: e.x, y: e.y });
            setTimeout(() => {
              if (e.action !== 'dead' && e.action !== 'transition' && p.action !== 'dead') {
                const curDist = Math.hypot(p.x - e.x, p.y - e.y);
                if (curDist <= (isPhase2 ? 84 : 74)) {
                  this.applyDamage(p, e.attackDamage || 24, p.x - e.x, p.y - e.y, 240, true);
                }
              }
            }, 340);
            return;
          } else {
            e.action = 'slash2';
            e.actionElapsed = 0;
            e.actionDuration = 0.55;
            const spreads = isPhase2 ? [-0.36, -0.18, 0, 0.18, 0.36] : [-0.26, 0, 0.26];
            for (const off of spreads) {
              this.fireArrowCustom(e, Math.round((e.attackDamage || 20) * 0.78), leadAngle + off, 460, 1.45, isPhase2 ? 1 : 0, true, false);
            }
            this.events.push({ type: 'bossSkill', bossId: e.id, skill: 'spit', x: e.x, y: e.y });
            return;
          }
        }

        const isBossKiting = (e.aiKiteTimer ?? 0) > 0 || e.attackCooldown > 0;

        // Boss close-range tentacle / eldritch strike or mid-range void bolt (only when not kiting)
        if (!isBossKiting && distToPlayer <= 52 && e.attackCooldown <= 0) {
          e.action = 'slash1';
          e.actionElapsed = 0;
          e.actionDuration = 0.48;
          e.actionHitTriggered = false;
          e.attackCooldown = isPhase2 ? 1.45 : 1.65;
          e.vx = dir.x * 95;
          e.vy = dir.y * 95;
          this.events.push({ type: 'slash', actorId: e.id, x: e.x, y: e.y, facing: e.facing, combo: 1 });
          return;
        } else if (!isBossKiting && isPhase2 && distToPlayer >= 95 && distToPlayer <= 250 && e.attackCooldown <= 0) {
          // Floating Eldritch hovers and fires predictive void bolts between melee approaches
          e.action = 'slash2';
          e.actionElapsed = 0;
          e.actionDuration = 0.52;
          e.attackCooldown = 1.45;
          e.vx = 0;
          e.vy = 0;
          const aimAngle = this.computePredictiveAimAngle(e, p, 480);
          this.fireArrowCustom(e, Math.round((e.attackDamage || 22) * 0.8), aimAngle, 480, 1.4, 1, true, false);
          return;
        }

        // Boss Hit-and-Run Kiting: after attacking, backstep + orbit laterally out to 120-165px before re-engaging
        if (isBossKiting) {
          const standoffDist = isPhase2 ? 145 : 118;
          let kx: number;
          let ky: number;
          if (distToPlayer < standoffDist) {
            // Retreat diagonally away from player while keeping eyes on player
            const rawKx = -dir.x * 0.82 - dir.y * flankSign * 0.58;
            const rawKy = -dir.y * 0.82 + dir.x * flankSign * 0.58;
            const normK = normalizeVector(rawKx, rawKy);
            const steered = this.steerWithAvoidance(e, normK.x, normK.y);
            kx = steered.x;
            ky = steered.y;
          } else {
            // Orbit laterally around the player at safe standoff distance
            const steered = this.steerWithAvoidance(e, -dir.y * flankSign, dir.x * flankSign);
            kx = steered.x * 0.85;
            ky = steered.y * 0.85;
          }
          e.action = 'walk';
          e.vx = kx * (e.moveSpeed * 1.05);
          e.vy = ky * (e.moveSpeed * 1.05);
          e.facing = vectorToDirection8(dir.x, dir.y, e.facing);
          e.actionElapsed += dt;
          this.applyVelocityWithCollision(e, dt);
          return;
        }

        const moveDir = this.computeTacticalMoveDir(e, dx, dy, distToPlayer);
        e.action = 'walk';
        e.vx = moveDir.x * e.moveSpeed;
        e.vy = moveDir.y * e.moveSpeed;
        e.facing = vectorToDirection8(dir.x, dir.y, e.facing);
        e.actionElapsed += dt;
        this.applyVelocityWithCollision(e, dt);
        return;
      }

      const isOrc = e.kind === 'hunter_orc' || e.kind === 'orc_warlord';
      if (isOrc) {
        // 0. Hunter Orc Skill: Tactical Backstep Dash + Barbed Javelin Shot when player closes in
        if (distToPlayer <= 78 && e.dashCooldown <= 0) {
          e.action = 'dash';
          e.actionElapsed = 0;
          e.actionDuration = 0.25;
          e.actionHitTriggered = true; // Evasive backstep (not a melee tackle)
          e.dashCooldown = 4.8;
          e.aiKiteTimer = 1.35;
          const rawKx = -dir.x * 0.88 - dir.y * flankSign * 0.45;
          const rawKy = -dir.y * 0.88 + dir.x * flankSign * 0.45;
          const normK = normalizeVector(rawKx, rawKy);
          const retreatDir = this.steerWithAvoidance(e, normK.x, normK.y);
          e.vx = retreatDir.x * 245;
          e.vy = retreatDir.y * 245;
          const leadAngle = this.computePredictiveAimAngle(e, p, 450);
          this.fireArrowAngle(e, Math.round((e.attackDamage || 18) * 0.85), leadAngle, true);
          this.events.push({ type: 'enemyDash', actorId: e.id, skill: 'TACTICAL DASH!', x: e.x, y: e.y });
          return;
        }

        // 1. Emergency point blank defense (cleave & backstep if cornered <= 34px)
        if (distToPlayer <= 34 && e.attackCooldown <= 0) {
          e.action = 'slash1';
          e.actionElapsed = 0;
          e.actionDuration = 0.45;
          e.actionHitTriggered = false;
          e.attackCooldown = 1.45;
          e.aiKiteTimer = 1.35;
          e.vx = -dir.x * 85;
          e.vy = -dir.y * 85;
          this.events.push({ type: 'slash', actorId: e.id, x: e.x, y: e.y, facing: e.facing, combo: 1 });
          return;
        }

        // 2. Predictive target-leading ranged shot (85px to 265px, when not actively retreating from close range)
        if (distToPlayer >= 85 && distToPlayer <= 265 && e.attackCooldown <= 0 && (e.aiKiteTimer ?? 0) <= 0.25) {
          e.action = 'slash2';
          e.actionElapsed = 0;
          e.actionDuration = 0.52;
          e.attackCooldown = e.isBoss ? 1.3 : (1.55 + Math.random() * 0.4);
          e.vx = 0;
          e.vy = 0;
          const leadAngle = this.computePredictiveAimAngle(e, p, 430);
          const aimVariance = (Math.random() - 0.5) * 0.14;
          this.fireArrowAngle(e, Math.round((e.attackDamage || 18) * 0.9), leadAngle + aimVariance, false);
          return;
        }

        // 3. Smart Kiting & Strafe Positioning for Orc Hunter
        if (distToPlayer < 125 || ((e.aiKiteTimer ?? 0) > 0 && distToPlayer < 165)) {
          const rawKx = -dir.x * 0.85 - dir.y * flankSign * 0.52;
          const rawKy = -dir.y * 0.85 + dir.x * flankSign * 0.52;
          const normK = normalizeVector(rawKx, rawKy);
          const retreatDir = this.steerWithAvoidance(e, normK.x, normK.y);
          e.action = 'walk';
          e.vx = retreatDir.x * (e.moveSpeed * 0.98);
          e.vy = retreatDir.y * (e.moveSpeed * 0.98);
          e.facing = vectorToDirection8(dir.x, dir.y, e.facing);
        } else if (distToPlayer > 235) {
          const approachDir = this.computeTacticalMoveDir(e, dx, dy, distToPlayer);
          e.action = 'walk';
          e.vx = approachDir.x * e.moveSpeed;
          e.vy = approachDir.y * e.moveSpeed;
          e.facing = vectorToDirection8(dir.x, dir.y, e.facing);
        } else {
          // In sweet spot: strafe laterally to dodge player arrows while keeping aim
          const strafeDir = this.steerWithAvoidance(e, -dir.y * flankSign, dir.x * flankSign);
          e.action = 'walk';
          e.vx = strafeDir.x * (e.moveSpeed * 0.68);
          e.vy = strafeDir.y * (e.moveSpeed * 0.68);
          e.facing = vectorToDirection8(dir.x, dir.y, e.facing);
        }
        e.actionElapsed += dt;
        this.applyVelocityWithCollision(e, dt);
        return;
      } else {
        // Smart Slime / Melee Enemy: Evasive Sidestep Dash, Acidic Surge Dash, or Attack -> Kite Back -> Orbit!
        const isKiting = (e.aiKiteTimer ?? 0) > 0 || e.attackCooldown > 0;

        // Slime Skill 1: Evasive Sidestep Dash when player aims a bow or casts a skill nearby
        if ((p.action === 'bowPull' || p.action === 'skill') && distToPlayer <= 155 && e.dashCooldown <= 0) {
          e.action = 'dash';
          e.actionElapsed = 0;
          e.actionDuration = 0.24;
          e.actionHitTriggered = true;
          e.dashCooldown = 5.0;
          const dodgeDir = this.steerWithAvoidance(e, -dir.y * flankSign, dir.x * flankSign);
          e.vx = dodgeDir.x * 230;
          e.vy = dodgeDir.y * 230;
          e.facing = vectorToDirection8(dodgeDir.x, dodgeDir.y, e.facing);
          this.events.push({ type: 'enemyDash', actorId: e.id, skill: 'EVASIVE DASH!', x: e.x, y: e.y });
          return;
        }

        // Slime Skill 2: Acidic Surge Dash from mid-range (58px-128px) to gap-close and inflict Venom Slow
        if (!isKiting && distToPlayer >= 58 && distToPlayer <= 128 && e.dashCooldown <= 0) {
          e.action = 'dash';
          e.actionElapsed = 0;
          e.actionDuration = 0.28;
          e.actionHitTriggered = false;
          e.dashCooldown = 5.5 + Math.random() * 1.2;
          const dashAngle = this.computePredictiveAimAngle(e, p, 240);
          e.vx = Math.cos(dashAngle) * 235;
          e.vy = Math.sin(dashAngle) * 235;
          e.facing = vectorToDirection8(e.vx, e.vy, e.facing);
          this.events.push({ type: 'enemyDash', actorId: e.id, skill: 'ACID DASH!', x: e.x, y: e.y });
          return;
        }

        if (!isKiting && distToPlayer <= 42 && e.attackCooldown <= 0) {
          e.action = 'slash1';
          e.actionElapsed = 0;
          e.actionDuration = 0.44;
          e.actionHitTriggered = false;
          e.attackCooldown = 1.55;
          const lungeAngle = this.computePredictiveAimAngle(e, p, 220);
          e.vx = Math.cos(lungeAngle) * 95;
          e.vy = Math.sin(lungeAngle) * 95;
          this.events.push({ type: 'slash', actorId: e.id, x: e.x, y: e.y, facing: e.facing, combo: 1 });
          return;
        }

        if (isKiting) {
          // Hit-and-Run Kiting: retreat diagonally out to ~105px, then circle/orbit the player until ready to strike again
          const kiteStandoff = 105;
          let kx: number;
          let ky: number;
          if (distToPlayer < kiteStandoff) {
            const rawKx = -dir.x * 0.84 - dir.y * flankSign * 0.54;
            const rawKy = -dir.y * 0.84 + dir.x * flankSign * 0.54;
            const normK = normalizeVector(rawKx, rawKy);
            const steered = this.steerWithAvoidance(e, normK.x, normK.y);
            kx = steered.x;
            ky = steered.y;
          } else {
            const steered = this.steerWithAvoidance(e, -dir.y * flankSign, dir.x * flankSign);
            kx = steered.x * 0.82;
            ky = steered.y * 0.82;
          }
          e.action = 'walk';
          e.vx = kx * (e.moveSpeed * 1.04);
          e.vy = ky * (e.moveSpeed * 1.04);
          e.facing = vectorToDirection8(dir.x, dir.y, e.facing);
          e.actionElapsed += dt;
          this.applyVelocityWithCollision(e, dt);
          return;
        }

        if (distToPlayer > 28) {
          const moveDir = this.computeTacticalMoveDir(e, dx, dy, distToPlayer);
          e.action = 'walk';
          e.vx = moveDir.x * e.moveSpeed;
          e.vy = moveDir.y * e.moveSpeed;
          e.facing = vectorToDirection8(moveDir.x, moveDir.y, e.facing);
        } else {
          e.action = 'idle';
          e.vx = 0;
          e.vy = 0;
        }
        e.actionElapsed += dt;
        this.applyVelocityWithCollision(e, dt);
        return;
      }
    }

    // Patrol with wall avoidance
    e.aiPatrolTimer -= dt;
    if (e.aiPatrolTimer <= 0) {
      e.aiPatrolTimer = 1.8 + Math.random() * 1.4;
      e.aiPatrolAngle += (Math.random() - 0.5) * Math.PI * 1.4;
      const distHome = Math.hypot(e.homeX - e.x, e.homeY - e.y);
      if (distHome > 64) {
        e.aiPatrolAngle = Math.atan2(e.homeY - e.y, e.homeX - e.x);
      }
    }

    const walking = e.aiPatrolTimer > 0.7;
    if (walking) {
      const rawPx = Math.cos(e.aiPatrolAngle);
      const rawPy = Math.sin(e.aiPatrolAngle);
      const steered = this.steerWithAvoidance(e, rawPx, rawPy);
      e.facing = vectorToDirection8(steered.x, steered.y, e.facing);
      e.action = 'walk';
      e.vx = steered.x * (e.moveSpeed * 0.45);
      e.vy = steered.y * (e.moveSpeed * 0.45);
    } else {
      e.action = 'idle';
      e.vx = 0;
      e.vy = 0;
    }
    e.actionElapsed += dt;
    this.applyVelocityWithCollision(e, dt);
  }

  private performMeleeStrike(attacker: SimActor, reach: number, damage: number, knockback: number): void {
    const targets = attacker.isPlayer ? this.enemies : [this.player];
    const fVec = DIRECTION_VECTORS[attacker.facing];

    for (const target of targets) {
      if (target.action === 'dead' || target.action === 'transition' || target.invulnTimer > 0) {
        continue;
      }
      const dx = target.x - attacker.x;
      const dy = target.y - attacker.y;
      const dist = Math.hypot(dx, dy);
      if (dist > reach) {
        continue;
      }
      if (dist > 4) {
        const dot = (dx / dist) * fVec.x + (dy / dist) * fVec.y;
        if (dot < 0.15) {
          continue;
        }
      }

      let effectiveDmg = damage;
      if (attacker.isPlayer && attacker.kind === 'crimson' && attacker.flameStanceTimer > 0) {
        effectiveDmg += 16;
        target.burnTimer = 3.5;
        target.burnDamage = 7;
        target.burnTickElapsed = 0;
        const prevRage = attacker.rage;
        attacker.rage = Math.min(attacker.maxRage, attacker.rage + 22);
        if (prevRage < attacker.maxRage && attacker.rage >= attacker.maxRage) {
          this.events.push({ type: 'recastReady', actorId: attacker.id });
        }
      }

      this.applyDamage(target, effectiveDmg, dx, dy, knockback, effectiveDmg >= 35);
      if (!attacker.isPlayer && target.isPlayer) {
        this.inflictEnemyDebuff(attacker, target, false);
      }
    }

    // Strike interactive world objects (barrels, brambles)
    if (attacker.isPlayer) {
      const strikeX = attacker.x + fVec.x * reach * 0.7;
      const strikeY = attacker.y + fVec.y * reach * 0.7;
      for (const obj of this.worldObjects) {
        if (!obj.active) continue;
        if (Math.hypot(obj.x - strikeX, obj.y - strikeY) <= reach) {
          if (obj.type === 'barrel') {
            this.detonateBarrel(obj);
          } else if (obj.type === 'bramble') {
            obj.active = false;
            obj.hp = 0;
            this.events.push({ type: 'brambleCut', x: obj.x, y: obj.y });
          }
        }
      }
    }
  }

  private inflictEnemyDebuff(attacker: SimActor, target: SimActor, guaranteed = false): void {
    if (!target.isPlayer || attacker.isPlayer || target.action === 'dead' || target.action === 'guard') {
      return;
    }

    if (attacker.isBoss) {
      if (guaranteed || Math.random() < 0.55) {
        target.stamina = Math.max(0, target.stamina - 14);
        target.slowTimer = Math.max(target.slowTimer ?? 0, 1.8);
        target.debuffActive = 'void_sap';
        target.debuffTimer = 1.8;
        this.events.push({
          type: 'debuffApplied',
          targetId: target.id,
          debuff: 'void_sap',
          label: 'VOID SAP! (-14 STM & SLOW)',
          x: target.x,
          y: target.y
        });
      }
      return;
    }

    const isOrc = String(attacker.kind).includes('orc');
    if (isOrc) {
      if (guaranteed || Math.random() < 0.48) {
        target.burnTimer = Math.max(target.burnTimer, 3.0);
        target.burnDamage = 4;
        target.burnTickElapsed = 0;
        target.debuffActive = 'bleed';
        target.debuffTimer = 3.0;
        this.events.push({
          type: 'debuffApplied',
          targetId: target.id,
          debuff: 'bleed',
          label: 'BARBED BLEED! (-4 HP/s)',
          x: target.x,
          y: target.y
        });
      }
      return;
    }

    // Ordinary Slimes: Venom Slow (-35% Move Speed)
    if (guaranteed || Math.random() < 0.45) {
      target.slowTimer = Math.max(target.slowTimer ?? 0, 2.4);
      target.debuffActive = 'slow';
      target.debuffTimer = 2.4;
      this.events.push({
        type: 'debuffApplied',
        targetId: target.id,
        debuff: 'slow',
        label: 'VENOM SLOW! (-35% SPD)',
        x: target.x,
        y: target.y
      });
    }
  }

  private applyDamage(
    target: SimActor,
    damage: number,
    dirX: number,
    dirY: number,
    knockback: number,
    critical: boolean
  ): void {
    if (target.action === 'transition') {
      return;
    }

    // Check Guard / Parry
    if (target.isPlayer && target.action === 'guard') {
      if (target.actionElapsed <= 0.28) {
        // PERFECT PARRY! Negates all damage, restores stamina, and stuns enemies
        target.stamina = Math.min(target.maxStamina, target.stamina + 25);
        this.events.push({ type: 'parry', x: target.x, y: target.y, perfect: true });
        for (const e of this.enemies) {
          if (e.action !== 'dead' && Math.hypot(e.x - target.x, e.y - target.y) <= 80) {
            e.attackCooldown = 1.6;
            e.vx = (e.x - target.x) * 2.5;
            e.vy = (e.y - target.y) * 2.5;
          }
        }
        return;
      } else {
        // Regular Guard (-75% damage)
        damage = Math.max(1, Math.round(damage * 0.25));
        knockback = Math.round(knockback * 0.35);
        this.events.push({ type: 'parry', x: target.x, y: target.y, perfect: false });
      }
    }

    // Check temporary Barrier Shield
    if (target.isPlayer && target.barrierShield > 0) {
      if (target.barrierShield >= damage) {
        target.barrierShield -= damage;
        damage = 0;
      } else {
        damage -= target.barrierShield;
        target.barrierShield = 0;
      }
    }

    target.hp = Math.max(0, target.hp - damage);
    target.invulnTimer = target.isPlayer ? 0.45 : 0.16;
    const kb = normalizeVector(dirX, dirY);
    target.vx = kb.x * knockback;
    target.vy = kb.y * knockback;

    if (target.isPlayer && target.kind === 'crimson' && target.flameStanceTimer > 0 && damage > 0) {
      const prevRage = target.rage;
      target.rage = Math.min(target.maxRage, target.rage + 12);
      if (prevRage < target.maxRage && target.rage >= target.maxRage) {
        this.events.push({ type: 'recastReady', actorId: target.id });
      }
    }

    if (!target.isPlayer) {
      target.aggroed = true;
      this.alertNearbyAllies(target, 165);
    }

    if (target.isBoss && (target.bossMinionsSpawned || 0) < 1 && target.hp > 0 && target.hp <= target.maxHp * 0.5) {
      target.bossMinionsSpawned = 1;
      this.events.push({ type: 'bossSkill', bossId: target.id, skill: 'minions', x: target.x, y: target.y });
      for (let m = 0; m < 2; m++) {
        const minion = this.createActor(`boss_minion_${target.id}_p${target.bossPhase || 1}_${m}`, 'green_slime', false, target.x + (m === 0 ? -40 : 40), target.y + 24, {
          kind: 'elvish',
          title: 'Abyssal Spawn',
          role: 'Guard',
          maxHp: 55,
          maxStamina: 80,
          moveSpeed: 78,
          skillName: 'Tackle',
          skillDesc: '',
          skillCooldown: 5
        });
        minion.attackDamage = 12;
        minion.aggroed = true;
        minion.respawnDelay = 0; // Summoned minions do not respawn once defeated
        this.enemies.push(minion);
      }
      this.waveTotalEnemies = this.enemies.length;
    }

    this.events.push({
      type: 'hit',
      targetId: target.id,
      x: target.x,
      y: target.y - 16,
      damage,
      critical
    });

    if (target.hp <= 0) {
      // Two-Phase Boss Transition: Phase 1 (Abyssal Jelly) -> Phase 2 (Floating Eldritch Organism)
      if (target.isBoss && (target.bossMaxPhases ?? 1) >= 2 && (target.bossPhase ?? 1) === 1) {
        this.triggerBossPhaseTransition(target);
        return;
      }

      target.action = 'dead';
      target.actionElapsed = 0;
      target.vx = 0;
      target.vy = 0;
      if (!target.isPlayer) {
        target.respawnTimer = target.respawnDelay ?? 6.0;
        this.kills += 1;
        const expGain = target.isBoss ? 120 : String(target.kind).includes('orc') ? 35 : 18;
        this.addExp(expGain);
      }
      this.events.push({ type: 'actorDefeated', actorId: target.id, x: target.x, y: target.y });
    } else if (target.action !== 'skill' && target.action !== 'guard') {
      target.action = 'hit';
      target.actionElapsed = 0;
      target.actionDuration = 0.24;
    }
  }

  private updateProjectiles(dt: number): void {
    const remaining: SimProjectile[] = [];

    for (const proj of this.projectiles) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;

      if (proj.life <= 0 || this.pointHitsCollider(proj.x, proj.y + 8)) {
        continue;
      }

      let hitWallOrDetonated = false;
      const targets = proj.ownerId === 'player' ? this.enemies : [this.player];
      for (const target of targets) {
        if (target.action === 'dead' || target.action === 'transition' || target.invulnTimer > 0) {
          continue;
        }
        if (proj.hitTargets && proj.hitTargets.has(target.id)) {
          continue; // Already pierced this target
        }
        const hitHalfW = target.isBoss ? 24 : 16;
        const hitHalfH = target.isBoss ? 28 : 20;
        if (Math.abs(proj.x - target.x) <= hitHalfW && Math.abs(proj.y - (target.y - 12)) <= hitHalfH) {
          if (!proj.hitTargets) proj.hitTargets = new Set();
          proj.hitTargets.add(target.id);

          const isCrit = Boolean(proj.isSkill || proj.isPerfect);
          this.applyDamage(target, proj.damage, proj.vx, proj.vy, proj.isPerfect ? 260 : 160, isCrit);
          if (proj.ownerId !== 'player' && target.isPlayer) {
            const shooter = this.enemies.find((en) => en.id === proj.ownerId);
            if (shooter) {
              this.inflictEnemyDebuff(shooter, target, Boolean(proj.isSkill));
            }
          }

          if (proj.pierce && proj.pierce > 0) {
            proj.pierce--;
          } else {
            hitWallOrDetonated = true;
            break;
          }
        }
      }

      if (!hitWallOrDetonated) {
        // Check hitting world objects (barrels, brambles)
        for (const obj of this.worldObjects) {
          if (!obj.active) continue;
          if (Math.hypot(obj.x - proj.x, obj.y - proj.y) <= 22) {
            if (obj.type === 'barrel') {
              this.detonateBarrel(obj);
              hitWallOrDetonated = true;
              break;
            } else if (obj.type === 'bramble') {
              obj.active = false;
              obj.hp = 0;
              this.events.push({ type: 'brambleCut', x: obj.x, y: obj.y });
              if (proj.pierce && proj.pierce > 0) {
                proj.pierce--;
              } else {
                hitWallOrDetonated = true;
                break;
              }
            }
          }
        }
      }

      if (!hitWallOrDetonated) {
        remaining.push(proj);
      }
    }

    this.projectiles = remaining;
  }

  private pointHitsCollider(px: number, py: number): boolean {
    for (const c of this.map.colliders) {
      if (px >= c.x && px <= c.x + c.width && py >= c.y && py <= c.y + c.height) {
        return true;
      }
    }
    return false;
  }

  private applyVelocityWithCollision(actor: SimActor, dt: number): void {
    const nextX = actor.x + actor.vx * dt;
    if (!this.rectCollides(nextX - FOOT_HALF_W, actor.y - FOOT_HALF_H, FOOT_HALF_W * 2, FOOT_HALF_H * 2)) {
      actor.x = nextX;
    }

    const nextY = actor.y + actor.vy * dt;
    if (!this.rectCollides(actor.x - FOOT_HALF_W, nextY - FOOT_HALF_H, FOOT_HALF_W * 2, FOOT_HALF_H * 2)) {
      actor.y = nextY;
    }
  }

  private rectCollides(rx: number, ry: number, rw: number, rh: number): boolean {
    for (const c of this.map.colliders) {
      if (rx < c.x + c.width && rx + rw > c.x && ry < c.y + c.height && ry + rh > c.y) {
        return true;
      }
    }
    return false;
  }

  private tickTimers(actor: SimActor, dt: number): void {
    if (actor.invulnTimer > 0) actor.invulnTimer = Math.max(0, actor.invulnTimer - dt);
    if (actor.attackCooldown > 0) actor.attackCooldown = Math.max(0, actor.attackCooldown - dt);
    if (actor.dashCooldown > 0) actor.dashCooldown = Math.max(0, actor.dashCooldown - dt);
    if (actor.skillCooldown > 0) actor.skillCooldown = Math.max(0, actor.skillCooldown - dt);
    if (actor.guardCooldown > 0) actor.guardCooldown = Math.max(0, actor.guardCooldown - dt);
    if (actor.ultimateCooldown > 0) actor.ultimateCooldown = Math.max(0, actor.ultimateCooldown - dt);
    if (actor.throwCooldown > 0) actor.throwCooldown = Math.max(0, actor.throwCooldown - dt);
    if (actor.buffTimer > 0) {
      actor.buffTimer = Math.max(0, actor.buffTimer - dt);
      if (actor.buffTimer === 0) actor.buffActive = undefined;
    }
    if (actor.slowTimer && actor.slowTimer > 0) {
      actor.slowTimer = Math.max(0, actor.slowTimer - dt);
    }
    if (actor.debuffTimer && actor.debuffTimer > 0) {
      actor.debuffTimer = Math.max(0, actor.debuffTimer - dt);
      if (actor.debuffTimer === 0) actor.debuffActive = undefined;
    }

    // Flame Stance duration countdown
    if (actor.flameStanceTimer > 0) {
      actor.flameStanceTimer = Math.max(0, actor.flameStanceTimer - dt);
      if (actor.flameStanceTimer === 0) {
        actor.rage = 0;
        actor.ultimateCooldown = actor.ultimateMaxCooldown;
      }
    }

    // Burn damage over time tick
    if (actor.burnTimer > 0 && actor.action !== 'dead' && actor.action !== 'transition') {
      actor.burnTimer = Math.max(0, actor.burnTimer - dt);
      actor.burnTickElapsed = (actor.burnTickElapsed || 0) + dt;
      if (actor.burnTickElapsed >= 0.75) {
        actor.burnTickElapsed = 0;
        const dmg = actor.burnDamage || 6;
        actor.hp = Math.max(0, actor.hp - dmg);
        this.events.push({ type: 'hit', targetId: actor.id, x: actor.x, y: actor.y, damage: dmg, critical: false });
        this.events.push({ type: 'burnTick', actorId: actor.id, x: actor.x, y: actor.y, damage: dmg });
        if (actor.hp <= 0) {
          if (actor.isBoss && (actor.bossMaxPhases ?? 1) >= 2 && (actor.bossPhase ?? 1) === 1) {
            this.triggerBossPhaseTransition(actor);
            return;
          }
          actor.action = 'dead';
          this.events.push({ type: 'actorDefeated', actorId: actor.id, x: actor.x, y: actor.y });
          if (!actor.isPlayer) {
            this.kills += 1;
            const expReward = actor.isBoss ? 120 : String(actor.kind).includes('orc') ? 35 : 18;
            this.addExp(expReward);
          }
        }
      }
    }
  }

  public getSnapshot(): WorldSnapshot {
    const aliveEnemies = this.enemies.filter((e) => e.action !== 'dead');
    const liveBoss =
      (this.activeBoss && this.activeBoss.action !== 'dead')
        ? this.activeBoss
        : this.enemies.find((e) => e.isBoss && e.action !== 'dead') || null;

    return {
      tick: this.tick,
      player: this.toSnapshot(this.player),
      enemies: this.enemies.map((e) => this.toSnapshot(e)),
      projectiles: this.projectiles.map((p) => ({
        id: p.id,
        ownerId: p.ownerId,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        angle: p.angle,
        isSkill: p.isSkill,
        isPierce: (p.pierce ?? 0) > 0,
        isPerfect: p.isPerfect
      })),
      worldObjects: this.worldObjects.map((o) => ({
        id: o.id,
        type: o.type,
        x: o.x,
        y: o.y,
        hp: o.hp,
        maxHp: o.maxHp,
        active: o.active,
        name: o.name
      })),
      kills: this.kills,
      events: this.events,
      wave: this.currentWave,
      waveState: this.waveState,
      waveEnemiesLeft: aliveEnemies.length,
      waveTotalEnemies: this.waveTotalEnemies,
      boss: liveBoss ? {
        id: liveBoss.id,
        name: liveBoss.bossName || 'Abyssal Jelly',
        hp: liveBoss.hp,
        maxHp: liveBoss.maxHp,
        phase: liveBoss.bossPhase ?? 1,
        maxPhases: liveBoss.bossMaxPhases ?? 2
      } : null
    };
  }

  private toSnapshot(actor: SimActor): ActorSnapshot {
    let bowChargeTier: 0 | 1 | 2 | 3 | undefined = undefined;
    let bowChargeRatio: number | undefined = undefined;

    if (actor.action === 'bowPull') {
      const isElvish = actor.kind === 'elvish';
      const fullChargeTime = isElvish ? 0.60 : 0.85;
      const perfectEnd = isElvish ? 0.85 : 1.10;
      const hold = actor.actionElapsed;
      bowChargeRatio = Math.min(1, hold / fullChargeTime);
      if (hold >= 1.6) {
        bowChargeTier = 3; // fatigue
      } else if (hold >= fullChargeTime && hold <= perfectEnd) {
        bowChargeTier = 2; // perfect
      } else if (hold >= 0.35) {
        bowChargeTier = 1; // focused
      } else {
        bowChargeTier = 0; // quick tap
      }
    }

    return {
      id: actor.id,
      kind: actor.kind,
      isPlayer: actor.isPlayer,
      isBoss: actor.isBoss,
      bossName: actor.bossName,
      bossPhase: actor.bossPhase,
      bossMaxPhases: actor.bossMaxPhases,
      x: actor.x,
      y: actor.y,
      facing: actor.facing,
      action: actor.action,
      actionElapsed: actor.actionElapsed,
      hp: actor.hp,
      maxHp: actor.maxHp,
      stamina: actor.stamina,
      maxStamina: actor.maxStamina,
      invulnTimer: actor.invulnTimer,
      dashCooldown: actor.dashCooldown,
      dashMaxCooldown: actor.dashMaxCooldown,
      skillCooldown: actor.skillCooldown,
      skillMaxCooldown: actor.skillMaxCooldown,
      skillName: actor.skillName,
      guardCooldown: actor.guardCooldown,
      guardMaxCooldown: actor.guardMaxCooldown,
      ultimateCooldown: actor.ultimateCooldown,
      ultimateMaxCooldown: actor.ultimateMaxCooldown,
      ultimateName: actor.ultimateName,
      throwCooldown: actor.throwCooldown,
      throwMaxCooldown: actor.throwMaxCooldown,
      throwName: actor.throwName,
      buffActive: actor.buffActive,
      buffTimer: actor.buffTimer,
      debuffActive: actor.debuffActive,
      debuffTimer: actor.debuffTimer,
      mp: actor.mp,
      maxMp: actor.maxMp,
      level: actor.level,
      exp: actor.exp,
      maxExp: actor.maxExp,
      statPoints: actor.statPoints,
      allocatedHp: actor.allocatedHp,
      allocatedStamina: actor.allocatedStamina,
      allocatedMp: actor.allocatedMp,
      rage: actor.rage,
      maxRage: actor.maxRage,
      flameStanceTimer: actor.flameStanceTimer,
      isFlameStance: (actor.flameStanceTimer ?? 0) > 0,
      isRecastReady: (actor.flameStanceTimer ?? 0) > 0 && (actor.rage ?? 0) >= 100,
      bowChargeTier,
      bowChargeRatio
    };
  }
}