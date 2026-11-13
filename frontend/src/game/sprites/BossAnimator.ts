import Phaser from 'phaser';
import type { ActorSnapshot, Direction8 } from '../../sim/types';

const DIR_TO_ROW: Record<Direction8, number> = {
  S: 0,
  SE: 1,
  E: 2,
  NE: 3,
  N: 4,
  NW: 5,
  W: 6,
  SW: 7
};

export function bossAnimKey(kind: 'abyssal_jelly' | 'floating_eldritch', action: 'idle' | 'move' | 'attack' | 'death', facing: Direction8): string {
  const row = DIR_TO_ROW[facing] ?? 0;
  return `${kind}_${action}_r${row}`;
}

export class BossAnimator {
  public readonly body: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly auraRing: Phaser.GameObjects.Ellipse;
  private readonly hpBg: Phaser.GameObjects.Rectangle;
  private readonly hpBorder: Phaser.GameObjects.Rectangle;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly nameLabel: Phaser.GameObjects.Text;
  private readonly phaseLabel: Phaser.GameObjects.Text;
  private lastAnim = '';
  private lastPhase: number = 1;
  private isDead = false;

  constructor(scene: Phaser.Scene, snapshot: ActorSnapshot) {
    const isPhase2 = snapshot.kind === 'floating_eldritch' || snapshot.bossPhase === 2;
    const baseKey = isPhase2 ? 'floating_eldritch_idle' : 'abyssal_jelly_idle';

    this.shadow = scene.add.ellipse(snapshot.x, snapshot.y + 6, 56, 20, 0x000000, 0.5);
    this.shadow.setDepth(snapshot.y - 2);

    this.auraRing = scene.add.ellipse(snapshot.x, snapshot.y + 4, 68, 26);
    this.auraRing.setStrokeStyle(2, isPhase2 ? 0xc084fc : 0x38bdf8, 0.65);
    this.auraRing.setDepth(snapshot.y - 1);

    scene.tweens.add({
      targets: this.auraRing,
      scaleX: 1.18,
      scaleY: 1.22,
      alpha: 0.25,
      duration: 750,
      yoyo: true,
      repeat: -1
    });

    this.body = scene.add.sprite(snapshot.x, snapshot.y, baseKey, 0);
    // 128x128 frame with centered floating organism/jelly; anchor slightly below center so ground contact feels natural
    this.body.setOrigin(0.5, 0.62);
    this.body.setScale(1.15);

    // World-space Boss HP Bar & Phase Indicator above the boss
    const barW = 86;
    const barH = 7;
    const barY = snapshot.y - 58;

    this.hpBorder = scene.add.rectangle(snapshot.x, barY, barW + 2, barH + 2, 0x090d10, 0.95);
    this.hpBorder.setStrokeStyle(1, isPhase2 ? 0xa855f7 : 0x38bdf8, 0.9);
    this.hpBg = scene.add.rectangle(snapshot.x, barY, barW, barH, 0x1e1b2e, 0.9);
    this.hpFill = scene.add.rectangle(snapshot.x - barW / 2, barY, barW, barH - 2, isPhase2 ? 0xa855f7 : 0xef4444, 1);
    this.hpFill.setOrigin(0, 0.5);

    this.nameLabel = scene.add
      .text(snapshot.x, barY - 11, snapshot.bossName || (isPhase2 ? 'Floating Eldritch Organism' : 'Abyssal Jelly'), {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: isPhase2 ? '#e9d5ff' : '#bae6fd',
        stroke: '#090d10',
        strokeThickness: 3
      })
      .setOrigin(0.5);

    this.phaseLabel = scene.add
      .text(snapshot.x, barY - 21, isPhase2 ? 'PHASE II - ELDRITCH HORROR' : 'PHASE I - ABYSSAL JELLY', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '8px',
        fontStyle: 'bold',
        color: isPhase2 ? '#f43f5e' : '#38bdf8',
        stroke: '#090d10',
        strokeThickness: 2
      })
      .setOrigin(0.5);

