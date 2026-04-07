import { Test, TestingModule } from '@nestjs/testing';
import { CombatService } from './combat.service';
import { PlayerClass } from '@riftborn/shared';

describe('CombatService', () => {
  let service: CombatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CombatService],
    }).compile();

    service = module.get<CombatService>(CombatService);
  });

  // ── Player stats ─────────────────────────────────────────────────────────────

  describe('computePlayerStats', () => {
    it('returns sensible stats for level 1 Voidblade', () => {
      const stats = service.computePlayerStats(1, PlayerClass.VOIDBLADE);
      expect(stats.hp).toBeGreaterThan(0);
      expect(stats.attack).toBeGreaterThan(0);
      expect(stats.defense).toBeGreaterThan(0);
      expect(stats.critChance).toBeGreaterThan(0);
      expect(stats.critChance).toBeLessThanOrEqual(0.5);
      expect(stats.critDamage).toBeGreaterThan(1);
    });

    it('Aethermage has higher critDamage than Ironveil', () => {
      const mage = service.computePlayerStats(5, PlayerClass.AETHERMAGE);
      const tank = service.computePlayerStats(5, PlayerClass.IRONVEIL);
      expect(mage.critDamage).toBeGreaterThan(tank.critDamage);
    });

    it('higher level yields higher stats', () => {
      const lv1 = service.computePlayerStats(1, PlayerClass.VOIDBLADE);
      const lv10 = service.computePlayerStats(10, PlayerClass.VOIDBLADE);
      expect(lv10.attack).toBeGreaterThan(lv1.attack);
      expect(lv10.hp).toBeGreaterThan(lv1.hp);
    });

    it('Aethermage has higher attack than Ironveil at same level', () => {
      const mage = service.computePlayerStats(5, PlayerClass.AETHERMAGE);
      const tank = service.computePlayerStats(5, PlayerClass.IRONVEIL);
      expect(mage.attack).toBeGreaterThan(tank.attack);
    });

    it('Ironveil has higher defense and hp than Aethermage', () => {
      const mage = service.computePlayerStats(5, PlayerClass.AETHERMAGE);
      const tank = service.computePlayerStats(5, PlayerClass.IRONVEIL);
      expect(tank.defense).toBeGreaterThan(mage.defense);
      expect(tank.hp).toBeGreaterThan(mage.hp);
    });

    it('crit chance caps at 0.5', () => {
      const stats = service.computePlayerStats(1000, PlayerClass.AETHERMAGE);
      expect(stats.critChance).toBeLessThanOrEqual(0.5);
    });
  });

  // ── Battle simulation ──────────────────────────────────────────────────────

  describe('simulateRoom', () => {
    const weakEnemy = { id: 'e1', name: 'Wisp', level: 1, hp: 10, attack: 1, defense: 0, speed: 10, expReward: 10, goldReward: 5 };
    const strongEnemy = { id: 'e2', name: 'Boss', level: 100, hp: 9_999_999, attack: 99_999, defense: 50_000, speed: 9999, expReward: 1000, goldReward: 500 };

    it('wins against a very weak enemy', () => {
      const player = service.computePlayerStats(10, PlayerClass.VOIDBLADE);
      const result = service.simulateRoom(player, {
        zone: 1, room: 1, enemies: [weakEnemy], clearGoldBonus: 100,
      });
      expect(result.victory).toBe(true);
      expect(result.rounds.length).toBeGreaterThan(0);
      expect(result.goldEarned).toBeGreaterThan(0);
    });

    it('loses against an impossible enemy', () => {
      const player = service.computePlayerStats(1, PlayerClass.IRONVEIL);
      const result = service.simulateRoom(player, {
        zone: 99, room: 10, enemies: [strongEnemy], clearGoldBonus: 999,
      });
      expect(result.victory).toBe(false);
      expect(result.goldEarned).toBe(0);
    });

    it('earns no gold on defeat', () => {
      const player = service.computePlayerStats(1, PlayerClass.VOIDBLADE);
      const result = service.simulateRoom(player, {
        zone: 99, room: 10, enemies: [strongEnemy], clearGoldBonus: 500,
      });
      expect(result.goldEarned).toBe(0);
    });

    it('always earns some exp even on defeat', () => {
      const player = service.computePlayerStats(1, PlayerClass.VOIDBLADE);
      const result = service.simulateRoom(player, {
        zone: 99, room: 10, enemies: [strongEnemy], clearGoldBonus: 0,
      });
      expect(result.expEarned).toBeGreaterThan(0);
    });

    it('battle log has at least one round', () => {
      const player = service.computePlayerStats(5, PlayerClass.AETHERMAGE);
      const result = service.simulateRoom(player, {
        zone: 1, room: 1, enemies: [weakEnemy], clearGoldBonus: 0,
      });
      expect(result.rounds.length).toBeGreaterThanOrEqual(1);
      expect(result.rounds[0].round).toBe(1);
    });

    it('player wins faster when speed is 2x enemy speed (bonus attacks)', () => {
      // Use a powerful fast player vs a very slow enemy
      const fastPlayer = service.computePlayerStats(20, PlayerClass.VOIDBLADE); // high speed
      const slowEnemy = { id: 'e', name: 'Slug', level: 1, hp: 100, attack: 1, defense: 0, speed: 1, expReward: 10, goldReward: 5 };
      const opts = { zone: 1, room: 1, enemies: [slowEnemy], clearGoldBonus: 0 };
      const result = service.simulateRoom(fastPlayer, opts);
      expect(result.victory).toBe(true);
    });

    it('is deterministic for same zone+room combo', () => {
      const player = service.computePlayerStats(5, PlayerClass.VOIDBLADE);
      const opts = { zone: 2, room: 3, enemies: [weakEnemy, weakEnemy], clearGoldBonus: 50 };
      const r1 = service.simulateRoom(player, opts);
      const r2 = service.simulateRoom(player, opts);
      expect(r1.rounds.length).toBe(r2.rounds.length);
      expect(r1.victory).toBe(r2.victory);
    });
  });

  // ── Level-up ──────────────────────────────────────────────────────────────

  describe('computeLevelUp', () => {
    it('does not level up when exp < threshold', () => {
      const result = service.computeLevelUp(1, 0, 50);
      expect(result.newLevel).toBe(1);
      expect(result.leveledUp).toBe(false);
      expect(result.newExp).toBe(50);
    });

    it('levels up when exp meets threshold', () => {
      const threshold = service.expToNextLevel(1); // 100 for level 1
      const result = service.computeLevelUp(1, 0, threshold);
      expect(result.newLevel).toBe(2);
      expect(result.leveledUp).toBe(true);
    });

    it('handles multi-level-up in one battle', () => {
      const bigExp = service.expToNextLevel(1) + service.expToNextLevel(2) + 1;
      const result = service.computeLevelUp(1, 0, bigExp);
      expect(result.newLevel).toBeGreaterThanOrEqual(3);
      expect(result.leveledUp).toBe(true);
    });

    it('expToNextLevel scales up with level', () => {
      expect(service.expToNextLevel(5)).toBeGreaterThan(service.expToNextLevel(1));
      expect(service.expToNextLevel(10)).toBeGreaterThan(service.expToNextLevel(5));
    });
  });
});
