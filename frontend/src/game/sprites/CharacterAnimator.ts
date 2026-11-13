import Phaser from 'phaser';
import { directionToSheetRow } from '../../sim/directions';
import type { ActionState, ActorSnapshot, CharacterKind } from '../../sim/types';
import { animKey, CHARACTER_SHEETS } from './sheetManifest';

export class CharacterAnimator {
  public readonly body: Phaser.GameObjects.Sprite;
  private readonly overlay: Phaser.GameObjects.Sprite | null;
  private readonly hpBg: Phaser.GameObjects.Rectangle | null = null;
  private readonly hpFill: Phaser.GameObjects.Rectangle | null = null;
  private peerNameText?: Phaser.GameObjects.Text;
  private peerHpBg?: Phaser.GameObjects.Rectangle;
  private peerHpFill?: Phaser.GameObjects.Rectangle;
  private chargeBarBg?: Phaser.GameObjects.Rectangle;
  private chargeBarFill?: Phaser.GameObjects.Rectangle;
  private lastAnim = '';
  private lastOverlayAnim = '';

  constructor(scene: Phaser.Scene, snapshot: ActorSnapshot) {
    const charKind: CharacterKind = (snapshot.kind in CHARACTER_SHEETS ? snapshot.kind : 'elvish') as CharacterKind;
    const idleSheet = CHARACTER_SHEETS[charKind].idle!;
    this.body = scene.add.sprite(snapshot.x, snapshot.y, idleSheet.key, 0);
    // Anchor near character's feet inside the 64x64 frame
    this.body.setOrigin(0.5, 0.72);

    if (snapshot.kind === 'crimson') {
      this.overlay = scene.add.sprite(snapshot.x, snapshot.y, 'crimson_slash1_vfx', 0);
      this.overlay.setOrigin(0.5, 0.72);
      this.overlay.setVisible(false);
    } else {
      this.overlay = null;
    }

    if (!snapshot.isPlayer) {
      this.hpBg = scene.add.rectangle(snapshot.x, snapshot.y - 28, 28, 4, 0x0b0f13, 0.85);
      this.hpFill = scene.add.rectangle(snapshot.x - 13, snapshot.y - 28, 26, 2, 0xef4444, 1);
      this.hpFill.setOrigin(0, 0.5);
    }
  }

