import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Application } from 'pixi.js';
import { useMutation } from '@tanstack/react-query';
import { combatSceneApi } from '../api/combat-scene.api';
import { CombatScene } from '../game/scene/CombatScene';
import { notify } from '../store/notification.store';

export interface CombatSceneState {
  kills: number;
  requiredKills: number;
  bossUnlocked: boolean;
  bossActive: boolean;
  zoneCleared: boolean;
  zoneName: string;
  bossName: string;
  triggerBoss: () => void;
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

  // ── Kill enemy mutation ────────────────────────────────────────────────────

  const killMutation = useMutation({
    mutationFn: combatSceneApi.killEnemy,
    onSuccess: (data) => {
      setKills(data.kills);
      setBossUnlocked(data.bossUnlocked);
      if (data.leveledUp) notify.success(`⬆️ Level Up! Now level ${data.newLevel}`);
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
        {
          onEnemyKilled: (typeId) => {
            killMutation.mutate({ zone: zoneRef.current, enemyTypeId: typeId });
          },
        },
      );

      app.ticker.add((t) => scene.update(t.deltaMS));

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
    sceneRef.current.spawnBoss();

    void bossMutation
      .mutateAsync(zoneRef.current)
      .then((data) => {
        sceneRef.current?.resolveBoss(data.victory);
        setBossActive(false);

        if (data.victory && data.result) {
          setZoneCleared(true);
          notify.loot(`⚔️ Zone cleared! → ${data.result.newZoneName}`);

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
          }, 2600);
        } else {
          notify.error('The boss overpowered you. Grow stronger.');
          bossBusyRef.current = false;
        }
      })
      .catch(() => {
        sceneRef.current?.resolveBoss(false);
        setBossActive(false);
        bossBusyRef.current = false;
      });
  }, [bossUnlocked, bossMutation]);

  return {
    kills,
    requiredKills,
    bossUnlocked,
    bossActive,
    zoneCleared,
    zoneName,
    bossName,
    triggerBoss,
  };
}
