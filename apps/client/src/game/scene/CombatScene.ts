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

const enum BossPhase {
  NONE = 0,      // normal farming
  ENTRY = 1,     // boss descending, enemies clearing
  FIGHT = 2,     // hero vs boss
  DEFEATED = 3,  // boss killed, awaiting server / zone reset
  LOST = 4,      // hero died, awaiting respawn
}

export interface CombatSceneCallbacks {
  onEnemyKilled: (typeId: string) => void;
  onBossDefeated?: () => void;
  onBossLost?: () => void;
  onChallengeBossDefeated?: (bossId: string) => void;
  onChallengeBossLost?: (bossId: string) => void;
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
  private bossPhase: BossPhase = BossPhase.NONE;
  private bossAtk = 0;
  private bossAttackTimer = 0;
  private bossDefeatedTimer = 0; // safety timeout after boss defeated
  private challengeBossId: string | null = null; // tracking if we are fighting a custom challenge boss
  private readonly BOSS_ATTACK_INTERVAL = 1200; // ms between boss hits

  // Danger-flash overlay for boss entry
  private readonly dangerOverlay: Graphics;
  private dangerFlashTimer = 0;

  // Skill-use flash
  private skillFlashTimer = 0;

  // Zone transition fade
  private zoneTransitionTimer = 0;

  // Loot orb system
  private lootOrbs: {
    gfx: Graphics;
    label: Text;
    refX: number;
    refY: number;
    itemName: string;
    rarity: string;
    bobTimer: number;
    pickedUp: boolean;
    pickupTimer: number;
  }[] = [];
  private lootWalkTarget: { refX: number; refY: number } | null = null;

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

