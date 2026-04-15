import type { AchievementStateDto } from '@riftborn/shared';
import { apiClient } from './client';

export const achievementsApi = {
  getState: async (): Promise<AchievementStateDto> => {
    const { data } = await apiClient.get<{ data: AchievementStateDto }>('/achievements');
    return data.data;
  },
};
