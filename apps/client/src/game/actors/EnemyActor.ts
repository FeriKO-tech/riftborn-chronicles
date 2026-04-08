import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { EnemyTypeDto } from '@riftborn/shared';

export type EnemyState = 'spawning' | 'idle' | 'dying' | 'dead';

let _idCounter = 0;

export class EnemyActor extends Container {
  readonly id: string;
  readonly typeId: string;
  readonly archetype: string;
  readonly maxHp: number;
  readonly goldReward: number;
  readonly expReward: number;
  hp: number;

  // Reference-field position (set by CombatScene each tick)
  refX: number;
  refY: number;

  protected tick = 0;
  private spawnTimer = 0;
  private deathTimer = 0;
  private _state: EnemyState = 'spawning';

  private readonly body: Graphics;
  private readonly hpBar: Graphics;
  readonly color: number;
  readonly accent: number;
  protected readonly size: number;

  constructor(type: EnemyTypeDto, spawnRefX: number, spawnRefY: number) {
    super();
    this.id      = `e_${++_idCounter}`;
    this.typeId  = type.id;
    this.archetype = type.archetype;
    this.maxHp   = type.baseHp;
    this.hp      = type.baseHp;
    this.refX    = spawnRefX;
    this.refY    = spawnRefY;
    this.color      = parseInt(type.color.replace('#', ''), 16);
    this.accent     = parseInt(type.accentColor.replace('#', ''), 16);
    this.goldReward = type.goldReward;
    this.expReward  = type.expReward;
    this.size    = type.size;

    this.alpha   = 0;

    this.body  = new Graphics(); this.addChild(this.body);
    this.hpBar = new Graphics(); this.addChild(this.hpBar);

    const label = new Text({ text: type.name, style: new TextStyle({ fontFamily: 'sans-serif', fontSize: 9, fill: 0xf87171, fontWeight: '600' }) });
    label.anchor.set(0.5, 1);
    label.position.set(0, -(this.size + 14));
    this.addChild(label);

    this._drawBody();
  }

  private _drawBody(): void {
    const g = this.body;
    const c = this.color;
    const a = this.accent;
    const s = this.size;

    switch (this.archetype) {
      case 'beast':   this._drawBeast(g, c, a, s); break;
      case 'scout':   this._drawScout(g, c, a, s); break;
      case 'brute':   this._drawBrute(g, c, a, s); break;
      case 'boss':    this._drawBoss(g, c, a, s);  break;
      default:        this._drawScout(g, c, a, s); break;
    }
  }

  protected _drawBeast(g: Graphics, c: number, a: number, s: number): void {
    // Shadow
    g.ellipse(0, s * 0.45, s * 0.7, s * 0.18); g.fill({ color: 0x000000, alpha: 0.3 });
    // Body (hunched oval)
    g.ellipse(0, 0, s * 0.85, s * 0.6); g.fill({ color: c });
    g.ellipse(0, 0, s * 0.85, s * 0.6); g.stroke({ width: 1, color: 0x9ca3af, alpha: 0.3 });
    // Left claw arm
    g.roundRect(-s * 0.9, -s * 0.1, s * 0.45, s * 0.55, 3); g.fill({ color: 0xd6d3d1 });
    g.roundRect(-s * 0.9, -s * 0.1, s * 0.45, s * 0.55, 3); g.stroke({ width: 0.6, color: 0xfafaf9, alpha: 0.4 });
    // Right claw arm
    g.roundRect(s * 0.45, -s * 0.1, s * 0.45, s * 0.55, 3); g.fill({ color: 0xd6d3d1 });
    g.roundRect(s * 0.45, -s * 0.1, s * 0.45, s * 0.55, 3); g.stroke({ width: 0.6, color: 0xfafaf9, alpha: 0.4 });
    // Left eye
    g.circle(-s * 0.22, -s * 0.12, s * 0.13); g.fill({ color: a });
    g.circle(-s * 0.22, -s * 0.12, s * 0.07); g.fill({ color: 0xfef2f2 });
    // Right eye
    g.circle(s * 0.22, -s * 0.12, s * 0.13); g.fill({ color: a });
    g.circle(s * 0.22, -s * 0.12, s * 0.07); g.fill({ color: 0xfef2f2 });
    // Glow halo behind eyes
    g.circle(-s * 0.22, -s * 0.12, s * 0.2); g.fill({ color: a, alpha: 0.15 });
    g.circle(s * 0.22, -s * 0.12, s * 0.2);  g.fill({ color: a, alpha: 0.15 });
  }

