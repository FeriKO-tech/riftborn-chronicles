import type { EnemyTypeDto, SpawnPointDto } from '@riftborn/shared';

export interface SpawnEvent {
  spawnPoint: SpawnPointDto;
  enemyType: EnemyTypeDto;
}

export class SpawnSystem {
  private accumulator = 0;
  private firstSpawnDone = false;

  reset(): void {
    this.accumulator = 0;
    this.firstSpawnDone = false;
  }

  update(
    deltaMs: number,
    liveCount: number,
    maxEnemies: number,
    intervalMs: number,
    spawnPoints: ReadonlyArray<SpawnPointDto>,
    enemyTypes: ReadonlyArray<EnemyTypeDto>,
  ): SpawnEvent | null {
    if (liveCount >= maxEnemies || spawnPoints.length === 0 || enemyTypes.length === 0) {
      if (liveCount >= maxEnemies) this.accumulator = Math.min(this.accumulator, intervalMs * 0.5);
      return null;
    }

    if (!this.firstSpawnDone) {
      this.firstSpawnDone = true;
      return this.pick(spawnPoints, enemyTypes);
    }

    this.accumulator += deltaMs;
    if (this.accumulator >= intervalMs) {
      this.accumulator -= intervalMs;
      return this.pick(spawnPoints, enemyTypes);
    }
    return null;
  }

  private pick(
    spawnPoints: ReadonlyArray<SpawnPointDto>,
    enemyTypes: ReadonlyArray<EnemyTypeDto>,
  ): SpawnEvent {
    const totalWeight = enemyTypes.reduce((s, t) => s + t.spawnWeight, 0);
    let r = Math.random() * totalWeight;
    let chosenType = enemyTypes[0];
    for (const t of enemyTypes) {
      r -= t.spawnWeight;
      if (r <= 0) { chosenType = t; break; }
    }
    const sp = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    return { spawnPoint: sp, enemyType: chosenType };
  }
}
