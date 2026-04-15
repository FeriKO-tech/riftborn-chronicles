import { Container, Graphics, Sprite, Assets, Text, TextStyle } from 'pixi.js';

export type HeroState = 'idle' | 'move' | 'attack' | 'hurt' | 'dead';

const CLASS_ACCENT: Record<string, number> = {
  VOIDBLADE: 0x7c3aed,
  AETHERMAGE: 0x3b82f6,
  IRONVEIL: 0x6b7280,
};

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
  private readonly shadow: Graphics;
  private readonly spriteContainer: Container;
  private readonly sprite: Sprite;
  private readonly slashFx: Graphics;   // sword slash arc effect
  private readonly hpBar: Graphics;
  private accent: number;

  constructor(playerClass: string, playerName: string) {
    super();
    this.accent = CLASS_ACCENT[playerClass] ?? 0x7c3aed;

    // 1. Shadow underneath (subtle dark ellipse)
    this.shadow = new Graphics();
    this.shadow.ellipse(0, 8, 18, 5);
    this.shadow.fill({ color: 0x000000, alpha: 0.35 });
    this.addChild(this.shadow);

    // 2. Aura (very subtle, only visible during attacks)
    this.aura = new Graphics();
    this.addChild(this.aura);

    // 3. Container for the sprite (handles bobbing/rotation)
    this.spriteContainer = new Container();
    this.addChild(this.spriteContainer);

    // 4. The actual sprite (loads from /hero.png in public folder)
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5, 1);
    this.sprite.scale.set(0.18);
    this.spriteContainer.addChild(this.sprite);

    // Load texture asynchronously (Pixi v8 requires Assets.load)
    void Assets.load('/hero.png').then((tex) => {
      if (tex) this.sprite.texture = tex;
    }).catch(() => {
      console.warn('[HeroActor] Failed to load /hero.png');
    });

    // 5. Slash effect layer (drawn on top of sprite during attacks)
    this.slashFx = new Graphics();
    this.slashFx.alpha = 0;
    this.addChild(this.slashFx);

    // 6. Name Label (right under feet)
    const label = new Text({ 
      text: playerName, 
      style: new TextStyle({ 
        fontFamily: 'sans-serif', 
        fontSize: 10, 
        fill: 0xa78bfa, 
        fontWeight: '700',
        dropShadow: { alpha: 0.8, blur: 2, distance: 0, color: '#000' }
      }) 
    });
    label.anchor.set(0.5, 0);
    label.position.set(0, 14);
    this.addChild(label);

    // 7. HP Bar (under the name)
    this.hpBar = new Graphics();
    this.addChild(this.hpBar);
  }

  setState(s: HeroState): void {
    if (this._state === 'dead') return;
    if (this._state === 'attack' && s !== 'hurt' && s !== 'dead') return;
    this._state = s;
    if (s === 'attack') this.attackCooldown = 0.55;
    if (s === 'hurt')   this.hurtTimer = 0.3;
  }

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

    if (this._state === 'dead') {
      this.deathTimer -= dt;
      this.alpha = 0.15 + Math.sin(this.tick * 6) * 0.1;
      this.spriteContainer.scale.set(0.85);
      if (this.deathTimer <= 0) {
        this.hp = this.maxHp;
        this._state = 'idle';
        this.refX = HERO_REF_X;
        this.refY = HERO_REF_Y;
        this.alpha = 1;
        this.spriteContainer.scale.set(1);
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

    // ── Idle / Move: gentle breathing bob ───────────────────────────────
    const bobSpeed = s === 'move' ? 12 : 3;
    const bobAmp   = s === 'move' ? 4 : 2;
    const bobY = Math.sin(t * bobSpeed) * bobAmp;

    // ── Attack: dramatic lunge + slash ──────────────────────────────────
    const swingProgress = s === 'attack' ? Math.max(0, (0.55 - this.attackCooldown) / 0.55) : 0;
    // Phase 1 (0-0.4): wind up — lean back slightly
    // Phase 2 (0.4-0.7): lunge forward hard
    // Phase 3 (0.7-1.0): return
    const lungeX = s === 'attack'
      ? (swingProgress < 0.35
          ? -6 * (swingProgress / 0.35)                    // lean back
          : 25 * Math.sin(((swingProgress - 0.35) / 0.65) * Math.PI)) // lunge forward
      : 0;

    const leanAngle = s === 'attack'
      ? (swingProgress < 0.35
          ? 0.05                                            // wind-up tilt
          : -0.15 * Math.sin(((swingProgress - 0.35) / 0.65) * Math.PI)) // swing tilt
      : 0;

    // Squash & stretch on attack impact
    const scaleX = s === 'attack' && swingProgress > 0.35 && swingProgress < 0.7 ? 1.1 : 1;
    const scaleY = s === 'attack' && swingProgress > 0.35 && swingProgress < 0.7 ? 0.92 : 1;

    this.spriteContainer.y = s === 'attack' ? bobY - swingProgress * 8 : bobY; // slight lift
    this.spriteContainer.x = lungeX;
    this.spriteContainer.rotation = leanAngle;
    this.spriteContainer.scale.set(scaleX, scaleY);

    // ── Slash arc effect ────────────────────────────────────────────────
    this.slashFx.clear();
    if (s === 'attack' && swingProgress > 0.3 && swingProgress < 0.75) {
      const slashT = (swingProgress - 0.3) / 0.45; // 0→1 during slash
      const arcAngle = -1.2 + slashT * 2.4;       // sweep from -1.2 to +1.2 rad
      const arcR = 45;
      const cx = lungeX + 15; // offset to right of hero
      const cy = -25;

      // Bright arc line
      this.slashFx.moveTo(
        cx + Math.cos(arcAngle - 0.4) * arcR * 0.3,
        cy + Math.sin(arcAngle - 0.4) * arcR * 0.3,
      );
      this.slashFx.lineTo(
        cx + Math.cos(arcAngle) * arcR,
        cy + Math.sin(arcAngle) * arcR,
      );
      this.slashFx.stroke({ width: 4, color: 0x60a5fa, alpha: 1 - slashT * 0.6 });

      // Wider glow trail
      this.slashFx.moveTo(
        cx + Math.cos(arcAngle - 0.6) * arcR * 0.2,
        cy + Math.sin(arcAngle - 0.6) * arcR * 0.2,
      );
      this.slashFx.lineTo(
        cx + Math.cos(arcAngle) * arcR * 1.1,
        cy + Math.sin(arcAngle) * arcR * 1.1,
      );
      this.slashFx.stroke({ width: 8, color: 0xbfdbfe, alpha: (1 - slashT) * 0.4 });

      this.slashFx.alpha = 1;
    } else {
      this.slashFx.alpha = 0;
    }

    // ── Aura pulse under feet (only visible during attack) ────────────
    this.aura.clear();
    if (s === 'attack' && swingProgress > 0.3) {
      const auraAlpha = 0.15 + swingProgress * 0.2;
      const auraR = 20 + swingProgress * 15;
      this.aura.ellipse(0, 8, auraR, auraR * 0.25);
      this.aura.fill({ color: this.accent, alpha: auraAlpha });
    }

    // ── Hurt: red flash + fast shake ────────────────────────────────────
    if (this._state === 'hurt') {
      this.sprite.tint = 0xff6666;
      this.spriteContainer.x = Math.sin(t * 60) * 5;
      this.spriteContainer.rotation = Math.sin(t * 40) * 0.03;
    } else if (s !== 'attack') {
      this.sprite.tint = 0xffffff;
      this.spriteContainer.x = 0;
      this.spriteContainer.rotation = 0;
      this.spriteContainer.scale.set(1);
    }

    // Sprite brightness flash on attack impact
    if (s === 'attack' && swingProgress > 0.35 && swingProgress < 0.55) {
      this.sprite.tint = 0xccddff; // brief white-blue flash
    } else if (s === 'attack') {
      this.sprite.tint = 0xffffff;
    }

    this._updateHpBar();
  }

  private _updateHpBar(): void {
    const pct = Math.max(0, Math.min(1, this.hp / this.maxHp));
    const bw = 40;
    const yPos = 26;
    this.hpBar.clear();
    this.hpBar.roundRect(-bw / 2, yPos, bw, 4, 2); 
    this.hpBar.fill({ color: 0x1a1a2e, alpha: 0.7 });
    if (pct > 0) {
      this.hpBar.roundRect(-bw / 2, yPos, bw * pct, 4, 2);
      this.hpBar.fill({ color: pct > 0.5 ? 0x4ade80 : pct > 0.25 ? 0xfbbf24 : 0xf87171 });
    }
  }
}
