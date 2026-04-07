import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export interface BattleSceneState {
  playerName: string;
  playerClass: string;
  playerHpPct: number;   // 0..1
  enemyName: string;
  enemyHpPct: number;    // 0..1
  battling: boolean;
}

// Class → accent color (hex number)
const CLASS_COLOR: Record<string, number> = {
  VOIDBLADE: 0x7c3aed,
  AETHERMAGE: 0x3b82f6,
  IRONVEIL: 0x6b7280,
};

async function createPixiScene(
  canvas: HTMLElement,
  stateRef: RefObject<BattleSceneState>,
): Promise<() => void> {
  const { Application, Container, Graphics, Text, TextStyle } = await import('pixi.js');

  const app = new Application();
  await app.init({
    width: canvas.clientWidth || 400,
    height: canvas.clientHeight || 300,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    backgroundColor: 0x0d0821,
    antialias: true,
  });
  canvas.appendChild(app.canvas);

  const W = app.screen.width;
  const H = app.screen.height;

  // ── Background grid (subtle) ──────────────────────────────────────────────
  const bg = new Graphics();
  const gridStep = 40;
  for (let x = 0; x < W; x += gridStep) {
    bg.moveTo(x, 0).lineTo(x, H);
  }
  for (let y = 0; y < H; y += gridStep) {
    bg.moveTo(0, y).lineTo(W, y);
  }
  bg.stroke({ width: 0.5, color: 0x1a0a3e, alpha: 0.6 });
  app.stage.addChild(bg);

  // ── VS divider ────────────────────────────────────────────────────────────
  const vsText = new Text({
    text: 'VS',
    style: new TextStyle({ fontFamily: 'Segoe UI, sans-serif', fontSize: 28, fontWeight: '900', fill: 0x4b5563 }),
  });
  vsText.anchor.set(0.5);
  vsText.position.set(W / 2, H / 2);
  app.stage.addChild(vsText);

  // ── Helper: build a fighter card ─────────────────────────────────────────
  function makeFighterCard(color: number, isEnemy: boolean) {
    const card = new Container();
    const cw = Math.min(120, W * 0.25);
    const ch = 140;

    // Glow
    const glow = new Graphics();
    glow.roundRect(-cw / 2, -ch / 2 - 4, cw, ch + 8, 14);
    glow.fill({ color, alpha: 0.12 });
    card.addChild(glow);

    // Body
    const body = new Graphics();
    body.roundRect(-cw / 2, -ch / 2, cw, ch, 12);
    body.fill({ color: isEnemy ? 0x1f0a10 : 0x0f0a1f });
    body.stroke({ width: 1.5, color, alpha: 0.6 });
    card.addChild(body);

    // Silhouette circle
    const sil = new Graphics();
    sil.circle(0, -20, 32);
    sil.fill({ color, alpha: 0.2 });
    sil.circle(0, -20, 32);
    sil.stroke({ width: 1.5, color, alpha: 0.8 });
    card.addChild(sil);

    // Center icon
    const icon = new Text({
      text: isEnemy ? '👾' : '⚔️',
      style: new TextStyle({ fontSize: 22 }),
    });
    icon.anchor.set(0.5);
    icon.position.set(0, -20);
    card.addChild(icon);

    // Name label
    const nameTag = new Text({
      text: isEnemy ? 'Enemy' : 'Player',
      style: new TextStyle({ fontFamily: 'Segoe UI, sans-serif', fontSize: 11, fill: 0xe8e0ff, fontWeight: '700' }),
    });
    nameTag.anchor.set(0.5);
    nameTag.position.set(0, 22);
    card.addChild(nameTag);

    // HP bar track
    const hpTrack = new Graphics();
    hpTrack.roundRect(-cw / 2 + 10, 42, cw - 20, 8, 4);
    hpTrack.fill({ color: 0x1a1a2e });
    card.addChild(hpTrack);

    // HP bar fill
    const hpFill = new Graphics();
    hpFill.roundRect(-cw / 2 + 10, 42, cw - 20, 8, 4);
    hpFill.fill({ color: isEnemy ? 0xf87171 : 0x4ade80 });
    card.addChild(hpFill);

    // HP label
    const hpLabel = new Text({
      text: 'HP',
      style: new TextStyle({ fontFamily: 'Segoe UI, sans-serif', fontSize: 9, fill: 0x6b7280 }),
    });
    hpLabel.anchor.set(0.5);
    hpLabel.position.set(0, 60);
    card.addChild(hpLabel);

    return { card, nameTag, hpFill, hpTrack, body, glow, cw };
  }

  // ── Player card (left) ────────────────────────────────────────────────────
  const playerColor = CLASS_COLOR[stateRef.current?.playerClass ?? 'VOIDBLADE'] ?? 0x7c3aed;
  const playerCard = makeFighterCard(playerColor, false);
  playerCard.card.position.set(W * 0.25, H / 2);
  app.stage.addChild(playerCard.card);

  // ── Enemy card (right) ────────────────────────────────────────────────────
  const enemyCard = makeFighterCard(0xf87171, true);
  enemyCard.card.position.set(W * 0.75, H / 2);
  app.stage.addChild(enemyCard.card);

  // ── Ticker ────────────────────────────────────────────────────────────────
  let tick = 0;
  let attackFlash = 0;

  app.ticker.add(() => {
    tick += 0.02;
    const state = stateRef.current;

    // Floating idle
    playerCard.card.y = H / 2 + Math.sin(tick) * 5;
    enemyCard.card.y = H / 2 + Math.sin(tick + Math.PI) * 5;

    // Update name labels
    if (state) {
      playerCard.nameTag.text = state.playerName || 'Player';
      enemyCard.nameTag.text = state.enemyName || 'Enemy';

      // HP bars
      const pHp = Math.max(0, Math.min(1, state.playerHpPct));
      const eHp = Math.max(0, Math.min(1, state.enemyHpPct));
      const barW = playerCard.cw - 20;

      playerCard.hpFill.clear();
      playerCard.hpFill.roundRect(-playerCard.cw / 2 + 10, 42, barW * pHp, 8, 4);
      playerCard.hpFill.fill({ color: pHp > 0.5 ? 0x4ade80 : pHp > 0.25 ? 0xfbbf24 : 0xf87171 });

      enemyCard.hpFill.clear();
      enemyCard.hpFill.roundRect(-enemyCard.cw / 2 + 10, 42, (enemyCard.cw - 20) * eHp, 8, 4);
      enemyCard.hpFill.fill({ color: 0xf87171 });

      // Attack flash
      if (state.battling && attackFlash <= 0) {
        attackFlash = 8;
      }
    }

    if (attackFlash > 0) {
      attackFlash--;
      const intensity = attackFlash / 8;
      playerCard.card.scale.set(1 + intensity * 0.08);
      playerCard.glow.alpha = 0.12 + intensity * 0.3;
    } else {
      playerCard.card.scale.set(1);
      playerCard.glow.alpha = 0.12;
    }

    // Pulse VS text
    vsText.alpha = 0.3 + Math.sin(tick * 0.8) * 0.15;
  });

  const handleResize = () => {
    const w = canvas.clientWidth || 400;
    const h = canvas.clientHeight || 300;
    app.renderer.resize(w, h);
    playerCard.card.position.set(w * 0.25, h / 2);
    enemyCard.card.position.set(w * 0.75, h / 2);
    vsText.position.set(w / 2, h / 2);
  };

  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
    app.destroy(true, { children: true });
  };
}

const DEFAULT_SCENE_STATE: BattleSceneState = {
  playerName: 'Hero',
  playerClass: 'VOIDBLADE',
  playerHpPct: 1,
  enemyName: 'Enemy',
  enemyHpPct: 1,
  battling: false,
};

export function usePixiApp(
  containerRef: RefObject<HTMLDivElement>,
  sceneStateRef?: RefObject<BattleSceneState>,
): void {
  const defaultRef = useRef<BattleSceneState>(DEFAULT_SCENE_STATE);
  const effectiveRef = sceneStateRef ?? defaultRef;
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    createPixiScene(container, effectiveRef).then((cleanup) => {
      if (cancelled) { cleanup(); return; }
      cleanupRef.current = cleanup;
    });

    return () => {
      cancelled = true;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);
}
