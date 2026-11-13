import Phaser from 'phaser';
import type { ActorSnapshot } from '../../sim/types';
import { SLIME_CONFIGS, type SlimeConfig } from './enemyManifest';

export class SlimeAnimator {
  public readonly body: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly hpBg: Phaser.GameObjects.Rectangle | null = null;
  private readonly hpFill: Phaser.GameObjects.Rectangle | null = null;
  private readonly config: SlimeConfig;
  private lastAnim = '';
  private isDead = false;

  constructor(scene: Phaser.Scene, snapshot: ActorSnapshot) {
    this.config = SLIME_CONFIGS[snapshot.kind] || SLIME_CONFIGS.green_slime;
    const idleKey = `${this.config.kind}_idle_down`;

    this.shadow = scene.add.ellipse(snapshot.x, snapshot.y - 2, 22 * this.config.shadowScale, 10 * this.config.shadowScale, 0x000000, 0.35);
    this.shadow.setDepth(snapshot.y - 1);

    this.body = scene.add.sprite(snapshot.x, snapshot.y, idleKey, 0);
    this.body.setOrigin(0.5, 0.72);
    this.body.setScale(this.config.scale);

    if (!snapshot.isBoss) {
      const barW = 28;
      this.hpBg = scene.add.rectangle(snapshot.x, snapshot.y - 24, barW, 4, 0x090d10, 0.85);
      this.hpFill = scene.add.rectangle(snapshot.x - barW / 2, snapshot.y - 24, barW - 2, 2, 0xef4444, 1);
      this.hpFill.setOrigin(0, 0.5);
      this.hpBg.setVisible(false);
      this.hpFill.setVisible(false);
    }
  }

  public sync(snapshot: ActorSnapshot): void {
    if (snapshot.action === 'dead') {
      if (!this.isDead) {
        this.isDead = true;
        this.hpBg?.setVisible(false);
        this.hpFill?.setVisible(false);
        this.shadow.setVisible(false);

        const isUp = snapshot.facing === 'N' || snapshot.facing === 'NE' || snapshot.facing === 'NW';
        const deathAnim = `${this.config.kind}_death_${isUp ? 'up' : 'down'}`;
        this.body.play(deathAnim, true);
        this.body.scene?.tweens.add({
          targets: this.body,
          alpha: 0,
          duration: 900,
          delay: 450,
          onComplete: () => {
            this.body.setVisible(false);
          }
        });
      }
      return;
    }

    if (this.isDead) {
      this.isDead = false;
      this.body.scene?.tweens.killTweensOf(this.body);
      this.body.setAlpha(1);
      this.lastAnim = '';
    }
    this.body.setVisible(true);
    if (this.body.alpha < 1) {
      this.body.setAlpha(1);
    }
    this.shadow.setVisible(true);
    this.body.setPosition(snapshot.x, snapshot.y);
    this.body.setDepth(snapshot.y);
    this.shadow.setPosition(snapshot.x, snapshot.y - 2);
    this.shadow.setDepth(snapshot.y - 1);

    // Direction & Flip
    const facing = snapshot.facing;
    const isUp = facing === 'N' || facing === 'NE' || facing === 'NW';
    const isLeft = facing === 'W' || facing === 'NW' || facing === 'SW';
    this.body.setFlipX(isLeft);

    // Action animation
    let actName: 'idle' | 'walk' | 'attack' | 'hit' = 'idle';
    if (snapshot.action === 'hit') {
      actName = 'hit';
    } else if (snapshot.action === 'slash1' || snapshot.action === 'slash2' || snapshot.action === 'skill') {
      actName = 'attack';
    } else if (snapshot.action === 'walk' || snapshot.action === 'dash') {
      actName = 'walk';
    }

    const targetAnim = `${this.config.kind}_${actName}_${isUp ? 'up' : 'down'}`;
    if (this.lastAnim !== targetAnim) {
      this.body.play(targetAnim, true);
      this.lastAnim = targetAnim;
    }

    // Hit / Dash reaction tint
    if (snapshot.action === 'hit') {
      this.body.setTint(0xff8888);
    } else if (snapshot.action === 'dash') {
      this.body.setTint(0x4ade80);
    } else {
      this.body.clearTint();
    }

    // Non-boss floating HP bar
    if (this.hpBg && this.hpFill) {
      const showBar = snapshot.hp < snapshot.maxHp;
      this.hpBg.setVisible(showBar);
      this.hpFill.setVisible(showBar);
      if (showBar) {
        const barY = this.body.y - (26 * this.config.scale);
        const barW = 28;
        this.hpBg.setPosition(this.body.x, barY).setDepth(snapshot.y + 20);
        const pct = Math.max(0, snapshot.hp / snapshot.maxHp);
        this.hpFill
          .setPosition(this.body.x - barW / 2 + 1, barY)
          .setDisplaySize((barW - 2) * pct, 2)
          .setDepth(snapshot.y + 21);
      }
    }
  }

  public destroy(): void {
    this.body.destroy();
    this.shadow.destroy();
    this.hpBg?.destroy();
    this.hpFill?.destroy();
  }
}
