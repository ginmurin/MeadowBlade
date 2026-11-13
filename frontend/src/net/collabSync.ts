import type { CustomMapData, CustomProperty, MapObject, MapZone, TileCell } from '../map/mapModel';
import { createEmptyMap } from '../map/mapModel';
import type { CharacterKind } from '../sim/types';
import PeerPkg from 'peerjs';

const PeerConstructor: any = (PeerPkg as any).Peer || (PeerPkg as any).default || PeerPkg;

const MAPS_STORAGE_KEY = 'meadowblade_saved_maps_v2';
const ACTIVE_MAP_KEY = 'meadowblade_active_map_id';

// -------------------------------------------------------------
// MAP STORAGE
// -------------------------------------------------------------
export class MapStorage {
  public static listMaps(): CustomMapData[] {
    try {
      const raw = localStorage.getItem(MAPS_STORAGE_KEY);
      if (!raw) {
        const defaultMap = createEmptyMap('Green Meadow Starter', 38, 26);
        localStorage.setItem(MAPS_STORAGE_KEY, JSON.stringify([defaultMap]));
        return [defaultMap];
      }
      return JSON.parse(raw);
    } catch {
      return [createEmptyMap()];
    }
  }

  public static getMap(id: string): CustomMapData | null {
    const list = this.listMaps();
    return list.find((m) => m.id === id) ?? null;
  }

  public static saveMap(map: CustomMapData): void {
    const list = this.listMaps();
    const idx = list.findIndex((m) => m.id === map.id);
    map.updatedAt = Date.now();
    if (idx >= 0) {
      list[idx] = map;
    } else {
      list.unshift(map);
    }
    localStorage.setItem(MAPS_STORAGE_KEY, JSON.stringify(list));
    localStorage.setItem(ACTIVE_MAP_KEY, map.id);
  }

  public static deleteMap(id: string): void {
    const list = this.listMaps().filter((m) => m.id !== id);
    localStorage.setItem(MAPS_STORAGE_KEY, JSON.stringify(list));
  }

  public static getActiveMapId(): string | null {
    return localStorage.getItem(ACTIVE_MAP_KEY);
  }

  public static setActiveMapId(id: string): void {
    localStorage.setItem(ACTIVE_MAP_KEY, id);
  }
}

// -------------------------------------------------------------
// LIVE MAP COLLABORATION (BroadcastChannel / Local Network Bus)
// -------------------------------------------------------------
export type CollabMessage =
  | { type: 'HELLO'; user: string }
  | { type: 'SYNC_FULL'; map: CustomMapData }
  | { type: 'PAINT_TILE'; layer: 'ground' | 'props'; x: number; y: number; tile: TileCell | null }
  | { type: 'SET_COLLISION'; x: number; y: number; solid: boolean }
  | { type: 'ADD_OBJECT'; object: MapObject }
  | { type: 'REMOVE_OBJECT'; id: string }
  | { type: 'SET_PROPERTIES'; properties: CustomProperty[] }
  | { type: 'SET_OBJECT_PROPERTIES'; objectId: string; properties: CustomProperty[] }
  | { type: 'ADD_ZONE'; zone: MapZone }
  | { type: 'UPDATE_ZONE'; zone: MapZone }
  | { type: 'REMOVE_ZONE'; id: string }
  | { type: 'CURSOR'; user: string; color: string; x: number; y: number };

export class CollabSession {
  private channel: BroadcastChannel | null = null;
  public readonly userName: string;
  public readonly userColor: string;
  public peerCount = 1;
  private onMessageCb?: (msg: CollabMessage) => void;
  private onPeerCountCb?: (count: number) => void;

