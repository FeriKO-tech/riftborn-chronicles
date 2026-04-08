import { apiClient } from './client';
import type {
  ApiSuccess,
  KillEnemyRequestDto,
  KillEnemyResponseDto,
  ZoneClearResponseDto,
  ZoneSceneConfigDto,
} from '@riftborn/shared';

export const combatSceneApi = {
  getSceneConfig: async (): Promise<ZoneSceneConfigDto> => {
    const { data } = await apiClient.get<ApiSuccess<ZoneSceneConfigDto>>('/stages/me/scene');
    return data.data;
  },

  killEnemy: async (dto: KillEnemyRequestDto): Promise<KillEnemyResponseDto> => {
    const { data } = await apiClient.post<ApiSuccess<KillEnemyResponseDto>>(
      '/stages/me/scene/kill',
      dto,
    );
    return data.data;
  },

  fightBoss: async (
    zone: number,
  ): Promise<{ victory: boolean; result: ZoneClearResponseDto | null }> => {
    const { data } = await apiClient.post<
      ApiSuccess<{ victory: boolean; result: ZoneClearResponseDto | null }>
    >('/stages/me/scene/boss', { zone });
    return data.data;
  },
};
