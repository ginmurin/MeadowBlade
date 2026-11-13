import { parseTmxXml, parseTsxXml, resolveExternalTilesetSources } from '../map/tiledParser';

export class MainMenu {
  private container: HTMLElement;
  private onPlayCb?: () => void;
  private onLoadTiledMapCb?: (tiledJson: any, mapName: string) => void;
  private onLobbyCb?: () => void;
  private onHeroSelectCb?: () => void;
  private onSettingsCb?: () => void;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    this.render();
  }

  public render(): void {
    this.container.innerHTML = `
      <div class="main-menu-screen">
        <div class="menu-backdrop"></div>
        <div class="menu-content">
          <div class="menu-title-block">
            <div class="menu-badge">ALPHA BUILD · BROWSER RPG</div>
            <h1 class="menu-title">MEADOWBLADE</h1>
            <p class="menu-tagline">Real-time Top-Down Combat with Native Tiled Map & TSX Support</p>
          </div>

          <div class="menu-nav-box">
            <button id="menu-play-btn" class="menu-btn primary">
              <span class="btn-text">
                <strong>Play Default Meadow</strong>
                <small>Enter the meadow realm and battle enemy waves</small>
              </span>
            </button>

            <button id="menu-load-tiled-btn" class="menu-btn accent">
              <span class="btn-text">
                <strong>Load Tiled Map (.json, .tmx, .tsx)</strong>
                <small>Native support for Tiled maps, TSX tilesets, colliders, trees, portals & zones</small>
              </span>
            </button>
            <input type="file" id="menu-tiled-file-input" accept=".json,.tmj,.tmx,.xml,.tsx,.tsj" style="display:none;" />

            <button id="menu-lobby-btn" class="menu-btn">
              <span class="btn-text">
                <strong>Multiplayer Lobby</strong>
                <small>Host or join parties with room codes & Tiled maps</small>
              </span>
            </button>

            <button id="menu-hero-btn" class="menu-btn ghost">
              <span class="btn-text">
                <strong>Choose Hero</strong>
                <small>Crimson Red · Elvish Ranger · Legacy Knight</small>
              </span>
            </button>

            <button id="menu-settings-btn" class="menu-btn ghost">
              <span class="btn-text">
                <strong>Settings & Accessibility</strong>
                <small>Epilepsy-safe flash controls, camera shake & keybindings</small>
              </span>
            </button>
          </div>

          <footer class="menu-footer">
            <span>Powered by Phaser 3 & TypeScript</span>
            <span>·</span>
            <span>Controls: WASD Move/Face · J Attack · K Bow · Shift Dash · Space Roll · Q Guard · E Skill · R Ult · F Throw</span>
          </footer>
        </div>
      </div>
    `;

    document.getElementById('menu-play-btn')?.addEventListener('click', () => {
      this.onPlayCb?.();
    });

    const fileInput = document.getElementById('menu-tiled-file-input') as HTMLInputElement;
    document.getElementById('menu-load-tiled-btn')?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) {
        this.readTiledFile(file);
      }
      fileInput.value = '';
    });

    // Drag and drop onto main menu
    this.container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    this.container.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext && ['json', 'tmj', 'tmx', 'xml', 'tsx', 'tsj'].includes(ext)) {
          this.readTiledFile(file);
        }
      }
    });

    document.getElementById('menu-lobby-btn')?.addEventListener('click', () => {
      this.onLobbyCb?.();
    });

    document.getElementById('menu-hero-btn')?.addEventListener('click', () => {
      this.onHeroSelectCb?.();
    });

    document.getElementById('menu-settings-btn')?.addEventListener('click', () => {
      this.onSettingsCb?.();
    });
  }

  private readTiledFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = reader.result as string;
        const fname = file.name.toLowerCase();
        const mapName = file.name.replace(/\.[^/.]+$/, '');
        let parsed: any;

        if (fname.endsWith('.tmx') || (fname.endsWith('.xml') && content.includes('<map'))) {
          // Native Tiled TMX XML map format
          parsed = parseTmxXml(content, mapName);
        } else if (fname.endsWith('.tsx') || (fname.endsWith('.xml') && content.includes('<tileset'))) {
          // Tiled TSX Tileset file: generate a playable playground showcasing the tileset
          const tsx = parseTsxXml(content);
          parsed = {
            name: `${mapName} Playground`,
            width: 32,
            height: 22,
            tilewidth: tsx.tilewidth || 32,
            tileheight: tsx.tileheight || 32,
            tilesets: [
              {
                firstgid: 1,
                name: tsx.name,
                source: file.name
              }
            ],
            layers: [
              {
                name: 'ground',
                type: 'tilelayer',
                width: 32,
                height: 22,
                data: new Array(32 * 22).fill(1)
              },
              {
                name: 'objects',
                type: 'objectgroup',
                objects: [
                  { name: 'player_spawn', type: 'player_spawn', point: true, x: 512, y: 352 },
                  { name: 'test_tree_1', type: 'tree', point: true, x: 256, y: 220, properties: [{ name: 'variant', value: 'tree1B' }] },
                  { name: 'test_tree_2', type: 'tree', point: true, x: 768, y: 220, properties: [{ name: 'variant', value: 'tree2B' }] }
                ]
              }
            ]
          };
          resolveExternalTilesetSources(parsed);
        } else {
          // JSON / TMJ / TSJ map format
          parsed = JSON.parse(content);
          resolveExternalTilesetSources(parsed);
        }

        this.onLoadTiledMapCb?.(parsed, mapName);
      } catch (err) {
        alert('Could not parse Tiled file (' + file.name + '): ' + String(err));
      }
    };
    reader.readAsText(file);
  }

  public onPlay(cb: () => void): void {
    this.onPlayCb = cb;
  }

  public onLoadTiledMap(cb: (tiledJson: any, mapName: string) => void): void {
    this.onLoadTiledMapCb = cb;
  }

  public onLobby(cb: () => void): void {
    this.onLobbyCb = cb;
  }

  public onHeroSelect(cb: () => void): void {
    this.onHeroSelectCb = cb;
  }

  public onSettings(cb: () => void): void {
    this.onSettingsCb = cb;
  }
}
