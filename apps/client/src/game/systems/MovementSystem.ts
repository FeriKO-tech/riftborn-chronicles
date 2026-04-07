// All coordinates are in reference-field space (800 × 460)

export interface MoveTarget {
  id: string;
  refX: number;
  refY: number;
}

export interface MoveResult {
  newRefX: number;
  newRefY: number;
  targetId: string | null;
  inAttackRange: boolean;
}

const HERO_SPEED = 160;  // px/s in reference space
const ATTACK_RANGE = 54; // px in reference space

export class MovementSystem {
  update(
    heroRefX: number,
    heroRefY: number,
    targets: MoveTarget[],
    deltaMs: number,
  ): MoveResult {
    if (targets.length === 0) {
      return { newRefX: heroRefX, newRefY: heroRefY, targetId: null, inAttackRange: false };
    }

    let nearest: MoveTarget = targets[0];
    let nearestDist = Infinity;
    for (const t of targets) {
      const d = Math.hypot(t.refX - heroRefX, t.refY - heroRefY);
      if (d < nearestDist) { nearestDist = d; nearest = t; }
    }

    if (nearestDist <= ATTACK_RANGE) {
      return { newRefX: heroRefX, newRefY: heroRefY, targetId: nearest.id, inAttackRange: true };
    }

    const dx = nearest.refX - heroRefX;
    const dy = nearest.refY - heroRefY;
    const dist = Math.hypot(dx, dy);
    const step = Math.min(HERO_SPEED * (deltaMs / 1000), dist);

    return {
      newRefX: heroRefX + (dx / dist) * step,
      newRefY: heroRefY + (dy / dist) * step,
      targetId: nearest.id,
      inAttackRange: false,
    };
  }
}