  constructor(public readonly roomId: string, userName?: string) {
    this.userName = userName || `Architect_${Math.floor(100 + Math.random() * 900)}`;
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    this.userColor = colors[Math.floor(Math.random() * colors.length)];

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`meadowblade_collab_${roomId}`);
      this.channel.onmessage = (ev) => {
        const msg = ev.data as CollabMessage;
        if (msg.type === 'HELLO') {
          this.peerCount += 1;
          this.onPeerCountCb?.(this.peerCount);
        }
        this.onMessageCb?.(msg);
      };
      this.channel.postMessage({ type: 'HELLO', user: this.userName });
    }
  }

  public onMessage(cb: (msg: CollabMessage) => void): void {
    this.onMessageCb = cb;
  }

  public onPeerCount(cb: (count: number) => void): void {
    this.onPeerCountCb = cb;
  }

  public broadcast(msg: CollabMessage): void {
    this.channel?.postMessage(msg);
  }

  public destroy(): void {
    this.channel?.close();
  }
}

// -------------------------------------------------------------
// MULTIPLAYER LOBBY SYSTEM (Client-to-Client / Broadcast Network)
// -------------------------------------------------------------
export interface LobbyPlayer {
  id: string;
  name: string;
  hero: CharacterKind;
  ready: boolean;
  isHost: boolean;
  ping: number;
}

export type GameMode = 'coop' | 'pvp';

export interface LobbyState {
  code: string;
  name: string;
  hostId: string;
  mapId: string;
  mapName: string;
  maxPlayers: number;
  players: LobbyPlayer[];
  status: 'waiting' | 'in_game';
  gameMode: GameMode;
}

export type LobbyMessage =
  | { type: 'DISCOVER_LOBBIES' }
  | { type: 'ANNOUNCE_LOBBY'; lobby: LobbyState }
  | { type: 'JOIN_REQUEST'; code: string; player: LobbyPlayer }
  | { type: 'JOIN_ACCEPTED'; lobby: LobbyState }
  | { type: 'UPDATE_LOBBY'; lobby: LobbyState }
  | { type: 'CHAT'; user: string; text: string }
  | { type: 'START_GAME'; lobby: LobbyState };

export class LobbyClient {
  private channel: BroadcastChannel | null = null;
  public peer: any = null;
  public peerConnections: any[] = [];
  public lobby: LobbyState | null = null;
  public localPlayer: LobbyPlayer;
  private onUpdateCb?: (lobby: LobbyState) => void;
  private onDiscoveredCb?: (lobbies: LobbyState[]) => void;
  private onStartGameCb?: (lobby: LobbyState) => void;
  private onChatCb?: (user: string, text: string) => void;
  private discoveredLobbies = new Map<string, { lobby: LobbyState; seen: number }>();
  private heartbeatTimer = 0;

  constructor(playerName?: string) {
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.localPlayer = {
      id,
      name: playerName || `Player_${Math.floor(100 + Math.random() * 900)}`,
      hero: 'crimson',
      ready: false,
      isHost: false,
      ping: 8
    };

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('meadowblade_lobby_mesh');
      this.channel.onmessage = (ev) => this.handleMessage(ev.data as LobbyMessage);
    }