  protected _drawScout(g: Graphics, c: number, a: number, s: number): void {
    // Shadow
    g.ellipse(0, s * 0.72, s * 0.35, s * 0.1); g.fill({ color: 0x000000, alpha: 0.3 });
    // Body (slim upright)
    g.roundRect(-s * 0.28, -s * 0.7, s * 0.56, s * 1.4, 6); g.fill({ color: c });
    g.roundRect(-s * 0.28, -s * 0.7, s * 0.56, s * 1.4, 6); g.stroke({ width: 1.2, color: a, alpha: 0.5 });
    // Visor (horizontal slit)
    g.roundRect(-s * 0.26, -s * 0.52, s * 0.52, s * 0.14, 2); g.fill({ color: a });
    // Arms
    g.roundRect(-s * 0.62, -s * 0.45, s * 0.32, s * 0.64, 3); g.fill({ color: c });
    g.roundRect(-s * 0.62, -s * 0.45, s * 0.32, s * 0.64, 3); g.stroke({ width: 0.6, color: a, alpha: 0.3 });
    g.roundRect(s * 0.3, -s * 0.45, s * 0.32, s * 0.64, 3);   g.fill({ color: c });
    g.roundRect(s * 0.3, -s * 0.45, s * 0.32, s * 0.64, 3);   g.stroke({ width: 0.6, color: a, alpha: 0.3 });
    // Twin blade tips
    g.roundRect(-s * 0.66, -s * 0.7, s * 0.14, s * 0.3, 2); g.fill({ color: 0xe2e8f0 });
    g.roundRect(s * 0.52, -s * 0.7, s * 0.14, s * 0.3, 2);  g.fill({ color: 0xe2e8f0 });
    // Body outline glow
    g.roundRect(-s * 0.3, -s * 0.72, s * 0.6, s * 1.44, 6); g.stroke({ width: 1.5, color: a, alpha: 0.12 });
  }

  protected _drawBoss(g: Graphics, c: number, a: number, s: number): void {
    // Shadow
    g.ellipse(0, s * 0.72, s * 0.85, s * 0.2); g.fill({ color: 0x000000, alpha: 0.55 });
    // Void cloak (wide trapezoidal)
    g.poly([-(s * 0.65), -(s * 0.8), s * 0.65, -(s * 0.8), s * 0.88, s * 0.72, -(s * 0.88), s * 0.72]);
    g.fill({ color: c });
    g.poly([-(s * 0.65), -(s * 0.8), s * 0.65, -(s * 0.8), s * 0.88, s * 0.72, -(s * 0.88), s * 0.72]);
    g.stroke({ width: 1.5, color: a, alpha: 0.4 });
    // Shoulders
    g.roundRect(-(s * 0.8), -(s * 0.68), s * 0.42, s * 0.3, 5); g.fill({ color: c });
    g.roundRect(-(s * 0.8), -(s * 0.68), s * 0.42, s * 0.3, 5); g.stroke({ width: 1.5, color: a, alpha: 0.65 });
    g.roundRect(s * 0.38, -(s * 0.68), s * 0.42, s * 0.3, 5);   g.fill({ color: c });
    g.roundRect(s * 0.38, -(s * 0.68), s * 0.42, s * 0.3, 5);   g.stroke({ width: 1.5, color: a, alpha: 0.65 });
    // Energy core
    g.circle(0, -(s * 0.06), s * 0.22); g.fill({ color: a, alpha: 0.75 });
    g.circle(0, -(s * 0.06), s * 0.13); g.fill({ color: 0xffffff, alpha: 0.9 });
    g.circle(0, -(s * 0.06), s * 0.28); g.fill({ color: a, alpha: 0.12 });
    // Void cracks
    g.moveTo(-(s * 0.18), -(s * 0.52)).lineTo(0, -(s * 0.18)).lineTo(s * 0.14, -(s * 0.38));
    g.stroke({ width: 1.5, color: a, alpha: 0.85 });
    // Eyes
    g.circle(-(s * 0.22), -(s * 0.5), s * 0.11); g.fill({ color: a });
    g.circle(s * 0.22,    -(s * 0.5), s * 0.11); g.fill({ color: a });
    g.circle(-(s * 0.22), -(s * 0.5), s * 0.05); g.fill({ color: 0xffffff });
    g.circle(s * 0.22,    -(s * 0.5), s * 0.05); g.fill({ color: 0xffffff });
    g.circle(-(s * 0.22), -(s * 0.5), s * 0.16); g.fill({ color: a, alpha: 0.14 });
    g.circle(s * 0.22,    -(s * 0.5), s * 0.16); g.fill({ color: a, alpha: 0.14 });
  }

