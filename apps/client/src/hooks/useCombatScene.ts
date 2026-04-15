import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Application } from 'pixi.js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BossConfigDto } from '@riftborn/shared';
import { combatSceneApi } from '../api/combat-scene.api';
import { bossApi } from '../api/boss.api';
import { CombatScene } from '../game/scene/CombatScene';
import { notify } from '../store/notification.store';
import { PLAYER_STATE_KEY } from './usePlayerQuery';
import { STAGE_PROGRESS_KEY } from './useStageQuery';

export interface CombatSceneState {
  kills: number;
  requiredKills: number;
  bossUnlocked: boolean;
  bossActive: boolean;
  zoneCleared: boolean;
  zoneName: string;
  bossName: string;
  bossHpPercent: number;
  heroHpPercent: number;
  autoBoss: boolean;
  toggleAutoBoss: () => void;
  triggerBoss: () => void;
  triggerChallengeBoss: (boss: BossConfigDto) => void;
  useSkill: (skillId: string, dmgMult: number, cooldownMs: number) => void;
}

export function useCombatScene(
  containerRef: RefObject<HTMLDivElement>,
  playerClass: string,
  playerName: string,
): CombatSceneState {
  const appRef      = useRef<Application | null>(null);
  const sceneRef    = useRef<CombatScene | null>(null);
  const zoneRef     = useRef(1);
  const bossBusyRef = useRef(false);

  const [kills, setKills]                   = useState(0);
  const [requiredKills, setRequiredKills]    = useState(10);
  const [bossUnlocked, setBossUnlocked]      = useState(false);
  const [bossActive, setBossActive]          = useState(false);
  const [zoneCleared, setZoneCleared]        = useState(false);
  const [zoneName, setZoneName]              = useState('');
  const [bossName, setBossName]              = useState('');
  const [bossHpPercent, setBossHpPercent]    = useState(0);
  const [heroHpPercent, setHeroHpPercent]    = useState(1);
  const [autoBoss, setAutoBoss]              = useState(false);
  const autoBossRef = useRef(false);
  autoBossRef.current = autoBoss;

  const qc = useQueryClient();

  // ── Kill enemy mutation ────────────────────────────────────────────────────

  const killMutation = useMutation({
    mutationFn: combatSceneApi.killEnemy,
    onSuccess: (data) => {
      setKills(data.kills);
      setBossUnlocked(data.bossUnlocked);
      if (data.leveledUp) notify.success(`⬆️ Level Up! Now level ${data.newLevel}`);
      // Refresh player state so gold/exp/level update in the top HUD
      void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
    },
    onError: () => { /* silent — visual already played out */ },
  });

  // ── Boss fight mutation ────────────────────────────────────────────────────

  const bossMutation = useMutation({
    mutationFn: combatSceneApi.fightBoss,
  });

  // ── Init PixiJS + CombatScene (once, on mount) ─────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    void (async () => {
      const config = await combatSceneApi.getSceneConfig().catch((err) => {
        console.error('[CombatScene] getSceneConfig failed:', err);
        return null;
      });
      if (cancelled || !config) return;

      const { Application } = await import('pixi.js');
      const app = new Application();
      await app.init({
        width: 800,
        height: 460,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundColor: 0x0c0117,
        antialias: true,
      });
      if (cancelled) { app.destroy(true); return; }

      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      canvas.style.position = 'absolute';
      canvas.style.inset = '0';
      container.appendChild(canvas);

      // Resize to actual container dimensions after DOM insertion
      requestAnimationFrame(() => {
        const w = container.clientWidth || 800;
        const h = container.clientHeight || 460;
        if (w !== 800 || h !== 460) app.renderer.resize(w, h);
      });

      const scene = new CombatScene(
        app,
        config.definition,
        playerClass,
        playerName,
        config.heroStats,
        {
          onEnemyKilled: (typeId) => {
            killMutation.mutate({ zone: zoneRef.current, enemyTypeId: typeId });
          },
          onBossDefeated: () => {
            // Boss died in real combat — claim rewards from server
            void bossMutation.mutateAsync(zoneRef.current).then((data) => {
              setBossActive(false);
              if (data.victory && data.result) {
                setZoneCleared(true);
                const r = data.result.rewards;
                notify.loot(
                  `⚔️ Zone cleared! +${r.goldBonus.toLocaleString()} 🟡  +${r.expBonus.toLocaleString()} ✨  +${r.diamonds} 💎` +
                  (r.drop.dropped ? `  📦 ${r.drop.rarity} ${r.drop.itemName}` : '') +
                  `  → ${data.result.newZoneName}`,
                );
                // Spawn loot after a short delay for death animation
                if (r.drop.dropped && sceneRef.current) {
                  setTimeout(() => {
                    sceneRef.current?.spawnLootDrop(r.drop.itemName ?? 'Item', r.drop.rarity ?? 'COMMON');
                  }, 1200);
                }
                void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
                void qc.invalidateQueries({ queryKey: STAGE_PROGRESS_KEY });
                void qc.invalidateQueries({ queryKey: ['inventory'] });
                // Reset zone after loot pickup time
                setTimeout(() => {
                  void combatSceneApi.getSceneConfig().then((fresh) => {
                    if (!sceneRef.current) return;
                    sceneRef.current.resetZone(fresh.definition);
                    zoneRef.current = fresh.combatState.zone;
                    setKills(fresh.combatState.kills);
                    setRequiredKills(fresh.combatState.requiredKills);
                    setBossUnlocked(fresh.combatState.bossUnlocked);
                    setZoneName(fresh.definition.name);
                    setBossName(fresh.definition.bossName);
                    setZoneCleared(false);
                    bossBusyRef.current = false;
                  });
                }, 5000);
              }
            }).catch(() => {
              setBossActive(false);
              bossBusyRef.current = false;
              sceneRef.current?.resetBossState();
            });
          },
          onBossLost: () => {
            // Hero lost — stay on zone, keep farming
            setBossActive(false);
            bossBusyRef.current = false;
            notify.error('The boss overpowered you. Grow stronger!');
            // Auto-boss retry after 3s if enabled
            if (autoBossRef.current) {
              setTimeout(() => {
                if (autoBossRef.current && !bossBusyRef.current && sceneRef.current) {
                  bossBusyRef.current = true;
                  setBossActive(true);
                  sceneRef.current.spawnBoss();
                }
              }, 3000);
            }
          },
          onChallengeBossDefeated: (bossId: string) => {
            void bossApi.fight(bossId).then((data) => {
              setBossActive(false);
              bossBusyRef.current = false;
              if (data.victory && data.rewards) {
                const r = data.rewards;
                notify.success(`🎉 Victory! +${r.goldShards.toLocaleString()} 🟡  +${r.voidCrystals} 💎  +${r.expEarned} ✨`);
                void qc.invalidateQueries({ queryKey: PLAYER_STATE_KEY });
                void qc.invalidateQueries({ queryKey: ['boss-state'] });
              }
              // Return to normal combat
              setTimeout(() => {
                sceneRef.current?.resetBossState();
                combatSceneApi.getSceneConfig().then((fresh) => setBossName(fresh.definition.bossName)).catch(() => undefined);
              }, 3000);
            });
          },
          onChallengeBossLost: (bossId: string) => {
            void bossApi.fight(bossId).then((data) => {
              setBossActive(false);
              bossBusyRef.current = false;
              notify.error(`💀 Defeated. Boss hit for ${data.totalDamageDealt.toLocaleString()} dmg.`);
              void qc.invalidateQueries({ queryKey: ['boss-state'] });
              // Return to normal combat
              setTimeout(() => {
                sceneRef.current?.resetBossState();
                combatSceneApi.getSceneConfig().then((fresh) => setBossName(fresh.definition.bossName)).catch(() => undefined);
              }, 3000);
            });
          },
        },
      );

      app.ticker.add((t) => {
        scene.update(t.deltaMS);
        // Poll HP for HUD at ~10fps (every 6th frame at 60fps)
        if (Math.floor(t.lastTime / 100) !== Math.floor((t.lastTime - t.deltaMS) / 100)) {
          setBossHpPercent(scene.getBossHpPercent());
          setHeroHpPercent(scene.getHeroHpPercent());
        }
      });

      const handleResize = () => {
        const w = container.clientWidth || 800;
        const h = container.clientHeight || 460;
        app.renderer.resize(w, h);
        scene.handleResize();
      };
      window.addEventListener('resize', handleResize);

      appRef.current  = app;
      sceneRef.current = scene;
      zoneRef.current  = config.combatState.zone;

      setKills(config.combatState.kills);
      setRequiredKills(config.combatState.requiredKills);
      setBossUnlocked(config.combatState.bossUnlocked);
      setZoneName(config.definition.name);
      setBossName(config.definition.bossName);

      // Store cleanup on container so useEffect cleanup can call it
      (container as HTMLDivElement & { __csCleanup?: () => void }).__csCleanup = () => {
        window.removeEventListener('resize', handleResize);
        scene.destroy();
        app.destroy(true, { children: true });
      };
    })();

    return () => {
      cancelled = true;
      const el = container as HTMLDivElement & { __csCleanup?: () => void };
      el.__csCleanup?.();
      delete el.__csCleanup;
      appRef.current  = null;
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  // ── Trigger boss ───────────────────────────────────────────────────────────

  const triggerBoss = useCallback(() => {
    if (!sceneRef.current || !bossUnlocked || bossBusyRef.current) return;
    bossBusyRef.current = true;
    setBossActive(true);
    // Just spawn — real fight happens in CombatScene.
    // Callbacks (onBossDefeated / onBossLost) handle the rest.
    sceneRef.current.spawnBoss();
  }, [bossUnlocked]);

  // ── Auto-boss: when bossUnlocked flips to true and autoBoss is on ─────────
  useEffect(() => {
    if (bossUnlocked && autoBossRef.current && !bossBusyRef.current) {
      triggerBoss();
    }
  }, [bossUnlocked, triggerBoss]);

  const toggleAutoBoss = useCallback(() => setAutoBoss((v) => !v), []);

  const triggerChallengeBoss = useCallback((boss: BossConfigDto) => {
    if (bossBusyRef.current || !sceneRef.current) return;
    bossBusyRef.current = true;
    setBossActive(true);
    setBossName(boss.name); // temporarily override boss name for HUD
    sceneRef.current.spawnChallengeBoss(boss);
  }, []);

  const useSkill = useCallback((skillId: string, dmgMult: number, cooldownMs: number) => {
    sceneRef.current?.useSkill(dmgMult);
  }, []);

  return {
    kills,
    requiredKills,
    bossUnlocked,
    bossActive,
    zoneCleared,
    zoneName,
    bossName,
    bossHpPercent,
    heroHpPercent,
    autoBoss,
    toggleAutoBoss,
    triggerBoss,
    triggerChallengeBoss,
    useSkill,
  };
}