  public sync(snapshot: ActorSnapshot): void {
    const alive = snapshot.action !== 'dead';
    this.body.setVisible(alive);

    if (!alive) {
      this.overlay?.setVisible(false);
      this.hpBg?.setVisible(false);
      this.hpFill?.setVisible(false);
      return;
    }

    this.body.setPosition(snapshot.x, snapshot.y);
    this.body.setDepth(snapshot.y);

    const { row, flipX } = directionToSheetRow(snapshot.facing);
    this.body.setFlipX(flipX);

    const charKind: CharacterKind = (snapshot.kind in CHARACTER_SHEETS ? snapshot.kind : 'elvish') as CharacterKind;
    const sheetMap = CHARACTER_SHEETS[charKind];
    const resolvedAction: ActionState = sheetMap[snapshot.action] ? snapshot.action : 'idle';
    const spec = sheetMap[resolvedAction] ?? sheetMap.idle!;

    const targetAnim = animKey(spec.key, row);
    if (this.lastAnim !== targetAnim) {
      this.body.play(targetAnim, true);
      this.lastAnim = targetAnim;
    }

    // Weapon slash arc overlay (for Crimson Red)
    if (this.overlay) {
      if (spec.overlayKey) {
        let vfxKey = spec.overlayKey;
        if (snapshot.isFlameStance) {
          if (snapshot.isRecastReady) {
            vfxKey = spec.overlayKey === 'crimson_slash1_vfx' ? 'crimson_slash1_bloody_vfx' : 'crimson_slash2_bloody_vfx';
          } else {
            vfxKey = spec.overlayKey === 'crimson_slash1_vfx' ? 'crimson_slash1_flame_vfx' : 'crimson_slash2_flame_vfx';
          }
        }
        const targetOverlay = animKey(vfxKey, row);
        this.overlay.setVisible(true);
        this.overlay.setPosition(this.body.x, this.body.y);
        this.overlay.setFlipX(flipX);
        this.overlay.setDepth(snapshot.y + 0.5);
        if (this.lastOverlayAnim !== targetOverlay) {
          this.overlay.play(targetOverlay, true);
          this.lastOverlayAnim = targetOverlay;
        }
      } else {
        this.overlay.setVisible(false);
        this.lastOverlayAnim = '';
      }
    }

    // Invulnerability blink / hit tint / flame stance glow
    if (snapshot.action === 'hit') {
      this.body.setTint(0xff9999);
    } else if (snapshot.isFlameStance) {
      this.body.setTint(snapshot.isRecastReady ? 0xff4444 : 0xffaa44);
    } else {
      this.body.clearTint();
    }

    if (snapshot.invulnTimer > 0 && snapshot.action !== 'dash' && snapshot.action !== 'roll') {
      this.body.setAlpha(Math.floor(snapshot.invulnTimer * 18) % 2 === 0 ? 0.5 : 1);
    } else {
      this.body.setAlpha(1);
    }

    // Enemy floating health bar
    if (this.hpBg && this.hpFill) {
      const showBar = snapshot.hp < snapshot.maxHp;
      this.hpBg.setVisible(showBar);
      this.hpFill.setVisible(showBar);
      if (showBar) {
        const barY = this.body.y - 28;
        this.hpBg.setPosition(this.body.x, barY).setDepth(snapshot.y + 20);
        this.hpFill
          .setPosition(this.body.x - 13, barY)
          .setDisplaySize(Math.max(0, 26 * (snapshot.hp / snapshot.maxHp)), 2)
          .setDepth(snapshot.y + 21);
      }
    }

    // Peer Player overhead name tag and health bar
    if (snapshot.peerName) {
      if (!this.peerNameText) {
        this.peerNameText = this.body.scene.add.text(snapshot.x, snapshot.y - 38, snapshot.peerName, {
          fontFamily: 'sans-serif',
          fontSize: '11px',
          fontStyle: 'bold',
          color: snapshot.isPvp ? '#f87171' : '#38bdf8',
          stroke: '#05070a',
          strokeThickness: 3
        });
        this.peerNameText.setOrigin(0.5, 0.5);
      }
      this.peerNameText.setText(snapshot.peerName);
      this.peerNameText.setPosition(snapshot.x, snapshot.y - 38);
      this.peerNameText.setDepth(snapshot.y + 40);
      this.peerNameText.setVisible(alive);

      if (!this.peerHpBg) {
        this.peerHpBg = this.body.scene.add.rectangle(snapshot.x, snapshot.y - 28, 32, 5, 0x090d10, 0.9);
      }
      if (!this.peerHpFill) {
        this.peerHpFill = this.body.scene.add.rectangle(snapshot.x - 15, snapshot.y - 28, 30, 3, snapshot.isPvp ? 0xef4444 : 0x22c55e, 1);
        this.peerHpFill.setOrigin(0, 0.5);
      }
      this.peerHpBg.setPosition(snapshot.x, snapshot.y - 28).setDepth(snapshot.y + 40).setVisible(alive);
      const hpRatio = Math.max(0, Math.min(1, snapshot.hp / Math.max(1, snapshot.maxHp)));
      this.peerHpFill
        .setPosition(snapshot.x - 15, snapshot.y - 28)
        .setDisplaySize(Math.max(1, 30 * hpRatio), 3)
        .setFillStyle(hpRatio > 0.5 ? (snapshot.isPvp ? 0xf87171 : 0x22c55e) : 0xef4444)
        .setDepth(snapshot.y + 41)
        .setVisible(alive);
    }

    // Bow charge meter indicator
    if (snapshot.action === 'bowPull' && snapshot.isPlayer) {
      if (!this.chargeBarBg) {
        this.chargeBarBg = this.body.scene.add.rectangle(this.body.x, this.body.y - 34, 26, 4, 0x090d10, 0.9);
      }
      if (!this.chargeBarFill) {
        this.chargeBarFill = this.body.scene.add.rectangle(this.body.x - 12, this.body.y - 34, 24, 2, 0x38bdf8, 1);
        this.chargeBarFill.setOrigin(0, 0.5);
      }

      this.chargeBarBg.setPosition(this.body.x, this.body.y - 34).setVisible(true).setDepth(snapshot.y + 30);
      const ratio = Math.max(0, Math.min(1, snapshot.bowChargeRatio ?? 0));
      const fillW = Math.max(1, ratio * 24);

      let color = 0x94a3b8;
      if (snapshot.bowChargeTier === 1) color = 0x38bdf8;
      else if (snapshot.bowChargeTier === 2) color = 0xfacc15; // Golden Perfect Draw
      else if (snapshot.bowChargeTier === 3) color = 0xef4444; // Fatigue red

      this.chargeBarFill
        .setPosition(this.body.x - 12, this.body.y - 34)
        .setDisplaySize(fillW, 2)
        .setFillStyle(color)
        .setVisible(true)
        .setDepth(snapshot.y + 31);
    } else {
      this.chargeBarBg?.setVisible(false);
      this.chargeBarFill?.setVisible(false);
    }
  }

  public destroy(): void {
    this.body.destroy();
    this.overlay?.destroy();
    this.hpBg?.destroy();
    this.hpFill?.destroy();
    this.peerNameText?.destroy();
    this.peerHpBg?.destroy();
    this.peerHpFill?.destroy();
    this.chargeBarBg?.destroy();
    this.chargeBarFill?.destroy();
  }
}