    this.queryLobbies();
  }

  public onUpdate(cb: (lobby: LobbyState) => void): void {
    this.onUpdateCb = cb;
  }

  public onDiscovered(cb: (lobbies: LobbyState[]) => void): void {
    this.onDiscoveredCb = cb;
  }

  public onStartGame(cb: (lobby: LobbyState) => void): void {
    this.onStartGameCb = cb;
  }

  public onChat(cb: (user: string, text: string) => void): void {
    this.onChatCb = cb;
  }

  public hostLobby(mapId: string, mapName: string, lobbyName?: string, gameMode: GameMode = 'coop'): LobbyState {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.localPlayer.isHost = true;
    this.localPlayer.ready = true;

    this.lobby = {
      code,
      name: lobbyName || `${this.localPlayer.name}'s Party`,
      hostId: this.localPlayer.id,
      mapId,
      mapName,
      maxPlayers: 4,
      players: [this.localPlayer],
      status: 'waiting',
      gameMode
    };

    this.initHostPeer(code);

    this.broadcast({ type: 'ANNOUNCE_LOBBY', lobby: this.lobby });
    this.startHeartbeat();
    this.onUpdateCb?.(this.lobby);
    return this.lobby;
  }

  private initHostPeer(code: string): void {
    try {
      this.peer?.destroy();
      const peerId = `meadowblade_room_${code.toLowerCase()}`;
      this.peer = new PeerConstructor(peerId);

      this.peer.on('connection', (conn: any) => {
        this.peerConnections.push(conn);
        conn.on('data', (data: any) => {
          this.handleMessage(data as LobbyMessage);
        });
        conn.on('close', () => {
          this.peerConnections = this.peerConnections.filter((c) => c !== conn);
        });
      });

      this.peer.on('error', (err: any) => {
        console.warn('Host PeerJS warning:', err);
      });
    } catch (e) {
      console.warn('Host PeerJS failed:', e);
    }
  }

  public joinLobby(code: string): void {
    const cleanCode = code.trim().toUpperCase();
    this.broadcast({ type: 'JOIN_REQUEST', code: cleanCode, player: this.localPlayer });

    try {
      this.peer?.destroy();
      this.peer = new PeerConstructor();

      this.peer.on('open', () => {
        const targetPeerId = `meadowblade_room_${cleanCode.toLowerCase()}`;
        const conn = this.peer.connect(targetPeerId);

        conn.on('open', () => {
          this.peerConnections = [conn];
          conn.send({ type: 'JOIN_REQUEST', code: cleanCode, player: this.localPlayer });
        });

        conn.on('data', (data: any) => {
          this.handleMessage(data as LobbyMessage);
        });

        conn.on('error', (err: any) => {
          console.warn('Peer connection error:', err);
        });
      });
    } catch (e) {
      console.warn('Client PeerJS connect error:', e);
    }
  }

  public setHero(hero: CharacterKind): void {
    this.localPlayer.hero = hero;
    this.syncPlayerState();
  }

  public toggleReady(): void {
    this.localPlayer.ready = !this.localPlayer.ready;
    this.syncPlayerState();
  }

  public setMap(mapId: string, mapName: string): void {
    if (this.lobby && this.localPlayer.isHost) {
      this.lobby.mapId = mapId;
      this.lobby.mapName = mapName;
      this.broadcast({ type: 'UPDATE_LOBBY', lobby: this.lobby });
      this.onUpdateCb?.(this.lobby);
    }
  }

  public setGameMode(mode: GameMode): void {
    if (this.lobby && this.localPlayer.isHost) {
      this.lobby.gameMode = mode;
      this.broadcast({ type: 'UPDATE_LOBBY', lobby: this.lobby });
      this.onUpdateCb?.(this.lobby);
    }
  }

  public sendChat(text: string): void {
    this.broadcast({ type: 'CHAT', user: this.localPlayer.name, text });
    this.onChatCb?.(this.localPlayer.name, text);
  }

  public launchGame(): void {
    if (this.lobby && this.localPlayer.isHost) {
      this.lobby.status = 'in_game';
      this.broadcast({ type: 'START_GAME', lobby: this.lobby });
      this.onStartGameCb?.(this.lobby);
    }
  }

  public detachNetwork(): { peer: any; connections: any[] } {
    clearInterval(this.heartbeatTimer);
    const result = { peer: this.peer, connections: [...this.peerConnections] };
    this.peer = null;
    this.peerConnections = [];
    return result;
  }

  public leaveLobby(): void {
    if (this.lobby) {
      this.lobby.players = this.lobby.players.filter((p) => p.id !== this.localPlayer.id);
      if (this.localPlayer.isHost && this.lobby.players.length > 0) {
        this.lobby.players[0].isHost = true;
        this.lobby.hostId = this.lobby.players[0].id;
      }
      this.broadcast({ type: 'UPDATE_LOBBY', lobby: this.lobby });
    }
    this.lobby = null;
    this.localPlayer.isHost = false;
    this.localPlayer.ready = false;
    clearInterval(this.heartbeatTimer);
    try {
      this.peer?.destroy();
    } catch {}
    this.peer = null;
    this.peerConnections = [];
  }

  public queryLobbies(): void {
    this.broadcast({ type: 'DISCOVER_LOBBIES' });
  }

  private syncPlayerState(): void {
    if (!this.lobby) return;
    const p = this.lobby.players.find((x) => x.id === this.localPlayer.id);
    if (p) {
      p.hero = this.localPlayer.hero;
      p.ready = this.localPlayer.ready;
    }
    this.broadcast({ type: 'UPDATE_LOBBY', lobby: this.lobby });
    this.onUpdateCb?.(this.lobby);
  }

  private startHeartbeat(): void {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = window.setInterval(() => {
      if (this.lobby && this.localPlayer.isHost) {
        this.broadcast({ type: 'ANNOUNCE_LOBBY', lobby: this.lobby });
      }
    }, 2000);
  }

  private broadcast(msg: LobbyMessage): void {
    this.channel?.postMessage(msg);
    for (const conn of this.peerConnections) {
      try {
        if (conn.open) {
          conn.send(msg);
        }
      } catch {}
    }
  }

  private handleMessage(msg: LobbyMessage): void {
    if (msg.type === 'DISCOVER_LOBBIES') {
      if (this.lobby && this.localPlayer.isHost) {
        this.broadcast({ type: 'ANNOUNCE_LOBBY', lobby: this.lobby });
      }
    } else if (msg.type === 'ANNOUNCE_LOBBY') {
      this.discoveredLobbies.set(msg.lobby.code, { lobby: msg.lobby, seen: Date.now() });
      const now = Date.now();
      const active: LobbyState[] = [];
      for (const [code, entry] of this.discoveredLobbies.entries()) {
        if (now - entry.seen < 6000) {
          active.push(entry.lobby);
        } else {
          this.discoveredLobbies.delete(code);
        }
      }
      this.onDiscoveredCb?.(active);
    } else if (msg.type === 'JOIN_REQUEST') {
      if (this.lobby && this.localPlayer.isHost && this.lobby.code === msg.code) {
        if (this.lobby.players.length < this.lobby.maxPlayers) {
          const exists = this.lobby.players.some((p) => p.id === msg.player.id);
          if (!exists) {
            this.lobby.players.push(msg.player);
          }
          this.broadcast({ type: 'JOIN_ACCEPTED', lobby: this.lobby });
          this.onUpdateCb?.(this.lobby);
        }
      }
    } else if (msg.type === 'JOIN_ACCEPTED') {
      const isForMe = msg.lobby.players.some((p) => p.id === this.localPlayer.id);
      if (isForMe) {
        this.lobby = msg.lobby;
        this.onUpdateCb?.(this.lobby);
      }
    } else if (msg.type === 'UPDATE_LOBBY') {
      if (this.lobby && this.lobby.code === msg.lobby.code) {
        this.lobby = msg.lobby;
        this.onUpdateCb?.(this.lobby);
      }
    } else if (msg.type === 'START_GAME') {
      if (this.lobby && this.lobby.code === msg.lobby.code) {
        this.lobby = msg.lobby;
        this.onStartGameCb?.(this.lobby);
      }
    } else if (msg.type === 'CHAT') {
      this.onChatCb?.(msg.user, msg.text);
    }
  }

  public destroy(): void {
    this.leaveLobby();
    this.channel?.close();
  }
}

