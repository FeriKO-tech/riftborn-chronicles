import { Container, Graphics, Text, TextStyle } from 'pixi.js';

export type HeroState = 'idle' | 'move' | 'attack' | 'hurt' | 'dead';

const CLASS_ACCENT: Record<string, number> = {
  VOIDBLADE: 0x7c3aed,
  AETHERMAGE: 0x3b82f6,
  IRONVEIL: 0x6b7280,
};

// Reference-field spawn position for hero
export const HERO_REF_X = 100;
export const HERO_REF_Y = 230;

export class HeroActor extends Container {
  refX = HERO_REF_X;
  refY = HERO_REF_Y;
  maxHp = 1000;
  hp = 1000;

  private tick = 0;
  private attackCooldown = 0;
  private hurtTimer = 0;
  private deathTimer = 0;
  private _state: HeroState = 'idle';

  private readonly aura: Graphics;
  private readonly coat: Graphics;
  private readonly head: Graphics;
  private readonly sword: Graphics;
  private readonly hpBar: Graphics;
  private accent: number;

  constructor(playerClass: string, playerName: string) {
    super();
    this.accent = CLASS_ACCENT[playerClass] ?? 0x7c3aed;

    this.aura  = new Graphics(); this.addChild(this.aura);
    this.sword = new Graphics(); this.addChild(this.sword);
    this.coat  = new Graphics(); this.addChild(this.coat);
    this.head  = new Graphics(); this.addChild(this.head);
    this.hpBar = new Graphics(); this.addChild(this.hpBar);

    const label = new Text({ text: playerName, style: new TextStyle({ fontFamily: 'sans-serif', fontSize: 10, fill: 0xa78bfa, fontWeight: '700' }) });
    label.anchor.set(0.5, 0);
    label.position.set(0, 42);
    this.addChild(label);

    this._drawBody();
  }

  private _drawBody(): void {
    const g = this.coat;
    const a = this.accent;

    // Shadow
    g.ellipse(0, 32, 20, 6); g.fill({ color: 0x000000, alpha: 0.35 });

    // Lower coat
    g.roundRect(-9, 8, 18, 22, 3); g.fill({ color: 0x1c1917 });
    g.roundRect(-9, 8, 18, 22, 3); g.stroke({ width: 0.5, color: 0x9ca3af, alpha: 0.2 });

    // Upper body
    g.roundRect(-10, -18, 20, 28, 5); g.fill({ color: 0x292524 });
    g.roundRect(-10, -18, 20, 28, 5); g.stroke({ width: 0.8, color: 0x9ca3af, alpha: 0.35 });

    // Right pauldron
    g.roundRect(9, -22, 13, 8, 4); g.fill({ color: 0x44403c });
    g.roundRect(9, -22, 13, 8, 4); g.stroke({ width: 0.8, color: a, alpha: 0.5 });

    // Left arm (void bracer — teal)
    g.roundRect(-20, -13, 9, 20, 3); g.fill({ color: 0x0e7490 });
    g.roundRect(-20, -13, 9, 20, 3); g.stroke({ width: 0.8, color: 0x06b6d4, alpha: 0.7 });

    // Right arm
    g.roundRect(11, -13, 8, 17, 3); g.fill({ color: 0x1c1917 });

    // Collar
    g.roundRect(-5, -21, 10, 6, 2); g.fill({ color: 0x44403c });

    // Sword handle
    const sw = this.sword;
    sw.roundRect(19, 4, 5, 11, 2); sw.fill({ color: 0x57534e });
    // Guard
    sw.roundRect(15, 2, 13, 4, 1); sw.fill({ color: 0x78716c });
    // Blade
    sw.roundRect(20, -38, 3, 42, 1); sw.fill({ color: 0xe2e8f0 });
    // Blade rune glow (cyan)
    sw.roundRect(18, -40, 6, 46, 2); sw.fill({ color: 0x06b6d4, alpha: 0.15 });
    sw.roundRect(20, -36, 3, 6, 1); sw.fill({ color: 0x06b6d4, alpha: 0.6 });

    // Head
    const h = this.head;
    h.circle(0, -32, 12); h.fill({ color: 0x1a1a1a });
    h.circle(0, -32, 12); h.stroke({ width: 1, color: a, alpha: 0.25 });
    // Hair
    h.circle(-3, -40, 9);  h.fill({ color: 0x1e1b4b });
    h.circle(4, -40, 7);   h.fill({ color: 0x1e1b4b });
    h.circle(0, -44, 6);   h.fill({ color: 0x312e81 });
    // Eye slit
    h.roundRect(-5, -34, 11, 3, 1); h.fill({ color: 0x0ea5e9 });
    h.roundRect(-5, -36, 11, 7, 2); h.fill({ color: 0x0ea5e9, alpha: 0.07 });
  }

