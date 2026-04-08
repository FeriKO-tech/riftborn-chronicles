import type { Application } from 'pixi.js';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { ZoneDefinitionDto, HeroSceneStatsDto } from '@riftborn/shared';
import { HeroActor, HERO_REF_X, HERO_REF_Y } from '../actors/HeroActor';
import { EnemyActor } from '../actors/EnemyActor';
import { BossActor } from '../actors/BossActor';
import { SpawnSystem } from '../systems/SpawnSystem';
import { MovementSystem } from '../systems/MovementSystem';
import { ParticleSystem } from '../effects/ParticleSystem';
import { FloatingTextSystem } from '../effects/FloatingTextSystem';

// Reference field dimensions
const REF_W = 800;
const REF_H = 460;

// Minimum hero-to-enemy gap before attack triggers
const ATTACK_COOLDOWN_MS = 650;
const ENEMY_ATTACK_RANGE = 70; // ref-space distance for enemy to hit hero
const ENEMY_ATTACK_CD_MS = 1200; // enemy attack cooldown

export interface CombatSceneCallbacks {
  onEnemyKilled: (typeId: string) => void;
}

export class CombatScene {
  private readonly app: Application;
  private readonly root: Container;
  private readonly bgLayer: Container;
  private readonly enemyLayer: Container;
  private readonly heroLayer: Container;
  private readonly fxLayer: Container;

  private hero: HeroActor;
  private enemies = new Map<string, EnemyActor>();
  private boss: BossActor | null = null;

  private readonly spawn = new SpawnSystem();
  private readonly movement = new MovementSystem();

  private def: ZoneDefinitionDto;
  private callbacks: CombatSceneCallbacks;

  private heroDamage = 50;
  private attackCooldown = 0;
  private bossMode = false;
  private bossDefeated = false;
  private bossDrainTimer = 0;
  private bossDrainActive = false;
  private bossDrainDuration = 2.5;

  // FX systems
  private readonly fx: ParticleSystem;
  private readonly floatText: FloatingTextSystem;

  // Screen shake
  private shakeTimer = 0;
  private shakeIntensity = 0;

  // Zone-clear flash overlay
  private readonly clearOverlay: Graphics;
  private clearFlashTimer = 0;

  constructor(
    app: Application,
    def: ZoneDefinitionDto,
    playerClass: string,
    playerName: string,
    heroStats: HeroSceneStatsDto,
    callbacks: CombatSceneCallbacks,
  ) {
    this.app = app;
    this.def = def;
    this.callbacks = callbacks;
    this.heroDamage = Math.max(1, heroStats.attack);

    this.root        = new Container();
    this.bgLayer     = new Container();
    this.enemyLayer  = new Container();
    this.heroLayer   = new Container();
    this.fxLayer     = new Container();

    this.root.addChild(this.bgLayer);
    this.root.addChild(this.enemyLayer);
    this.root.addChild(this.heroLayer);
    this.root.addChild(this.fxLayer);

    // Particle + float-text containers sit below the clear overlay
    const particleLayer  = new Container();
    const floatLayer     = new Container();
    this.fxLayer.addChild(particleLayer);
    this.fxLayer.addChild(floatLayer);

    this.clearOverlay = new Graphics();
    this.clearOverlay.alpha = 0;
    this.fxLayer.addChild(this.clearOverlay);

    this.fx        = new ParticleSystem(particleLayer);
    this.floatText = new FloatingTextSystem(floatLayer);

    app.stage.addChild(this.root);

    this.hero = new HeroActor(playerClass, playerName);
    this.hero.maxHp = heroStats.maxHp;
    this.hero.hp    = heroStats.maxHp;
    this.heroLayer.addChild(this.hero);

    this._drawBackground();
    this.spawn.reset();
  }

  // ── Zone reset (called after zone clear) ────────────────────────────────

  resetZone(newDef: ZoneDefinitionDto): void {
    this.def = newDef;
    this.bossMode = false;
    this.bossDefeated = false;
    if (this.boss) { this.enemyLayer.removeChild(this.boss); this.boss = null; }
    for (const [, e] of this.enemies) this.enemyLayer.removeChild(e);
    this.enemies.clear();
    this.fx.destroy();
    this.floatText.destroy();
    this.hero.refX = HERO_REF_X;
    this.hero.refY = HERO_REF_Y;
    this.hero.hp   = this.hero.maxHp;
    this.hero.setState('idle');
    this.attackCooldown = 0;
    this.shakeTimer = 0;
    this.bossDrainActive = false;
    this.bossDrainTimer  = 0;
    this.root.x = 0; this.root.y = 0;
    this.spawn.reset();
    this._drawBackground();
  }

