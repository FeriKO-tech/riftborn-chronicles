import { Graphics } from 'pixi.js';
import { EnemyActor } from './EnemyActor';
import type { EnemyTypeDto } from '@riftborn/shared';

// Boss drops from top of field on spawn
const BOSS_ENTRY_DURATION = 1.2; // seconds

export class BossActor extends EnemyActor {
  private entryTimer = 0;
  private entryStartY = -120;
  private entryEndY = 0;
  private entryDone = false;

  private readonly crown: Graphics;
  private readonly outerGlow: Graphics;

  constructor(type: EnemyTypeDto, spawnRefX: number, spawnRefY: number) {
    super(type, spawnRefX, spawnRefY);
    this.scale.set(1.6);

    // Outer dramatic glow ring
    this.outerGlow = new Graphics();
    this.addChildAt(this.outerGlow, 0);

    // Crown above head
    this.crown = new Graphics();
    this.addChild(this.crown);
    this._drawCrown();

    // Descend from top
    this.y = this.entryStartY;
    this.alpha = 0;
  }

  private _drawCrown(): void {
    const g = this.crown;
    const s = this.size;
    const topY = -(s * 0.75);

    // Crown base arc
    g.roundRect(-s * 0.55, topY - s * 0.2, s * 1.1, s * 0.22, 3);
    g.fill({ color: 0xf59e0b });
    g.roundRect(-s * 0.55, topY - s * 0.2, s * 1.1, s * 0.22, 3);
    g.stroke({ width: 1, color: 0xfbbf24, alpha: 0.8 });

    // Thorn spikes (5)
    const thorns = [-0.4, -0.2, 0, 0.2, 0.4];
    for (const tx of thorns) {
      const h = tx === 0 ? s * 0.5 : s * 0.35;
      g.moveTo(tx * s, topY - s * 0.18);
      g.lineTo(tx * s - s * 0.08, topY - s * 0.18 - h * 0.5);
      g.lineTo(tx * s, topY - s * 0.18 - h);
      g.lineTo(tx * s + s * 0.08, topY - s * 0.18 - h * 0.5);
      g.closePath();
      g.fill({ color: tx === 0 ? 0xf59e0b : 0xfbbf24 });
      g.stroke({ width: 0.5, color: 0xfef3c7, alpha: 0.5 });
    }

    // Crown energy orbits (decorative circles)
    g.circle(-s * 0.38, topY - s * 0.08, s * 0.09); g.fill({ color: 0x7c3aed, alpha: 0.9 });
    g.circle(s * 0.38, topY - s * 0.08, s * 0.09);  g.fill({ color: 0x7c3aed, alpha: 0.9 });
  }

  override update(deltaMs: number): void {
    const dt = deltaMs / 1000;

    // Entry descent animation
    if (!this.entryDone) {
      this.entryTimer += dt;
      const t = Math.min(1, this.entryTimer / BOSS_ENTRY_DURATION);
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      const offsetY = this.entryStartY + (this.entryEndY - this.entryStartY) * ease;
      this.position.set(0, offsetY); // local offset applied by CombatScene
      this.alpha = Math.min(1, t * 2);
      if (t >= 1) {
        this.entryDone = true;
        this.position.set(0, 0);
      }
    }

    super.update(deltaMs);

    // Outer glow pulse
    if (this.isAlive()) {
      this.outerGlow.clear();
      const pulse = 0.06 + Math.sin(this.tick * 3) * 0.03;
      this.outerGlow.circle(0, 0, this.size * 1.4);
      this.outerGlow.fill({ color: 0xf59e0b, alpha: pulse });
      this.outerGlow.circle(0, 0, this.size * 1.8);
      this.outerGlow.fill({ color: 0x7c3aed, alpha: pulse * 0.4 });
    }

    // Rotate crown slowly
    this.crown.rotation = Math.sin(this.tick * 0.6) * 0.08;
  }

  isEntryDone(): boolean { return this.entryDone; }
}
