import { Container, Text, TextStyle } from 'pixi.js';

interface FloatEntry {
  t: Text;
  vy: number;
  life: number;
  maxLife: number;
}

const STYLES: Record<string, { fill: number; fontSize: number }> = {
  gold:  { fill: 0xfbbf24, fontSize: 14 },
  exp:   { fill: 0x60a5fa, fontSize: 12 },
  kill:  { fill: 0xf87171, fontSize: 13 },
  loot:  { fill: 0xa78bfa, fontSize: 13 },
  level: { fill: 0x4ade80, fontSize: 16 },
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

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const dead: number[] = [];

    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      e.life -= dt;
      if (e.life <= 0) { dead.push(i); continue; }

      e.t.y  += e.vy * dt;
      e.vy   *= 0.94;
      // Fade out in the last 40% of lifetime
      const fadeRatio = e.life / e.maxLife;
      e.t.alpha = Math.min(1, fadeRatio * 2.5);
      // Slight grow-in then shrink
      const s = 0.8 + Math.min(0.3, (1 - fadeRatio) * 0.6);
      e.t.scale.set(s);
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

  private _emit(x: number, y: number, content: string, variant: keyof typeof STYLES): void {
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
    this.entries.push({ t, vy: -(55 + Math.random() * 35), life: 1.1, maxLife: 1.1 });
  }
}
