import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

// Lazy-imported to avoid PixiJS loading before the canvas container mounts
async function createPixiScene(canvas: HTMLElement): Promise<() => void> {
  const { Application, Graphics, Text, TextStyle } = await import('pixi.js');

  const app = new Application();

  await app.init({
    width: canvas.clientWidth || window.innerWidth,
    height: canvas.clientHeight || window.innerHeight,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    backgroundColor: 0x0d0821,
    antialias: true,
  });

  canvas.appendChild(app.canvas);

  // ── Placeholder scene: animated void ring ────────────────────────────────
  const cx = app.screen.width / 2;
  const cy = app.screen.height / 2;

  const outerRing = new Graphics();
  outerRing.circle(cx, cy, 90);
  outerRing.stroke({ width: 2, color: 0x7c3aed, alpha: 0.5 });
  app.stage.addChild(outerRing);

  const innerRing = new Graphics();
  innerRing.circle(cx, cy, 60);
  innerRing.stroke({ width: 1.5, color: 0xa78bfa, alpha: 0.7 });
  app.stage.addChild(innerRing);

  const core = new Graphics();
  core.circle(cx, cy, 20);
  core.fill({ color: 0xa855f7, alpha: 0.35 });
  app.stage.addChild(core);

  const label = new Text({
    text: 'Riftborn Chronicles',
    style: new TextStyle({
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 15,
      fill: 0xa78bfa,
      align: 'center',
    }),
  });
  label.anchor.set(0.5);
  label.position.set(cx, cy + 115);
  app.stage.addChild(label);

  const subLabel = new Text({
    text: 'PixiJS v8 · Foundation Active',
    style: new TextStyle({
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: 11,
      fill: 0x6b7280,
      align: 'center',
    }),
  });
  subLabel.anchor.set(0.5);
  subLabel.position.set(cx, cy + 135);
  app.stage.addChild(subLabel);

  let tick = 0;
  app.ticker.add(() => {
    tick += 0.012;
    outerRing.rotation = tick * 0.4;
    innerRing.rotation = -tick * 0.7;
    core.alpha = 0.25 + Math.sin(tick * 2) * 0.15;
    label.alpha = 0.7 + Math.sin(tick) * 0.3;
  });
  // ─────────────────────────────────────────────────────────────────────────

  const handleResize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    app.renderer.resize(w, h);

    const ncx = w / 2;
    const ncy = h / 2;
    outerRing.position.set(ncx - cx, ncy - cy);
    innerRing.position.set(ncx - cx, ncy - cy);
    core.position.set(ncx - cx, ncy - cy);
    label.position.set(ncx, ncy + 115);
    subLabel.position.set(ncx, ncy + 135);
  };

  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
    app.destroy(true, { children: true });
  };
}

export function usePixiApp(containerRef: RefObject<HTMLDivElement>): void {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    createPixiScene(container).then((cleanup) => {
      if (cancelled) {
        cleanup();
        return;
      }
      cleanupRef.current = cleanup;
    });

    return () => {
      cancelled = true;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [containerRef]);
}
