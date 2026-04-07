import type { Application } from 'pixi.js';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { ZoneDefinitionDto } from '@riftborn/shared';
import { HeroActor, HERO_REF_X, HERO_REF_Y } from '../actors/HeroActor';
import { EnemyActor } from '../actors/EnemyActor';
import { BossActor } from '../actors/BossActor';
import { SpawnSystem } from '../systems/SpawnSystem';
import { MovementSystem } from '../systems/MovementSystem';

// Reference field dimensions
const REF_W = 800;
const REF_H = 460;

// Minimum hero-to-enemy gap before attack triggers
const ATTACK_COOLDOWN_MS = 650;

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

  private attackCooldown = 0;
  private bossMode = false;
  private bossDefeated = false;

  // Zone-clear flash overlay
  private readonly clearOverlay: Graphics;
  private clearFlashTimer = 0;

  constructor(
    app: Application,
    def: ZoneDefinitionDto,
    playerClass: string,
    playerName: string,
    callbacks: CombatSceneCallbacks,
  ) {
    this.app = app;
    this.def = def;
    this.callbacks = callbacks;

    this.root        = new Container();
    this.bgLayer     = new Container();
    this.enemyLayer  = new Container();
    this.heroLayer   = new Container();
    this.fxLayer     = new Container();

    this.root.addChild(this.bgLayer);
    this.root.addChild(this.enemyLayer);
    this.root.addChild(this.heroLayer);
    this.root.addChild(this.fxLayer);

    this.clearOverlay = new Graphics();
    this.clearOverlay.alpha = 0;
    this.fxLayer.addChild(this.clearOverlay);

    app.stage.addChild(this.root);

    this.hero = new HeroActor(playerClass, playerName);
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
      this.boss.triggerDeath();
      this.bossDefeated = true;
      this.clearFlashTimer = 1.5;
    } else {
      this.hero.setState('hurt');
      this.bossMode = false; // allow retrying
    }
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
      }
    }

    // Collect alive targets
    const aliveTargets = this._collectAliveTargets();

    // Attack cooldown
    if (this.attackCooldown > 0) this.attackCooldown -= deltaMS;

    // Hero movement + AI (skip if boss entry in progress)
    const bossReady = this.boss?.isEntryDone() ?? false;
    if (!this.hero.isAttacking()) {
      if (this.bossMode && this.boss && bossReady) {
        // Target boss
        const bossTarget = [{ id: this.boss.id, refX: this.boss.refX, refY: this.boss.refY }];
        const mv = this.movement.update(this.hero.refX, this.hero.refY, bossTarget, deltaMS);
        this.hero.refX = mv.newRefX;
        this.hero.refY = mv.newRefY;
        if (mv.inAttackRange && this.attackCooldown <= 0 && !this.bossDefeated) {
          this.hero.setState('attack');
          this.attackCooldown = ATTACK_COOLDOWN_MS;
          // Outcome set externally via resolveBoss() after server responds
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
            target.triggerDeath();
            this.callbacks.onEnemyKilled(target.typeId);
          }
        } else {
          this.hero.setState('move');
        }
      } else {
        this.hero.setState('idle');
      }
    }

    // Sync positions
    this._syncActorPosition(this.hero);

    // Update hero
    this.hero.update(deltaMS);

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

    // Update boss
    if (this.boss) {
      this.boss.update(deltaMS);
      this._syncActorPosition(this.boss);
      if (this.boss.isDead()) {
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
    this.app.stage.removeChild(this.root);
  }
}
