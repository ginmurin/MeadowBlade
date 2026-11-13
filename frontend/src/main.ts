import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { WorldScene } from './game/scenes/WorldScene';
import { MainMenu } from './ui/MainMenu';
import { LobbyUI } from './ui/LobbyUI';
import { showToast } from './ui/toast';
import type { CharacterKind } from './sim/types';
import { parseTmxXml, resolveExternalTilesetSources } from './map/tiledParser';

export type AppScreen = 'menu' | 'game' | 'lobby';

export interface StartWorldOptions {
  tiledMapData?: any;
  tiledMapKey?: string;
  mapName?: string;
  hero?: CharacterKind;
  waveMode?: boolean;
  lobbyRoomCode?: string;
  isPvp?: boolean;
  localPlayerName?: string;
}

class AppController {
  private game: Phaser.Game;
  private selectedHero: CharacterKind = 'crimson';
  private activeTiledMapData?: any;
  private activeTiledMapKey = 'meadow';
  private activeMapName = 'Meadow Realm';
  private activeWaveMode = false;
  private lobbyUI: LobbyUI | null = null;

  constructor() {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game-root',
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#0d1216',
      pixelArt: true,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      scene: [BootScene, WorldScene]
    });

    this.initMainMenu();
    this.initHeroSelectModal();
    this.initSettingsModal();
    this.bindGlobalEvents();
    this.switchScreen('menu');

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('map') === 'cave') {
      fetch('/assets/maps/cave_dungeon.tmx')
        .then((r) => r.text())
        .then((tmxText) => {
          const parsed = parseTmxXml(tmxText, 'cave dungeon');
          this.startWorld({
            tiledMapData: parsed,
            mapName: 'cave dungeon',
            waveMode: false
          });
        })
        .catch((err) => console.error('Failed to auto-load cave map:', err));
    }
  }

  private initMainMenu(): void {
    const menu = new MainMenu('menu-root');

    menu.onPlay(() => {
      this.startWorld({
        tiledMapData: undefined,
        tiledMapKey: 'meadow',
        mapName: 'Meadow Realm',
        waveMode: true
      });
    });

    menu.onLoadTiledMap((tiledJson, mapName) => {
      showToast(`Loaded Tiled map: ${mapName}`);
      this.startWorld({
        tiledMapData: tiledJson,
        mapName,
        waveMode: false
      });
    });

    menu.onLobby(() => {
      this.switchScreen('lobby');
      this.startLobby();
    });

    menu.onHeroSelect(() => {
      const modal = document.getElementById('char-select-modal');
      modal?.classList.add('visible');
    });

    menu.onSettings(() => {
      window.dispatchEvent(new CustomEvent('meadowblade_open_settings'));
    });
  }

  private initSettingsModal(): void {
    const modal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('close-settings-btn');
    const saveBtn = document.getElementById('save-settings-btn');
    const badgeEl = document.getElementById('flash-mode-badge');

    const openSettings = () => {
      window.dispatchEvent(new CustomEvent('meadowblade_pause_game', { detail: true }));
      modal?.classList.add('visible');
      syncPillState();
    };

    const closeSettings = () => {
      modal?.classList.remove('visible');
      window.dispatchEvent(new CustomEvent('meadowblade_pause_game', { detail: false }));
    };

    const syncPillState = () => {
      const currentFlash = localStorage.getItem('meadowblade_flash_setting') || 'off';
      const currentShake = localStorage.getItem('meadowblade_shake_setting') || 'reduced';

      document.querySelectorAll<HTMLButtonElement>('.settings-pill-btn').forEach((btn) => {
        const setting = btn.dataset.setting;
        const val = btn.dataset.value;
        if (setting === 'flash') {
          btn.classList.toggle('active', val === currentFlash);
        } else if (setting === 'shake') {
          btn.classList.toggle('active', val === currentShake);
        }
      });

      if (badgeEl) {
        if (currentFlash === 'off') {
          badgeEl.textContent = 'EPILEPSY SAFE';
          badgeEl.style.color = '#34d399';
          badgeEl.style.borderColor = 'rgba(52, 211, 153, 0.4)';
          badgeEl.style.background = 'rgba(52, 211, 153, 0.15)';
        } else if (currentFlash === 'soft') {
          badgeEl.textContent = 'REDUCED TINT';
          badgeEl.style.color = '#fbbf24';
          badgeEl.style.borderColor = 'rgba(251, 191, 36, 0.4)';
          badgeEl.style.background = 'rgba(251, 191, 36, 0.15)';
        } else {
          badgeEl.textContent = 'FULL FLASH';
          badgeEl.style.color = '#f87171';
          badgeEl.style.borderColor = 'rgba(248, 113, 113, 0.4)';
          badgeEl.style.background = 'rgba(248, 113, 113, 0.15)';
        }
      }
    };

    closeBtn?.addEventListener('click', closeSettings);
    saveBtn?.addEventListener('click', closeSettings);
    document.getElementById('hud-settings-btn')?.addEventListener('click', openSettings);

    document.querySelectorAll<HTMLButtonElement>('.settings-pill-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const setting = btn.dataset.setting;
        const val = btn.dataset.value;
        if (setting === 'flash' && val) {
          localStorage.setItem('meadowblade_flash_setting', val);
        } else if (setting === 'shake' && val) {
          localStorage.setItem('meadowblade_shake_setting', val);
        }
        syncPillState();
      });
    });

    if (!localStorage.getItem('meadowblade_flash_setting')) {
      localStorage.setItem('meadowblade_flash_setting', 'off');
    }
    if (!localStorage.getItem('meadowblade_shake_setting')) {
      localStorage.setItem('meadowblade_shake_setting', 'reduced');
    }
    syncPillState();

    window.addEventListener('meadowblade_open_settings', openSettings);
  }

  private initHeroSelectModal(): void {
    const modal = document.getElementById('char-select-modal');
    const closeBtn = document.getElementById('close-hero-select-btn');
    const backBtn = document.getElementById('back-hero-select-btn');

    const closeModal = () => {
      modal?.classList.remove('visible');
      window.dispatchEvent(new CustomEvent('meadowblade_close_hero_select'));
    };

    closeBtn?.addEventListener('click', closeModal);
    backBtn?.addEventListener('click', closeModal);

    const cards = document.querySelectorAll<HTMLElement>('.hero-card');
    cards.forEach((card) => {
      const hero = card.dataset.hero as CharacterKind | undefined;
      const pickBtn = card.querySelector('.pick-btn');

      const selectHero = (e?: Event) => {
        e?.stopPropagation();
        if (!hero) return;
        this.selectedHero = hero;
        cards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');

        const heroNames: Record<CharacterKind, string> = {
          crimson: 'Crimson Red (Blademaiden)',
          elvish: 'Elvish Ranger (Sylph Archer)',
          legacy: 'Legacy Knight (Iron Vanguard)'
        };
        const heroSub = document.querySelector('#menu-hero-btn small');
        if (heroSub) heroSub.textContent = `Selected: ${heroNames[hero]}`;

        showToast(`Hero selected: ${heroNames[hero]}`);
        window.dispatchEvent(new CustomEvent('meadowblade_hero_change', { detail: hero }));
        closeModal();
      };

      card.addEventListener('click', selectHero);
      pickBtn?.addEventListener('click', selectHero);
    });
  }

  private bindGlobalEvents(): void {
    window.addEventListener('meadowblade_open_menu', () => {
      this.switchScreen('menu');
    });

    document.getElementById('hud-menu-btn')?.addEventListener('click', () => {
      this.switchScreen('menu');
    });

    // Global drag & drop for Tiled maps (.tmx, .json, .tmj, .xml)
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        const fname = file.name.toLowerCase();
        const isSupported = fname.endsWith('.json') || fname.endsWith('.tmj') || fname.endsWith('.tmx') || fname.endsWith('.xml');
        if (!isSupported) return;

        const reader = new FileReader();
        reader.onload = () => {
          try {
            const content = reader.result as string;
            const mapName = file.name.replace(/\.[^/.]+$/, '');
            let parsed: any;
            if (fname.endsWith('.tmx') || (fname.endsWith('.xml') && content.includes('<map'))) {
              parsed = parseTmxXml(content, mapName);
            } else {
              parsed = JSON.parse(content);
              resolveExternalTilesetSources(parsed);
            }

            showToast(`Loaded Tiled map: ${mapName}`);
            this.startWorld({
              tiledMapData: parsed,
              mapName,
              waveMode: false
            });
          } catch (err) {
            alert('Invalid Tiled Map (' + file.name + '): ' + String(err));
          }
        };
        reader.readAsText(file);
      }
    });
  }

  public switchScreen(screen: AppScreen): void {
    const menuEl = document.getElementById('menu-root')!;
    const hudEl = document.getElementById('hud')!;
    const lobbyEl = document.getElementById('lobby-root')!;
    const gameRoot = document.getElementById('game-root')!;

    menuEl.style.display = screen === 'menu' ? 'flex' : 'none';
    hudEl.style.display = screen === 'game' ? 'flex' : 'none';
    lobbyEl.style.display = screen === 'lobby' ? 'flex' : 'none';

    if (screen === 'game') {
      gameRoot.style.visibility = 'visible';
      gameRoot.style.pointerEvents = 'auto';
      gameRoot.style.zIndex = '10';
      this.game.scale.resize(window.innerWidth, window.innerHeight);
    } else {
      gameRoot.style.visibility = 'hidden';
      gameRoot.style.pointerEvents = 'none';
      gameRoot.style.zIndex = '1';
    }

    if (screen === 'menu') {
      const worldScene = this.game.scene.getScene('WorldScene');
      if (worldScene && worldScene.scene.isActive()) {
        worldScene.scene.pause();
      }
    }
  }

  public startWorld(options?: StartWorldOptions): void {
    this.activeTiledMapData = options?.tiledMapData;
    this.activeTiledMapKey = options?.tiledMapKey || (this.activeTiledMapData ? `custom_tiled_${Date.now()}` : 'meadow');
    this.activeMapName = options?.mapName || (this.activeTiledMapData ? 'Custom Tiled Map' : 'Meadow Realm');
    const isCustomMap = Boolean(this.activeTiledMapData || (this.activeTiledMapKey && this.activeTiledMapKey !== 'meadow'));
    this.activeWaveMode = options?.waveMode !== undefined ? options.waveMode : !isCustomMap;
    if (options?.hero) {
      this.selectedHero = options.hero;
    }

    this.switchScreen('game');

    requestAnimationFrame(() => {
      this.game.scale.resize(window.innerWidth, window.innerHeight);
      const worldScene = this.game.scene.getScene('WorldScene');
      const sceneData = {
        tiledMapData: this.activeTiledMapData,
        tiledMapKey: this.activeTiledMapKey,
        mapName: this.activeMapName,
        hero: this.selectedHero,
        waveMode: this.activeWaveMode,
        lobbyRoomCode: options?.lobbyRoomCode,
        isPvp: options?.isPvp,
        localPlayerName: options?.localPlayerName
      };

      if (worldScene) {
        if (worldScene.scene.isPaused()) {
          worldScene.scene.resume();
        }
        if (worldScene.scene.isActive()) {
          worldScene.scene.restart(sceneData);
        } else {
          this.game.scene.start('WorldScene', sceneData);
        }
      } else {
        this.game.scene.start('WorldScene', sceneData);
      }
    });
  }

  private startLobby(): void {
    this.lobbyUI = new LobbyUI('lobby-root');

    this.lobbyUI.onBack(() => {
      this.switchScreen('menu');
    });

    this.lobbyUI.onLaunch((lobby, hero, tiledMapData) => {
      this.startWorld({
        tiledMapData,
        tiledMapKey: tiledMapData ? undefined : lobby.mapId,
        mapName: lobby.mapName,
        hero,
        lobbyRoomCode: lobby.code,
        isPvp: lobby.gameMode === 'pvp',
        localPlayerName: localStorage.getItem('meadowblade_player_name') || 'Hero'
      });
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new AppController();
});