    this.dangerOverlay = new Graphics();
    this.dangerOverlay.alpha = 0;
    this.fxLayer.addChild(this.dangerOverlay);

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
    // Trigger zone transition fade
    this.zoneTransitionTimer = 0.5;
    this.def = newDef;
    this.bossPhase = BossPhase.NONE;
    if (this.boss) { this.enemyLayer.removeChild(this.boss); this.boss = null; }
    for (const [, e] of this.enemies) this.enemyLayer.removeChild(e);
    this.enemies.clear();
    // Clean up loot orbs
    for (const orb of this.lootOrbs) {
      this.fxLayer.removeChild(orb.gfx);
      this.fxLayer.removeChild(orb.label);
    }
    this.lootOrbs.length = 0;
    this.lootWalkTarget = null;
    this.fx.destroy();
    this.floatText.destroy();
    this.hero.refX = HERO_REF_X;
    this.hero.refY = HERO_REF_Y;
    this.hero.hp   = this.hero.maxHp;
    this.hero.setState('idle');
    this.attackCooldown = 0;
    this.shakeTimer = 0;
    this.bossAtk = 0;
    this.bossAttackTimer = 0;
    this.bossDefeatedTimer = 0;
    this.dangerFlashTimer = 0;
    this.skillFlashTimer = 0;
    this.zoneTransitionTimer = 0;
    this.root.x = 0; this.root.y = 0;
    this.spawn.reset();
    this._drawBackground();
  }

  // ── Spawn boss manually (called by hook when player clicks boss button) ─

  resetBossState(): void {
    this.bossPhase = BossPhase.NONE;
    this.challengeBossId = null;
    this.hero.hp = this.hero.maxHp;
    if (this.boss) {
      this.boss.triggerDeath();
      this.boss = null;
    }
  }

  spawnBoss(): void {
    if (this.bossPhase !== BossPhase.NONE) return;
    this.bossPhase = BossPhase.ENTRY;

    // Remove all regular enemies immediately (clean arena)
    for (const [id, e] of this.enemies) {
      this.enemyLayer.removeChild(e);
      this.enemies.delete(id);
    }

    this.bossAtk = this.def.bossAtk ?? Math.floor(this.def.bossMaxHp * 0.05);
    this.bossAttackTimer = this.BOSS_ATTACK_INTERVAL;

    const bossType = {
      id: this.def.bossId,
      name: this.def.bossName,
      archetype: 'boss' as const,
      baseHp: this.def.bossMaxHp,
      baseAtk: this.bossAtk,
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

    // Danger flash on boss entry
    this.dangerFlashTimer = 0.4;
  }

  spawnChallengeBoss(bossDto: import('@riftborn/shared').BossConfigDto): void {
    if (this.bossPhase !== BossPhase.NONE) return;
    this.bossPhase = BossPhase.ENTRY;
    this.challengeBossId = bossDto.id;
    
    // Fully heal hero before challenge boss
    this.hero.hp = this.hero.maxHp;

    // Remove all regular enemies immediately
    for (const [id, e] of this.enemies) {
      this.enemyLayer.removeChild(e);
      this.enemies.delete(id);
    }

    this.bossAtk = bossDto.attack;
    this.bossAttackTimer = this.BOSS_ATTACK_INTERVAL;

    const bossType = {
      id: bossDto.id,
      name: bossDto.name,
      archetype: 'boss' as const,
      baseHp: bossDto.hp,
      baseAtk: this.bossAtk,
      spawnWeight: 0,
      color: '#111827',
      accentColor: '#dc2626', // red accent for challenge bosses
      size: Math.min(50, 36 + Math.log10(bossDto.hp)),
      goldReward: 0,
      expReward: 0,
      dropChance: 1,
      icon: bossDto.icon,
    };

    const bossRefX = (REF_W * 0.72);
    const bossRefY = (REF_H * 0.5);
    this.boss = new BossActor(bossType, bossRefX, bossRefY);
    this.enemyLayer.addChild(this.boss);
    this._syncActorPosition(this.boss);

    // Danger flash on boss entry
    this.dangerFlashTimer = 0.6;
  }

  // ── Boss defeated (called internally when boss HP reaches 0) ──────────────

  private handleBossDefeated(): void {
    this.bossPhase = BossPhase.DEFEATED;
    this.bossDefeatedTimer = 0;
    this.fx.emitBossExplosion(this.boss!.x, this.boss!.y);
    this.shakeTimer = 0.35; this.shakeIntensity = 14;
    this.clearFlashTimer = 1.5;
    
    if (this.challengeBossId) {
      this.callbacks.onChallengeBossDefeated?.(this.challengeBossId);
    } else {
      this.callbacks.onBossDefeated?.();
    }
  }

  // ── Hero lost to boss (called internally when hero HP reaches 0) ──────────

  private handleBossLost(): void {
    this.bossPhase = BossPhase.LOST;
    if (this.challengeBossId) {
      this.callbacks.onChallengeBossLost?.(this.challengeBossId);
    } else {
      this.callbacks.onBossLost?.();
    }
  }

  // ── Loot drop (called by hook after boss kill) ───────────────────────────

  spawnLootDrop(itemName: string, rarity: string): void {
    const RARITY_COLORS: Record<string, number> = {
      COMMON: 0xa8a29e, UNCOMMON: 0x22c55e, RARE: 0x3b82f6,
      EPIC: 0xa855f7, LEGENDARY: 0xf59e0b,
    };
    const color = RARITY_COLORS[rarity] ?? 0xfde68a;
    // Spawn where boss was (center-right area)
    const refX = REF_W * 0.65;
    const refY = REF_H * 0.52;
    // Tell hero to walk toward the loot
    this.lootWalkTarget = { refX, refY };
    this.hero.setState('move');

    const gfx = new Graphics();
    gfx.circle(0, 0, 12);
    gfx.fill({ color, alpha: 0.85 });
    gfx.circle(0, 0, 16);
    gfx.stroke({ width: 2, color, alpha: 0.4 });
    gfx.circle(0, -4, 4);
    gfx.fill({ color: 0xffffff, alpha: 0.5 });
    this.fxLayer.addChild(gfx);

    const label = new Text({
      text: itemName,
      style: new TextStyle({
        fontFamily: 'sans-serif', fontSize: 10, fill: color,
        fontWeight: '700', dropShadow: { alpha: 0.6, blur: 2, distance: 1, color: '#000' },
      }),
    });
    label.anchor.set(0.5, 1);
    this.fxLayer.addChild(label);

    this.lootOrbs.push({
      gfx, label, refX, refY, itemName, rarity,
      bobTimer: 0, pickedUp: false, pickupTimer: 0,
    });
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
   try { this._updateInner(deltaMS); } catch (err) { console.error('[CombatScene] update error:', err); }
  }

  private _updateInner(deltaMS: number): void {
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    const inBoss = this.bossPhase !== BossPhase.NONE;
    const bossFighting = this.bossPhase === BossPhase.FIGHT;
    const bossEntry = this.bossPhase === BossPhase.ENTRY;

    // Promote ENTRY → FIGHT once entry animation completes
    if (bossEntry && this.boss?.isEntryDone()) {
      this.bossPhase = BossPhase.FIGHT;
    }

    // Safety timeout: if boss defeated/lost phase lasts > 8s, force reset
    if (this.bossPhase === BossPhase.DEFEATED || this.bossPhase === BossPhase.LOST) {
      this.bossDefeatedTimer += deltaMS / 1000;
      if (this.bossDefeatedTimer > 8) {
        this.bossPhase = BossPhase.NONE;
        if (this.boss) { this.boss.triggerDeath(); }
      }
    }

    // Spawn enemies (skip during any boss phase)
    if (!inBoss) {
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

    // Skip AI when hero is dead or walking to loot
    if (!this.hero.isDead() && !this.lootWalkTarget) {
      if (!this.hero.isAttacking()) {
        if (bossFighting && this.boss && this.boss.isAlive()) {
          // ── Boss fight AI ──
          const bossTarget = [{ id: this.boss.id, refX: this.boss.refX, refY: this.boss.refY }];
          const mv = this.movement.update(this.hero.refX, this.hero.refY, bossTarget, deltaMS);
          this.hero.refX = mv.newRefX;
          this.hero.refY = mv.newRefY;
          if (mv.inAttackRange && this.attackCooldown <= 0) {
            this.hero.setState('attack');
            this.attackCooldown = ATTACK_COOLDOWN_MS;
            // Deal real damage to boss
            const variance = 0.8 + Math.random() * 0.4;
            const dmg = Math.max(1, Math.floor(this.heroDamage * variance));
            const killed = this.boss.takeDamage(dmg);
            this.fx.emitHeroAttackTrail(this.hero.x, this.hero.y, 0x7c3aed);
            this.fx.emitKillSparks(this.boss.x, this.boss.y, 0xf59e0b, killed ? 12 : 5);
            this.floatText.emitCustom(this.boss.x, this.boss.y - 30, `-${dmg}`, 0xef4444);
            this.shakeTimer = 0.08; this.shakeIntensity = 4;
            if (killed) {
              this.handleBossDefeated();
            }
          } else {
            this.hero.setState('move');
          }
        } else if (!inBoss && aliveTargets.length > 0) {
          // ── Normal farming AI ──
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
                this.fx.emitGhostRise(target.x, target.y - 10, target.color);
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

      // Boss attacks hero back (only during FIGHT phase)
      if (bossFighting && this.boss && this.boss.isAlive()) {
        this.bossAttackTimer -= deltaMS;
        if (this.bossAttackTimer <= 0) {
          this.bossAttackTimer = this.BOSS_ATTACK_INTERVAL;
          const variance = 0.7 + Math.random() * 0.6;
          const bossDmg = Math.max(1, Math.floor(this.bossAtk * variance));
          this.hero.takeDamage(bossDmg);
          this.fx.emitKillSparks(this.hero.x, this.hero.y, 0xef4444, 4);
          this.floatText.emitCustom(this.hero.x, this.hero.y - 30, `-${bossDmg}`, 0xfbbf24);
          this.shakeTimer = 0.06; this.shakeIntensity = 3;
          // Check if hero died
          if (this.hero.hp <= 0) {
            this.handleBossLost();
          }
        }
      }
    }

    // Sync positions
    this._syncActorPosition(this.hero);

    // Update hero (track death→alive for respawn FX)
    const wasDeadBeforeUpdate = this.hero.isDead();
    this.hero.update(deltaMS);
    if (wasDeadBeforeUpdate && !this.hero.isDead()) {
      this._syncActorPosition(this.hero);
      this.fx.emitRespawnBurst(this.hero.x, this.hero.y, 0x7c3aed);
      this.floatText.emitCustom(this.hero.x, this.hero.y - 40, 'Revived!', 0x4ade80);
    }

    // Boss-lost cleanup: hero respawned after death animation
    if (this.bossPhase === BossPhase.LOST && !this.hero.isDead()) {
      this.bossPhase = BossPhase.NONE;
      if (this.boss) {
        this.boss.triggerDeath();
      }
      this.callbacks.onBossLost?.();
    }

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

    // Danger flash overlay (red tint on boss entry)
    if (this.dangerFlashTimer > 0) {
      this.dangerFlashTimer -= deltaMS / 1000;
      this.dangerOverlay.clear();
      const alpha = Math.max(0, this.dangerFlashTimer / 0.4) * 0.18;
      this.dangerOverlay.rect(0, 0, W, H);
      this.dangerOverlay.fill({ color: 0xef4444, alpha });
      this.dangerOverlay.alpha = 1;
    } else {
      this.dangerOverlay.alpha = 0;
    }

    // Skill-use flash overlay (purple flash)
    if (this.skillFlashTimer > 0) {
      this.skillFlashTimer -= deltaMS / 1000;
      this.dangerOverlay.clear();
      const alpha = Math.max(0, this.skillFlashTimer / 0.25) * 0.12;
      this.dangerOverlay.rect(0, 0, W, H);
      this.dangerOverlay.fill({ color: 0x7c3aed, alpha });
      this.dangerOverlay.alpha = 1;
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

    // Update boss
    if (this.boss) {
      this.boss.update(deltaMS);
      this._syncActorPosition(this.boss);
      // Remove boss sprite after death animation completes
      if (this.boss.isDead()) {
        this.enemyLayer.removeChild(this.boss);
        this.boss = null;
      }
    }

    // Hero walks toward loot orb
    if (this.lootWalkTarget && this.lootOrbs.length > 0) {
      const speed = 200; // ref-units per second
      const dx = this.lootWalkTarget.refX - this.hero.refX;
      const dy = this.lootWalkTarget.refY - this.hero.refY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 30) {
        const step = speed * (deltaMS / 1000);
        this.hero.refX += (dx / dist) * Math.min(step, dist);
        this.hero.refY += (dy / dist) * Math.min(step, dist);
        this.hero.setState('move');
      } else {
        this.hero.setState('idle');
      }
    }

    // Loot orb update
    const W2 = this.app.screen.width;
    const H2 = this.app.screen.height;
    const sx2 = W2 / REF_W;
    const sy2 = H2 / REF_H;
    for (let i = this.lootOrbs.length - 1; i >= 0; i--) {
      const orb = this.lootOrbs[i];
      orb.bobTimer += deltaMS / 1000;
      const bobY = Math.sin(orb.bobTimer * 3) * 4;

      if (!orb.pickedUp) {
        // Check if hero is close enough
        const dx = this.hero.refX - orb.refX;
        const dy = this.hero.refY - orb.refY;
        if (Math.sqrt(dx * dx + dy * dy) < 50) {
          orb.pickedUp = true;
          orb.pickupTimer = 1.2;
          this.lootWalkTarget = null;
          this.hero.setState('idle');
          this.floatText.emitCustom(
            orb.gfx.x, orb.gfx.y - 20,
            `📦 ${orb.itemName}`,
            orb.rarity === 'LEGENDARY' ? 0xf59e0b :
            orb.rarity === 'EPIC' ? 0xa855f7 :
            orb.rarity === 'RARE' ? 0x3b82f6 : 0x22c55e,
          );
        }
      }

      if (orb.pickedUp) {
        orb.pickupTimer -= deltaMS / 1000;
        orb.gfx.alpha = Math.max(0, orb.pickupTimer);
        orb.label.alpha = Math.max(0, orb.pickupTimer);
        orb.gfx.scale.set(1 + (1 - orb.pickupTimer) * 0.5);
        if (orb.pickupTimer <= 0) {
          this.fxLayer.removeChild(orb.gfx);
          this.fxLayer.removeChild(orb.label);
          this.lootOrbs.splice(i, 1);
          continue;
        }
      }

      orb.gfx.x = orb.refX * sx2;
      orb.gfx.y = (orb.refY + bobY) * sy2;
      orb.label.x = orb.gfx.x;
      orb.label.y = orb.gfx.y - 18 * sy2;
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

    // Zone transition fade (fade black → transparent over 0.5s)
    if (this.zoneTransitionTimer > 0) {
      this.zoneTransitionTimer -= deltaMS / 1000;
      const t = Math.max(0, this.zoneTransitionTimer / 0.5);
      // Peak black at midpoint, then fade out
      const alpha = t > 0.5 ? (1 - t) * 2 : t * 2;
      this.clearOverlay.clear();
      this.clearOverlay.rect(0, 0, W, H);
      this.clearOverlay.fill({ color: 0x000000, alpha: alpha * 0.85 });
      this.clearOverlay.alpha = 1;
    }
  }

  // ── Background ────────────────────────────────────────────────────────────

  // Seed-based pseudo-random for deterministic zone visuals
  private _seededRng(seed: number) {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
  }

  private _drawBackground(): void {
    this.bgLayer.removeChildren();
    const W = this.app.screen.width;
    const H = this.app.screen.height;
    const zone = this.def.zone ?? 1;

    const ambientHex = parseInt(this.def.ambientColor.replace('#', ''), 16);
    const fogHex     = parseInt(this.def.fogColor.replace('#', ''), 16);
    const rng = this._seededRng(zone * 7919);

    // Sky fill
    const sky = new Graphics();
    sky.rect(0, 0, W, H); sky.fill({ color: ambientHex });
    this.bgLayer.addChild(sky);

    // Parallax depth layers (3 fog strips at different heights)
    const horizonLayers = 12;
    for (let i = 0; i < horizonLayers; i++) {
      const lr = new Graphics();
      const yr = H * 0.30 + (i / horizonLayers) * H * 0.35;
      const alpha = (i / horizonLayers) * 0.22;
      lr.rect(0, yr, W, H * 0.35 / horizonLayers + 2);
      lr.fill({ color: fogHex, alpha });
      this.bgLayer.addChild(lr);
    }

    // Background stars / void specks (zone determines density and color)
    const starCount = 12 + zone * 2;
    const starGfx = new Graphics();
    for (let s = 0; s < starCount; s++) {
      const sx = rng() * W;
      const sy = rng() * H * 0.55;
      const size = 0.5 + rng() * 1.5;
      const starAlpha = 0.04 + rng() * 0.12;
      const useAccent = rng() > 0.6;
      starGfx.circle(sx, sy, size);
      starGfx.fill({ color: useAccent ? fogHex : 0xffffff, alpha: starAlpha });
    }
    this.bgLayer.addChild(starGfx);

    // Distant mountains / pillars silhouette (zone-seeded shapes)
    const pillarCount = 3 + Math.floor(zone / 3);
    const pillars = new Graphics();
    for (let p = 0; p < pillarCount; p++) {
      const px = rng() * W;
      const pw = 20 + rng() * 40;
      const ph = 30 + rng() * (H * 0.2);
      const py = H * 0.38 - ph;
      pillars.roundRect(px - pw / 2, py, pw, ph, 3);
      pillars.fill({ color: ambientHex, alpha: 0.5 + rng() * 0.3 });
    }
    this.bgLayer.addChild(pillars);

    // Floor
    const floorY = H * 0.58;
    const floor = new Graphics();
    floor.rect(0, floorY, W, H - floorY);
    floor.fill({ color: 0x1c1917, alpha: 0.85 });
    floor.rect(0, floorY, W, H - floorY);
    floor.stroke({ width: 0.5, color: 0x292524, alpha: 0.5 });
    this.bgLayer.addChild(floor);

    // Floor grid lines (perspective)
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

    // Arcane veins in floor (color varies by zone)
    const veinColors = [0x7c3aed, 0x3b82f6, 0xef4444, 0xf59e0b, 0x22c55e];
    const veinColor = veinColors[(zone - 1) % veinColors.length];
    const veins = new Graphics();
    const veinCount = 3 + Math.floor(zone / 4);
    for (let v = 0; v < veinCount; v++) {
      const vx = W * (0.12 + rng() * 0.76);
      veins.moveTo(vx, floorY).lineTo(vx + W * (0.03 + rng() * 0.06), H);
      veins.stroke({ width: 0.8, color: veinColor, alpha: 0.15 + rng() * 0.1 });
    }
    this.bgLayer.addChild(veins);

    // Lantern glows (positions shift per zone)
    const lanternCount = 2 + Math.floor(zone / 3);
    for (let l = 0; l < lanternCount; l++) {
      const lx = W * (0.12 + (l / lanternCount) * 0.76);
      const lantern = new Graphics();
      lantern.circle(lx, H * 0.56, W * 0.12);
      lantern.fill({ color: 0xfde68a, alpha: 0.04 });
      lantern.circle(lx, H * 0.56, W * 0.05);
      lantern.fill({ color: 0xfde68a, alpha: 0.06 });
      this.bgLayer.addChild(lantern);
    }

    // Floating void shards (zone-unique)
    const shards = new Graphics();
    const shardCount = 5 + Math.floor(zone / 2);
    for (let s = 0; s < shardCount; s++) {
      const sx = rng() * W;
      const sy = H * (0.05 + rng() * 0.30);
      const sz = 8 + rng() * 12;
      shards.poly([sx, sy - sz, sx + sz * 0.4, sy, sx - sz * 0.4, sy]);
      shards.fill({ color: veinColor, alpha: 0.05 + rng() * 0.06 });
    }
    this.bgLayer.addChild(shards);

    // Boss arch
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

  // ── Skill usage (called from UI skill bar) ─────────────────────────────

  useSkill(dmgMult: number): void {
    const baseDmg = this.heroDamage;
    const totalDmg = Math.round(baseDmg * dmgMult * (0.9 + Math.random() * 0.2));

    // Skill-use screen flash
    this.skillFlashTimer = 0.25;

    // Target boss if in boss fight phase, else nearest enemy
    // Guard: don't hit boss during entry animation or after defeated
    if (this.bossPhase === BossPhase.FIGHT && this.boss && this.boss.isAlive()) {
      this.boss.takeDamage(totalDmg);
      this.floatText.emitCrit(this.boss.x, this.boss.y - 20, totalDmg);
      this.fx.emitKillSparks(this.boss.x, this.boss.y, 0xfbbf24, 10);
      this.shakeTimer = 0.15; this.shakeIntensity = 8;
      if (!this.boss.isAlive()) this.handleBossDefeated();
    } else {
      // Hit nearest alive enemy
      let nearest: EnemyActor | null = null;
      let nearestDist = Infinity;
      for (const [, e] of this.enemies) {
        if (!e.isAlive()) continue;
        const d = Math.abs(e.refX - this.hero.refX) + Math.abs(e.refY - this.hero.refY);
        if (d < nearestDist) { nearest = e; nearestDist = d; }
      }
      if (nearest) {
        nearest.takeDamage(totalDmg);
        this.floatText.emitCrit(nearest.x, nearest.y - 20, totalDmg);
        this.fx.emitKillSparks(nearest.x, nearest.y, 0xfbbf24, 8);
        this.shakeTimer = 0.1; this.shakeIntensity = 5;
      }
    }
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
