import { Injectable } from '@nestjs/common';
import { PlayerClass } from '@riftborn/shared';
import type { BattleRoundDto, CombatStatsDto, CompanionBonusDto, EquipmentBonusDto } from '@riftborn/shared';
import type { EnemyTemplateDto } from '@riftborn/shared';

// ── Class base-stat multipliers ───────────────────────────────────────────────
const CLASS_MULT: Record<
  string,
  { atk: number; def: number; hp: number; spd: number; crit: number; critDmg: number }
> = {
  // Voidblade: balanced damage, fast, moderate crit damage
  [PlayerClass.VOIDBLADE]: { atk: 1.3, def: 0.9, hp: 1.0, spd: 1.1, crit: 0.08, critDmg: 1.8 },
  // Aethermage: burst mage — highest crit chance AND crit damage
  [PlayerClass.AETHERMAGE]: { atk: 1.5, def: 0.7, hp: 0.8, spd: 1.0, crit: 0.12, critDmg: 2.2 },
  // Ironveil: tank — lowest crit chance, but still punishes on proc
  [PlayerClass.IRONVEIL]: { atk: 0.9, def: 1.4, hp: 1.3, spd: 0.8, crit: 0.05, critDmg: 1.6 },
};

const DEFAULT_MULT = CLASS_MULT[PlayerClass.VOIDBLADE];
const MAX_ROUNDS = 50;
const EXP_PER_KILL = 80; // base exp multiplied by enemy level

export interface SimulateOptions {
  zone: number;
  room: number;
  enemies: EnemyTemplateDto[];
  clearGoldBonus: number;
}

export interface SimulateResult {
  victory: boolean;
  rounds: BattleRoundDto[];
  totalDamageDealt: number;
  goldEarned: number;
  expEarned: number;
}

@Injectable()
export class CombatService {
  // ── Public API ─────────────────────────────────────────────────────────────

  computePlayerStats(
    level: number,
    playerClass: string,
    equipBonus?: EquipmentBonusDto,
    companionBonus?: CompanionBonusDto,
  ): CombatStatsDto {
    const m = CLASS_MULT[playerClass] ?? DEFAULT_MULT;
    const base = level * 100;
    // Base + equipment bonuses (absolute values)
    const baseHp = Math.floor(base * m.hp * 10) + (equipBonus?.hpBonus ?? 0);
    const baseAtk = Math.floor(base * m.atk) + (equipBonus?.atkBonus ?? 0);
    const baseDef = Math.floor(base * m.def * 0.5) + (equipBonus?.defBonus ?? 0);
    // Companion percentage multipliers applied on top
    const cAtkMult = 1 + (companionBonus?.atkPct ?? 0) / 100;
    const cDefMult = 1 + (companionBonus?.defPct ?? 0) / 100;
    const cHpMult  = 1 + (companionBonus?.hpPct ?? 0) / 100;
    const hp = Math.floor(baseHp * cHpMult);
    return {
      hp,
      maxHp: hp,
      attack: Math.floor(baseAtk * cAtkMult),
      defense: Math.floor(baseDef * cDefMult),
      speed: Math.floor(base * m.spd * 0.3),
      critChance: Math.min(0.5, m.crit + level * 0.001),
      critDamage: m.critDmg,
    };
  }

  simulateRoom(playerStats: CombatStatsDto, opts: SimulateOptions): SimulateResult {
    const seed = opts.zone * 1_000_000 + opts.room * 10_000 + Date.now() % 10_000;
    const rng = this.lcgRng(seed);

    let allRounds: BattleRoundDto[] = [];
    let victory = true;
    let playerHp = playerStats.hp;
    let totalDmg = 0;
    let totalExp = 0;

    for (const enemy of opts.enemies) {
      const result = this.fightEnemy(playerStats, enemy, playerHp, rng);
      allRounds = allRounds.concat(result.rounds);
      totalDmg += result.totalDmg;
      playerHp = result.playerHpLeft;
      totalExp += result.expEarned;

      if (!result.victory) {
        victory = false;
        break;
      }
    }

    const goldEarned = victory
      ? opts.enemies.reduce((s, e) => s + e.goldReward, 0) + opts.clearGoldBonus
      : 0;

    return {
      victory,
      rounds: allRounds,
      totalDamageDealt: totalDmg,
      goldEarned,
      expEarned: victory ? totalExp : Math.floor(totalExp * 0.3),
    };
  }

