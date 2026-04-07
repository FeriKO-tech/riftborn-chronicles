import { apiClient } from './client';
import type { ApiSuccess, PvpFightResultDto, PvpStateDto } from '@riftborn/shared';

export const pvpApi = {
  getState: async (): Promise<PvpStateDto> => {
    const { data } = await apiClient.get<ApiSuccess<PvpStateDto>>('/pvp/state');
    return data.data;
  },

  fight: async (opponentPlayerId: string): Promise<PvpFightResultDto> => {
    const { data } = await apiClient.post<ApiSuccess<PvpFightResultDto>>('/pvp/fight', {
      opponentPlayerId,
    });
    return data.data;
  },

  refreshSnapshot: async (): Promise<void> => {
    await apiClient.post('/pvp/snapshot/refresh');
  },
};
