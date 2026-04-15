import type { LeaderboardResponseDto } from '@riftborn/shared';
import { apiClient } from './client';

export const leaderboardApi = {
  get: async (): Promise<LeaderboardResponseDto> => {
    const { data } = await apiClient.get<{ data: LeaderboardResponseDto }>('/leaderboard');
    return data.data;
  },
};