// -------------------------------------------------------------
// REAL-TIME MULTIPLAYER & PVP GAME SESSION (Broadcast / WebRTC Mesh)
// -------------------------------------------------------------
export interface NetworkPlayerSync {
  id: string;
  name: string;
  hero: CharacterKind;
  x: number;
  y: number;
  facing: string;
  action: string;
  hp: number;
  maxHp: number;
  isAttacking?: boolean;
  pvpEnabled?: boolean;
}

export type NetGameMessage =
  | { type: 'PLAYER_STATE'; state: NetworkPlayerSync }
  | { type: 'PLAYER_ATTACK'; attackerId: string; hero: CharacterKind; x: number; y: number; attackType: string; damage: number; facing: string }
  | { type: 'PLAYER_HIT'; targetId: string; damage: number; attackerId: string }
  | { type: 'PLAYER_LEFT'; id: string };

export class MultiplayerGameSession {
  private channel: BroadcastChannel | null = null;
  private peer: any = null;
  private peerConnections: any[] = [];
  public peers = new Map<string, NetworkPlayerSync>();
  private onPeerUpdateCb?: (peer: NetworkPlayerSync) => void;
  private onPeerAttackCb?: (msg: Extract<NetGameMessage, { type: 'PLAYER_ATTACK' }>) => void;
  private onPeerHitCb?: (targetId: string, damage: number, attackerId: string) => void;
  private onPeerLeaveCb?: (id: string) => void;