  computeLevelUp(
    currentLevel: number,
    currentExp: number,
    expGained: number,
  ): { newLevel: number; newExp: number; leveledUp: boolean } {
    let level = currentLevel;
    let exp = currentExp + expGained;
    let leveledUp = false;

    while (exp >= this.expToNextLevel(level)) {
      exp -= this.expToNextLevel(level);
      level++;
      leveledUp = true;
    }

    return { newLevel: level, newExp: exp, leveledUp };
  }

  expToNextLevel(level: number): number {
    return Math.floor(level * 100 * Math.pow(1.15, level - 1));
  }

  computePowerScore(
    level: number,
    playerClass: string,
    equipBonus?: EquipmentBonusDto,
    companionBonus?: CompanionBonusDto,
  ): number {
    const stats = this.computePlayerStats(level, playerClass, equipBonus, companionBonus);
    return Math.floor(stats.attack * 2 + stats.defense + stats.hp / 10);
  }

  simulateSingleEnemy(
    playerStats: CombatStatsDto,
    enemy: EnemyTemplateDto,
    seed: number,
  ): { victory: boolean; rounds: number; totalDamageDealt: number } {
    const rng = this.lcgRng(seed >>> 0);
    const result = this.fightEnemy(playerStats, enemy, playerStats.hp, rng);
    return {
      victory: result.victory,
      rounds: result.rounds.length,
      totalDamageDealt: result.totalDmg,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private fightEnemy(
    playerStats: CombatStatsDto,
    enemy: EnemyTemplateDto,
    startingPlayerHp: number,
    rng: () => number,
  ): {
    rounds: BattleRoundDto[];
    victory: boolean;
    totalDmg: number;
    playerHpLeft: number;
    expEarned: number;
  } {
    let playerHp = startingPlayerHp;
    let enemyHp = enemy.hp;
    const rounds: BattleRoundDto[] = [];
    let totalDmg = 0;

    // Speed determines attack order.
    // If enemy speed > player speed: enemy strikes first each round (ambush advantage).
    // If player speed >= 2× enemy speed: player gets a bonus free attack in odd rounds.
    const playerGoesFirst = playerStats.speed >= enemy.speed;
    const playerHasDoubleSpeed = playerStats.speed >= enemy.speed * 2;

    for (let i = 1; i <= MAX_ROUNDS; i++) {
      let playerDmg = 0;
      let enemyDmg = 0;
      let playerCrit = false;

      const attackPlayer = () => {
        const crit = rng() < playerStats.critChance;
        const rawDmg = playerStats.attack * (crit ? playerStats.critDamage : 1);
        const variance = 1 + (rng() - 0.5) * 0.2;
        playerDmg += Math.max(1, Math.floor(rawDmg * variance - enemy.defense * 0.25));
        if (crit) playerCrit = true;
      };

      const attackEnemy = () => {
        if (enemyHp - playerDmg <= 0) return; // enemy already dead
        const eVariance = 1 + (rng() - 0.5) * 0.15;
        enemyDmg += Math.max(1, Math.floor(enemy.attack * eVariance - playerStats.defense * 0.25));
      };

      if (playerGoesFirst) {
        attackPlayer();
        // Bonus attack on odd rounds when player is significantly faster
        if (playerHasDoubleSpeed && i % 2 === 1) attackPlayer();
        attackEnemy();
      } else {
        attackEnemy();
        attackPlayer();
      }

      enemyHp = Math.max(0, enemyHp - playerDmg);
      totalDmg += playerDmg;
      if (enemyHp > 0) playerHp = Math.max(0, playerHp - enemyDmg);

      rounds.push({
        round: rounds.length + 1,
        playerDmg,
        enemyDmg: enemyHp > 0 ? enemyDmg : 0,
        playerHpLeft: playerHp,
        enemyHpLeft: enemyHp,
        playerCrit,
      });

      if (enemyHp <= 0 || playerHp <= 0) break;
    }

    const victory = enemyHp <= 0;
    return {
      rounds,
      victory,
      totalDmg,
      playerHpLeft: playerHp,
      expEarned: Math.floor(enemy.expReward + enemy.level * EXP_PER_KILL),
    };
  }

  /** Linear Congruential Generator — fast, deterministic, seedable */
  private lcgRng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = Math.imul(s, 1664525) + 1013904223;
      s >>>= 0;
      return s / 0xffffffff;
    };
  }
}