  // ── Spawn boss manually (called by hook when player clicks boss button) ─

  spawnBoss(): void {
    if (this.bossMode || this.bossDefeated) return;
    this.bossMode = true;

    // Remove all regular enemies immediately
    for (const [, e] of this.enemies) { e.triggerDeath(); }

    const bossType = {
      id: this.def.bossId,
      name: this.def.bossName,
      archetype: 'boss' as const,
      baseHp: this.def.bossMaxHp,
      baseAtk: 0,
      spawnWeight: 0,
      color: '#111827',
      accentColor: '#f59e0b',
      size: 42,
      goldReward: 0,
      expReward: 0,
      dropChance: 1,
    };

    const bossRefX = (REF_W * 0.72);
    const bossRefY = (REF_H * 0.5);
    this.boss = new BossActor(bossType, bossRefX, bossRefY);
    this.enemyLayer.addChild(this.boss);
    this._syncActorPosition(this.boss);
  }

  // ── Resolve boss outcome (called by hook after server response) ──────────

  resolveBoss(victory: boolean): void {
    if (!this.boss) return;
    if (victory) {
      this.bossDrainActive = true;
      this.bossDrainTimer  = this.bossDrainDuration;
      this.bossDefeated = true;
    } else {
      this.hero.takeDamage(this.hero.maxHp * 0.4);
      this.shakeTimer = 0.2; this.shakeIntensity = 8;
      this.bossMode = false;
    }
  }

  updateHeroStats(stats: HeroSceneStatsDto): void {
    this.heroDamage  = Math.max(1, stats.attack);
    this.hero.maxHp  = stats.maxHp;
    this.hero.hp     = Math.min(this.hero.hp, stats.maxHp);
  }

  getBossHpPercent(): number {
    if (!this.boss) return 0;
    return Math.max(0, this.boss.hp / this.boss.maxHp);
  }

  getHeroHpPercent(): number {
    return Math.max(0, this.hero.hp / this.hero.maxHp);
  }

  // ── Main update (called by PixiJS ticker) ────────────────────────────────

  update(deltaMS: number): void {
    const W = this.app.screen.width;
    const H = this.app.screen.height;
    const sx = W / REF_W;
    const sy = H / REF_H;

    // Spawn enemies (skip during boss mode)
    if (!this.bossMode) {
      const liveCount = this._aliveEnemyCount();
      const event = this.spawn.update(
        deltaMS,
        liveCount,
        this.def.maxLiveEnemies,
        this.def.spawnIntervalMs,
        this.def.spawnPoints,
        this.def.enemyTypes,
      );
      if (event) {
        const enemy = new EnemyActor(event.enemyType, event.spawnPoint.x, event.spawnPoint.y);
        this.enemies.set(enemy.id, enemy);
        this.enemyLayer.addChild(enemy);
        this._syncActorPosition(enemy);
        // Spawn glint (position already synced)
        this.fx.emitSpawnGlint(enemy.x, enemy.y, enemy.accent);
      }
    }

    // Collect alive targets
    const aliveTargets = this._collectAliveTargets();

    // Attack cooldown
    if (this.attackCooldown > 0) this.attackCooldown -= deltaMS;

    // Skip AI when hero is dead
    if (!this.hero.isDead()) {
      // Hero movement + AI (skip if boss entry in progress)
      const bossReady = this.boss?.isEntryDone() ?? false;
      if (!this.hero.isAttacking()) {
        if (this.bossMode && this.boss && bossReady) {
          const bossTarget = [{ id: this.boss.id, refX: this.boss.refX, refY: this.boss.refY }];
          const mv = this.movement.update(this.hero.refX, this.hero.refY, bossTarget, deltaMS);
          this.hero.refX = mv.newRefX;
          this.hero.refY = mv.newRefY;
          if (mv.inAttackRange && this.attackCooldown <= 0 && !this.bossDefeated) {
            this.hero.setState('attack');
            this.attackCooldown = ATTACK_COOLDOWN_MS;
            this.fx.emitHeroAttackTrail(this.hero.x, this.hero.y, 0x7c3aed);
          } else {
            this.hero.setState('move');
          }
        } else if (!this.bossMode && aliveTargets.length > 0) {
          const mv = this.movement.update(this.hero.refX, this.hero.refY, aliveTargets, deltaMS);
          this.hero.refX = mv.newRefX;
          this.hero.refY = mv.newRefY;
          if (mv.inAttackRange && mv.targetId && this.attackCooldown <= 0) {
            const target = this.enemies.get(mv.targetId);
            if (target && target.isAlive()) {
              this.hero.setState('attack');
              this.attackCooldown = ATTACK_COOLDOWN_MS;
              const killed = target.takeDamage(this.heroDamage);
              // Hit FX
              this.fx.emitHeroAttackTrail(this.hero.x, this.hero.y, 0x7c3aed);
              this.fx.emitKillSparks(target.x, target.y, target.accent, killed ? 10 : 4);
              if (killed) {
                this.fx.emitDeathBurst(target.x, target.y, target.color);
                this.floatText.emitGold(target.x, target.y, target.goldReward);
                this.floatText.emitExp(target.x, target.y - 18, target.expReward);
                this.callbacks.onEnemyKilled(target.typeId);
              }
            }
          } else {
            this.hero.setState('move');
          }
        } else {
          this.hero.setState('idle');
        }
      }

      // Enemy attack-back: alive enemies in range hit hero
      for (const [, e] of this.enemies) {
        if (!e.isAlive()) continue;
        const dx = this.hero.refX - e.refX;
        const dy = this.hero.refY - e.refY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < ENEMY_ATTACK_RANGE && e.attackTimer <= 0) {
          this.hero.takeDamage(Math.max(1, e.baseAtk - Math.floor(this.heroDamage * 0.1)));
          e.attackTimer = ENEMY_ATTACK_CD_MS;
          this.fx.emitKillSparks(this.hero.x, this.hero.y, 0xef4444, 3);
        }
      }
    }

