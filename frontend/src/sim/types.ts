export type Direction8 = 'S' | 'SE' | 'E' | 'NE' | 'N' | 'NW' | 'W' | 'SW';

export type CharacterKind = 'crimson' | 'elvish' | 'legacy';

export type EnemyKind =
  | 'green_slime'
  | 'blue_slime'
  | 'purple_slime'
  | 'yellow_slime'
  | 'green_king_slime'
  | 'blue_king_slime'
  | 'purple_king_slime'
  | 'yellow_king_slime'
  | 'hunter_orc'
  | 'orc_warlord'
  | 'abyssal_jelly'
  | 'floating_eldritch'
  | 'elvish';

export type ActionState =
  | 'idle'
  | 'walk'
  | 'dash'
  | 'roll'
  | 'slash1'
  | 'slash2'
  | 'bowPull'
  | 'bowRelease'
  | 'guard'
  | 'throw'
  | 'skill'
  | 'transition'
  | 'hit'
  | 'dead';

export interface PlayerInput {
  moveX: number;
  moveY: number;
  aimDir?: Direction8;
  attackPressed: boolean;
  bowHeld: boolean;
  dashPressed: boolean;
  rollPressed: boolean;
  skillPressed: boolean;
  guardHeld: boolean;
  ultimatePressed: boolean;
  throwPressed: boolean;
  statUpgrade?: 'hp' | 'stamina' | 'mp';
}

export interface ColliderRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface PortalTrigger {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  inName?: string;
  outName?: string;
  targetMapId?: string;
  targetX: number;
  targetY: number;
  label?: string;
  targetMapName?: string;
  connectorTag?: string;
}

export interface MapSpawnData {
  widthPx: number;
  heightPx: number;
  playerSpawn: Point2D;
  enemySpawns: Array<{ name: string; x: number; y: number; kind?: string; respawnDelay?: number }>;
  colliders: ColliderRect[];
  portals?: PortalTrigger[];
  isPeaceful?: boolean;
}

export interface ActorSnapshot {
  id: string;
  kind: CharacterKind | EnemyKind;
  isPlayer: boolean;
  isBoss?: boolean;
  bossName?: string;
  bossPhase?: 1 | 2;
  bossMaxPhases?: number;
  x: number;
  y: number;
  facing: Direction8;
  action: ActionState;
  actionElapsed: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  invulnTimer: number;
  dashCooldown: number;
  dashMaxCooldown: number;
  skillCooldown: number;
  skillMaxCooldown: number;
  skillName: string;
  guardCooldown?: number;
  guardMaxCooldown?: number;
  ultimateCooldown?: number;
  ultimateMaxCooldown?: number;
  ultimateName?: string;
  throwCooldown?: number;
  throwMaxCooldown?: number;
  throwName?: string;
  buffActive?: string;
  buffTimer?: number;
  mp?: number;
  maxMp?: number;
  level?: number;
  exp?: number;
  maxExp?: number;
  statPoints?: number;
  allocatedHp?: number;
  allocatedStamina?: number;
  allocatedMp?: number;
  rage?: number;
  maxRage?: number;
  flameStanceTimer?: number;
  isFlameStance?: boolean;
  isRecastReady?: boolean;
  bowChargeTier?: 0 | 1 | 2 | 3;
  bowChargeRatio?: number;
  debuffActive?: 'slow' | 'bleed' | 'void_sap';
  debuffTimer?: number;
}

export interface ProjectileSnapshot {
  id: number;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  isSkill?: boolean;
  isPierce?: boolean;
  isPerfect?: boolean;
}

export interface BossSnapshot {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  phase?: 1 | 2;
  maxPhases?: number;
}

export interface WorldObjectSnapshot {
  id: string;
  type: 'barrel' | 'shrine' | 'campfire' | 'bramble';
  x: number;
  y: number;
  hp?: number;
  maxHp?: number;
  active?: boolean;
  name?: string;
}

export type SimEvent =
  | { type: 'slash'; actorId: string; x: number; y: number; facing: Direction8; combo: 1 | 2 }
  | { type: 'bowRelease'; actorId: string; x: number; y: number; facing: Direction8 }
  | { type: 'dash'; actorId: string; x: number; y: number; kind: 'dash' | 'roll' }
  | { type: 'skill'; actorId: string; x: number; y: number; skill: string }
  | { type: 'hit'; targetId: string; x: number; y: number; damage: number; critical?: boolean }
  | { type: 'actorDefeated'; actorId: string; x: number; y: number }
  | { type: 'playerRespawned'; x: number; y: number }
  | { type: 'portalTransport'; portalId: string; x: number; y: number; targetMapId?: string; targetX: number; targetY: number; label: string; connectorTag?: string }
  | { type: 'waveStart'; wave: number; isBossWave: boolean }
  | { type: 'waveCleared'; wave: number }
  | { type: 'bossSpawned'; bossName: string }
  | { type: 'bossPhaseTransition'; bossId: string; newName: string; x: number; y: number }
  | { type: 'bossSkill'; bossId: string; skill: 'slam' | 'spit' | 'minions' | 'void_beam'; x: number; y: number; angle?: number }
  | { type: 'parry'; x: number; y: number; perfect: boolean }
  | { type: 'barrelExploded'; x: number; y: number }
  | { type: 'shrineActivated'; shrineType: string; x: number; y: number; label: string }
  | { type: 'brambleCut'; x: number; y: number }
  | { type: 'levelUp'; level: number; statPoints: number; x: number; y: number }
  | { type: 'statUpgraded'; stat: 'hp' | 'stamina' | 'mp'; newMax: number }
  | { type: 'ultimateVfx'; hero: CharacterKind; x: number; y: number; dir: Direction8 }
  | { type: 'noMp'; x: number; y: number; needed: number }
  | { type: 'flameStanceActivated'; actorId: string; duration: number }
  | { type: 'recastReady'; actorId: string }
  | { type: 'redFlameRecast'; actorId: string; x: number; y: number }
  | { type: 'rageNotReady'; x: number; y: number; rage: number }
  | { type: 'bowPerfect'; x: number; y: number }
  | { type: 'bowFatigued'; x: number; y: number }
  | { type: 'noStamina'; x: number; y: number; needed: number }
  | { type: 'burnTick'; actorId: string; x: number; y: number; damage: number }
  | { type: 'debuffApplied'; targetId: string; debuff: 'slow' | 'bleed' | 'void_sap'; label: string; x: number; y: number }
  | { type: 'enemyDash'; actorId: string; skill: string; x: number; y: number };

export interface WorldSnapshot {
  tick: number;
  player: ActorSnapshot;
  enemies: ActorSnapshot[];
  projectiles: ProjectileSnapshot[];
  worldObjects: WorldObjectSnapshot[];
  kills: number;
  events: SimEvent[];
  wave?: number;
  waveState?: 'active' | 'cleared' | 'boss_wave' | 'spawning';
  waveEnemiesLeft?: number;
  waveTotalEnemies?: number;
  boss?: BossSnapshot | null;
}