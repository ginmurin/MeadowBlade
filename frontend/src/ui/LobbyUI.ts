import { LobbyClient, type LobbyState, type GameMode } from '../net/collabSync';
import { generateProceduralMap, type ProceduralTheme } from '../map/proceduralGen';
import { exportToTiledJson } from '../map/mapModel';
import { parseTmxXml, parseTsxXml, resolveExternalTilesetSources } from '../map/tiledParser';
import type { CharacterKind } from '../sim/types';

export class LobbyUI {
  public client: LobbyClient;
  private container: HTMLElement;
  private uploadedTiledMap: any | null = null;
  private onLaunchGameCb?: (lobby: LobbyState, hero: CharacterKind, mapData?: any) => void;
  private onBackCb?: () => void;
  private playerName: string = '';

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    const savedName = localStorage.getItem('meadowblade_player_name') || '';
    this.playerName = savedName;
    this.client = new LobbyClient(this.playerName || undefined);
    this.init();
  }

  private init(): void {
    this.client.onDiscovered((lobbies) => this.renderLobbyList(lobbies));
    this.client.onUpdate((lobby) => this.renderRoomView(lobby));
    this.client.onStartGame((lobby) => {
      this.onLaunchGameCb?.(lobby, this.client.localPlayer.hero, this.uploadedTiledMap ?? undefined);
    });
    this.client.onChat((user, text) => this.appendChatMessage(user, text));

    if (!this.playerName) {
      this.renderNamePrompt();
    } else {
      this.renderBrowseView();
    }
  }

  public renderNamePrompt(): void {
    this.container.innerHTML = `
      <div class="lobby-screen" style="max-width: 480px; height: auto; padding: 32px 28px; text-align: center;">
        <div style="font-size: 32px; margin-bottom: 8px;">⚔️</div>
        <h2 style="font-size: 22px; color: #f8fafc; margin-bottom: 6px;">Enter Your Hero Name</h2>
        <p style="font-size: 13px; color: #94a3b8; margin-bottom: 20px;">
          Choose your identity before entering multiplayer lobbies, co-op parties, or PVP duels.
        </p>
        <div style="margin-bottom: 16px;">
          <input id="prompt-player-name" type="text" placeholder="e.g. Shadowblade, Valen, Aerith" class="ed-input" style="font-size: 15px; padding: 10px 14px; text-align: center;" autofocus />
        </div>
        <div style="display: flex; gap: 10px;">
          <button id="prompt-back-btn" class="ed-btn ghost" style="flex: 1; padding: 10px;">← Main Menu</button>
          <button id="prompt-continue-btn" class="ed-btn primary" style="flex: 2; padding: 10px; font-weight: 700;">Continue to Lobby →</button>
        </div>
      </div>
    `;

    const input = document.getElementById('prompt-player-name') as HTMLInputElement;
    input?.focus();

    const proceed = () => {
      const val = input.value.trim();
      if (!val) {
        input.style.borderColor = '#ef4444';
        return;
      }
      this.playerName = val;
      localStorage.setItem('meadowblade_player_name', val);
      this.client.localPlayer.name = val;
      this.renderBrowseView();
    };

    document.getElementById('prompt-continue-btn')?.addEventListener('click', proceed);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') proceed();
    });
    document.getElementById('prompt-back-btn')?.addEventListener('click', () => {
      this.onBackCb?.();
    });
  }

  public renderBrowseView(): void {
    this.container.innerHTML = `
      <div class="lobby-screen">
        <div class="lobby-header">
          <button id="lobby-back-btn" class="ed-btn ghost">← Main Menu</button>
          <h2>Multiplayer Adventure Lobbies</h2>
          <div class="lobby-user-tag">
            Playing as: <strong id="lobby-username">${this.client.localPlayer.name}</strong>
            <button id="change-name-btn" class="ed-btn tiny ghost" style="margin-left: 8px; font-size: 10px; padding: 2px 6px;">Edit</button>
          </div>
        </div>

        <div class="lobby-body-grid">
          <!-- Left: Available Lobbies -->
          <div class="lobby-panel">
            <div class="panel-header">
              <h3>Discovered Rooms</h3>
              <button id="refresh-lobbies-btn" class="ed-btn small">Refresh</button>
            </div>
            <div id="lobbies-list" class="lobbies-list">
              <div class="empty-hint">Scanning for open parties across your tabs & network...</div>
            </div>
          </div>

          <!-- Right: Host or Direct Code Join -->
          <div class="lobby-panel">
            <div class="panel-header">
              <h3>Host or Direct Join</h3>
            </div>

            <div class="form-section">
              <label class="form-label">Create a New Room</label>
              <div class="form-row">
                <input id="new-lobby-name" type="text" placeholder="Party Name" value="${this.client.localPlayer.name}'s Room" class="ed-input" />
              </div>

              <!-- Game Mode Selector: Co-op vs PVP Arena -->
              <div class="form-row" style="margin-top:12px;">
                <label class="form-sublabel">Select Match Mode:</label>
                <select id="lobby-game-mode" class="ed-select">
                  <option value="coop" selected>🤝 Cooperative Adventure (Battle Mobs & Bosses Together)</option>
                  <option value="pvp">⚔️ PVP Duel Arena (Player vs Player Combat)</option>
                </select>
              </div>

              <!-- Map Source Option Tabs -->
              <div class="form-row" style="margin-top:10px;">
                <label class="form-sublabel">Select Map Mode:</label>
                <select id="lobby-map-mode" class="ed-select">
                  <option value="builtin" selected>Built-in Lush Meadow (Tiled Map)</option>
                  <option value="random">Random Procedural Realm</option>
                  <option value="import">Upload Tiled JSON Map File</option>
                </select>
              </div>

              <!-- Random Gen Biome Choice -->
              <div id="random-biome-row" class="form-row" style="margin-top:8px; display:none;">
                <label class="form-sublabel">Random Generation Theme:</label>
                <select id="random-theme-select" class="ed-select">
                  <option value="grassland">Lush Meadow with River & Bridge</option>
                  <option value="forest">Ancient Deep Forest Glades</option>
                  <option value="cave">Subterranean Crystal Cavern</option>
                  <option value="desert">Desert Sands & Oasis Ruins</option>
                  <option value="snow">Frozen Tundra & Ice Chasm</option>
                </select>
              </div>

              <!-- Import Tiled JSON / TMX / TSX Choice -->
              <div id="import-map-row" class="form-row" style="margin-top:8px; display:none;">
                <label class="form-sublabel">Upload Tiled Map (.json, .tmx, .tsx):</label>
                <label class="ed-btn success file-btn full-width" style="justify-content:center; padding:8px;">
                  <span id="import-btn-label">Choose Tiled File</span>
                  <input id="lobby-import-file" type="file" accept=".json,.tmj,.tmx,.xml,.tsx,.tsj" style="display:none;" />
                </label>
              </div>

              <button id="create-lobby-btn" class="ed-btn primary full-width" style="margin-top:14px;">Host Game Room</button>
            </div>

            <div class="divider"><span>OR</span></div>

            <div class="form-section">
              <label class="form-label">Join with Room Code</label>
              <div class="join-code-row">
                <input id="direct-code-input" type="text" placeholder="e.g. BLADE-74" class="ed-input" style="text-transform:uppercase;" />
                <button id="direct-join-btn" class="ed-btn success">Join</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Map mode dropdown toggle
    const modeSelect = document.getElementById('lobby-map-mode') as HTMLSelectElement;
    const randomRow = document.getElementById('random-biome-row')!;
    const importRow = document.getElementById('import-map-row')!;

    modeSelect.addEventListener('change', () => {
      const v = modeSelect.value;
      randomRow.style.display = v === 'random' ? 'block' : 'none';
      importRow.style.display = v === 'import' ? 'block' : 'none';
    });

    // File import in lobby
    const fileInput = document.getElementById('lobby-import-file') as HTMLInputElement;
    fileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const content = reader.result as string;
            const fname = file.name.toLowerCase();
            const mapName = file.name.replace(/\.[^/.]+$/, '');
            let parsed: any;

            if (fname.endsWith('.tmx') || (fname.endsWith('.xml') && content.includes('<map'))) {
              parsed = parseTmxXml(content, mapName);
            } else if (fname.endsWith('.tsx') || (fname.endsWith('.xml') && content.includes('<tileset'))) {
              const tsx = parseTsxXml(content);
              parsed = {
                name: `${mapName} Playground`,
                width: 32,
                height: 22,
                tilewidth: tsx.tilewidth || 32,
                tileheight: tsx.tileheight || 32,
                tilesets: [{ firstgid: 1, name: tsx.name, source: file.name }],
                layers: [
                  { name: 'ground', type: 'tilelayer', width: 32, height: 22, data: new Array(32 * 22).fill(1) },
                  {
                    name: 'objects',
                    type: 'objectgroup',
                    objects: [
                      { name: 'player_spawn', type: 'player_spawn', point: true, x: 512, y: 352 },
                      { name: 'tree_1', type: 'tree', point: true, x: 256, y: 220, properties: [{ name: 'variant', value: 'tree1B' }] }
                    ]
                  }
                ]
              };
              resolveExternalTilesetSources(parsed);
            } else {
              parsed = JSON.parse(content);
              resolveExternalTilesetSources(parsed);
            }

            this.uploadedTiledMap = parsed;
            const lbl = document.getElementById('import-btn-label');
            if (lbl) lbl.textContent = `Loaded: ${mapName}`;
          } catch {
            alert('Could not parse Tiled file: ' + file.name);
          }
        };
        reader.readAsText(file);
      }
    });

    document.getElementById('lobby-back-btn')?.addEventListener('click', () => {
      this.onBackCb?.();
    });

    document.getElementById('refresh-lobbies-btn')?.addEventListener('click', () => {
      this.client.queryLobbies();
    });

    document.getElementById('change-name-btn')?.addEventListener('click', () => {
      this.renderNamePrompt();
    });

    document.getElementById('create-lobby-btn')?.addEventListener('click', () => {
      const nameInput = document.getElementById('new-lobby-name') as HTMLInputElement;
      const mode = modeSelect.value;
      const gameModeSelect = document.getElementById('lobby-game-mode') as HTMLSelectElement;
      const gameMode = (gameModeSelect?.value || 'coop') as GameMode;

      let mapId = 'meadow';
      let mapName = 'Meadow Realm';

      if (mode === 'random') {
        const theme = (document.getElementById('random-theme-select') as HTMLSelectElement).value as ProceduralTheme;
        const procMap = generateProceduralMap(theme, `Procedural ${theme.toUpperCase()} Realm`);
        this.uploadedTiledMap = exportToTiledJson(procMap);
        mapId = procMap.id;
        mapName = procMap.name;
      } else if (mode === 'import' && this.uploadedTiledMap) {
        mapId = 'imported_tiled';
        mapName = this.uploadedTiledMap.name || 'Custom Tiled Map';
      }

      this.client.hostLobby(mapId, mapName, nameInput.value.trim(), gameMode);
    });

    document.getElementById('direct-join-btn')?.addEventListener('click', () => {
      const input = document.getElementById('direct-code-input') as HTMLInputElement;
      const code = input.value.trim().toUpperCase();
      if (code) {
        this.client.joinLobby(code);
      }
    });

    this.client.queryLobbies();
  }

  private renderLobbyList(lobbies: LobbyState[]): void {
    const listEl = document.getElementById('lobbies-list');
    if (!listEl) return;

    if (lobbies.length === 0) {
      listEl.innerHTML = `<div class="empty-hint">No parties found yet. Open another tab or click 'Host Game Room' to start one!</div>`;
      return;
    }

    listEl.innerHTML = lobbies
      .map(
        (l) => `
        <div class="lobby-card">
          <div class="lobby-card-info">
            <div class="lobby-card-title">${l.name} ${l.gameMode === 'pvp' ? '<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); font-size: 10px; padding: 1px 6px; border-radius: 4px; margin-left: 6px;">⚔️ PVP ARENA</span>' : '<span style="background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); font-size: 10px; padding: 1px 6px; border-radius: 4px; margin-left: 6px;">🤝 CO-OP</span>'}</div>
            <div class="lobby-card-sub">Map: <strong>${l.mapName}</strong> · Code: <span class="room-code-tag">${l.code}</span></div>
          </div>
          <div class="lobby-card-right">
            <span class="player-count-pill">${l.players.length}/${l.maxPlayers}</span>
            <button class="ed-btn small success join-btn" data-code="${l.code}">Join</button>
          </div>
        </div>
      `
      )
      .join('');

    listEl.querySelectorAll<HTMLElement>('.join-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code;
        if (code) this.client.joinLobby(code);
      });
    });
  }

  public renderRoomView(lobby: LobbyState): void {
    const isHost = this.client.localPlayer.isHost;
    const isReady = this.client.localPlayer.ready;

    this.container.innerHTML = `
      <div class="lobby-room-screen">
        <header class="room-header">
          <button id="leave-room-btn" class="ed-btn ghost">← Leave Room</button>
          <div class="room-title-box">
            <h2>${lobby.name}</h2>
            <div class="room-code-display">
              Room Code: <strong id="code-val">${lobby.code}</strong>
              <button id="copy-code-btn" class="ed-btn tiny">Copy</button>
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <div class="room-map-badge" style="${lobby.gameMode === 'pvp' ? 'background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #f87171;' : ''}">
              Mode: <strong>${lobby.gameMode === 'pvp' ? '⚔️ PVP Duel Arena' : '🤝 Co-op Adventure'}</strong>
            </div>
            <div class="room-map-badge">Realm: <strong>${lobby.mapName}</strong></div>
          </div>
        </header>

        <div class="room-grid">
          <!-- Left: Player Slots -->
          <div class="room-players-panel">
            <h3>Heroes in Party (${lobby.players.length}/${lobby.maxPlayers})</h3>
            <div class="players-slot-list">
              ${lobby.players
                .map(
                  (p) => `
                <div class="player-slot-card ${p.ready ? 'ready' : ''} ${p.id === this.client.localPlayer.id ? 'local' : ''}">
                  <div class="slot-avatar hero-${p.hero}"></div>
                  <div class="slot-info">
                    <div class="slot-name">${p.name} ${p.isHost ? '👑' : ''}</div>
                    <div class="slot-hero">${this.getHeroTitle(p.hero)}</div>
                  </div>
                  <div class="slot-status ${p.ready ? 'ready' : 'pending'}">
                    ${p.ready ? 'READY' : 'NOT READY'}
                  </div>
                </div>
              `
                )
                .join('')}
            </div>

            <!-- Hero Selector for Local Player -->
            <div class="local-hero-select">
              <div class="label">Choose Your Character:</div>
              <div class="hero-pick-row">
                <button class="hero-btn ${this.client.localPlayer.hero === 'crimson' ? 'active' : ''}" data-hero="crimson">Crimson Red</button>
                <button class="hero-btn ${this.client.localPlayer.hero === 'elvish' ? 'active' : ''}" data-hero="elvish">Elvish Ranger</button>
                <button class="hero-btn ${this.client.localPlayer.hero === 'legacy' ? 'active' : ''}" data-hero="legacy">Legacy Knight</button>
              </div>
            </div>
          </div>

          <!-- Right: Chat & Start Game -->
          <div class="room-chat-panel">
            <h3>Party Chat & Briefing</h3>
            <div id="room-chat-box" class="chat-log">
              <div class="chat-msg system">Welcome to party ${lobby.name}. Ready up before launching!</div>
            </div>
            <div class="chat-input-row">
              <input id="room-chat-input" type="text" placeholder="Send message..." class="ed-input" />
              <button id="room-chat-send" class="ed-btn">Send</button>
            </div>

            <div class="room-action-bar">
              <button id="toggle-ready-btn" class="ed-btn ${isReady ? 'ghost' : 'success'} big">
                ${isReady ? 'Cancel Ready' : '✔ Ready Up'}
              </button>
              ${
                isHost
                  ? `<button id="launch-game-btn" class="ed-btn primary big">⚔️ Launch Adventure</button>`
                  : `<div class="waiting-host-hint">Waiting for host 👑 to start...</div>`
              }
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('leave-room-btn')?.addEventListener('click', () => {
      this.client.leaveLobby();
      this.renderBrowseView();
    });

    document.getElementById('copy-code-btn')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(lobby.code);
      const btn = document.getElementById('copy-code-btn');
      if (btn) btn.textContent = 'Copied!';
      setTimeout(() => {
        if (btn) btn.textContent = 'Copy';
      }, 1200);
    });

    document.querySelectorAll<HTMLElement>('.hero-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hero = btn.dataset.hero as CharacterKind | undefined;
        if (hero) {
          this.client.setHero(hero);
        }
      });
    });

    document.getElementById('toggle-ready-btn')?.addEventListener('click', () => {
      this.client.toggleReady();
    });

    document.getElementById('launch-game-btn')?.addEventListener('click', () => {
      this.client.launchGame();
    });

    const chatInput = document.getElementById('room-chat-input') as HTMLInputElement;
    const sendChat = () => {
      const text = chatInput.value.trim();
      if (text) {
        this.client.sendChat(text);
        chatInput.value = '';
      }
    };
    document.getElementById('room-chat-send')?.addEventListener('click', sendChat);
    chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChat();
    });
  }

  private appendChatMessage(user: string, text: string): void {
    const box = document.getElementById('room-chat-box');
    if (!box) return;
    const msg = document.createElement('div');
    msg.className = 'chat-msg';
    msg.innerHTML = `<strong>${user}:</strong> ${text}`;
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
  }

  private getHeroTitle(k: CharacterKind): string {
    if (k === 'crimson') return 'Blademaiden';
    if (k === 'elvish') return 'Sylph Archer';
    return 'Iron Vanguard';
  }

  public onLaunch(cb: (lobby: LobbyState, hero: CharacterKind, tiledMapData?: any) => void): void {
    this.onLaunchGameCb = cb;
  }

  public onBack(cb: () => void): void {
    this.onBackCb = cb;
  }
}