import Phaser from 'phaser';
import type { ActorSnapshot } from '../../sim/types';

export class OrcAnimator {
  public readonly body: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly hpBg: Phaser.GameObjects.Rectangle | null = null;
  private readonly hpFill: Phaser.GameObjects.Rectangle | null = null;
  private lastAnim = '';
  private isDead = false;

  constructor(scene: Phaser.Scene, snapshot: ActorSnapshot) {
    const isWarlord = snapshot.kind === 'orc_warlord' || snapshot.isBoss;
    const scale = isWarlord ? 1.45 : 1.05;

    this.shadow = scene.add.ellipse(snapshot.x, snapshot.y, 28 * scale, 10 * scale, 0x000000, 0.40);
    this.shadow.setDepth(snapshot.y - 1);

    this.body = scene.add.sprite(snapshot.x, snapshot.y, 'hunter_orc', 0);
    // Hunter Orc sprite in 96x96 has feet at y = 60 (60 / 96 = 0.625)
    this.body.setOrigin(0.5, 0.625);
    this.body.setScale(scale);

    if (isWarlord) {
      this.body.setTint(0xfca5a5);
    }

    if (!snapshot.isBoss) {
      const barW = 32;
      this.hpBg = scene.add.rectangle(snapshot.x, snapshot.y - 28, barW, 4, 0x090d10, 0.85);
      this.hpFill = scene.add.rectangle(snapshot.x - barW / 2, snapshot.y - 28, barW - 2, 2, 0xef4444, 1);
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

        this.body.play('hunter_orc_death', true);
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
    this.shadow.setPosition(snapshot.x, snapshot.y);
    this.shadow.setDepth(snapshot.y - 1);

    // Direction & Flip (Orc sprite faces right by default in sheet)
    const facing = snapshot.facing;
    const isLeft = facing === 'W' || facing === 'NW' || facing === 'SW';
    this.body.setFlipX(isLeft);

    // Action animation mapping
    let actKey = 'hunter_orc_idle';
    if (snapshot.action === 'hit') {
      actKey = 'hunter_orc_hit';
    } else if (snapshot.action === 'slash1') {
      actKey = 'hunter_orc_attack1'; // Melee Cleave
    } else if (snapshot.action === 'slash2' || snapshot.action === 'skill') {
      actKey = 'hunter_orc_attack2'; // Ranged Spear Throw
    } else if (snapshot.action === 'walk' || snapshot.action === 'dash') {
      actKey = 'hunter_orc_walk';
    }

    if (this.lastAnim !== actKey) {
      this.body.play(actKey, true);
      this.lastAnim = actKey;
    }

    // Hit / Dash reaction tint
    if (snapshot.action === 'hit') {
      this.body.setTint(0xff8888);
    } else if (snapshot.action === 'dash') {
      this.body.setTint(0x38bdf8);
    } else if (snapshot.kind === 'orc_warlord' || snapshot.isBoss) {
      this.body.setTint(0xfca5a5);
    } else {
      this.body.clearTint();
    }

    // Floating HP bar
    if (this.hpBg && this.hpFill) {
      const showBar = snapshot.hp < snapshot.maxHp;
      this.hpBg.setVisible(showBar);
      this.hpFill.setVisible(showBar);
      if (showBar) {
        const barY = this.body.y - 28;
        this.hpBg.setPosition(this.body.x, barY).setDepth(snapshot.y + 20);
        this.hpFill
          .setPosition(this.body.x - 15, barY)
          .setDisplaySize(Math.max(0, 30 * (snapshot.hp / snapshot.maxHp)), 2)
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