  setState(s: HeroState): void {
    if (this._state === 'dead') return; // can't change state when dead
    if (this._state === 'attack' && s !== 'hurt' && s !== 'dead') return;
    this._state = s;
    if (s === 'attack') this.attackCooldown = 0.55;
    if (s === 'hurt')   this.hurtTimer = 0.3;
  }

  /** Apply damage, returns true if hero died. */
  takeDamage(amount: number): boolean {
    if (this._state === 'dead') return false;
    this.hp = Math.max(0, this.hp - amount);
    if (this._state !== 'attack') this._state = 'hurt';
    this.hurtTimer = 0.2;
    if (this.hp <= 0) {
      this._state = 'dead';
      this.deathTimer = 2.0;
      return true;
    }
    return false;
  }

  getState(): HeroState { return this._state; }
  isAttacking(): boolean { return this._state === 'attack'; }
  isDead(): boolean { return this._state === 'dead'; }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.tick += dt;

    // Death / respawn
    if (this._state === 'dead') {
      this.deathTimer -= dt;
      this.alpha = 0.15 + Math.sin(this.tick * 6) * 0.1;
      this.scale.set(0.85);
      if (this.deathTimer <= 0) {
        this.hp = this.maxHp;
        this._state = 'idle';
        this.refX = HERO_REF_X;
        this.refY = HERO_REF_Y;
        this.alpha = 1;
        this.scale.set(1);
      }
      this._updateHpBar();
      return;
    }

    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0 && this._state === 'attack') this._state = 'idle';
    }
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      if (this.hurtTimer <= 0 && this._state === 'hurt') this._state = 'idle';
    }

    const s = this._state;
    const t = this.tick;

    // Bob
    const bobSpeed = s === 'move' ? 12 : 2;
    const bobAmp   = s === 'move' ? 3 : 4;
    const bobY = Math.sin(t * bobSpeed) * bobAmp;

    this.coat.y  = bobY;
    this.head.y  = bobY;
    this.hpBar.y = 0;

    // Sword swing
    const swingProgress = s === 'attack' ? Math.max(0, (0.55 - this.attackCooldown) / 0.55) : 0;
    this.sword.y        = bobY - swingProgress * 6;
    this.sword.rotation = swingProgress * 0.7;

    // Lunge during attack
    this.coat.x  = s === 'attack' ? swingProgress * 10 : 0;
    this.head.x  = this.coat.x;
    this.sword.x = this.coat.x;

    // Aura pulse
    this.aura.clear();
    const auraAlpha = s === 'attack'
      ? 0.1 + swingProgress * 0.18
      : 0.04 + Math.sin(t * 2.5) * 0.025;
    const auraR = s === 'attack' ? 30 + swingProgress * 16 : 26;
    this.aura.circle(0, -4, auraR);
    this.aura.fill({ color: this.accent, alpha: auraAlpha });
    this.aura.circle(0, -4, auraR * 0.5);
    this.aura.fill({ color: 0xa78bfa, alpha: auraAlpha * 0.4 });

    // Hurt flash
    this.alpha = this._state === 'hurt' ? (0.5 + Math.sin(t * 30) * 0.5) : 1;

    this._updateHpBar();
  }

  private _updateHpBar(): void {
    const pct = Math.max(0, Math.min(1, this.hp / this.maxHp));
    const bw = 44;
    this.hpBar.clear();
    this.hpBar.roundRect(-bw / 2, 38, bw, 5, 2); this.hpBar.fill({ color: 0x1a1a2e });
    if (pct > 0) {
      this.hpBar.roundRect(-bw / 2, 38, bw * pct, 5, 2);
      this.hpBar.fill({ color: pct > 0.5 ? 0x4ade80 : pct > 0.25 ? 0xfbbf24 : 0xf87171 });
    }
  }
}