    this.lastPhase = isPhase2 ? 2 : 1;
  }

  public sync(snapshot: ActorSnapshot): void {
    const isPhase2 = snapshot.kind === 'floating_eldritch' || snapshot.bossPhase === 2;
    const bossKind: 'abyssal_jelly' | 'floating_eldritch' = isPhase2 ? 'floating_eldritch' : 'abyssal_jelly';

    if (snapshot.action === 'dead') {
      if (!this.isDead) {
        this.isDead = true;
        this.hpBorder.setVisible(false);
        this.hpBg.setVisible(false);
        this.hpFill.setVisible(false);
        this.nameLabel.setVisible(false);
        this.phaseLabel.setVisible(false);
        this.shadow.setVisible(false);
        this.auraRing.setVisible(false);

        const deathKey = bossAnimKey(bossKind, 'death', snapshot.facing);
        if (this.body.scene?.anims.exists(deathKey)) {
          this.body.play(deathKey, true);
        }
        this.body.scene?.tweens.add({
          targets: this.body,
          alpha: 0,
          duration: 1300,
          delay: 900,
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
    this.auraRing.setVisible(true);

    this.body.setPosition(snapshot.x, snapshot.y);
    this.body.setDepth(snapshot.y);
    this.shadow.setPosition(snapshot.x, snapshot.y + 6);
    this.shadow.setDepth(snapshot.y - 2);
    this.auraRing.setPosition(snapshot.x, snapshot.y + 4);
    this.auraRing.setDepth(snapshot.y - 1);

    // Detect Phase 1 <-> Phase 2 visual transition (including respawn reset to Phase 1)
    const currentPhase = isPhase2 ? 2 : 1;
    if (currentPhase !== this.lastPhase) {
      this.lastPhase = currentPhase;
      if (isPhase2) {
        this.auraRing.setStrokeStyle(2.5, 0xc084fc, 0.85);
        this.hpBorder.setStrokeStyle(1.2, 0xc084fc, 0.95);
        this.hpFill.setFillStyle(0xa855f7, 1);
        this.nameLabel.setColor('#f3e8ff');
        this.phaseLabel.setColor('#f43f5e');
        this.body.setScale(1.25);
      } else {
        this.auraRing.setStrokeStyle(2, 0x38bdf8, 0.75);
        this.hpBorder.setStrokeStyle(1.2, 0x38bdf8, 0.95);
        this.hpFill.setFillStyle(0xef4444, 1);
        this.nameLabel.setColor('#bae6fd');
        this.phaseLabel.setColor('#38bdf8');
        this.body.setScale(1.15);
      }
    }

    // Determine animation action
    let act: 'idle' | 'move' | 'attack' | 'death' = 'idle';
    if (snapshot.action === 'transition') {
      // During Phase 1 -> 2 metamorphosis, play abyssal_jelly death/dissolve animation before emerging as Eldritch
      act = 'death';
    } else if (snapshot.action === 'slash1' || snapshot.action === 'slash2' || snapshot.action === 'skill') {
      act = 'attack';
    } else if (snapshot.action === 'walk' || snapshot.action === 'dash') {
      act = 'move';
    }

    const animKind = snapshot.action === 'transition' ? 'abyssal_jelly' : bossKind;
    const key = bossAnimKey(animKind, act, snapshot.facing);

    if (this.lastAnim !== key && this.body.scene?.anims.exists(key)) {
      this.body.play(key, true);
      this.lastAnim = key;
    }

    // Hit / Transition tint feedback
    if (snapshot.action === 'transition') {
      const pulse = Math.sin(snapshot.actionElapsed * 18) > 0;
      this.body.setTint(pulse ? 0xd8b4fe : 0x6b21a8);
    } else if (snapshot.action === 'hit') {
      this.body.setTint(0xff8888);
    } else {
      this.body.clearTint();
    }

    // Update World-space Boss HP Bar & Phase Label
    const barW = 86;
    const barY = this.body.y - 60;
    const hpRatio = Math.max(0, Math.min(1, snapshot.hp / Math.max(1, snapshot.maxHp)));

    this.hpBorder.setVisible(true).setPosition(this.body.x, barY).setDepth(snapshot.y + 30);
    this.hpBg.setVisible(true).setPosition(this.body.x, barY).setDepth(snapshot.y + 31);
    this.hpFill
      .setVisible(true)
      .setPosition(this.body.x - barW / 2, barY)
      .setDisplaySize(Math.max(0, barW * hpRatio), 5)
      .setDepth(snapshot.y + 32);

    this.nameLabel
      .setVisible(true)
      .setText(`${snapshot.bossName || (isPhase2 ? 'Floating Eldritch' : 'Abyssal Jelly')} (${Math.ceil(snapshot.hp)}/${snapshot.maxHp})`)
      .setPosition(this.body.x, barY - 10)
      .setDepth(snapshot.y + 32);

    this.phaseLabel
      .setVisible(true)
      .setText(
        snapshot.action === 'transition'
          ? 'METAMORPHOSIS -> PHASE II'
          : isPhase2
            ? 'PHASE 2/2 - FLOATING ELDRITCH'
            : 'PHASE 1/2 - ABYSSAL JELLY'
      )
      .setPosition(this.body.x, barY - 20)
      .setDepth(snapshot.y + 32);
  }

  public destroy(): void {
    this.body.destroy();
    this.shadow.destroy();
    this.auraRing.destroy();
    this.hpBorder.destroy();
    this.hpBg.destroy();
    this.hpFill.destroy();
    this.nameLabel.destroy();
    this.phaseLabel.destroy();
  }
}
