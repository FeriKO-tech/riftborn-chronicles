import { apiClient } from './client';
import type {
  ApiSuccess,
  ClaimOfflineRewardResponseDto,
  CombatStatsDto,
  HeartbeatResponseDto,
  OfflineRewardPreviewDto,
  PlayerStateDto,
} from '@riftborn/shared';

export const playerApi = {
  getState: async (): Promise<PlayerStateDto> => {
    const { data } = await apiClient.get<ApiSuccess<PlayerStateDto>>('/players/me');
    return data.data;
  },

  getOfflineRewardPreview: async (): Promise<OfflineRewardPreviewDto> => {
    const { data } = await apiClient.get<ApiSuccess<OfflineRewardPreviewDto>>(
      '/players/me/offline-rewards',
    );
    return data.data;
  },

  claimOfflineReward: async (): Promise<ClaimOfflineRewardResponseDto> => {
    const { data } = await apiClient.post<ApiSuccess<ClaimOfflineRewardResponseDto>>(
      '/players/me/offline-rewards/claim',
    );
    return data.data;
  },

  getMyStats: async (): Promise<CombatStatsDto> => {
    const { data } = await apiClient.get<ApiSuccess<CombatStatsDto>>('/players/me/stats');
    return data.data;
  },

  heartbeat: async (): Promise<HeartbeatResponseDto> => {
    const { data } = await apiClient.post<ApiSuccess<HeartbeatResponseDto>>(
      '/players/me/heartbeat',
    );
    return data.data;
  },
};
