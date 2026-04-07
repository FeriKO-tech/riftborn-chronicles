import axios from 'axios';
import type {
  KillEnemyRequestDto,
  KillEnemyResponseDto,
  ZoneClearResponseDto,
  ZoneSceneConfigDto,
} from '@riftborn/shared';

const BASE = '/api/v1/stages';

export const combatSceneApi = {
  getSceneConfig: (): Promise<ZoneSceneConfigDto> =>
    axios.get<ZoneSceneConfigDto>(`${BASE}/me/scene`).then((r) => r.data),

  killEnemy: (dto: KillEnemyRequestDto): Promise<KillEnemyResponseDto> =>
    axios.post<KillEnemyResponseDto>(`${BASE}/me/scene/kill`, dto).then((r) => r.data),

  fightBoss: (zone: number): Promise<{ victory: boolean; result: ZoneClearResponseDto | null }> =>
    axios
      .post<{ victory: boolean; result: ZoneClearResponseDto | null }>(
        `${BASE}/me/scene/boss`,
        { zone },
      )
      .then((r) => r.data),
};
