import { Container, Graphics } from 'pixi.js';

interface Particle {
  g: Graphics;
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
  noGravity?: boolean;
}

const GRAVITY = 220; // px/s² in canvas space

export class ParticleSystem {
  private readonly layer: Container;
  private particles: Particle[] = [];

  constructor(layer: Container) {
    this.layer = layer;
  }

  // ── Emitters ────────────────────────────────────────────────────────────────

  emitKillSparks(x: number, y: number, color: number, count = 10): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
      const speed = 50 + Math.random() * 110;
      this._add(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 30,
        0.3 + Math.random() * 0.25, i % 4 === 0 ? 0xffffff : color, 2 + Math.random() * 3);
    }
  }

  emitDeathBurst(x: number, y: number, color: number): void {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 150;
      this._add(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 55,
        0.45 + Math.random() * 0.4, i % 3 === 0 ? 0xffffff : color, 3 + Math.random() * 5);
    }
  }

  emitBossExplosion(x: number, y: number): void {
    const palette = [0xf59e0b, 0xef4444, 0xa855f7, 0xfbbf24, 0xffffff, 0x06b6d4];
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 220;
      const col = palette[Math.floor(Math.random() * palette.length)];
      this._add(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 90,
        0.6 + Math.random() * 0.9, col, 4 + Math.random() * 8);
    }
  }

  emitSpawnGlint(x: number, y: number, color: number): void {
    for (let i = 0; i < 7; i++) {
      const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.8;
      this._add(x, y, (Math.random() - 0.5) * 35, Math.sin(angle) * 70,
        0.25 + Math.random() * 0.15, color, 1.5 + Math.random() * 2.5);
    }
  }

  emitHeroAttackTrail(x: number, y: number, accent: number): void {
    for (let i = 0; i < 5; i++) {
      this._add(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12,
        12 + Math.random() * 30, (Math.random() - 0.5) * 20,
        0.18 + Math.random() * 0.12, accent, 2 + Math.random() * 3);
    }
  }

  emitRespawnBurst(x: number, y: number, accent: number): void {
    const ring = [0x4ade80, accent, 0xffffff, accent];
    for (let i = 0; i < 18; i++) {
      const angle = (Math.PI * 2 * i) / 18;
      const speed = 70 + Math.random() * 80;
      const col = ring[i % ring.length];
      this._add(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 40,
        0.4 + Math.random() * 0.3, col, 2.5 + Math.random() * 3.5);
    }
  }

  emitGhostRise(x: number, y: number, color: number): void {
    for (let i = 0; i < 6; i++) {
      this._addNoGravity(
        x + (Math.random() - 0.5) * 16,
        y + (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        -(30 + Math.random() * 40),
        0.5 + Math.random() * 0.3,
        color,
        4 + Math.random() * 4,
      );
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const dead: number[] = [];

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { dead.push(i); continue; }

      if (!p.noGravity) p.vy += GRAVITY * dt;
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;

      const alpha = Math.max(0, p.life / p.maxLife);
      const r     = p.size * alpha;
      p.g.clear();
      if (r > 0.3) {
        p.g.circle(p.x, p.y, r);
        p.g.fill({ color: p.color, alpha });
      }
    }

    for (let i = dead.length - 1; i >= 0; i--) {
      const idx = dead[i];
      this.layer.removeChild(this.particles[idx].g);
      this.particles.splice(idx, 1);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private _add(x: number, y: number, vx: number, vy: number,
    life: number, color: number, size: number): void {
    const g = new Graphics();
    this.layer.addChild(g);
    this.particles.push({ g, x, y, vx, vy, life, maxLife: life, color, size });
  }

  private _addNoGravity(x: number, y: number, vx: number, vy: number,
    life: number, color: number, size: number): void {
    const g = new Graphics();
    this.layer.addChild(g);
    this.particles.push({ g, x, y, vx, vy, life, maxLife: life, color, size, noGravity: true });
  }

  destroy(): void {
    for (const p of this.particles) this.layer.removeChild(p.g);
    this.particles = [];
  }
}