    // Sync positions
    this._syncActorPosition(this.hero);

    // Update hero
    this.hero.update(deltaMS);

    // Update FX
    this.fx.update(deltaMS);
    this.floatText.update(deltaMS);

    // Screen shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= deltaMS / 1000;
      const mag = this.shakeIntensity * Math.max(0, this.shakeTimer / 0.35);
      this.root.x = (Math.random() - 0.5) * mag * 2;
      this.root.y = (Math.random() - 0.5) * mag * 2;
    } else {
      this.root.x = 0; this.root.y = 0;
    }

    // Update enemies
    const toRemove: string[] = [];
    for (const [id, e] of this.enemies) {
      e.update(deltaMS);
      this._syncActorPosition(e);
      if (e.isDead()) toRemove.push(id);
    }
    for (const id of toRemove) {
      const e = this.enemies.get(id)!;
      this.enemyLayer.removeChild(e);
      this.enemies.delete(id);
    }

    // Boss HP drain animation (victory → gradual drain)
    if (this.bossDrainActive && this.boss) {
      this.bossDrainTimer -= deltaMS / 1000;
      const drainPct = 1 - Math.max(0, this.bossDrainTimer / this.bossDrainDuration);
      this.boss.hp = Math.max(0, this.boss.maxHp * (1 - drainPct));
      if (this.bossDrainTimer <= 0) {
        this.boss.triggerDeath();
        this.bossDrainActive = false;
      }
    }

    // Update boss
    if (this.boss) {
      this.boss.update(deltaMS);
      this._syncActorPosition(this.boss);
      if (this.boss.isDead()) {
        this.fx.emitBossExplosion(this.boss.x, this.boss.y);
        this.shakeTimer = 0.35; this.shakeIntensity = 14;
        this.clearFlashTimer = 1.5;
        this.enemyLayer.removeChild(this.boss);
        this.boss = null;
      }
    }

    // Zone-clear flash
    if (this.clearFlashTimer > 0) {
      this.clearFlashTimer -= deltaMS / 1000;
      const alpha = Math.max(0, Math.sin((1.5 - this.clearFlashTimer) * Math.PI * 0.66) * 0.55);
      this.clearOverlay.clear();
      this.clearOverlay.rect(0, 0, W, H);
      this.clearOverlay.fill({ color: 0xf59e0b, alpha });
      this.clearOverlay.alpha = 1;
    } else {
      this.clearOverlay.alpha = 0;
    }
  }

  // ── Background ────────────────────────────────────────────────────────────

  private _drawBackground(): void {
    this.bgLayer.removeChildren();
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    const ambientHex = parseInt(this.def.ambientColor.replace('#', ''), 16);
    const fogHex     = parseInt(this.def.fogColor.replace('#', ''), 16);

    // Sky fill
    const sky = new Graphics();
    sky.rect(0, 0, W, H); sky.fill({ color: ambientHex });
    this.bgLayer.addChild(sky);

    // Void horizon gradient (fake gradient via rects)
    const horizonLayers = 8;
    for (let i = 0; i < horizonLayers; i++) {
      const lr = new Graphics();
      const yr = H * 0.35 + (i / horizonLayers) * H * 0.3;
      const alpha = (i / horizonLayers) * 0.25;
      lr.rect(0, yr, W, H * 0.3 / horizonLayers + 2);
      lr.fill({ color: fogHex, alpha });
      this.bgLayer.addChild(lr);
    }

    // Floor tiles
    const floorY = H * 0.58;
    const floor = new Graphics();
    floor.rect(0, floorY, W, H - floorY);
    floor.fill({ color: 0x1c1917, alpha: 0.85 });
    floor.rect(0, floorY, W, H - floorY);
    floor.stroke({ width: 0.5, color: 0x292524, alpha: 0.5 });
    this.bgLayer.addChild(floor);

    // Floor grid lines (perspective-ish)
    const grid = new Graphics();
    const horizonX = W * 0.5;
    const gridCols = 8;
    for (let i = 0; i <= gridCols; i++) {
      const bx = W * 0.05 + (i / gridCols) * W * 0.9;
      grid.moveTo(horizonX, floorY).lineTo(bx, H);
      grid.stroke({ width: 0.5, color: 0x292524, alpha: 0.4 });
    }
    for (let row = 0; row < 5; row++) {
      const ry = floorY + ((row + 1) / 5) * (H - floorY);
      grid.moveTo(0, ry).lineTo(W, ry);
      grid.stroke({ width: 0.3, color: 0x292524, alpha: 0.3 });
    }
    this.bgLayer.addChild(grid);

    // Arcane veins in floor
    const veins = new Graphics();
    for (let v = 0; v < 4; v++) {
      const vx = W * (0.18 + v * 0.22);
      veins.moveTo(vx, floorY).lineTo(vx + W * 0.06, H);
      veins.stroke({ width: 0.8, color: 0x7c3aed, alpha: 0.2 });
    }
    this.bgLayer.addChild(veins);

    // Lantern glows (3 points)
    for (const lx of [W * 0.18, W * 0.5, W * 0.82]) {
      const lantern = new Graphics();
      lantern.circle(lx, H * 0.56, W * 0.14);
      lantern.fill({ color: 0xfde68a, alpha: 0.05 });
      lantern.circle(lx, H * 0.56, W * 0.06);
      lantern.fill({ color: 0xfde68a, alpha: 0.06 });
      this.bgLayer.addChild(lantern);
    }

    // Background void shards (decorative)
    const shards = new Graphics();
    for (let s = 0; s < 6; s++) {
      const sx = W * (0.1 + s * 0.16);
      const sy = H * (0.12 + Math.sin(s * 1.3) * 0.12);
      shards.poly([sx, sy - 14, sx + 5, sy, sx - 5, sy]);
      shards.fill({ color: 0x7c3aed, alpha: 0.08 });
    }
    this.bgLayer.addChild(shards);

    // Boss arch (visible after boss mode triggers)
    const arch = new Graphics();
    const archX = W * 0.72;
    arch.roundRect(archX - W * 0.1, H * 0.05, W * 0.2, H * 0.52, 8);
    arch.stroke({ width: 1, color: 0xf59e0b, alpha: 0.12 });
    arch.roundRect(archX - W * 0.07, H * 0.08, W * 0.14, H * 0.46, 6);
    arch.fill({ color: 0x000000, alpha: 0.2 });
    this.bgLayer.addChild(arch);

    // Zone name watermark
    const zoneName = new Text({ text: this.def.name.toUpperCase(), style: new TextStyle({ fontFamily: 'sans-serif', fontSize: 11, fill: 0xffffff, fontWeight: '700', letterSpacing: 3 }) });
    zoneName.anchor.set(0.5, 0.5);
    zoneName.position.set(W * 0.5, H * 0.2);
    zoneName.alpha = 0.08;
    this.bgLayer.addChild(zoneName);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _syncActorPosition(actor: HeroActor | EnemyActor): void {
    const W = this.app.screen.width;
    const H = this.app.screen.height;
    actor.x = actor.refX * (W / REF_W);
    actor.y = actor.refY * (H / REF_H);
  }

  private _aliveEnemyCount(): number {
    let count = 0;
    for (const [, e] of this.enemies) if (!e.isDead()) count++;
    return count;
  }

  private _collectAliveTargets() {
    const targets: { id: string; refX: number; refY: number }[] = [];
    for (const [, e] of this.enemies) {
      if (e.isAlive()) targets.push({ id: e.id, refX: e.refX, refY: e.refY });
    }
    return targets;
  }

  handleResize(): void {
    this._drawBackground();
  }

  destroy(): void {
    this.fx.destroy();
    this.floatText.destroy();
    this.app.stage.removeChild(this.root);
  }
}