  constructor(
    public readonly roomCode: string,
    public readonly localId: string,
    existingNet?: { peer: any; connections: any[] }
  ) {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`meadowblade_game_${roomCode}`);
      this.channel.onmessage = (ev) => this.handleMessage(ev.data as NetGameMessage);
    }

    if (existingNet && existingNet.peer) {
      this.peer = existingNet.peer;
      this.peerConnections = existingNet.connections || [];
      for (const conn of this.peerConnections) {
        conn.removeAllListeners?.('data');
        conn.on('data', (data: any) => this.handleMessage(data as NetGameMessage));
      }
      this.peer.on('connection', (conn: any) => {
        this.peerConnections.push(conn);
        conn.on('data', (data: any) => this.handleMessage(data as NetGameMessage));
        conn.on('close', () => {
          this.peerConnections = this.peerConnections.filter((c) => c !== conn);
        });
      });
    }
  }

  public onPeerUpdate(cb: (peer: NetworkPlayerSync) => void): void {
    this.onPeerUpdateCb = cb;
  }

  public onPeerAttack(cb: (msg: Extract<NetGameMessage, { type: 'PLAYER_ATTACK' }>) => void): void {
    this.onPeerAttackCb = cb;
  }

  public onPeerHit(cb: (targetId: string, damage: number, attackerId: string) => void): void {
    this.onPeerHitCb = cb;
  }

  public onPeerLeave(cb: (id: string) => void): void {
    this.onPeerLeaveCb = cb;
  }

  public broadcastState(state: NetworkPlayerSync): void {
    const msg: NetGameMessage = { type: 'PLAYER_STATE', state };
    this.channel?.postMessage(msg);
    for (const conn of this.peerConnections) {
      try {
        if (conn.open) conn.send(msg);
      } catch {}
    }
  }

  public broadcastAttack(hero: CharacterKind, x: number, y: number, attackType: string, damage: number, facing: string): void {
    const msg: NetGameMessage = {
      type: 'PLAYER_ATTACK',
      attackerId: this.localId,
      hero,
      x,
      y,
      attackType,
      damage,
      facing
    };
    this.channel?.postMessage(msg);
    for (const conn of this.peerConnections) {
      try {
        if (conn.open) conn.send(msg);
      } catch {}
    }
  }

  public broadcastHit(targetId: string, damage: number): void {
    const msg: NetGameMessage = {
      type: 'PLAYER_HIT',
      targetId,
      damage,
      attackerId: this.localId
    };
    this.channel?.postMessage(msg);
    for (const conn of this.peerConnections) {
      try {
        if (conn.open) conn.send(msg);
      } catch {}
    }
  }

  private handleMessage(msg: NetGameMessage): void {
    if (msg.type === 'PLAYER_STATE') {
      if (msg.state.id === this.localId) return;
      this.peers.set(msg.state.id, msg.state);
      this.onPeerUpdateCb?.(msg.state);
    } else if (msg.type === 'PLAYER_ATTACK') {
      if (msg.attackerId === this.localId) return;
      this.onPeerAttackCb?.(msg);
    } else if (msg.type === 'PLAYER_HIT') {
      this.onPeerHitCb?.(msg.targetId, msg.damage, msg.attackerId);
    } else if (msg.type === 'PLAYER_LEFT') {
      this.peers.delete(msg.id);
      this.onPeerLeaveCb?.(msg.id);
    }
  }

  public destroy(): void {
    const msg: NetGameMessage = { type: 'PLAYER_LEFT', id: this.localId };
    this.channel?.postMessage(msg);
    for (const conn of this.peerConnections) {
      try {
        if (conn.open) conn.send(msg);
      } catch {}
    }
    try {
      this.peer?.destroy();
    } catch {}
    this.channel?.close();
  }
}