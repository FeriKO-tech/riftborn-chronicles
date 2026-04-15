import { Container, Text, TextStyle } from 'pixi.js';

interface FloatEntry {
  t: Text;
  vy: number;
  vx: number;
  life: number;
  maxLife: number;
  scaleBase: number;
}

const STYLES: Record<string, { fill: number; fontSize: number }> = {
  gold:  { fill: 0xfbbf24, fontSize: 14 },
  exp:   { fill: 0x60a5fa, fontSize: 12 },
  kill:  { fill: 0xf87171, fontSize: 13 },
  loot:  { fill: 0xa78bfa, fontSize: 13 },
  level: { fill: 0x4ade80, fontSize: 16 },
  crit:  { fill: 0xfbbf24, fontSize: 18 },
  heal:  { fill: 0x4ade80, fontSize: 14 },
  dodge: { fill: 0x9ca3af, fontSize: 12 },
};

export class FloatingTextSystem {
  private readonly layer: Container;
  private entries: FloatEntry[] = [];

  constructor(layer: Container) {
    this.layer = layer;
  }

  emitGold(x: number, y: number, amount: number): void {
    this._emit(x, y, `+${amount}g`, 'gold');
  }

  emitExp(x: number, y: number, amount: number): void {
    this._emit(x, y, `+${amount} exp`, 'exp');
  }

  emitKill(x: number, y: number, name: string): void {
    this._emit(x, y - 14, name, 'kill');
  }

  emitLoot(x: number, y: number): void {
    this._emit(x, y - 28, '✦ Item Drop!', 'loot');
  }

  emitLevelUp(x: number, y: number): void {
    this._emit(x, y, '⬆ LEVEL UP!', 'level');
  }

  emitCrit(x: number, y: number, amount: number): void {
    this._emit(x, y - 8, `⚡CRIT -${amount}`, 'crit', 1.3);
  }

  emitHeal(x: number, y: number, amount: number): void {
    this._emit(x, y, `+${amount} HP`, 'heal');
  }

  emitDodge(x: number, y: number): void {
    this._emit(x, y, 'DODGE', 'dodge');
  }

  emitCustom(x: number, y: number, content: string, color: number, scale = 1.0): void {
    const t = new Text({
      text: content,
      style: new TextStyle({
        fontFamily: 'sans-serif',
        fontSize: Math.round(14 * scale),
        fontWeight: '700',
        fill: color,
      }),
    });
    t.anchor.set(0.5, 1);
    t.position.set(x + (Math.random() - 0.5) * 12, y);
    t.alpha = 0;
    this.layer.addChild(t);
    this.entries.push({ t, vy: -(50 + Math.random() * 25), vx: (Math.random() - 0.5) * 20, life: 1.6, maxLife: 1.6, scaleBase: scale });
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const dead: number[] = [];

    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      e.life -= dt;
      if (e.life <= 0) { dead.push(i); continue; }

      e.t.y  += e.vy * dt;
      e.t.x  += e.vx * dt;
      e.vy   *= 0.94;
      e.vx   *= 0.96;
      // Fade out in the last 40% of lifetime
      const fadeRatio = e.life / e.maxLife;
      e.t.alpha = Math.min(1, fadeRatio * 2.5);
      // Pop-in then shrink, scaled by scaleBase
      const base = e.scaleBase;
      const progress = 1 - fadeRatio;
      const s = base * (progress < 0.15 ? 0.6 + progress * 3.0 : 1.0 - (progress - 0.15) * 0.25);
      e.t.scale.set(Math.max(0.3, s));
    }

    for (let i = dead.length - 1; i >= 0; i--) {
      const idx = dead[i];
      this.layer.removeChild(this.entries[idx].t);
      this.entries.splice(idx, 1);
    }
  }

  destroy(): void {
    for (const e of this.entries) this.layer.removeChild(e.t);
    this.entries = [];
  }

  private _emit(x: number, y: number, content: string, variant: keyof typeof STYLES, scaleOverride = 1.0): void {
    const s = STYLES[variant];
    const t = new Text({
      text: content,
      style: new TextStyle({
        fontFamily: 'sans-serif',
        fontSize: s.fontSize,
        fontWeight: '700',
        fill: s.fill,
      }),
    });
    t.anchor.set(0.5, 1);
    t.position.set(x + (Math.random() - 0.5) * 24, y);
    t.alpha = 0;
    this.layer.addChild(t);
    this.entries.push({ t, vy: -(55 + Math.random() * 35), vx: (Math.random() - 0.5) * 18, life: 1.1, maxLife: 1.1, scaleBase: scaleOverride });
  }
}