  protected _drawBrute(g: Graphics, c: number, a: number, s: number): void {
    // Shadow
    g.ellipse(0, s * 0.62, s * 1.1, s * 0.22); g.fill({ color: 0x000000, alpha: 0.4 });
    // Fists
    g.roundRect(-s * 1.1, -s * 0.1, s * 0.55, s * 0.7, 6); g.fill({ color: c });
    g.roundRect(-s * 1.1, -s * 0.1, s * 0.55, s * 0.7, 6); g.stroke({ width: 1, color: 0x374151, alpha: 0.3 });
    g.roundRect(s * 0.55, -s * 0.1, s * 0.55, s * 0.7, 6); g.fill({ color: c });
    g.roundRect(s * 0.55, -s * 0.1, s * 0.55, s * 0.7, 6); g.stroke({ width: 1, color: 0x374151, alpha: 0.3 });
    // Main body
    g.roundRect(-s * 0.58, -s * 0.62, s * 1.16, s * 1.24, 8); g.fill({ color: c });
    g.roundRect(-s * 0.58, -s * 0.62, s * 1.16, s * 1.24, 8); g.stroke({ width: 1.5, color: 0x374151, alpha: 0.4 });
    // Glow cracks
    g.moveTo(-s * 0.2, -s * 0.5).lineTo(s * 0.1, -s * 0.1).lineTo(-s * 0.15, s * 0.2);
    g.stroke({ width: 1.5, color: a, alpha: 0.7 });
    g.moveTo(s * 0.2, -s * 0.35).lineTo(s * 0.05, s * 0.1);
    g.stroke({ width: 1.2, color: a, alpha: 0.5 });
    // Single eye
    g.circle(0, -s * 0.18, s * 0.2); g.fill({ color: 0xef4444 });
    g.circle(0, -s * 0.18, s * 0.11); g.fill({ color: 0xfef2f2 });
    g.circle(0, -s * 0.18, s * 0.26); g.fill({ color: 0xef4444, alpha: 0.12 });
  }

  triggerDeath(): void {
    if (this._state === 'dying' || this._state === 'dead') return;
    this._state = 'dying';
    this.deathTimer = 0.45;
  }

  isDead(): boolean  { return this._state === 'dead'; }
  isAlive(): boolean { return this._state === 'idle'; }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.tick += dt;

    switch (this._state) {
      case 'spawning': {
        this.spawnTimer += dt;
        const progress = Math.min(1, this.spawnTimer / 0.35);
        this.alpha = progress;
        this.scale.set(0.6 + progress * 0.4);
        if (progress >= 1) this._state = 'idle';
        break;
      }
      case 'idle': {
        const bob = Math.sin(this.tick * 2.8) * 2.5;
        this.body.y = bob;
        this.alpha = 1;
        this.scale.set(1);
        // Update HP bar
        this._updateHpBar();
        break;
      }
      case 'dying': {
        this.deathTimer -= dt;
        const progress = Math.max(0, this.deathTimer / 0.45);
        this.alpha   = progress;
        this.scale.set(progress * 0.7 + 0.3);
        this.body.y  = (1 - progress) * -12;
        if (this.deathTimer <= 0) this._state = 'dead';
        break;
      }
    }
  }

  private _updateHpBar(): void {
    const pct = Math.max(0, Math.min(1, this.hp / this.maxHp));
    const bw = this.size * 1.4;
    const by = -(this.size + 6);
    this.hpBar.clear();
    this.hpBar.roundRect(-bw / 2, by, bw, 4, 2); this.hpBar.fill({ color: 0x1a1a2e });
    if (pct > 0) {
      this.hpBar.roundRect(-bw / 2, by, bw * pct, 4, 2);
      this.hpBar.fill({ color: pct > 0.6 ? 0xef4444 : pct > 0.3 ? 0xf97316 : 0xfbbf24 });
    }
  }
}
